import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  CanonicalJob,
  DEDUP_ENGINE_TOKEN,
  DedupMetrics,
  IDedupEngine,
  IJobObservationStore,
  IJobStore,
  JOB_OBSERVATION_STORE_TOKEN,
  JOB_STORE_TOKEN,
  JobPostDto,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';
import { JobsService } from './jobs.service';

/**
 * Per-call options for {@link JobsAggregator.aggregate} /
 * {@link JobsAggregator.aggregateRaw}.
 */
export interface AggregateOptions {
  /**
   * Run the bound `IDedupEngine` over the fan-out result. Default: `true`
   * when an engine is bound (Spec 003 / Phase 5 migration plan).
   *
   * Setting `dedup=false` returns the raw fan-out unchanged — the only
   * supported way for legacy clients to opt out of dedup.
   */
  readonly dedup?: boolean;

  /**
   * Persist post-dedup canonical records (and their source observations)
   * via the bound `IJobStore` / `IJobObservationStore` (Spec 004 / T11).
   * Default: `true`.
   *
   * Persistence is best-effort: a backend-down blip MUST NOT turn a
   * successful search into a 500. Failures surface via
   * {@link AggregateResult.persistError} so callers / dashboards / metrics
   * can observe them without coupling to the response status code.
   *
   * Setting `persist=false` short-circuits the side-effect entirely —
   * useful for ephemeral / preview searches and for tests that don't
   * care about the store. Per Q-018 (run #25), `persist=true` with no
   * store bound is also a silent no-op (matches the dedup precedent:
   * "when nothing is bound the aggregator is a pass-through").
   */
  readonly persist?: boolean;
}

/**
 * Envelope returned by the aggregator. The shape is intentionally additive:
 * `jobs` is always populated (raw or deduped) so existing controller code
 * keeps working without conditional handling.
 */
export interface AggregateResult {
  /** Final job list — deduped when `dedup=true` and an engine is bound. */
  readonly jobs: JobPostDto[];
  /** Pre-dedup count. Equals `rawJobs.length`. */
  readonly rawCount: number;
  /** Post-dedup count. Equals `jobs.length`. */
  readonly outputCount: number;
  /** `true` iff the dedup engine actually ran. */
  readonly deduped: boolean;
  /** Populated only when {@link deduped} is `true`. */
  readonly dedupMetrics?: DedupMetrics;
  /**
   * `true` iff a backend was bound, `persist` was not opted out, and
   * the upsertMany call succeeded. Spec 004 / T11.
   */
  readonly persisted?: boolean;
  /**
   * Insert / update accounting from `IJobStore.upsertMany`. Populated
   * only when {@link persisted} is `true` and the active backend
   * advertises real counts (in-memory backends always return
   * `{ inserted, updated }`; Postgres / SQLite return real `ON CONFLICT`
   * counts).
   */
  readonly persistCounts?: { readonly inserted: number; readonly updated: number };
  /**
   * Populated only when persistence was attempted AND failed (i.e.
   * `persist=true`, a store WAS bound, and upsertMany / putAll
   * rejected). Carries the wire-stable error code (`ERR_STORE_BACKEND_DOWN`
   * / `ERR_STORE_INVALID_CURSOR` / generic `ERR_STORE_PERSIST_FAILED`)
   * plus the message. Operators read this from logs / metrics; callers
   * can surface it as a response header without blocking the response
   * body.
   */
  readonly persistError?: { readonly code: string; readonly message: string };
}

/**
 * Generic fallback error code surfaced via {@link AggregateResult.persistError}
 * when the underlying backend rejection lacks a structured `.code`.
 * Distinct from the well-known Spec 004 §7.3 codes
 * (`ERR_STORE_NOT_FOUND` / `ERR_STORE_BACKEND_DOWN` / `ERR_STORE_INVALID_CURSOR`)
 * so log queries can grep "ERR_STORE_PERSIST_FAILED" specifically when
 * triaging aggregator-side persistence drops.
 */
export const ERR_STORE_PERSIST_FAILED = 'ERR_STORE_PERSIST_FAILED';

/** Per-site breakdown entry returned by {@link JobsAggregator.aggregateIncremental}. */
export interface PerSiteAggregateResult {
  readonly site: Site;
  readonly rawCount: number;
  readonly outputCount: number;
  readonly persisted?: boolean;
  readonly persistError?: { readonly code: string; readonly message: string };
}

/** Result of {@link JobsAggregator.aggregateIncremental} — `AggregateResult` plus the per-site trail. */
export interface AggregateIncrementalResult extends AggregateResult {
  readonly perSite: ReadonlyArray<PerSiteAggregateResult>;
}

/**
 * Thin orchestration layer between {@link JobsService} (fan-out), the
 * dedup engine (Spec 003 / Phase 5), and the persistent store
 * (Spec 004 / Phase 5).
 *
 * The aggregator is intentionally minimal — it does **not** own caching,
 * salary post-processing, or sorting (those still live in `JobsService`).
 * It only:
 *
 *   1. delegates fan-out to `JobsService.searchJobs`;
 *   2. invokes the bound `IDedupEngine` (if present and the caller didn't
 *      opt out) to collapse near-duplicates across sources;
 *   3. picks the **first** raw `JobPostDto` per canonical cluster as the
 *      "winning" representative — this preserves the input sort order
 *      established by `JobsService` (site asc, then datePosted desc);
 *   4. (Spec 004 / T11) persists the post-dedup `CanonicalJob[]` plus
 *      their `SourceObservation[]` via the bound `IJobStore` /
 *      `IJobObservationStore`, **best-effort**: any backend failure is
 *      logged and surfaced via {@link AggregateResult.persistError} but
 *      MUST NOT fail the request. Persistence runs only when an engine
 *      is bound (i.e. dedup actually produced a `canonical[]` list);
 *      pure pass-through paths skip persistence by construction.
 *
 * The engine and store bindings are **optional** so that environments
 * that haven't imported `DedupHybridModule` / `StoreModule.forActive` (or
 * that swap them for no-ops via DI) keep working. When no engine is
 * bound the aggregator is a pass-through. When no store is bound
 * persistence is silently a no-op (Q-018 / run #25).
 */
@Injectable()
export class JobsAggregator {
  private readonly logger = new Logger(JobsAggregator.name);

  constructor(
    private readonly jobsService: JobsService,
    @Optional() @Inject(DEDUP_ENGINE_TOKEN) private readonly dedupEngine?: IDedupEngine,
    @Optional() @Inject(JOB_STORE_TOKEN) private readonly jobStore?: IJobStore,
    @Optional() @Inject(JOB_OBSERVATION_STORE_TOKEN)
    private readonly observationStore?: IJobObservationStore,
  ) {}

  /**
   * Fan-out then optionally dedup.
   *
   * Use this when you have an input DTO and want the full pipeline.
   */
  async aggregate(
    input: ScraperInputDto,
    options: AggregateOptions = {},
  ): Promise<AggregateResult> {
    const rawJobs = await this.jobsService.searchJobs(input);
    return this.aggregateRaw(rawJobs, options);
  }

  /**
   * Same pipeline as {@link aggregate}, but dedup+persist happens PER
   * SITE, as soon as that site's scrape settles, instead of waiting for
   * every selected site to finish before doing one combined dedup+persist.
   *
   * Trade-off (deliberately chosen over `aggregate`'s cross-site dedup):
   * a job posted on two different sites (e.g. LinkedIn AND Indeed) is no
   * longer merged into one canonical record with two source observations
   * — each site's batch is deduped only against itself, so the same
   * posting seen on N sites becomes N separate canonical rows. In
   * exchange, a broad multi-site run persists incrementally (each site's
   * results land in the store as soon as that site finishes) rather than
   * making the caller wait for the single slowest site before ANY row is
   * saved — the pain point this method exists to fix.
   *
   * Reuses {@link aggregateRaw} unchanged, once per site — no dedup/
   * persist logic is duplicated here.
   */
  async aggregateIncremental(
    input: ScraperInputDto,
    options: AggregateOptions = {},
  ): Promise<AggregateIncrementalResult> {
    const jobs: JobPostDto[] = [];
    const perSite: PerSiteAggregateResult[] = [];
    let rawCount = 0;
    let deduped = false;
    let anyPersisted = false;
    let insertedTotal = 0;
    let updatedTotal = 0;
    let sitesFailedToPersist = 0;

    await this.jobsService.searchJobsIncremental(input, async (site, siteJobs) => {
      const result = await this.aggregateRaw(siteJobs, options);

      rawCount += result.rawCount;
      deduped = deduped || result.deduped;
      jobs.push(...result.jobs);
      if (result.persisted) {
        anyPersisted = true;
        insertedTotal += result.persistCounts?.inserted ?? 0;
        updatedTotal += result.persistCounts?.updated ?? 0;
      }
      if (result.persistError) sitesFailedToPersist++;

      this.logger.log(
        `[incremental] ${site}: ${result.rawCount} raw → ${result.outputCount} deduped` +
          (result.persisted
            ? `, persisted (+${result.persistCounts?.inserted ?? 0}/${result.persistCounts?.updated ?? 0})`
            : result.persistError
              ? `, persist FAILED: ${result.persistError.message}`
              : ''),
      );

      perSite.push({
        site,
        rawCount: result.rawCount,
        outputCount: result.outputCount,
        persisted: result.persisted,
        persistError: result.persistError,
      });
    });

    return {
      jobs,
      rawCount,
      outputCount: jobs.length,
      deduped,
      persisted: anyPersisted,
      persistCounts: anyPersisted ? { inserted: insertedTotal, updated: updatedTotal } : undefined,
      persistError: sitesFailedToPersist > 0
        ? {
            code: ERR_STORE_PERSIST_FAILED,
            message: `${sitesFailedToPersist} of ${perSite.length} site(s) failed to persist — see perSite for details`,
          }
        : undefined,
      perSite,
    };
  }

  /**
   * Apply (or skip) dedup on an already-fanned-out list.
   *
   * The controller uses this overload to keep the `cache → dedup` order:
   *   1. cache lookup (raw) — fast path
   *   2. fan-out via `JobsService` on miss
   *   3. cache write (raw) — keeps cache invalidation independent of
   *      dedup-engine version changes
   *   4. dedup pass per-request (this method)
   *   5. (T11) persist post-dedup canonical + observations
   */
  async aggregateRaw(
    rawJobs: JobPostDto[],
    options: AggregateOptions = {},
  ): Promise<AggregateResult> {
    const rawCount = rawJobs.length;
    const wantDedup = options.dedup ?? true;

    if (!wantDedup) {
      return {
        jobs: rawJobs,
        rawCount,
        outputCount: rawCount,
        deduped: false,
      };
    }
    if (!this.dedupEngine) {
      this.logger.debug(
        'No IDedupEngine bound under DEDUP_ENGINE_TOKEN — returning raw list',
      );
      return {
        jobs: rawJobs,
        rawCount,
        outputCount: rawCount,
        deduped: false,
      };
    }
    if (rawCount === 0) {
      return {
        jobs: rawJobs,
        rawCount,
        outputCount: 0,
        deduped: true,
        dedupMetrics: {
          inputCount: 0,
          outputCount: 0,
          mergedPairs: 0,
          elapsedMs: 0,
        },
      };
    }

    const result = await this.dedupEngine.dedup(rawJobs);

    // Pick the first raw job per canonical cluster. We iterate the input
    // (which is already sorted by `JobsService`) so the representative
    // is the most-recent-on-the-best-site entry — and the output keeps
    // the same site/date ordering as a non-deduped response.
    const seen = new Set<string>();
    const deduped: JobPostDto[] = [];
    for (let i = 0; i < rawJobs.length; i++) {
      const canonId = result.assignments[i];
      if (!canonId) continue; // rejected by engine
      if (seen.has(canonId)) continue;
      seen.add(canonId);
      deduped.push(rawJobs[i]);
    }

    this.logger.log(
      `dedup: ${rawCount} → ${deduped.length} (merged ${result.metrics.mergedPairs} pairs in ${result.metrics.elapsedMs}ms)`,
    );

    const persistOutcome = await this.maybePersist(result.canonical, options);

    return {
      jobs: deduped,
      rawCount,
      outputCount: deduped.length,
      deduped: true,
      dedupMetrics: result.metrics,
      ...persistOutcome,
    };
  }

  /**
   * Best-effort persistence of the post-dedup canonical records and their
   * source observations. Spec 004 / T11 + Q-018 (run #25, Option A).
   *
   * Returns a partial {@link AggregateResult} carrying only the
   * persistence-related fields, ready to spread into the final result
   * envelope. The four outcomes are:
   *
   *   - `persist=false` opt-out → no fields (consumer sees `persisted`
   *     and friends as `undefined`).
   *   - No `IJobStore` bound → no fields. Matches the dedup-engine
   *     precedent of silently skipping when nothing is wired.
   *   - Empty canonical list → no fields. Avoids a `upsertMany([])`
   *     round-trip on every all-rejected dedup pass.
   *   - Bound + non-empty → attempt `upsertMany` and (when an
   *     observation store is bound and the canonical record carries
   *     observations) `putAll`. Success → `persisted: true` +
   *     `persistCounts`. Failure → `persisted: false` + structured
   *     `persistError`. Errors are caught here and NEVER bubble.
   */
  private async maybePersist(
    canonical: ReadonlyArray<CanonicalJob>,
    options: AggregateOptions,
  ): Promise<Partial<AggregateResult>> {
    const wantPersist = options.persist ?? true;
    if (!wantPersist) return {};
    if (!this.jobStore) {
      this.logger.debug(
        'No IJobStore bound under JOB_STORE_TOKEN — skipping persistence',
      );
      return {};
    }
    if (canonical.length === 0) return {};

    try {
      const counts = await this.jobStore.upsertMany(canonical);
      // Observations are best-effort within best-effort: a successful
      // canonical upsert is the load-bearing write; observation putAll
      // failures degrade to "canonical persisted, observations stale"
      // rather than nuking the persisted flag. We capture per-record
      // failures via `Promise.allSettled` so one bad row doesn't drop
      // the rest.
      if (this.observationStore) {
        await Promise.allSettled(
          canonical.map((c) =>
            this.observationStore!.putAll(c.canonicalJobId, c.sources ?? []),
          ),
        );
      }
      this.logger.log(
        `persisted: ${canonical.length} canonical records ` +
          `(inserted=${counts.inserted}, updated=${counts.updated})`,
      );
      return {
        persisted: true,
        persistCounts: counts,
      };
    } catch (err) {
      const code = readErrorCode(err);
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `persist failed: ${code} — ${message}. Search response continues.`,
      );
      return {
        persisted: false,
        persistError: { code, message },
      };
    }
  }
}

/**
 * Read the structured `.code` off an error rejection, falling back to
 * {@link ERR_STORE_PERSIST_FAILED} when the rejection is a bare `Error`
 * or non-error value. Stays in this file rather than `@ever-jobs/common`
 * because the only caller is the persistence-failure path above.
 */
function readErrorCode(err: unknown): string {
  if (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  ) {
    return (err as { code: string }).code;
  }
  return ERR_STORE_PERSIST_FAILED;
}
