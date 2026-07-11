-- @ever-jobs/store-postgres-prisma — add run_state (cron watermark tracking).
--
-- Tracks the last successful run timestamp per named scheduled job (e.g.
-- 'daily-export'), so a cron can size its next lookback window from
-- elapsed time instead of a static config value. `key` is free-form so
-- future crons reuse this table instead of each inventing their own
-- watermark column.

CREATE TABLE "run_state" (
  "key" TEXT NOT NULL,
  "last_run_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "run_state_pkey" PRIMARY KEY ("key")
);
