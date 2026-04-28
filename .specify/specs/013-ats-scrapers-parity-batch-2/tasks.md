# Tasks: 013 — ATS-Scrapers Parity, Batch 2 (Oracle HCM Cloud / Mercor / Tesla)

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Bootstrap

- [x] T01 — Site enum + tsconfig paths + jest moduleNameMapper additions;
  `ScraperInputDto` extended with `siteNumber` + `descriptionDepth`.
  **Landed run #44.**
  - **Files (planned):** `packages/models/src/enums/site.enum.ts`,
    `packages/models/src/dtos/scraper-input.dto.ts`,
    `tsconfig.base.json`, `jest.config.js`.
  - **Acceptance:**
    - `Site.ORACLE === 'oracle'`, `Site.MERCOR === 'mercor'`,
      `Site.TESLA === 'tesla'`, `Site.TESLA_PLAYWRIGHT === 'tesla_playwright'`.
    - tsconfig + jest mapper mirror **all four** new package paths
      (including `source-tesla-playwright`, even though the optional
      plugin is NOT in `ALL_SOURCE_MODULES`).
    - `ScraperInputDto.siteNumber?: string` and
      `ScraperInputDto.descriptionDepth?: 'board' | 'detail-25' | 'detail-all'`
      land with JSDoc + `@ApiProperty` decoration matching existing
      optional-field conventions.
  - **Estimate:** 0.25 day.

- [x] T02 — Four new plugin packages scaffolded; three appended to
  `ALL_SOURCE_MODULES`.
  **Landed run #45.**
  - **Files (planned):** `packages/plugins/source-ats-oracle/{package.json,tsconfig.json,src/{index.ts,oracle.module.ts,oracle.service.ts},__tests__/oracle.service.spec.ts}`,
    same shape for `source-ats-mercor`, `source-tesla`, AND
    `source-tesla-playwright` (the optional companion gets a stub
    package too — its scaffolding is identical, only `ALL_SOURCE_MODULES`
    excludes it). Plus one edit to `packages/plugins/index.ts`.
  - **Files (actual):** matched plan exactly. Four packages × six
    files each (package.json + tsconfig.json + src/index.ts +
    src/<plugin>.module.ts + src/<plugin>.service.ts +
    __tests__/<plugin>.service.spec.ts) = 24 new files. Plus
    one edit to the `ALL_SOURCE_MODULES` barrel (3 imports
    added, 3 array entries added — `MercorModule` /
    `OracleModule` interleaved alphabetically into the ATS
    block, `TeslaModule` interleaved into the source-* block;
    `TeslaPlaywrightModule` deliberately not imported per
    FR-13).
  - **Acceptance:**
    - Four packages exist and compile with stub
      `scrape(input) { return new JobResponseDto([]); }`.
    - `ALL_SOURCE_MODULES` includes `OracleModule`, `MercorModule`,
      `TeslaModule` — but **NOT** `TeslaPlaywrightModule`.
    - Each new plugin's `__tests__/<plugin>.service.spec.ts` pins
      (a) NestJS DI resolution via the corresponding module,
      (b) stub `scrape()` returning empty `JobResponseDto`,
      (c) the new `Site` enum value's literal string.
  - **Estimate:** 0.5 day. **Actual:** ~0.3 day (matches Spec 006 /
    T02 actual at run #29).

## Phase 2 — Oracle HCM Cloud

- [x] T03 — `OracleService.scrape(input)` REST + finder-string path.
  **Landed run #46.**
  - **Files (planned):** `packages/plugins/source-ats-oracle/src/oracle.service.ts`,
    `…/oracle.types.ts`, `…/oracle.constants.ts`.
  - **Acceptance (FR-1 / FR-2 / FR-3 / FR-4):**
    - URL composition: `companyUrl` (full URL override) ⇒ used verbatim;
      `companySlug` (`<subdomain>-<region>` form) ⇒ composed to
      `https://<subdomain>.fa.<region>.oraclecloud.com`.
    - Finder string: `siteNumber=<value>,facetsList=<facets>,limit=100,offset=N,sortBy=POSTING_DATES_DESC`
      (commas between params, semicolons between facets — matches the
      live API's wire format per upstream Python; spec.md / FR-2's
      all-semicolon variant was wrong, see § 10 Decisions log).
      Documented facet list:
      `LOCATIONS;WORK_LOCATIONS;WORKPLACE_TYPES;TITLES;CATEGORIES;ORGANIZATIONS;POSTING_DATES;FLEX_FIELDS`.
    - Pagination: increment `offset` by `100` until
      `requisitionList[]` empty OR `resultsWanted` cap.
    - HTTP via `@ever-jobs/common.createHttpClient` (no new deps).
    - Errors caught → empty `JobResponseDto`; sentinel codes
      `ERR_ORACLE_BAD_TENANT` / `ERR_ORACLE_FINDER_REJECTED` recorded.
  - **Estimate:** 0.5 day.

- [x] T04 — Oracle unit tests (≥ 6 cases).
  **Landed run #47.**
  - **Files (planned):** `packages/plugins/source-ats-oracle/__tests__/oracle.service.spec.ts`
    (extend), `…/__tests__/fixtures/oracle-page-1.json`.
  - **Files (actual):** matched plan exactly. The spec file grew
    from 4 cases (T03 registration smoke) → 10 cases (4 carry-over
    + 6 behavioural). Fixture is a sanitised five-requisition
    `eeho-us2` corpus exercising the five mapping branches
    (PrimaryLocation/EmployerName, remote, `ExternalUrl`,
    `ExternalUrlSeo`, EmployerName-fallback). The ≥ 200-job
    `resultsWanted` corpus is synthesised in-test via
    `buildSyntheticPage()` so the on-disk fixture stays small.
  - **Acceptance:**
    - Cases: happy path, empty `requisitionList[]`, HTTP 500,
      `resultsWanted` cap (fixture w/ ≥ 200 jobs), `companyUrl`
      override (custom-tenant URL), custom `siteNumber` override.
    - Fixture sourced from Oracle's own careers site (sanitised
      `eeho-us2` corpus).
  - **Estimate:** 0.5 day. **Actual:** ~0.3 day (matches Spec 006 /
    T04 actual at run #31).

## Phase 3 — Mercor

- [x] T05 — `MercorService.scrape(input)` single GET path.
  **Landed run #48.**
  - **Files (planned):** `packages/plugins/source-ats-mercor/src/mercor.service.ts`,
    `…/mercor.types.ts`, `…/mercor.constants.ts`.
  - **Acceptance (FR-5 / FR-6 / FR-7 / FR-8):**
    - Single GET to `https://aws.api.mercor.com/work/listings-explore-page`
      per `scrape()` call.
    - Headers include literal `Authorization: Bearer` (empty token)
      mirroring upstream Python.
    - Post-filter: when `companySlug` supplied, retain only
      `listings[]` rows whose `companyName` (lower-cased) contains
      the slug (lower-cased). Empty slug → full catalogue.
    - `resultsWanted` cap applied AFTER post-filter.
    - HTTP via `@ever-jobs/common.createHttpClient`.
    - Errors caught → empty `JobResponseDto`; sentinel
      `ERR_MERCOR_ENVELOPE` recorded when response lacks `listings[]`;
      sentinel `ERR_MERCOR_FETCH_FAILED` recorded on HTTP failure
      (added during implementation — not in original spec text but
      necessary symmetry with Oracle's two-sentinel pattern).
  - **Estimate:** 0.4 day.

- [x] T06 — Mercor unit tests (≥ 5 cases).
  **Landed run #49.**
  - **Files (planned):** `packages/plugins/source-ats-mercor/__tests__/mercor.service.spec.ts`
    (extend), `…/__tests__/fixtures/mercor-explore.json`.
  - **Files (actual):** matched plan exactly. The spec file grew
    from 5 cases (T05 registration / wire-format / envelope-guard /
    HTTP-failure smoke) → 11 cases (5 carry-over + 6 behavioural).
    Fixture is a sanitised 50-listing corpus spanning 12 distinct
    `companyName` values (Stripe ×8, OpenAI ×5, Anthropic ×4, Notion
    ×4, Airbnb ×5, Figma ×4, Vercel ×3, Linear ×4, Discord ×4,
    Coinbase ×3, Plaid ×3, Ramp ×3) covering hourly / monthly /
    yearly compensation intervals and remote / on-site location
    variants. Two listings (Notion 1021, Figma 1030) deliberately
    have null `rateMin / rateMax / payRateFrequency` to exercise
    the compensation-null branch.
  - **Acceptance:**
    - Cases: happy path with full catalogue, slug post-filter narrows
      result, empty `listings[]`, HTTP 500, resultsWanted cap
      mid-catalogue.
    - Fixture has ≥ 50 listings spanning ≥ 10 distinct
      `companyName` values so post-filter can be exercised
      meaningfully.
  - **Estimate:** 0.4 day. **Actual:** ~0.3 day (matches Spec 006 /
    T04 actual at run #31 and Spec 013 / T04 actual at run #47).

## Phase 4 — Tesla (default, pure-HTTP)

- [x] T07 — `TeslaService.scrape(input)` board + detail path.
  **Landed run #50.**
  - **Files (planned):** `packages/plugins/source-tesla/src/tesla.service.ts`,
    `…/tesla.types.ts`, `…/tesla.constants.ts`.
  - **Acceptance (FR-9 / FR-10 / FR-11 / FR-12):**
    - Board GET: `https://www.tesla.com/cua-api/apps/careers/state` with
      rotated UA + `Accept: application/json`.
    - Map `listings[]` → `JobPostDto[]` with `id` / `title` /
      `location` / `department` (location resolved via
      `lookup.locations[l]`, department via `lookup.departments[d]` —
      spec.md / FR-10's "data.lookup.listings[]" path was wrong;
      upstream Python and the live API put `listings[]` at the top
      level of the response and `lookup` is a sibling map. See § 10
      Decisions log).
    - Detail fetches: for the first
      `min(resultsWanted, descriptionDepth-budget)` jobs, GET
      `https://www.tesla.com/cua-api/careers/job/{id}`; populate
      `description`. `descriptionDepth` budget map:
      `'board'` → 0, `'detail-25'` (default) → 25, `'detail-all'` → ∞.
    - Akamai sentinel: when board GET returns 403 / 503 / HTML body
      (or any non-`{listings,lookup}`-shaped payload), return empty
      `JobResponseDto` with sentinel `ERR_TESLA_AKAMAI_CHALLENGE`.
      Other HTTP failures use `ERR_TESLA_FETCH_FAILED` (added during
      implementation — symmetric with Oracle / Mercor patterns).
    - HTTP via `@ever-jobs/common.createHttpClient`.
  - **Estimate:** 0.7 day.

- [x] T08 — Tesla unit tests (≥ 6 cases).
  **Landed run #51.**
  - **Files (planned):** `packages/plugins/source-tesla/__tests__/tesla.service.spec.ts`
    (extend), `…/__tests__/fixtures/tesla-board.json`,
    `…/__tests__/fixtures/tesla-job-{id}.json`.
  - **Files (actual):** matched plan exactly. The spec file grew
    from 7 cases (T07 registration / wire-format / budget-map /
    Akamai-403 / HTML-Akamai / HTTP-500) → 14 cases (7 carry-over
    + 7 behavioural — one extra over the ≥ 6 acceptance line so
    the `descriptionDepth='board'` budget=0 path AND the
    lookup-key null-fallback paths both get explicit pins).
    `tesla-board.json` ships a sanitised 50-listing corpus
    spanning **6** distinct `lookup.locations` keys (Palo Alto /
    Austin / Fremont / Remote-US / Berlin / Shanghai) and **5**
    `lookup.departments` keys (Engineering / Manufacturing /
    Sales & Service / Software & IT / Vehicle Service) — both
    over the minimum of ≥ 5 / ≥ 3. Plus 3 `lookup.regions` keys
    (Americas / EMEA / APAC) even though `r` is not currently
    consumed by `toJobPost()` (carries the upstream envelope
    shape forward for future enrichment specs). Listings 200049
    has `d: null` and 200050 has `l: null` to exercise the
    `toJobPost()` defensive paths. Detail fixtures:
    `tesla-job-200001.json` (FULL 4-field envelope),
    `tesla-job-200002.json` (PARTIAL 2-field — Description +
    Responsibilities only), `tesla-job-200003.json` (SINGLE-field
    — Compensation only), `tesla-job-missing.json` (the
    missing-all-four branch — only `department` + `timeType`
    metadata flows; the four free-text fields are absent so
    `composeDescription()` resolves to `null`).
  - **Acceptance:**
    - Cases: happy path with detail fetches (assert first 3 have
      `description !== null`, remainder `description === null`),
      empty `lookup.listings[]`, HTTP 500, Akamai 403 sentinel,
      Akamai 503 sentinel, resultsWanted cap pre-detail-fetch.
  - **Estimate:** 0.5 day. **Actual:** ~0.3 day (matches Spec 006 /
    T04 actual at run #31, Spec 013 / T04 actual at run #47, and
    Spec 013 / T06 actual at run #49).

## Phase 5 — Tesla-Playwright (OPTIONAL companion)

- [x] T09 — `TeslaPlaywrightService.scrape(input)` lazy-Playwright path.
  **Landed run #52.**
  - **Files (planned):** `packages/plugins/source-tesla-playwright/src/tesla-playwright.service.ts`,
    `…/tesla-playwright.types.ts`, `…/tesla-playwright.constants.ts`,
    `packages/plugins/source-tesla-playwright/package.json` (declares
    `"playwright": "^X.Y"` as a `peerDependency` + `optionalDependency`).
  - **Acceptance (FR-13):**
    - Lazy `import('playwright')` inside `scrape()`; caught when
      missing → sentinel `ERR_TESLA_PLAYWRIGHT_UNAVAILABLE` + empty
      `JobResponseDto`. Implemented via `Function('s', 'return import(s)')(...)`
      indirection so ts-jest doesn't statically resolve the missing
      module at compile time (typical TypeScript-tooling-vs-optional-dep
      friction; same trick the upstream `pino` / `pretty-print`
      ecosystem uses).
    - Headless Chromium launched with anti-automation flags mirroring
      upstream Python (`--disable-blink-features=AutomationControlled`
      plus `--disable-dev-shm-usage` and `--no-sandbox` for sandboxed
      CI hardening).
    - Navigate to `https://www.tesla.com/careers/search/`; wait for
      `networkidle` with 60 s timeout; settle 5 s after navigation;
      in-page `fetch()` through the established session.
    - Same `JobPostDto[]` mapping as `TeslaService` (FR-10) but
      emitting `Site.TESLA_PLAYWRIGHT` (not `Site.TESLA`) per Q-032
      default — dedup-engine's hash strategy collapses cross-site
      duplicates via `externalId`.
    - Three sentinel codes: `ERR_TESLA_PLAYWRIGHT_UNAVAILABLE` (missing
      `playwright`), `ERR_TESLA_PLAYWRIGHT_NAV_FAILED` (careers-page
      goto failed), `ERR_TESLA_PLAYWRIGHT_FETCH_FAILED` (in-page fetch
      failed or unexpected error). Browser always closed in `finally`.
  - **Estimate:** 0.8 day.

- [ ] T10 — Tesla-Playwright unit tests (≥ 4 cases).
  - **Files (planned):** `packages/plugins/source-tesla-playwright/__tests__/tesla-playwright.service.spec.ts`
    (extend), with `jest.mock('playwright', …)` for the happy-path
    case + a separate spec for the missing-dep case.
  - **Acceptance:**
    - Cases: happy path with stubbed `playwright` module,
      `playwright` not installed sentinel
      (`require('playwright')` throws), Akamai bypass succeeds,
      page navigation timeout returns empty.
  - **Estimate:** 0.5 day.

## Phase 6 — Integration & docs

- [ ] T11 — Three-plugin integration spec.
  - **Files (planned):** `apps/api/__tests__/integration/source-ats-batch-2.integration.spec.ts`.
  - **Acceptance:**
    - Wires Oracle + Mercor + Tesla through live `JobsService`
      fan-out via stubbed-`createHttpClient` fixture.
    - Asserts each plugin contributes ≥ 1 row.
    - Asserts `JobsAggregator` dedup with zero collisions on the
      synthetic fixture (Spec 003 / FR-1).
    - Tesla-Playwright NOT in this suite (default
      `ALL_SOURCE_MODULES` excludes it).
  - **Estimate:** 0.4 day.

- [ ] T12 — Three-plugin e2e spec.
  - **Files (planned):** `apps/api/__tests__/e2e/source-ats-batch-2.e2e-spec.ts`.
  - **Acceptance:**
    - `GET /api/jobs?site=oracle&companyUrl=https%3A%2F%2Feeho.fa.us2.oraclecloud.com`,
      `&site=mercor&companySlug=stripe`, `&site=tesla` return
      `200 OK` + non-empty `JobPostDto[]` against a sandboxed
      fixture server.
    - Asserts dedup-engine consumes the rows without collisions
      across the three plugins.
  - **Estimate:** 0.4 day.

- [ ] T13 — Coverage docs.
  - **Files (planned):** `docs/ATS_INTEGRATIONS.md` (three new
    matrix rows for Oracle / Mercor / Tesla; Tesla-Playwright noted
    as opt-in companion in a sub-row), `docs/COMPANY_SLUG_DIRECTORY.md`
    (≥ 10 seed slugs each for Oracle / Mercor / Tesla — Mercor's
    "slugs" are case-insensitive substring matches against
    `companyName`).
  - **Acceptance:**
    - Matrix rows include: Method (REST / GraphQL / Playwright),
      Data Format, Notable Users (sampled from upstream
      `*_companies.csv`), URL pattern.
    - Seed-slug entries for Oracle sampled from
      `OTHERS/Ats-scrapers/oracle/oracle_companies.csv` (e.g.
      `eeho-us2`, `ttx`, `cooper`); for Mercor a curated list of
      visible companies on the explore page (e.g. `stripe`, `notion`,
      `airbnb`); for Tesla a single entry (`tesla`, since it is
      single-tenant).
  - **Estimate:** 0.4 day.

- [ ] T14 — Performance benches.
  - **Files (planned):** `packages/plugins/source-ats-oracle/__tests__/oracle.bench.ts`,
    `packages/plugins/source-ats-mercor/__tests__/mercor.bench.ts`,
    `packages/plugins/source-tesla/__tests__/tesla.bench.ts`,
    plus four new npm-script entry points (`bench:oracle`,
    `bench:mercor`, `bench:tesla`, `bench:ats-batch-2`).
  - **Acceptance:**
    - Each bench runs 3 warm-ups + 20 timed iterations against the
      `__tests__/fixtures/` corpus; patches
      `@ever-jobs/common.createHttpClient` via module-cache override
      BEFORE requiring the service.
    - Computes `min/median/mean/p95/p99/max` +
      `memory_bytes.{before,after,delta}`; emits a single JSON
      record at `dist/bench/<plugin>.json`.
    - NFR-2 ceilings pinned: Oracle < 6 s, Mercor < 1.5 s, Tesla
      (HTTP-only, ≤ 25 detail fetches) < 12 s.
    - Bench reports `p95_under_ceiling` + `headroom_pct` but does
      NOT exit non-zero on breach (CI gating is a follow-up spec,
      same boundary as Spec 006 / T12).
  - **Estimate:** 0.4 day.

## Phase 7 — Closeout

- [ ] T15 — Spec 013 graduates to "All phases done".
  - **Files (planned):** `.specify/specs/013-ats-scrapers-parity-batch-2/spec.md`
    (Status flip), `competitor-watch.md §C` (rows AC-4 / AC-5 / AC-6
    marked DONE with run-tag attributions), `docs/log.md` (closeout
    entry), `docs/index.md` (Spec 013 status update).
  - **Acceptance:**
    - Status field reads "All phases done (T01..T15 runs #44..#XX);
      spec complete".
    - §C rows AC-4 / AC-5 / AC-6 marked **DONE** with run-tag
      attributions and ✅ glyph.
    - Notes-for-the-next-run pinned to:
      * Spec 014 candidate = AC-8 (seed-companies refresh) OR
        Q-026/Q-027 salary residuals (whichever has more upstream
        signal at closeout time).
      * Spec 015 candidate = AC-9 (Workable diff).
      * Spec 016 candidate = ATS detail-page enrichment (carry-over
        from Spec 006 / Spec 013 § 3 non-goals).
  - **Estimate:** 0.25 day.

---

## Notes for the next run (after this scaffold lands)

- **Default for run #53** = Spec 013 / Phase 5 / T10 — Tesla-
  Playwright behavioural unit-test sweep. Extend
  `__tests__/tesla-playwright.service.spec.ts` to ≥ 4 cases
  (happy path with stubbed `playwright` module via
  `jest.mock('playwright', () => ({...}))` factory; `playwright`
  not installed sentinel `ERR_TESLA_PLAYWRIGHT_UNAVAILABLE`
  carry-over from T09 — already exercised; Akamai bypass
  succeeds — board+detail fetches return populated JSON via
  the stubbed `page.evaluate()`; page navigation timeout
  returns empty via stubbed `page.goto()` rejecting with
  `TimeoutError`). Mirror the Oracle T04 / Mercor T06 / Tesla
  T08 fixture-mock pattern. Estimated 0.5 day.
- **Default for run #52 (DONE — landed run #52)** = Spec 013 /
  Phase 5 / T09 — `TeslaPlaywrightService.scrape(input)`
  lazy-Playwright path in the OPTIONAL companion package.
  Real `tesla-playwright.service.ts` + `tesla-playwright.types.ts`
  + `tesla-playwright.constants.ts` shipped. Lazy import via
  `Function('s', 'return import(s)')` indirection (avoids
  ts-jest's static-resolution friction with optional deps);
  three sentinel codes (`ERR_TESLA_PLAYWRIGHT_UNAVAILABLE` /
  `_NAV_FAILED` / `_FETCH_FAILED`); browser always closed in
  `finally`. Emits `Site.TESLA_PLAYWRIGHT` (Q-032 default).
- **Default for run #51 (DONE — landed run #51)** = Spec 013 /
  Phase 4 / T08 — Tesla behavioural unit-test sweep. Spec file
  grew from 7 → 14 cases (7 carry-over + 7 behavioural —
  +1 over the ≥ 6 acceptance line for explicit `board=0`-budget
  + lookup-key null-fallback pins);
  `__tests__/fixtures/tesla-board.json` shipped (50 listings ×
  6 locations × 5 departments × 3 regions; listings 200049 /
  200050 exercise the missing-`d` / missing-`l` branches);
  detail fixtures `tesla-job-200001.json` (full 4-field) /
  `tesla-job-200002.json` (partial 2-field) /
  `tesla-job-200003.json` (single-field) /
  `tesla-job-missing.json` (missing-all-four → composeDescription
  returns null) ship the documented detail-envelope variants.
- **Default for run #50 (DONE — landed run #50)** = Spec 013 /
  Phase 4 / T07 — `TeslaService.scrape(input)` HTTP-only board +
  detail path. Real `tesla.service.ts` + `tesla.types.ts` +
  `tesla.constants.ts` shipped; sentinel codes
  `ERR_TESLA_AKAMAI_CHALLENGE` (403 / 503 / non-JSON body) +
  `ERR_TESLA_FETCH_FAILED` (other HTTP failures) recorded via
  `Logger.warn`. Detail-fetch budget honoured per Q-031 / FR-11.
  Three load-bearing decisions resolved during implementation
  (board envelope path divergence from FR-10; two-sentinel error
  model symmetric with Oracle/Mercor; broadened Akamai detection
  beyond status codes to "any non-JSON-shaped payload"); see § 10
  Decisions log of spec.md.
- **Default for run #49 (DONE — landed run #49)** = Spec 013 /
  Phase 3 / T06 — Mercor behavioural unit-test sweep. Spec file
  grew from 5 → 11 cases; `__tests__/fixtures/mercor-explore.json`
  shipped (50-listing × 12-company corpus exercising slug
  post-filter narrowing, resultsWanted-cap-after-filter, hourly /
  monthly / yearly compensation intervals, remote / on-site
  locations, and the compensation-null branch via two deliberate
  null-rate entries).
- **Default for run #48 (DONE — landed run #48)** = Spec 013 /
  Phase 3 / T05 — `MercorService.scrape(input)` single GET path
  against `https://aws.api.mercor.com/work/listings-explore-page`.
  Real `mercor.service.ts` + `mercor.types.ts` +
  `mercor.constants.ts` shipped; literal `Authorization: Bearer`
  empty-token header per FR-8; client-side `companyName`
  substring post-filter; `resultsWanted` cap applied AFTER filter;
  sentinel codes `ERR_MERCOR_ENVELOPE` /
  `ERR_MERCOR_FETCH_FAILED` recorded via `Logger.warn`.
- **Default for run #47 (DONE — landed run #47)** = Spec 013 /
  Phase 2 / T04 — Oracle behavioural unit-test sweep. Spec file
  grew from 4 → 10 cases; `__tests__/fixtures/oracle-page-1.json`
  shipped (sanitised `eeho-us2` 5-row corpus + in-test
  `buildSyntheticPage()` for the ≥ 200-job `resultsWanted` cap
  exercise). `axios` factory mocked at `@ever-jobs/common.createHttpClient`
  per the Avature pattern.
- **Default for run #46 (DONE — landed run #46)** = Spec 013 /
  Phase 2 / T03 — `OracleService.scrape(input)` REST + finder-string
  path. Real `oracle.service.ts` + `oracle.types.ts` +
  `oracle.constants.ts` shipped; sentinel codes
  `ERR_ORACLE_BAD_TENANT` / `ERR_ORACLE_FINDER_REJECTED` recorded
  via `Logger.warn`. Wire format follows upstream Python's exact
  comma+semicolon scheme (see § 10 Decisions log).
- **Default for run #45 (DONE — landed run #45)** = Spec 013 /
  Phase 1 / T02 — scaffold the four new plugin packages and
  append three (Oracle / Mercor / Tesla) to `ALL_SOURCE_MODULES`.
  `TeslaPlaywrightModule` deliberately excluded per FR-13.
- **Default for run #44 (DONE — landed run #44)** = Spec 013 /
  Phase 1 / T01 (Site enum + tsconfig paths + jest moduleNameMapper
  + `ScraperInputDto` extensions). Pure scaffolding pass; same
  shape as Spec 006 / T01 (run #29).
- **Out-of-scope reminders for future runs:**
  - Tesla-Playwright is OPT-IN. Do NOT add it to
    `ALL_SOURCE_MODULES` even when the package compiles.
  - `playwright` dep is declared on `source-tesla-playwright`'s
    `package.json` ONLY. Root `package.json` does NOT declare it.
    Lockfile sync uses the npmjs.org registry override per
    `MEMORY.md` "Lockfile registry rule".
  - Q-026 / Q-027 salary-parser residuals are NOT bundled into Spec
    013. They retain their own future spec ID (Spec 014 or later).
  - Detail-page enrichment for Oracle / Mercor (richer
    `JobPostDto.description`, `applicationUrl`, etc.) is deferred
    to candidate Spec 016. Do NOT extend Oracle's or Mercor's
    services with detail fetches in this batch.
- **Decision boundaries to honour during T01..T15:**
  - **`source-tesla` (default) is HTTP-only.** No `playwright`
    import in this package, period. The Akamai bypass is a feature
    of the OPTIONAL companion plugin.
  - **Mercor is catalogue-wide.** Do NOT implement per-slug URL
    construction; the explore-page endpoint is the only entry point.
    Filter happens client-side after the GET.
  - **Oracle's `companyUrl` is the canonical input.** `companySlug`
    is a convenience shorthand; do NOT prefer it when both supplied.
- **Cross-spec coordination:**
  - When Spec 014 (or whichever spec inherits Q-026/Q-027) lands,
    update `docs/questions.md` Q-026/Q-027 resolution text from
    "tentatively Spec 013" to the actual spec ID that landed.
  - When Spec 016 (detail-page enrichment) lands, update Spec 006 §
    3 + Spec 013 § 3 non-goals references from "candidate Spec 016"
    to the actual spec ID + status.
