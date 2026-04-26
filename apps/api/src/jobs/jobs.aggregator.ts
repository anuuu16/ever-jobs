import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  DEDUP_ENGINE_TOKEN,
  DedupMetrics,
  IDedupEngine,
  JobPostDto,
  ScraperInputDto,
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
}

/**
 * Thin orchestration layer between {@link JobsService} (fan-out) and the
 * dedup engine (Spec 003 / Phase 5).
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
 *      established by `JobsService` (site asc, then datePosted desc).
 *
 * The engine binding is **optional** so that environments that haven't
 * imported `DedupHybridModule` (or that swap it for a no-op via DI) keep
 * working. When no engine is bound the aggregator is a pass-through.
 */
@Injectable()
export class JobsAggregator {
  private readonly logger = new Logger(JobsAggregator.name);

  constructor(
    private readonly jobsService: JobsService,
    @Optional() @Inject(DEDUP_ENGINE_TOKEN) private readonly dedupEngine?: IDedupEngine,
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
   * Apply (or skip) dedup on an already-fanned-out list.
   *
   * The controller uses this overload to keep the `cache → dedup` order:
   *   1. cache lookup (raw) — fast path
   *   2. fan-out via `JobsService` on miss
   *   3. cache write (raw) — keeps cache invalidation independent of
   *      dedup-engine version changes
   *   4. dedup pass per-request (this method)
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

    return {
      jobs: deduped,
      rawCount,
      outputCount: deduped.length,
      deduped: true,
      dedupMetrics: result.metrics,
    };
  }
}
