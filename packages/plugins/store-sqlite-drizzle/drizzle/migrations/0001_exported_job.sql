-- Migration: 0001_exported_job
-- Adds `exported_job` — tracks job URLs already pushed by `DailyExportCron`
-- so a re-run only surfaces genuinely new postings. See `../schema.ts` for
-- the Drizzle source-of-truth; this file is the on-disk migration for
-- production sqlite deployments (mirrors the 0000_init.sql convention —
-- hand-authored, also bootstrapped via `INITIAL_SCHEMA_SQL` for tests).

CREATE TABLE IF NOT EXISTS exported_job (
  job_url TEXT PRIMARY KEY NOT NULL,
  exported_at TEXT NOT NULL
);
