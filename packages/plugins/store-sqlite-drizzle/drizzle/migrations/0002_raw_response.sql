-- Migration: 0002_raw_response
-- Adds `source_observation.raw_response` — opt-in capture of the raw HTTP
-- response body a source plugin received (HTML page, JSON payload, etc.),
-- populated only when `ScraperInputDto.captureRawResponse` is true. Used to
-- validate extraction issues (e.g. why a field came back empty) via the
-- /admin job detail view. See `../schema.ts` for the Drizzle source-of-truth.

ALTER TABLE source_observation ADD COLUMN raw_response TEXT;
