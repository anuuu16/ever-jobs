-- @ever-jobs/store-postgres-prisma — restore the pg_trgm GIN indexes.
--
-- A stray auto-generated migration (`20260711095422_mig`, created by running
-- `prisma migrate dev` against this schema) dropped `idx_canonical_job_company_trgm`
-- / `_title_trgm` / `_location_trgm`. This is a known hazard, not a one-off
-- mistake: these indexes use the `gin_trgm_ops` operator class, which
-- Prisma's schema DSL cannot express (even with the `extendedIndexes`
-- preview feature — opclass-specific GIN indexes are invisible to it). Any
-- `prisma migrate dev` run against this schema will see them as "drift" and
-- propose dropping them again, because nothing in schema.prisma says they
-- should exist.
--
-- DO NOT run `prisma migrate dev` (or `npm run prisma:migrate:dev`) against
-- a database with real data for this reason. Use `prisma migrate deploy`
-- (`npm run prisma:migrate:deploy`) only — it applies pending migration
-- files in order without diffing/reconciling against schema.prisma.

CREATE INDEX IF NOT EXISTS "idx_canonical_job_company_trgm"
  ON "canonical_job" USING GIN ("company" public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_canonical_job_title_trgm"
  ON "canonical_job" USING GIN ("title" public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_canonical_job_location_trgm"
  ON "canonical_job" USING GIN ("location" public.gin_trgm_ops);
