-- @ever-jobs/store-postgres-prisma — add canonical_job.is_remote.
--
-- Elected remote status from the dedup engine's boolean-OR merge across
-- sources (see `DedupHybridService.resolveIsRemote`), promoted from the
-- generic `fields_json` blob to a real column so `listByQuery` can filter
-- on it without a JSONB path scan. NULL means no source expressed an
-- opinion either way, distinct from FALSE ("explicitly not remote") —
-- filters on TRUE/FALSE both exclude NULL rows. Additive + nullable, so
-- this is safe to apply against an existing populated table (existing
-- rows just get NULL until the next re-scrape re-populates them via
-- `upsert`).

ALTER TABLE "canonical_job" ADD COLUMN "is_remote" BOOLEAN;

CREATE INDEX "idx_canonical_job_is_remote" ON "canonical_job" ("is_remote");
