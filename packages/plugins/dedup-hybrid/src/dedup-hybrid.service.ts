import { Injectable, Logger } from '@nestjs/common';
import {
  CanonicalJob,
  DedupInputError,
  DedupMetrics,
  DedupResult,
  FieldWithProvenance,
  IDedupEngine,
  JobPostDto,
  Site,
  SourceObservation,
  provenance,
} from '@ever-jobs/models';
import { canonicalJobId, canonicalKey, normalizeCompany, normalizeLocation, normalizeTitle } from '@ever-jobs/common';

import { HashStrategy } from './strategies/hash-strategy';
import { MinHashStrategy } from './strategies/minhash-strategy';
import { ClusterPartition, DedupHybridOptions, IDedupStrategy, PreparedJob } from './types';
import { UnionFind } from './union-find';

/**
 * Raw `JobPostDto` keys already materialised into `fields` with a
 * normalized value (`title`/`companyName`/`location`/`jobUrl`/`description`),
 * plus `rawResponse` (kept only on `SourceObservation`, not duplicated
 * into `fields`). Everything else on the winning raw job is carried
 * through generically — see the loop in `dedup()`.
 */
const RAW_FIELDS_HANDLED = new Set([
  'title',
  'companyName',
  'location',
  'jobUrl',
  'description',
  'rawResponse',
]);

/**
 * Forward tolerance applied by {@link clampImplausibleFutureDate} — absorbs
 * legitimate timezone skew between a source and this process (e.g. a
 * source reporting "today" in a timezone that's already tomorrow UTC).
 * Anything further out than this is treated as a malformed upstream date
 * (most commonly a locale mismatch — e.g. a source emitting `DD/MM/YYYY`
 * that got parsed as `MM/DD/YYYY`, silently swapping month and day) rather
 * than a real future-dated posting.
 */
const FUTURE_DATE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * `value`, unless it parses as a date more than {@link FUTURE_DATE_TOLERANCE_MS}
 * ahead of now — in which case it's a parsing/scraping artifact (a source
 * doesn't post as-yet-unposted jobs), not a genuinely future-dated posting,
 * and gets clamped to today's date instead. Keeps a single misbehaving
 * source (a bad `datePosted` parse) from contaminating the canonical field
 * — and, transitively, the export payload built from it
 * (`AdminController.toExportPayload` in `apps/api`) — while still leaving
 * the field populated rather than dropping it. Non-string / unparseable
 * values are returned unchanged; they're not this guard's concern.
 */
function clampImplausibleFutureDate(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  if (parsed <= Date.now() + FUTURE_DATE_TOLERANCE_MS) return value;
  return new Date().toISOString().slice(0, 10);
}

/**
 * Default hybrid dedup engine — Spec 003 / FR-1.
 *
 * Pipeline (each stage further merges clusters from the previous stage):
 *
 *  1. {@link HashStrategy} — exact `canonicalJobId` bucketing (O(N), fast path).
 *  2. {@link MinHashStrategy} — MinHash + LSH near-duplicate detection on
 *     long-form text (description, falling back to title + company).
 *
 * The service:
 *  - validates inputs (rejects entries missing `title` or `companyName`)
 *  - prepares each input once (canonical key + id)
 *  - runs strategies in order, unioning partitions via {@link UnionFind}
 *  - emits one `CanonicalJob` per cluster, picking the first observation as
 *    the field winner (replaced by `IMergeResolver` when Phase 4 lands)
 *  - returns a `DedupResult` envelope with assignments + metrics
 */
@Injectable()
export class DedupHybridService implements IDedupEngine {
  private readonly logger = new Logger(DedupHybridService.name);
  private readonly strategies: ReadonlyArray<IDedupStrategy> = [
    new HashStrategy(),
    new MinHashStrategy(),
  ];
  private readonly options: Required<DedupHybridOptions> = {
    rejectInvalid: true,
  };

  async dedup(jobs: ReadonlyArray<JobPostDto>): Promise<DedupResult> {
    const start = Date.now();
    const errors: DedupInputError[] = [];
    const prepared: PreparedJob[] = [];
    const inputCount = jobs.length;

    // Pass 1 — validate + prepare. We keep `prepared` indices contiguous so
    // strategies can use a typed-array Union-Find later.
    for (let i = 0; i < inputCount; i++) {
      const raw = jobs[i];
      if (!raw || !raw.title || !raw.companyName) {
        if (this.options.rejectInvalid) {
          errors.push({
            inputIndex: i,
            code: 'ERR_DEDUP_INVALID_INPUT',
            message: 'job is missing required title or companyName',
          });
          continue;
        }
      }

      const keyInput = {
        title: raw.title ?? '',
        company: raw.companyName ?? '',
        location: raw.location ? formatLocation(raw.location) : '',
      };
      prepared.push({
        index: i,
        canonicalKey: canonicalKey(keyInput),
        canonicalJobId: canonicalJobId(keyInput),
        raw,
      });
    }

    // Pass 2 — run strategies; union all partitions in a single Union-Find.
    const uf = new UnionFind(prepared.length);
    const indexToPos = new Map<number, number>();
    for (let pos = 0; pos < prepared.length; pos++) {
      indexToPos.set(prepared[pos].index, pos);
    }
    for (const strategy of this.strategies) {
      const partition: ClusterPartition = strategy.cluster(prepared);
      for (const cluster of partition.clusters) {
        if (cluster.length < 2) continue;
        const headPos = indexToPos.get(cluster[0]);
        if (headPos === undefined) continue;
        for (let k = 1; k < cluster.length; k++) {
          const nextPos = indexToPos.get(cluster[k]);
          if (nextPos !== undefined) uf.union(headPos, nextPos);
        }
      }
    }

    // Pass 3 — materialise canonical records.
    const clusters = uf.toClusters();
    const mergedAt = new Date().toISOString();
    const canonical: CanonicalJob[] = [];
    const assignments: (string | null)[] = new Array(inputCount).fill(null);

    for (const cluster of clusters) {
      const observations: SourceObservation[] = [];
      const head = prepared[cluster[0]];
      const fields: Record<string, FieldWithProvenance<unknown>> = {};

      for (const pos of cluster) {
        const job = prepared[pos];
        const obs = jobToObservation(job.raw);
        if (obs) observations.push(obs);
      }

      // Phase-3 default merge: head wins for every field. Phase 4 introduces
      // `IMergeResolver` for ATS > company > board > niche precedence.
      const headSite = (head.raw.site as Site) ?? observations[0]?.site ?? Site.LINKEDIN;
      const headSourceId = String(head.raw.id ?? observations[0]?.sourceJobId ?? '');
      const observedAt = observations[0]?.observedAt ?? mergedAt;

      const titleVal = normalizeTitle(head.raw.title ?? '');
      const companyVal = normalizeCompany(head.raw.companyName ?? '');
      const locationVal = head.raw.location ? normalizeLocation(formatLocation(head.raw.location)) : '';

      fields['title'] = provenance(titleVal, headSite, headSourceId, observedAt);
      fields['company'] = provenance(companyVal, headSite, headSourceId, observedAt);
      fields['location'] = provenance(locationVal, headSite, headSourceId, observedAt);
      fields['url'] = provenance(head.raw.jobUrl ?? '', headSite, headSourceId, observedAt);
      if (head.raw.description) {
        fields['description'] = provenance(head.raw.description, headSite, headSourceId, observedAt);
      }
      // Every other populated field on the winning source's raw JobPostDto
      // (compensation, jobType, datePosted, skills, department, ...) —
      // carried through generically so the admin detail view (and any
      // other `fields` consumer) sees everything the scraper returned,
      // not just the handful of identity fields above. `RAW_FIELDS_HANDLED`
      // skips keys already set (with normalized values) above, plus
      // `rawResponse`, which is carried separately on `SourceObservation`
      // and would otherwise duplicate a potentially large blob here.
      for (const [key, value] of Object.entries(head.raw)) {
        if (RAW_FIELDS_HANDLED.has(key) || value === null || value === undefined) {
          continue;
        }
        let fieldValue = value;
        if (key === 'datePosted') {
          fieldValue = clampImplausibleFutureDate(value);
          if (fieldValue !== value) {
            this.logger.warn(
              `Clamping implausible future datePosted "${String(value)}" from ` +
                `${headSite}/${headSourceId} to today's date — likely a source-side date-parsing bug`,
            );
          }
        }
        fields[key] = provenance(fieldValue, headSite, headSourceId, observedAt);
      }

      const record: CanonicalJob = {
        canonicalJobId: head.canonicalJobId,
        title: titleVal,
        company: companyVal,
        location: locationVal,
        description: head.raw.description ?? undefined,
        // `jobUrl` is typed as required on JobPostDto, but that's a
        // compile-time assertion, not a runtime guarantee — a scraper bug
        // can still produce a job without one. Falling back to '' (same
        // pattern as `location` above) means one malformed posting loses
        // its deep link, not its entire persistence batch (the `url`
        // column is NOT NULL in both SQL backends).
        url: head.raw.jobUrl ?? '',
        sources: observations,
        fields,
        mergedAt,
      };
      canonical.push(record);

      for (const pos of cluster) {
        assignments[prepared[pos].index] = head.canonicalJobId;
      }
    }

    const metrics: DedupMetrics = {
      inputCount,
      outputCount: canonical.length,
      mergedPairs: prepared.length - canonical.length,
      elapsedMs: Date.now() - start,
    };

    if (errors.length > 0) {
      this.logger.warn(
        `dedup rejected ${errors.length} of ${inputCount} inputs (missing title/company)`,
      );
    }

    return {
      canonical,
      assignments,
      errors,
      metrics,
    };
  }
}

/**
 * Build a `SourceObservation` from a `JobPostDto`. Returns `null` if the DTO
 * lacks the bare-minimum identity fields (`site`, `jobUrl`).
 *
 * `observedAt` is always "now" (scrape time) — per the `SourceObservation`
 * contract ("ISO-8601 timestamp when the plugin observed the job"), NOT the
 * source's self-reported posting date. Using `datePosted` here previously
 * conflated the two: a malformed/future-dated `datePosted` from one
 * misbehaving source (e.g. a locale-mismatched date parse) silently
 * corrupted every field's provenance timestamp on the canonical record.
 */
function jobToObservation(raw: JobPostDto): SourceObservation | null {
  if (!raw.site || !raw.jobUrl) return null;
  return {
    site: raw.site as Site,
    sourceJobId: String(raw.id ?? raw.atsId ?? raw.jobUrl),
    url: raw.jobUrl,
    observedAt: new Date().toISOString(),
    rawTitle: raw.title,
    rawResponse: raw.rawResponse ?? undefined,
  };
}

/**
 * Render `LocationDto` into the flat string the canonicaliser expects.
 * `displayLocation()` is the canonical UI rendering already; we lean on it
 * here to avoid drifting from the user-visible shape.
 */
function formatLocation(loc: NonNullable<JobPostDto['location']>): string {
  if (typeof (loc as { displayLocation?: () => string }).displayLocation === 'function') {
    return (loc as { displayLocation: () => string }).displayLocation();
  }
  const parts: string[] = [];
  if (loc.city) parts.push(loc.city);
  if (loc.state) parts.push(loc.state);
  if (loc.country) parts.push(typeof loc.country === 'string' ? loc.country : String(loc.country));
  return parts.join(', ');
}
