/**
 * Tracks the last time a named scheduled job (e.g. `DailyExportCron`)
 * completed a successful pass, so the next run can compute how far back
 * it needs to look instead of relying on a static lookback window.
 *
 * `key` is a free-form string identifying the caller (e.g.
 * `'daily-export'`) rather than a dedicated field per cron — any future
 * scheduled job that needs a "last run" watermark reuses the same
 * store/table instead of a bespoke column each time.
 *
 * Separate interface (mirroring the {@link import('./exported-job-store.interface').IExportedJobStore}
 * split) rather than a method on `IJobStore`: run-state tracking has a
 * different key (an arbitrary caller-chosen string, not `canonicalJobId`
 * or `jobUrl`) and a different lifecycle (one row per key, overwritten
 * on every successful run — no pruning, no batch operations).
 */
export interface IRunStateStore {
  /**
   * Last successful run's recorded timestamp for `key`, or `null` if
   * this key has never completed a run. Callers use this to size the
   * next run's lookback window (e.g. "how many hours since we last ran").
   */
  getLastRunAt(key: string): Promise<Date | null>;

  /**
   * Record that `key` completed successfully as of `at`. Overwrites any
   * previous value — callers MUST call this only after a run has fully
   * succeeded (a failed/partial run should leave the prior watermark in
   * place so the next attempt re-covers the same window).
   */
  setLastRunAt(key: string, at: Date): Promise<void>;
}

/**
 * DI token for the active `IRunStateStore`. Bound by
 * `StoreModule.forActive(...)` when (and only when) the active
 * `IJobStore` backend's runtime instance satisfies
 * {@link isRunStateStore} — mirrors `EXPORTED_JOB_STORE_TOKEN`'s binding
 * pattern exactly.
 */
export const RUN_STATE_STORE_TOKEN = 'RUN_STATE_STORE';

/**
 * Type guard for {@link IRunStateStore}. Used by
 * `StoreModule.forActive(...)` to decide at boot whether the active
 * backend instance also satisfies this optional contract.
 */
export function isRunStateStore(
  candidate: unknown,
): candidate is IRunStateStore {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const c = candidate as Partial<IRunStateStore>;
  return (
    typeof c.getLastRunAt === 'function' &&
    typeof c.setLastRunAt === 'function'
  );
}
