# Tasks: 006 — ATS-Scrapers Parity, Batch 1 (Avature / Gem / Join.com)

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Bootstrap

- [ ] T01 — Site enum + tsconfig paths + jest moduleNameMapper additions.
  - **Files:** `packages/models/src/enums/site.enum.ts`,
    `tsconfig.base.json`, `jest.config.js`.
  - **Acceptance:** `Site.AVATURE === 'avature'`, `Site.GEM === 'gem'`,
    `Site.JOIN_COM === 'join_com'`. `tsconfig.base.json` declares three
    new `paths` entries:
    `@ever-jobs/source-ats-avature: ["packages/plugins/source-ats-avature/src/index.ts"]`,
    same for `source-ats-gem` and `source-ats-joincom`. `jest.config.js`
    `moduleNameMapper` mirrors all three.
  - **Estimate:** 0.25 day.

- [ ] T02 — Three new plugin packages scaffolded; appended to
  `ALL_SOURCE_MODULES`.
  - **Files:** `packages/plugins/source-ats-avature/{package.json,tsconfig.json,src/{index.ts,avature.module.ts,avature.service.ts},__tests__/avature.service.spec.ts}`,
    same shape for `source-ats-gem` and `source-ats-joincom`,
    plus `packages/plugins/index.ts`.
  - **Acceptance:** Three packages exist and compile with stub
    `scrape(input) { return new JobResponseDto([]); }`.
    `ALL_SOURCE_MODULES` includes `AvatureModule`, `GemModule`,
    `JoinComModule`. `npm run build` green.
  - **Estimate:** 0.5 day.

## Phase 2 — Avature

- [ ] T03 — `AvatureService.scrape(input)` HTML-scrape path.
  - **Files:** `packages/plugins/source-ats-avature/src/avature.service.ts`,
    `…/avature.types.ts`, `…/avature.constants.ts`.
  - **Acceptance:**
    - Resolves base URL from `input.companyUrl ?? \`https://\${input.companySlug}.avature.net\``.
    - Paginates `${base}/careers/SearchJobs/?jobOffset=N&jobRecordsPerPage=12`
      until empty page or short page.
    - Parses HTML via `cheerio`; multi-selector chain matches
      upstream Python's resilience (`article.job` / `div.job-item`
      / `li.job-listing` / `tr.job` / `div[data-job-id]`, link-text
      fallback).
    - Skips Apply-link decoys (link-text in `['apply','apply now',
      'apply online','learn more','view job']`).
    - Caps at `input.resultsWanted` (default 100).
    - Catches HTTP errors → returns empty `JobResponseDto`, never
      throws.
  - **Estimate:** 1 day.

- [ ] T04 — Avature unit tests.
  - **Files:** `packages/plugins/source-ats-avature/__tests__/avature.service.spec.ts`,
    `…/__tests__/fixtures/avature-page-1.html`.
  - **Acceptance:** ≥ 5 cases — happy path (12 jobs), empty page,
    HTTP 500 caught, `resultsWanted=5` cap, custom-domain override
    via `companyUrl`. All green.
  - **Estimate:** 0.5 day.

## Phase 3 — Gem

- [ ] T05 — `GemService.scrape(input)` GraphQL-batch path.
  - **Files:** `packages/plugins/source-ats-gem/src/gem.service.ts`,
    `…/gem.types.ts`, `…/gem.constants.ts`.
  - **Acceptance:**
    - Single POST to `https://jobs.gem.com/api/public/graphql/batch`
      with both `JobBoardTheme` and `JobBoardList` operations
      carrying `boardId = input.companySlug`.
    - Headers: `Accept: */*`, `Content-Type: application/json`,
      `Origin/Referer: https://jobs.gem.com`, `batch: true`,
      `User-Agent` per `@ever-jobs/common`.
    - Picks the response array element whose `data.oatsExternalJobPostings`
      is defined (tolerates response-order swap).
    - Maps each `jobPostings[i]` to a `JobPostDto` with
      `id = ext_id`, `title`, `location =
      locations[0]?.name`, `department = job?.department?.name`,
      `employmentType = job?.employmentType`,
      `locationType = job?.locationType`,
      `url = \`https://jobs.gem.com/\${input.companySlug}/jobs/\${ext_id}\``.
    - Caps at `input.resultsWanted`.
    - Catches HTTP errors → empty `JobResponseDto`.
  - **Estimate:** 1 day.

- [ ] T06 — Gem unit tests.
  - **Files:** `packages/plugins/source-ats-gem/__tests__/gem.service.spec.ts`,
    `…/__tests__/fixtures/gem-batch-response.json`.
  - **Acceptance:** ≥ 4 cases — happy path, empty `jobPostings`,
    HTTP 500 caught, response-order tolerance (Theme first vs
    List first). All green.
  - **Estimate:** 0.5 day.

## Phase 4 — Join.com

- [ ] T07 — `JoinComService.scrape(input)` REST two-step path.
  - **Files:** `packages/plugins/source-ats-joincom/src/joincom.service.ts`,
    `…/joincom.types.ts`, `…/joincom.constants.ts`.
  - **Acceptance:**
    - Step 1: `GET https://join.com/companies/<slug>` (HTML) →
      regex-extract numeric ID via `"company":{"id":(\d+)`
      first, fallback `"companyId":(\d+)`.
    - Step 2: `GET https://join.com/api/public/companies/<id>/jobs?locale=en-us&page=N&pageSize=50&withAggregations=true&sort=+title`
      until `pagination.totalPages` reached or `items[]` empty.
    - Maps each `items[i]` to a `JobPostDto` with `id = item.id`,
      `title = item.title`, `location = item.locations?.[0]?.name`,
      `description = item.description` (HTML →
      `htmlToPlainText` if `descriptionFormat === 'text'`),
      `url = item.shareableUrl ?? \`https://join.com/jobs/\${item.id}\``,
      `postedAt = item.publishedAt`.
    - Caps at `input.resultsWanted` mid-pagination.
    - Sleeps `>= 0.5 s` between pages (matches upstream Python's
      polite pacing).
    - Catches HTTP errors / regex miss → empty `JobResponseDto`.
  - **Estimate:** 1 day.

- [ ] T08 — Join.com unit tests.
  - **Files:** `packages/plugins/source-ats-joincom/__tests__/joincom.service.spec.ts`,
    `…/__tests__/fixtures/joincom-company-page.html`,
    `…/__tests__/fixtures/joincom-jobs-page-1.json`.
  - **Acceptance:** ≥ 5 cases — happy path, empty board,
    HTTP 500 caught, slug-not-found (no `"company":{"id":` match,
    no `"companyId":` fallback), `resultsWanted=20` mid-page cap.
    All green.
  - **Estimate:** 0.5 day.

## Phase 5 — Integration & docs

- [ ] T09 — Live integration suite for all three plugins.
  - **File:** `apps/api/__tests__/integration/source-ats-batch-1.integration.spec.ts`.
  - **Acceptance:** Boots `AppModule`; stubs `createHttpClient` with
    fixture responses for the three new plugins; calls
    `JobsService.searchJobs({ site: ['avature','gem','join_com'],
    companySlug: 'demo' })`; asserts ≥ 1 row from each plugin in
    the deduped result. Verifies the four-place registration
    (no plugin silently absent from `PluginRegistry`).
  - **Estimate:** 0.5 day.

- [ ] T10 — E2E suite via supertest.
  - **File:** `apps/api/__tests__/e2e/source-ats-batch-1.e2e-spec.ts`.
  - **Acceptance:** Three GET assertions —
    `/api/jobs?site=avature&companySlug=bloomberg`,
    `?site=gem&companySlug=accel`,
    `?site=join_com&companySlug=primer-ai` — each returns
    `200 OK` + non-empty body, against a sandboxed nock-fixture
    upstream. Asserts dedup-engine collapses identical postings
    across the three plugins (zero collisions on the synthetic
    fixture).
  - **Estimate:** 0.5 day.

- [ ] T11 — Coverage docs update.
  - **Files:** `docs/ATS_INTEGRATIONS.md`,
    `docs/COMPANY_SLUG_DIRECTORY.md`.
  - **Acceptance:** Three new matrix rows; ≥ 10 seed slugs per
    plugin (sampled from upstream `OTHERS/Ats-scrapers/<id>/<id>_companies.csv`).
    `npm run lint:docs` green.
  - **Estimate:** 0.25 day.

- [ ] T12 — Per-plugin perf bench.
  - **Files:** `packages/plugins/source-ats-avature/__tests__/avature.bench.ts`,
    `…/source-ats-gem/__tests__/gem.bench.ts`,
    `…/source-ats-joincom/__tests__/joincom.bench.ts`.
  - **Acceptance:** Each bench file establishes a baseline against
    NFR-2 ceilings on the fixture corpus. Outputs a JSON line at
    `dist/bench/<plugin>.json`. CI gating on bench thresholds is a
    follow-up spec.
  - **Estimate:** 0.5 day.

## Phase 6 — Closeout

- [ ] T13 — Spec 006 graduates; backlog rolled forward.
  - **Files:** `.specify/specs/006-ats-scrapers-parity-batch-1/{spec.md,tasks.md}`,
    `docs/log.md`, `docs/index.md`, `competitor-watch.md`.
  - **Acceptance:** Spec status flipped to "All phases done
    (T01–T13); spec complete". `competitor-watch.md §C` rows AC-1,
    AC-2, AC-3 marked **DONE** with run-tag attributions. Notes
    for next run pinned to "Spec 007 (or batch 2)" — pick the
    next subset of `competitor-watch.md §C` (AC-4 = Oracle HCM
    Cloud / AC-5 = Mercor / AC-6 = Tesla, **OR** AC-7 = European
    salary parser as a fast small-spec interlude **OR** AC-8 =
    seed-companies refresh).
  - **Estimate:** 0.25 day.

## Notes-for-the-next-run (pinned default for run #29)

- Default = **Spec 006 / Phase 1 / T01 + T02** — Site enum
  additions and three empty plugin packages scaffolded with stubs.
  Land registration scaffolding first; deferring business logic to
  T03..T08 keeps the diff reviewable. CI must remain green at the
  end of T01+T02 (stubs return empty `JobResponseDto`, no behaviour
  regression).
- The five load-bearing decisions deferred to T01:
  1. **Slug for Join.com is `join_com`, not `joincom` / `join`**
     (matches upstream Python directory `join_com/` and the
     `Site` enum convention of underscore-snake-case for
     compound vendor names — cf. `ZIP_RECRUITER = 'zip_recruiter'`).
  2. **Plugin folder name is `source-ats-joincom`** (no underscore
     — matches the existing `source-ats-greenhouse` / `source-ats-lever`
     hyphen convention; the underscore lives only in the enum value).
  3. **`AvatureService` accepts both `companyUrl` and `companySlug`**;
     prefer `companyUrl` if present (custom-domain tenants like
     `careers.ibm.com`); fall back to subdomain construction
     `https://<slug>.avature.net` otherwise.
  4. **No new external deps**: Avature uses `cheerio` (already in
     `@ever-jobs/common`); Gem uses `axios.post` w/ JSON;
     Join.com uses `axios.get` + `String.prototype.match`. Lockfile
     sync is a no-op for this spec.
  5. **Default circuit-breaker policy** (Spec 005 /
     `DEFAULT_CIRCUIT_POLICY`) inherited; no `getCircuitBreakerPolicy()`
     override unless evidence of flakiness emerges in T09 / T10.

- Out-of-scope reminders that occasionally drift back into temptation:
  - **Job-detail page enrichment.** All three upstream Python clients
    expose a `get_job_detail(...)` method; we deliberately don't
    ship that here (deferred to a future spec — candidate Spec 016).
  - **Bulk-discovery refresh** (AC-8) — a separate spec
    (candidate Spec 014).
  - **European salary parser** (AC-7) — separate spec (Spec 012 in
    `competitor-watch.md §C`).
  - **AC-4..AC-9** — out of scope; subsequent specs/batches.
