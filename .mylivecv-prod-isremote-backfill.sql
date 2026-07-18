
BEGIN;

UPDATE mylivecv."AggregatedJob"
SET "isRemote" = true, "updatedAt" = now()
WHERE location ~* '\mremote\M' AND "isRemote" = false;

COMMIT;
