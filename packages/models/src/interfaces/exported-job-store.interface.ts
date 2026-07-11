/**
 * Tracks which job postings a daily export job (`DailyExportCron`) has
 * already pushed downstream, so re-running the export only surfaces
 * genuinely new postings.
 *
 * Separate interface (mirroring the {@link import('./health-snapshot-store.interface').IHealthSnapshotStore}
 * split) rather than a method on `IJobStore`: exported-job tracking has
 * a different key (`jobUrl`, not `canonicalJobId` — the export cron
 * runs before/independent of dedup persistence) and a different
 * lifecycle (append-only "seen" marks, no updates, periodic pruning by
 * age rather than upsert-by-id).
 */
export interface IExportedJobStore {
  /**
   * Given a batch of job URLs, return the subset that have NOT been
   * previously marked exported. Order is not guaranteed to match the
   * input. Empty input MUST short-circuit to `[]` without touching the
   * backend.
   */
  filterUnseen(jobUrls: ReadonlyArray<string>): Promise<string[]>;

  /**
   * Record that the given job URLs were successfully exported at `at`.
   * Idempotent — marking an already-exported URL again is a no-op for
   * that URL. Empty input MUST short-circuit without touching the
   * backend.
   */
  markExported(jobUrls: ReadonlyArray<string>, at: Date): Promise<void>;

  /**
   * Remove exported-marks older than `olderThan` so the table doesn't
   * grow unbounded. Returns the number of rows removed. Backends MAY
   * implement this as a no-op returning `0` if pruning isn't needed
   * (e.g. a bounded in-memory ring), but the reference implementations
   * all support it.
   */
  prune(olderThan: Date): Promise<number>;
}

/**
 * DI token for the active `IExportedJobStore`. Bound by
 * `StoreModule.forActive(...)` when (and only when) the active
 * `IJobStore` backend's runtime instance satisfies
 * {@link isExportedJobStore} — mirrors `HEALTH_SNAPSHOT_STORE_TOKEN`'s
 * binding pattern exactly.
 */
export const EXPORTED_JOB_STORE_TOKEN = 'EXPORTED_JOB_STORE';

/**
 * Type guard for {@link IExportedJobStore}. Used by
 * `StoreModule.forActive(...)` to decide at boot whether the active
 * backend instance also satisfies this optional contract.
 */
export function isExportedJobStore(
  candidate: unknown,
): candidate is IExportedJobStore {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const c = candidate as Partial<IExportedJobStore>;
  return (
    typeof c.filterUnseen === 'function' &&
    typeof c.markExported === 'function' &&
    typeof c.prune === 'function'
  );
}
