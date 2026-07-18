import { Injectable, Logger } from '@nestjs/common';

/** Names of the admin actions tracked by this registry. */
export type BackgroundJobName =
  | 'extract-all'
  | 'clear-all'
  | 'export-all'
  | 'export-all-full'
  | 'reset-exported';

/** Coarse progress marker — "N of M platforms/sites done", plus a label for the status line. */
export interface BackgroundJobProgress {
  readonly done: number;
  readonly total: number;
  readonly label: string;
}

/**
 * Snapshot of one background job's state. Serialised as-is over the wire by
 * `AdminController.backgroundStatus()` — the admin UI polls this to render
 * a running/finished status that survives a page refresh.
 */
export interface BackgroundJobStatus {
  readonly name: BackgroundJobName;
  readonly state: 'idle' | 'running' | 'done' | 'failed';
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly progress?: BackgroundJobProgress;
  readonly result?: unknown;
  readonly error?: string;
}

const IDLE: Omit<BackgroundJobStatus, 'name'> = { state: 'idle' };

/**
 * In-memory, server-side registry of long-running admin actions
 * ("Extract ALL sources", "Delete ALL data"). Deliberately NOT a store-plugin
 * capability (no new `IJobStore`-style interface, no per-backend
 * implementation, no DB table): this state only needs to survive a browser
 * refresh, not a server restart — the Node process backing this admin UI
 * already lives for the whole session, so a plain singleton + `Map` is
 * enough. Promoting this to real persistence would be ceremony this
 * ephemeral operational state doesn't need.
 *
 * `start()` fires `work` WITHOUT awaiting it (fire-and-forget), mirroring
 * the pattern `DailyExportCron.onApplicationBootstrap` already uses for its
 * `setInterval(() => void this.runExport(), ...)` tick — the HTTP handler
 * that calls `start()` returns immediately with the current status; the
 * work itself keeps running on the event loop afterwards. A rejection from
 * `work` is always caught here and recorded as `state: 'failed'` — it can
 * never crash the process or leave a job stuck in `running` forever.
 */
@Injectable()
export class AdminBackgroundJobsService {
  private readonly logger = new Logger(AdminBackgroundJobsService.name);
  private readonly jobs = new Map<BackgroundJobName, BackgroundJobStatus>();

  /** Every tracked job's current status — used by the poll/refresh endpoint. */
  getAll(): Record<BackgroundJobName, BackgroundJobStatus> {
    const names: BackgroundJobName[] = [
      'extract-all',
      'clear-all',
      'export-all',
      'export-all-full',
      'reset-exported',
    ];
    const out = {} as Record<BackgroundJobName, BackgroundJobStatus>;
    for (const name of names) {
      out[name] = this.jobs.get(name) ?? { name, ...IDLE };
    }
    return out;
  }

  /**
   * Start `name` running `work`, unless it's already `running` (in which
   * case this is a no-op that just returns the current — unchanged —
   * status; the caller doesn't get a second concurrent run).
   *
   * `work` receives an `update()` callback for progress reporting; whatever
   * `work` resolves with becomes `status.result` once it settles.
   */
  start(
    name: BackgroundJobName,
    work: (update: (progress: BackgroundJobProgress) => void) => Promise<unknown>,
  ): BackgroundJobStatus {
    const existing = this.jobs.get(name);
    if (existing?.state === 'running') {
      return existing;
    }

    const startedAt = new Date().toISOString();
    const running: BackgroundJobStatus = { name, state: 'running', startedAt };
    this.jobs.set(name, running);

    const update = (progress: BackgroundJobProgress): void => {
      const current = this.jobs.get(name);
      if (current?.state !== 'running') return; // job already settled — ignore stale updates
      this.jobs.set(name, { ...current, progress });
    };

    void work(update)
      .then((result) => {
        this.jobs.set(name, {
          name,
          state: 'done',
          startedAt,
          finishedAt: new Date().toISOString(),
          progress: this.jobs.get(name)?.progress,
          result,
        });
      })
      .catch((err) => {
        this.logger.warn(
          `Background job "${name}" failed: ${err instanceof Error ? err.message : err}`,
        );
        this.jobs.set(name, {
          name,
          state: 'failed',
          startedAt,
          finishedAt: new Date().toISOString(),
          progress: this.jobs.get(name)?.progress,
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return running;
  }
}
