-- Migration: 0004_is_remote
-- Adds `canonical_job.is_remote` — elected remote status from the dedup
-- engine's boolean-OR merge across sources (see
-- `DedupHybridService.resolveIsRemote`), promoted from the generic
-- `fields_json` blob to a real column so `listByQuery` can filter on it
-- without a JSON scan. NULL means no source expressed an opinion either
-- way, distinct from 0 ("explicitly not remote").
-- See `../schema.ts` for the Drizzle source-of-truth; this file is the
-- on-disk migration for production sqlite deployments (mirrors the
-- 0003_run_state.sql convention — hand-authored, also bootstrapped via
-- `INITIAL_SCHEMA_SQL` for tests).

ALTER TABLE canonical_job ADD COLUMN is_remote INTEGER;

CREATE INDEX IF NOT EXISTS idx_canonical_job_is_remote
  ON canonical_job (is_remote);
