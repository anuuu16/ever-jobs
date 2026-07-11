-- Migration: 0003_run_state
-- Adds `run_state` — tracks the last successful run timestamp per named
-- scheduled job (e.g. `'daily-export'`), so a cron can size its next
-- lookback window from elapsed time instead of a static config value.
-- See `../schema.ts` for the Drizzle source-of-truth; this file is the
-- on-disk migration for production sqlite deployments (mirrors the
-- 0001_exported_job.sql convention — hand-authored, also bootstrapped
-- via `INITIAL_SCHEMA_SQL` for tests).

CREATE TABLE IF NOT EXISTS run_state (
  key TEXT PRIMARY KEY NOT NULL,
  last_run_at TEXT NOT NULL
);
