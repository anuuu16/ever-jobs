import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  EXPORTED_JOB_STORE_TOKEN,
  IExportedJobStore,
  IRunStateStore,
  JobPostDto,
  RUN_STATE_STORE_TOKEN,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';
import { JobsAggregator } from './jobs.aggregator';

/**
 * Config shape read from `ConfigService.get('dailyExport')`. Mirrors the
 * `dailyExport` block added to `apps/api/src/config/configuration.ts`.
 */
export interface DailyExportConfig {
  readonly enabled: boolean;
  readonly intervalMs: number;
  readonly siteNames: string[];
  readonly searchTerm?: string;
  readonly location?: string;
  readonly isRemote: boolean;
  readonly resultsWanted: number;
  /** Explicit override — wins outright over the dynamic lookback below. */
  readonly hoursOld?: number;
  readonly firstRunLookbackHours: number;
  readonly maxLookbackHours: number;
  readonly lookbackOverlapMinutes: number;
  readonly retentionDays: number;
  readonly targetUrl?: string;
  readonly targetMethod: string;
  readonly targetHeaders: Record<string, string>;
  readonly targetTimeoutMs: number;
  readonly dir: string;
  readonly format: string;
}

/** Default cadence when `DAILY_EXPORT_INTERVAL_MS` is unset or invalid: 24h. */
export const DEFAULT_DAILY_EXPORT_INTERVAL_MS = 86_400_000;

/**
 * `key` this cron uses in `IRunStateStore` — one watermark for the whole
 * scheduled tick (which fans out across every configured site in a single
 * `aggregate()` call). Manual admin-triggered runs (`AdminController.run()`
 * / `runCompanies()`) intentionally do NOT read or write this key — they
 * stay ad-hoc/operator-driven, so there's one clear owner of "last
 * successful run."
 */
export const DAILY_EXPORT_RUN_STATE_KEY = 'daily-export';

/**
 * Compute the `hoursOld` search window for one tick.
 *
 * Precedence:
 *   1. `explicitHoursOld` set → returned unchanged (today's static
 *      behaviour, for operators who want a fixed window).
 *   2. `lastRunAt === null` (first run ever, or no `IRunStateStore` bound)
 *      → `firstRunLookbackHours`, capped at `maxLookbackHours`.
 *   3. Otherwise → hours elapsed since `lastRunAt`, plus a small overlap
 *      (duplicates are absorbed by `IExportedJobStore` dedup, so overlap
 *      is free), clamped to `[1, maxLookbackHours]` — the cap guards
 *      against a long-dead cron or clock skew triggering a huge fetch.
 *
 * Pure function — exported so it gets direct unit tests without mocking
 * the cron/store, mirroring this file's existing small-helper style
 * (see `normaliseInterval`).
 */
export function computeDynamicHoursOld(params: {
  readonly explicitHoursOld: number | undefined;
  readonly lastRunAt: Date | null;
  readonly now: Date;
  readonly firstRunLookbackHours: number;
  readonly maxLookbackHours: number;
  readonly overlapMinutes: number;
}): number {
  const { explicitHoursOld, lastRunAt, now, firstRunLookbackHours, maxLookbackHours, overlapMinutes } = params;

  if (typeof explicitHoursOld === 'number' && Number.isFinite(explicitHoursOld)) {
    return explicitHoursOld;
  }

  if (lastRunAt === null) {
    return Math.min(firstRunLookbackHours, maxLookbackHours);
  }

  const elapsedHours = (now.getTime() - lastRunAt.getTime()) / 3_600_000;
  const withOverlap = elapsedHours + overlapMinutes / 60;
  return Math.min(Math.max(withOverlap, 1), maxLookbackHours);
}

/** Outcome of a single {@link DailyExportCron.runExport} pass. */
export type DailyExportResult =
  | { readonly ran: false; readonly reason: 'disabled' | 'no-jobs' | 'push-failed' }
  | {
      readonly ran: true;
      readonly exported: number;
      readonly skippedDuplicates: number;
      readonly destination: string;
    };

/**
 * Periodic push of freshly-seen job postings to a downstream platform —
 * or, absent a configured target, a local file — so an operator's own
 * ingest endpoint receives newly-discovered postings without re-processing
 * ones already sent.
 *
 * Follows the `HealthSnapshotCron` precedent: a plain `setInterval` (not
 * `@nestjs/schedule`), `unref()`'d so it never keeps the process alive,
 * and best-effort — a failed tick logs a warning and never throws (the
 * next tick retries).
 *
 * "Fresh" is tracked via the active `EVER_JOBS_STORE` backend's
 * `IExportedJobStore` capability (`@Optional()`-injected — when unbound,
 * every tick exports the full search result with no cross-run dedup).
 * A push failure does NOT mark the batch exported, so the same jobs are
 * retried on the next tick alongside anything newly discovered.
 */
@Injectable()
export class DailyExportCron
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DailyExportCron.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly aggregator: JobsAggregator,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(EXPORTED_JOB_STORE_TOKEN)
    private readonly exportedJobStore?: IExportedJobStore | null,
    @Optional()
    @Inject(RUN_STATE_STORE_TOKEN)
    private readonly runStateStore?: IRunStateStore | null,
  ) {}

  onApplicationBootstrap(): void {
    const config = this.getConfig();
    if (!config.enabled) {
      this.logger.log('Daily job export disabled (ENABLE_DAILY_EXPORT is not set).');
      return;
    }

    if (!this.exportedJobStore) {
      this.logger.log(
        'EXPORTED_JOB_STORE_TOKEN unbound — daily export will run without cross-run dedup ' +
          '(every tick re-exports the full search result).',
      );
    }

    if (!this.runStateStore && config.hoursOld === undefined) {
      this.logger.log(
        `RUN_STATE_STORE_TOKEN unbound — daily export will use the static ` +
          `${config.firstRunLookbackHours}h first-run lookback on every tick ` +
          `(no watermark to compute elapsed time from).`,
      );
    }

    const interval = this.normaliseInterval(config.intervalMs);
    const destination = config.targetUrl ? `webhook ${config.targetUrl}` : `file:${config.dir}`;
    this.logger.log(`Daily job export enabled (interval ${interval} ms, destination ${destination}).`);
    this.timer = setInterval(() => void this.runExport(), interval);
    if (typeof this.timer === 'object' && this.timer !== null) {
      const t = this.timer as { unref?: () => void };
      if (typeof t.unref === 'function') {
        t.unref();
      }
    }
  }

  onApplicationShutdown(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Run one export pass. Public so tests (and an operator via a manual
   * trigger) can drive a single tick without waiting for the timer.
   */
  async runExport(): Promise<DailyExportResult> {
    const config = this.getConfig();
    if (!config.enabled) {
      return { ran: false, reason: 'disabled' };
    }

    // Captured BEFORE the search runs — the watermark records "covered
    // up to this point," not "now after the run finished," so a slow
    // tick doesn't silently create a gap for the next one.
    const tickStartedAt = new Date();

    try {
      const input = await this.buildSearchInput(config, tickStartedAt);
      // persist:true (default) so anything the cron finds is also
      // browsable/searchable via the /admin UI, not just pushed downstream.
      const { jobs } = await this.aggregator.aggregate(input);

      const candidateUrls = jobs.map((job) => job.jobUrl);
      const unseenUrls = this.exportedJobStore
        ? new Set(await this.exportedJobStore.filterUnseen(candidateUrls))
        : new Set(candidateUrls);
      const freshJobs = jobs.filter((job) => unseenUrls.has(job.jobUrl));
      const skippedDuplicates = jobs.length - freshJobs.length;

      if (freshJobs.length === 0) {
        this.logger.log(
          `Daily export tick: 0 fresh jobs (${skippedDuplicates} already exported previously) — nothing to push.`,
        );
        await this.pruneManifest(config);
        // The search itself completed successfully — just nothing new
        // to push. Advance the watermark so the next tick doesn't
        // re-scan the same window.
        await this.advanceWatermark(tickStartedAt);
        return { ran: false, reason: 'no-jobs' };
      }

      const destination = config.targetUrl
        ? await this.pushToTarget(config, freshJobs)
        : await this.writeExportFile(config, freshJobs);

      if (destination === null) {
        // Push/write failed — do NOT mark exported, and do NOT advance
        // the watermark, so the next tick retries this same window and
        // these same jobs.
        return { ran: false, reason: 'push-failed' };
      }

      if (this.exportedJobStore) {
        await this.exportedJobStore.markExported(
          freshJobs.map((job) => job.jobUrl),
          new Date(),
        );
      }
      await this.pruneManifest(config);
      await this.advanceWatermark(tickStartedAt);

      this.logger.log(
        `Daily export tick: pushed ${freshJobs.length} fresh job(s) to ${destination} (${skippedDuplicates} duplicate(s) skipped).`,
      );
      return { ran: true, exported: freshJobs.length, skippedDuplicates, destination };
    } catch (err) {
      this.logger.warn(
        `Daily export tick failed: ${err instanceof Error ? err.message : err}; will retry next tick.`,
      );
      return { ran: false, reason: 'push-failed' };
    }
  }

  // ── helpers ──────────────────────────────

  private getConfig(): DailyExportConfig {
    return this.configService.get<DailyExportConfig>('dailyExport')!;
  }

  private async buildSearchInput(
    config: DailyExportConfig,
    tickStartedAt: Date,
  ): Promise<ScraperInputDto> {
    const validSites = new Set(Object.values(Site) as string[]);
    // Configured sites win; otherwise fall back to the curated
    // job-board list (`defaults.siteNames`) rather than fanning out
    // across every registered source (1,800+ company/ATS scrapers).
    const configuredSites = config.siteNames.length
      ? config.siteNames
      : (this.configService.get<{ siteNames: string[] }>('defaults')?.siteNames ?? []);
    const siteType = configuredSites.filter((s) => validSites.has(s)) as Site[];

    const lastRunAt = this.runStateStore
      ? await this.runStateStore.getLastRunAt(DAILY_EXPORT_RUN_STATE_KEY)
      : null;
    const hoursOld = computeDynamicHoursOld({
      explicitHoursOld: config.hoursOld,
      lastRunAt,
      now: tickStartedAt,
      firstRunLookbackHours: config.firstRunLookbackHours,
      maxLookbackHours: config.maxLookbackHours,
      overlapMinutes: config.lookbackOverlapMinutes,
    });

    return new ScraperInputDto({
      siteType: siteType.length ? siteType : undefined,
      searchTerm: config.searchTerm,
      location: config.location,
      isRemote: config.isRemote,
      resultsWanted: config.resultsWanted,
      hoursOld,
    });
  }

  /**
   * Record that the tick starting at `tickStartedAt` covered its search
   * window successfully — called from both the "pushed fresh jobs" and
   * "zero fresh jobs" success paths, never from a failure path (see
   * `runExport`'s call sites for why). No-op when `IRunStateStore` isn't
   * bound.
   */
  private async advanceWatermark(tickStartedAt: Date): Promise<void> {
    if (!this.runStateStore) return;
    await this.runStateStore.setLastRunAt(DAILY_EXPORT_RUN_STATE_KEY, tickStartedAt);
  }

  /**
   * POST the fresh jobs to the configured target URL. Returns the
   * destination string on success, `null` on failure (never throws —
   * the caller treats `null` as "don't mark exported, retry next tick").
   */
  private async pushToTarget(
    config: DailyExportConfig,
    jobs: JobPostDto[],
  ): Promise<string | null> {
    try {
      await axios.request({
        url: config.targetUrl,
        method: config.targetMethod as
          | 'POST'
          | 'PUT'
          | 'PATCH'
          | 'post'
          | 'put'
          | 'patch',
        timeout: config.targetTimeoutMs,
        headers: {
          'Content-Type': 'application/json',
          ...config.targetHeaders,
        },
        data: { jobs },
      });
      return `webhook ${config.targetUrl}`;
    } catch (err) {
      this.logger.warn(
        `Daily export push to ${config.targetUrl} failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private async pruneManifest(config: DailyExportConfig): Promise<void> {
    if (!this.exportedJobStore) return;
    const cutoff = new Date(Date.now() - config.retentionDays * 86_400_000);
    try {
      await this.exportedJobStore.prune(cutoff);
    } catch (err) {
      this.logger.warn(
        `Daily export manifest prune failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async writeExportFile(
    config: DailyExportConfig,
    jobs: JobPostDto[],
  ): Promise<string | null> {
    try {
      await mkdir(config.dir, { recursive: true });
      const dateStamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const isCsv = config.format === 'csv';
      const file = join(config.dir, `jobs-${dateStamp}.${isCsv ? 'csv' : 'json'}`);
      const contents = isCsv ? this.toCsv(jobs) : JSON.stringify(jobs, null, 2);
      await writeFile(file, contents, 'utf-8');
      return `file:${file}`;
    } catch (err) {
      this.logger.warn(
        `Daily export file write to ${config.dir} failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** Minimal flat CSV writer — mirrors `JobsController.jobsToCsv`'s shape for consistency. */
  private toCsv(jobs: JobPostDto[]): string {
    if (jobs.length === 0) return 'No results\n';

    const flatJobs = jobs.map((job) => {
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(job)) {
        if (value === null || value === undefined) {
          flat[key] = '';
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          for (const [subKey, subVal] of Object.entries(value as Record<string, unknown>)) {
            flat[`${key}.${subKey}`] = String(subVal ?? '');
          }
        } else if (Array.isArray(value)) {
          flat[key] = value.join('; ');
        } else {
          flat[key] = String(value);
        }
      }
      return flat;
    });

    const headers = new Set<string>();
    for (const row of flatJobs) {
      for (const key of Object.keys(row)) headers.add(key);
    }
    const headerArr = [...headers];

    const escape = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    const lines = [headerArr.map(escape).join(',')];
    for (const row of flatJobs) {
      lines.push(headerArr.map((h) => escape(row[h] ?? '')).join(','));
    }
    return lines.join('\n') + '\n';
  }

  private normaliseInterval(raw: number): number {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
      return DEFAULT_DAILY_EXPORT_INTERVAL_MS;
    }
    return raw;
  }
}
