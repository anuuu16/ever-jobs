-- @ever-jobs/store-postgres-prisma — add source_observation.raw_response.
--
-- Opt-in capture of the raw HTTP response body a source plugin received
-- (HTML page, JSON payload, etc.), populated only when
-- `ScraperInputDto.captureRawResponse` is true. Used to validate
-- extraction issues via the /admin job detail view.

ALTER TABLE "source_observation" ADD COLUMN "raw_response" TEXT;
