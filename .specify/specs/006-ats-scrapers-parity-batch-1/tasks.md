# Tasks: 006 — ATS-Scrapers Parity, Batch 1 (Avature / Gem / Join.com)

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Bootstrap

- [x] T01 — Site enum + tsconfig paths + jest moduleNameMapper additions.
  - **Files (planned):** `packages/models/src/enums/site.enum.ts`,
    `tsconfig.base.json`, `jest.config.js`.
  - **Files (actual):** matched plan exactly.
  - **Acceptance:** `Site.AVATURE === 'avature'`, `Site.GEM === 'gem'`,
    `Site.JOIN_COM === 'join_com'`; tsconfig + jest mapper mirror all
    three new package paths. **Done:** run #29 (2026-04-27). The
    Site enum addition lands under a new `Phase 28: Spec 006 — ATS-
    Scrapers Parity, Batch 1` group comment so a future contributor
    sees exactly which spec introduced these vendor names. The
    underscore in `JOIN_COM = 'join_com'` honours the
    `ZIP_RECRUITER = 'zip_recruiter'` precedent for compound vendor
    names; the folder name (`source-ats-joincom`) drops the
    underscore per the existing hyphen convention for plugin
    folders. The path-and-mapper additions are the same three lines
    in two files — no fancy regex / build scaffolding needed.
  - **Estimate:** 0.25 day. **Actual:** ~0.1 day.

- [x] T02 — Three new plugin packages scaffolded; appended to
  `ALL_SOURCE_MODULES`.
  - **Files (planned):** `packages/plugins/source-ats-avature/{package.json,tsconfig.json,src/{index.ts,avature.module.ts,avature.service.ts},__tests__/avature.service.spec.ts}`,
    same shape for `source-ats-gem` and `source-ats-joincom`,
    plus `packages/plugins/index.ts`.
  - **Files (actual):** matched plan exactly. Three packages × four
    source files each + one test file each = 15 new files. Plus
    one edit to the `ALL_SOURCE_MODULES` barrel (3 imports
    added, 3 array entries added, all alphabetical).
  - **Acceptance:** Three packages exist and compile with stub
    `scrape(input) { return new JobResponseDto([]); }`.
    `ALL_SOURCE_MODULES` includes `AvatureModule`, `GemModule`,
    `JoinComModule`. **Done:** run #29 (2026-04-27). The five
    load-bearing decisions called out in run #28's Notes-for-the-
    next-run section all hold:
      1. **`join_com`** is the enum value; **`source-ats-joincom`**
         is the folder name. Tests pin `Site.JOIN_COM === 'join_com'`
         so a future rename has to update the assertion too.
      2. **`AvatureService` accepts both `companyUrl` and
         `companySlug`** — the stub doesn't exercise this yet, but
         the JSDoc on the service flags T03 as the landing point
         for the resolution logic so a future contributor doesn't
         add custom-domain support to the wrong service.
      3. **No new external deps** added this run. Avature service
         imports `cheerio` from `@ever-jobs/common` will land in
         T03; Gem imports `axios.post` JSON in T05; Join.com uses
         `axios.get` + `String.prototype.match` in T07. Lockfile
         is unchanged.
      4. **Default `DEFAULT_CIRCUIT_POLICY`** inherited — none of
         the three services implement
         `getCircuitBreakerPolicy()`. T03 / T05 / T07 will revisit
         per-source policy if integration testing reveals
         flakiness.
      5. The four-place registration scaffolding is now exercised
         by three new unit specs (one per service), each pinning
         (a) NestJS DI resolution via the corresponding module,
         (b) stub `scrape()` returning empty `JobResponseDto`,
         (c) the new `Site` enum value's literal string. This
         locks the scaffolding before any source behaviour exists
         — a regression here means the four-place registration is
         broken.
    Verification: 9 / 9 new cases lock the registration path
    (3 cases × 3 services). Tests cannot run in this sandbox (no
    `node_modules` — pattern from runs #21–#28); CI on push
    validates the full unit + integration bundle. Spec 006
    graduates from "draft (run #28); T01..T13 pending" to
    "Phase 1 done (T01..T02 run #29); T03..T13 pending".
  - **Estimate:** 0.5 day. **Actual:** ~0.3 day.

## Phase 2 — Avature

- [x] T03 — `AvatureService.scrape(input)` HTML-scrape path.
  - **Files (planned):** `packages/plugins/source-ats-avature/src/avature.service.ts`,
    `…/avature.types.ts`, `…/avature.constants.ts`.
  - **Files (actual):** matched plan exactly. Plus a tiny one-line
    addition to `packages/models/src/dtos/scraper-input.dto.ts`
    (new `companyUrl?: string` field — Q-022 / Option A) so the
    custom-domain override has a place to live in the canonical
    DTO. Documented inline as "Used by the Avature plugin (Spec
    006 / Q-022)" so a future contributor sees the call-site
    immediately.
  - **Acceptance:**
    - Resolves base URL from `input.companyUrl ?? \`https://\${input.companySlug}.avature.net\``. ✅ `tenantFromUrl` honours
      both, and `extractCompanyName` casefolds the host segment
      (`bloomberg.avature.net` → `Bloomberg`, `careers.ibm.com` →
      `Ibm`). Locale prefix preservation (`/en_US`, `/fr_CA`,
      etc.) carries over from upstream Python's
      `extract_base_url`.
    - Paginates `${base}/careers/SearchJobs/?jobOffset=N&jobRecordsPerPage=12`
      until empty page or short page. ✅ `AVATURE_RECORDS_PER_PAGE`
      = 12, `AVATURE_MAX_PAGES` = 50 (hard ceiling guards against
      runaway loops).
    - Parses HTML via `cheerio`; multi-selector chain matches
      upstream Python's resilience (`article.job` / `div.job-item`
      / `li.job-listing` / `tr.job` / `div[data-job-id]`, link-text
      fallback). ✅ Five-cascade chain in `parseListings`, plus an
      `/JobDetail/`-link fallback when none of the five hit.
    - Skips Apply-link decoys (link-text in `['apply','apply now',
      'apply online','learn more','view job']`). ✅
      `AVATURE_APPLY_DECOY_TEXTS` is a `ReadonlySet<string>`;
      filtering happens twice (once on link text, once on title)
      so Apply-decoys can't slip through under either branch.
    - Caps at `input.resultsWanted` (default 100). ✅ Default lives
      in `AVATURE_DEFAULT_RESULTS_WANTED` (= 100); the cap fires
      mid-page so we don't burn an extra HTTP request once we've
      collected enough.
    - Catches HTTP errors → returns empty `JobResponseDto`, never
      throws. ✅ Error branch logs at `warn` level and breaks the
      pagination loop — caller sees an empty array, never a
      thrown error.
  - **Done:** run #30 (2026-04-27). Implementation =
    1 service.ts (~210 LOC) + 1 constants.ts (~50 LOC) + 1
    types.ts (~30 LOC); polite pacing of 0.5 s wired via
    `createHttpClient({ rateDelayMin: 0.5 })`. Default circuit-
    breaker policy inherited (no override needed).
  - **Estimate:** 1 day. **Actual:** ~0.5 day.

- [x] T04 — Avature unit tests.
  - **Files (planned):** `packages/plugins/source-ats-avature/__tests__/avature.service.spec.ts`,
    `…/__tests__/fixtures/avature-page-1.html`.
  - **Files (actual):** matched plan plus one extra fixture
    (`avature-page-empty.html`) so the empty-page assertion has a
    distinct fixture from the populated one — letting the same
    `mockGet.mockResolvedValueOnce` chain feed both pages of the
    happy-path test (page 1 = populated, page 2 = empty → loop
    breaks).
  - **Acceptance:** ≥ 5 cases — happy path (12 jobs), empty page,
    HTTP 500 caught, `resultsWanted=5` cap, custom-domain override
    via `companyUrl`. All green. ✅ **8 cases** total (5 mandated
    + 2 carry-over scaffolding cases from T02 + 1 extra "neither
    companyUrl nor companySlug" no-op case proving the warning
    branch). Happy-path counts 11 jobs (12 anchors minus the 1
    Apply-decoy at id=12349), and pins remote detection (id=12347
    "Remote — Americas" → `isRemote=true`) plus location/department
    parsing.
  - **Done:** run #30 (2026-04-27). Local
    `npx jest --testPathPatterns 'packages/plugins/source-ats-avature'`
    reports `Test Suites: 1 passed, 1 total · Tests: 8 passed, 8
    total · exit 0`. Full source-plugin run reports
    `Test Suites: 1 skipped, 120 passed, 120 of 121 total · Tests:
    12 skipped, 318 passed, 330 total · exit 0` (313 → 318 = +5
    net new passing cases vs run #29's baseline; the 3 stubs are
    now subsumed under the new 8-case spec).
  - **Estimate:** 0.5 day. **Actual:** ~0.3 day.

## Phase 3 — Gem

- [x] T05 — `GemService.scrape(input)` GraphQL-batch path.
  - **Files (planned):** `packages/plugins/source-ats-gem/src/gem.service.ts`,
    `…/gem.types.ts`, `…/gem.constants.ts`.
  - **Files (actual):** matched plan exactly.
    `gem.service.ts` (~190 LOC),
    `gem.constants.ts` (~100 LOC; queries + endpoint + headers +
    `GEM_DEFAULT_RESULTS_WANTED = 100`),
    `gem.types.ts` (~75 LOC; structural interfaces for the
    `oatsExternalJobPostings` response shape).
  - **Acceptance:**
    - Single POST to `https://jobs.gem.com/api/public/graphql/batch`
      with both `JobBoardTheme` and `JobBoardList` operations
      carrying `boardId = input.companySlug`. ✅ Unit case
      "happy path … pins the wire request" asserts exactly two
      operations are present, in the canonical order, with the
      slug bound to `boardId`.
    - Headers: `Accept: */*`, `Content-Type: application/json`,
      `Origin/Referer: https://jobs.gem.com`, `batch: true`,
      `User-Agent` per `@ever-jobs/common`. ✅ `GEM_HEADERS`
      constant carries every required header, including the
      load-bearing `batch: 'true'` flag — the server silently
      degrades to non-batched without it.
    - Picks the response array element whose
      `data.oatsExternalJobPostings` is defined (tolerates
      response-order swap). ✅ `pickJobBoardListEnvelope`
      walks the response array and returns the first envelope
      whose `data.oatsExternalJobPostings !== undefined` —
      tolerates Theme-first OR List-first ordering. Unit case
      "response-order tolerance" pins the inverted-order shape
      with a `.reverse()`-d clone of the fixture.
    - Maps each `jobPostings[i]` to a `JobPostDto` with
      `id = "gem-${extId ?? id}"`, `title`, `location =
      locations[0]?.name`, `department = job?.department?.name`,
      `url = \`https://jobs.gem.com/\${slug}/jobs/\${id}\``,
      `companyName = jobBoardExternal.teamDisplayName ?? slug`.
      ✅ `toJobPost` builds the DTO; remote detection cascades
      through `locations[0].isRemote`, then case-insensitive
      `"remote"` substring match on the location name, then
      `job.locationType.toLowerCase().includes('remote')`.
    - Caps at `input.resultsWanted`. ✅ `for-of` loop breaks
      once `jobs.length >= resultsWanted`. Unit case
      "honours resultsWanted=2 against a 3-posting fixture"
      pins this.
    - Catches HTTP errors → empty `JobResponseDto`. ✅
      `try`/`catch` around the `client.post` call; rejection
      logs at `warn` and returns `new JobResponseDto([])`.
      Two unit cases (HTTP 500 caught + a fresh socket-hangup
      rejection) verify the never-throw posture.
  - **Done:** run #31 (2026-04-27). Two minor design choices
    weren't called out in `tasks.md` and were locked into the
    source/test surface:
      1. **Coerce a non-array response into a single-element
         array.** A misconfigured upstream redirect can return
         an unwrapped envelope (the `batch: 'true'` header is
         silently dropped along the redirect chain). The parser
         handles this with `Array.isArray(raw) ? raw : raw ?
         [raw] : []` so the one-envelope case still has a chance
         of matching `JobBoardList` (the more common failure mode
         is the redirect dropping the List operation entirely,
         which falls through to the "no envelope carries
         `oatsExternalJobPostings`" branch and emits an empty
         `JobResponseDto`).
      2. **`null` for missing-id postings.** A posting with
         neither `extId` nor `id` is dropped (returned `null`
         from `toJobPost` and filtered out) rather than synthesised
         with a placeholder. Synthetic ids would break dedup
         keying downstream — Spec 003's hash strategy uses the
         canonical `id` field as one of the three primary
         signals, and a `gem-undefined-${i}` synthetic would
         collapse every missing-id posting into one canonical
         row.
  - **Estimate:** 1 day. **Actual:** ~0.4 day.

- [x] T06 — Gem unit tests.
  - **Files (planned):** `packages/plugins/source-ats-gem/__tests__/gem.service.spec.ts`,
    `…/__tests__/fixtures/gem-batch-response.json`.
  - **Files (actual):** matched plan exactly.
    `gem.service.spec.ts` (~190 LOC),
    `__tests__/fixtures/gem-batch-response.json` (~95 LOC; 3
    postings + theme envelope + companyInfo).
  - **Acceptance:** ≥ 4 cases — happy path, empty `jobPostings`,
    HTTP 500 caught, response-order tolerance (Theme first vs
    List first). All green. ✅ **9 cases** total (4 mandated + 3
    carry-over scaffolding cases from T02 + 1 extra
    "resultsWanted=2 mid-fixture cap" + 1 extra "no envelope
    carries oatsExternalJobPostings" sentinel test). Locally
    `npx jest --testPathPatterns 'packages/plugins/source-ats-gem'`
    reports `Test Suites: 1 passed, 1 total · Tests: 9 passed,
    9 total · exit 0`.
  - **Done:** run #31 (2026-04-27). Fixture deep-cloned per
    case via `JSON.parse(JSON.stringify(...))` so one mutation
    (e.g. emptying `jobPostings[]` for the "empty" case) doesn't
    leak into a sibling test.
  - **Estimate:** 0.5 day. **Actual:** ~0.3 day.

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

## Notes-for-the-next-run (pinned default for run #31)

- Default = **Spec 006 / Phase 3 / T05 + T06** — `GemService.scrape()`
  GraphQL-batch implementation plus its ≥ 4 unit cases (happy path,
  empty `jobPostings`, HTTP 500, response-order tolerance). Reasoning:
  Gem is the only one of the three plugins that's a single-request
  scrape (no pagination), so the diff stays reviewable when bundled
  with its tests. T07+T08 (Join.com — two-step REST scrape with
  regex-extracted company ID) is the second-smallest and is the
  next default after T05+T06. T09..T13 (integration / e2e / docs /
  bench / closeout) wait until all three plugin behaviours land.
- The five load-bearing decisions from run #28 still hold; added
  this run:
  6. **`companyUrl` is now a first-class field on `ScraperInputDto`**
     — runtime override for ATS scrapers that support custom-domain
     career portals (Avature today; Workday already had its own
     URL helper in `Site.WORKDAY`). Q-022 / Option A pinned this in
     run #28; T03 made it concrete. Future ATS plugins that need
     the same custom-domain override should reuse this field, not
     introduce a per-plugin equivalent.
- The five load-bearing decisions deferred to T01:
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
