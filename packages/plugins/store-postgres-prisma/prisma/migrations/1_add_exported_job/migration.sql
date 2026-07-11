-- @ever-jobs/store-postgres-prisma — add exported_job (daily-export dedup tracking).
--
-- Tracks job URLs already pushed by `DailyExportCron` so a re-run only
-- surfaces genuinely new postings. Keyed by raw `job_url` (not
-- `canonical_job_id`) since the export cron runs independent of dedup
-- persistence.

CREATE TABLE "exported_job" (
  "job_url" TEXT NOT NULL,
  "exported_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "exported_job_pkey" PRIMARY KEY ("job_url")
);
