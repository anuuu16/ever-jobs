
BEGIN;

-- everjobs.canonical_job: nullable is_remote, flip null/false -> true only
-- for rows whose location text unambiguously says "Remote".
UPDATE everjobs.canonical_job
SET is_remote = true
WHERE location ~* '\mremote\M' AND (is_remote IS NULL OR is_remote = false);

-- mylivecv.AggregatedJob: NOT NULL isRemote (defaulted to false on ingest
-- because toExportPayload never sent the field) — same flip, plus
-- updatedAt so the live site's cache-busting/sort-by-updated logic (if any)
-- sees the change.
UPDATE mylivecv."AggregatedJob"
SET "isRemote" = true, "updatedAt" = now()
WHERE location ~* '\mremote\M' AND "isRemote" = false;

COMMIT;
