# Spec 013 — ATS-Scrapers Parity, Batch 2 (Oracle HCM Cloud / Mercor / Tesla)

| Field          | Value                                                |
| -------------- | ---------------------------------------------------- |
| Spec ID        | 013                                                  |
| Slug           | ats-scrapers-parity-batch-2                          |
| Status         | draft (run #43); T01..T13 pending                    |
| Owner          | scheduled-task agent (`ever-jobs`)                   |
| Created        | 2026-04-27 (run #43)                                 |
| Last updated   | 2026-04-27 (run #43)                                 |
| Supersedes     | (none)                                               |
| Related specs  | 001 (Plugin Architecture Foundation), 003 (Dedup Engine), 005 (Circuit Breaker), 006 (ATS-Scrapers Parity, Batch 1) |

## 1. Problem Statement

The hourly competitor-watch backlog (`/competitor-watch.md §C`) lists nine
follow-up actions (AC-1..AC-9) accumulated across thirty-plus scheduled
runs. Spec 006 closed AC-1..AC-3 (Avature / Gem / Join.com) as a single
batched spec. Spec 012 closed AC-7 (European salary parser). The remaining
upstream-driven coverage gaps are AC-4..AC-6 — three new ATS / sourcing
platforms that exist in the upstream OSS reference codebase
(`OTHERS/Ats-scrapers/<vendor>/`) but not in our `packages/plugins/`
catalogue:

- **AC-4 — Oracle HCM Cloud (Oracle Recruiting Cloud).** Enterprise-grade
  multi-tenant ATS used by Oracle, City of Atlanta, TTX, EXP,
  CooperCompanies, Kroll, etc. URL pattern
  `https://{subdomain}.fa.{region}.oraclecloud.com`. Fetch path is the
  HCM CandidateExperience REST API
  (`/hcmRestApi/resources/latest/recruitingCEJobRequisitions`) with a
  finder-query string — same flavour as Workday's multi-tenant URL
  discovery, fits cleanly into the existing `IScraper` shape.
- **AC-5 — Mercor.** Single-tenant explore page at
  `https://work.mercor.com/`; one GET to
  `https://aws.api.mercor.com/work/listings-explore-page` returns ALL
  current public listings (no per-company segmentation, no pagination).
  Authorization header is a literal `Bearer` (empty token) per the
  upstream client. Different shape from any existing plugin: it is
  **catalogue-wide** rather than slug-keyed.
- **AC-6 — Tesla.** Single-company custom careers site at
  `https://www.tesla.com/careers/search/`. Internal API at
  `/cua-api/apps/careers/state` (board) and `/cua-api/careers/job/{id}`
  (detail). Akamai Bot Manager challenges are present; the upstream
  Python uses Playwright with a real Chromium session to bypass them.
  Different shape from any existing plugin: it is **single-tenant** AND
  **browser-automation-flavoured**, not pure HTTP.

Bundling AC-4..AC-6 into a single spec mirrors Spec 006's pattern (per
Q-024's "future bundled batch" line and run #42's pinned default) and
keeps the cold-start boot-time amortisation cost flat (one
`ALL_SOURCE_MODULES` rebuild, one lockfile sync round, one CI matrix
expansion). Even with their differing shapes, the three plugins share
the same registration topology (`Site` enum + `ALL_SOURCE_MODULES` +
two-place tsconfig+jest aliases per Spec 001) and the same authoring
rhythm (slug-or-URL-driven aggregator dispatch via
`/api/jobs?…&site=<key>`).

## 2. Goals

- Ship three new source plugins under `packages/plugins/`:
  - `source-ats-oracle` — REST GET against the multi-tenant
    `recruitingCEJobRequisitions` finder, paginated via
    `?offset=N&limit=100`. Custom-domain resolution from `companyUrl`
    (e.g. `https://eeho.fa.us2.oraclecloud.com`) with a default
    `siteNumber` of `CX_45001` (per Q-030).
  - `source-ats-mercor` — single GET to the explore-page endpoint;
    returns the entire public catalogue. Filter by `companySlug` /
    `searchKeywords` post-fetch (per Q-029).
  - `source-tesla` — Tesla single-company scraper. Pure-HTTP path by
    default (calls `/cua-api/apps/careers/state` directly with rotated
    UA + `Accept: application/json`); Playwright fallback gated behind
    a separate optional plugin package (`source-tesla-playwright`)
    that adds Akamai-bypass via lazy `import()` (per Q-028).
- Each plugin honours `ScraperInputDto.proxies / .caCert /
  .requestTimeout` via `@ever-jobs/common`'s `createHttpClient` (per
  Spec 001's HTTP-client mandate).
- Each plugin emits standard `JobPostDto` rows: `title / company /
  location / description / url / postedAt` — same shape Greenhouse,
  Lever, Workday, Avature, Gem, Join.com already produce.
- Each plugin registers in **all four** required places (per
  `AGENTS.md §5`): `site.enum.ts`, `packages/plugins/index.ts`,
  `tsconfig.base.json`, `jest.config.js`.
- Each plugin has **at least one** happy-path unit test under
  `__tests__/<plugin-id>.service.spec.ts` (per `AGENTS.md §7`).

## 3. Non-Goals

- **Hard parity with the Python upstream's CLI / discovery scripts.**
  We adopt the SCRAPER LOGIC, not the bundled
  `searxng_discovery.py` / `firecrawl_discovery.py` / SerpAPI tooling
  — discovery in Ever Jobs is the `PluginRegistry` itself (per
  `competitor-watch.md §D`). Same boundary as Spec 006.
- **Job-detail scraping for Oracle / Mercor.** Both expose richer
  per-job detail endpoints (Oracle's `recruitingCEJobRequisitionDetails`
  finder, Mercor's listing-by-id). Detail-fetch is deferred to a
  future spec (candidate Spec 016 — "ATS detail-page enrichment",
  same line listed in Spec 006 / § 3 carry-over). Tesla's detail
  endpoint is exercised in this spec only because Tesla's board
  endpoint emits `description = ""` for most jobs and the detail
  endpoint is the only way to populate `JobPostDto.description`.
- **Akamai bot-bypass in the default Tesla plugin.** The default
  `source-tesla` plugin SHALL attempt the pure-HTTP path. The
  Playwright-based fallback ships behind an OPTIONAL companion
  plugin `source-tesla-playwright` (per Q-028 default A). Operators
  must opt into the heavyweight Chromium dep explicitly.
- **Mercor authenticated-session flow.** Mercor's private listings
  (paid candidate dashboard) require a real candidate JWT. Public
  explore-page endpoint is unauthenticated by upstream design;
  no candidate-auth flow ships in this batch.
- **Oracle event search.** The upstream `recruitingCEEvents` finder
  is out of scope — Ever Jobs is a job-search engine, not an
  events board. Skipped intentionally.
- **AC-8 / AC-9.** Out of scope; remaining backlog items deferred
  to subsequent specs (AC-8 → Spec 014 candidate; AC-9 → Spec 015
  candidate; revisit after Spec 013 ships).
- **Q-026 / Q-027 salary parser residuals.** Renamed to **Spec 014
  candidate** — they were tentatively flagged "Spec 013" in the
  Q-026/Q-027 default text written in run #41, but run #42's
  Notes-for-the-next-run pinned Spec 013 to AC-4..AC-6 explicitly.
  The salary residuals will receive their own spec under Spec 014
  (or absorbed into the next pending currency-domain spec, whichever
  runs first).

## 4. User / Caller Stories

- *As a job-seeker dashboard*, I want to query
  `GET /api/jobs?site=oracle&companyUrl=https%3A%2F%2Feeho.fa.us2.oraclecloud.com&limit=50`
  and get a paginated list of Oracle's open roles via the HCM REST
  API.
- *As an operator*, I want a per-source breaker on each of the three
  plugins (Spec 005 / FR-1) so a Mercor 502 doesn't degrade the
  Oracle / Tesla fan-out.
- *As a downstream consumer*, I want each plugin's `JobPostDto.company`
  field populated correctly even when the upstream payload encodes the
  company differently (Oracle: `requisitionList[].EmployerName`;
  Mercor: `companyName`; Tesla: literal `'Tesla'`).
- *As a plugin author*, I want a small per-plugin
  `getCircuitBreakerPolicy()` override option for known-flaky Oracle
  tenants without forking the whole service (Spec 005 / FR-3).
- *As a security-conscious operator*, I want the Tesla plugin to NOT
  ship Playwright by default — Chromium adds ~280 MB to the install
  surface and one process boundary to harden. The Playwright-flavoured
  `source-tesla-playwright` plugin must be opt-in.

## 5. Functional Requirements

| ID     | Requirement                                                                                            | Priority |
| ------ | ------------------------------------------------------------------------------------------------------ | -------- |
| FR-1   | New plugin `source-ats-oracle` implements `IScraper` and exposes `Site.ORACLE = 'oracle'`.            | must     |
| FR-2   | `source-ats-oracle` paginates via `?offset=N&limit=100` against `recruitingCEJobRequisitions` until `requisitionList[]` empty OR `resultsWanted` cap hit. | must |
| FR-3   | `source-ats-oracle` accepts both `companyUrl` (full URL like `https://eeho.fa.us2.oraclecloud.com`) AND a `companySlug` interpreted as `<subdomain>-<region>` (e.g. `eeho-us2`) → URL composition `https://<subdomain>.fa.<region>.oraclecloud.com`. | must |
| FR-4   | `source-ats-oracle` accepts an optional `siteNumber` field on the input DTO (default `CX_45001`); used in the finder string `siteNumber=<value>`. | must |
| FR-5   | New plugin `source-ats-mercor` implements `IScraper` and exposes `Site.MERCOR = 'mercor'`.            | must     |
| FR-6   | `source-ats-mercor` issues exactly ONE GET to `https://aws.api.mercor.com/work/listings-explore-page` per call; consumes the response's `listings[]` array. | must |
| FR-7   | `source-ats-mercor` post-filters `listings[]` by `companySlug` (case-insensitive substring on `companyName`) when supplied; otherwise emits the full catalogue, capped by `resultsWanted`. | must |
| FR-8   | `source-ats-mercor` sets the literal `Authorization: Bearer` header (empty token) on every request, mirroring the upstream Python client. | must |
| FR-9   | New plugin `source-tesla` implements `IScraper` and exposes `Site.TESLA = 'tesla'`. Pure-HTTP path; no Playwright dep. | must |
| FR-10  | `source-tesla` calls `GET https://www.tesla.com/cua-api/apps/careers/state` with rotated UA + `Accept: application/json` headers; consumes `data.lookup.listings[]` → `JobPostDto[]`. | must |
| FR-11  | `source-tesla` issues a follow-up `GET https://www.tesla.com/cua-api/careers/job/{id}` for the **first ≤ 25 jobs** (capped by `resultsWanted`) to populate `JobPostDto.description`; remaining jobs get `description: null` (per Q-031). | should |
| FR-12  | `source-tesla` returns an empty `JobResponseDto` (NOT throws) when the board endpoint returns 403 / 503 / Akamai HTML — operator can install the optional `source-tesla-playwright` plugin to add the bypass path. | must |
| FR-13  | New OPTIONAL plugin `source-tesla-playwright` exposes `Site.TESLA_PLAYWRIGHT = 'tesla_playwright'`. Lazy-imports `playwright` at first `scrape()` call so the cold-start cost stays out of the default install. | should |
| FR-14  | All three default plugins register in `packages/models/src/enums/site.enum.ts`, `packages/plugins/index.ts`, `tsconfig.base.json` (paths), and `jest.config.js` (moduleNameMapper). | must     |
| FR-15  | All three default plugins use `@ever-jobs/common` `createHttpClient` so `proxies / caCert / requestTimeout` flow through correctly. | must     |
| FR-16  | All three default plugins respect `input.resultsWanted` (default `100`) and stop fetching once the cap is reached. | must     |
| FR-17  | All three default plugins produce `JobPostDto` with at minimum: `title`, `company`, `location` (string), `url`, `postedAt` (when available — Oracle and Tesla expose it; Mercor does not). | must |
| FR-18  | Each default plugin ships a `<plugin>.service.spec.ts` with at least three cases: happy-path parsing, empty-board guard, error-tolerance (HTTP 500 / 403 / 503 returns empty `JobResponseDto`, never throws). | must     |
| FR-19  | Each default plugin documents its scrape-input contract in a sibling JSDoc block on the `@SourcePlugin({…})` decorator AND in the `ATS_INTEGRATIONS.md` matrix. | should   |
| FR-20  | Each default plugin is dedup-engine-friendly: its emitted `JobPostDto.id` (or `(site, externalId)` tuple) is stable across reruns so the `dedup-hybrid` strategy can collapse identical postings (Spec 003 / FR-1). | must     |

## 6. Non-Functional Requirements

| ID     | Requirement                                                                                | Target            |
| ------ | ------------------------------------------------------------------------------------------ | ----------------- |
| NFR-1  | Per-plugin cold-start contribution to module-graph init (default plugins only)            | < 25 ms           |
| NFR-2  | `scrape()` p95 latency, single company, default `resultsWanted=100`, no proxy             | Oracle < 6 s; Mercor < 1.5 s; Tesla (HTTP-only path, board only) < 3 s; Tesla (HTTP + ≤25 detail fetches) < 12 s |
| NFR-3  | Per-plugin memory ceiling (`maxResults=100`)                                               | < 8 MB transient  |
| NFR-4  | Bundle weight per default plugin (NestJS module + service + types + constants)             | < 25 KB minified  |
| NFR-5  | Default circuit-breaker policy (Spec 005 / DEFAULT_CIRCUIT_POLICY)                         | inherited; no override unless evidence of flakiness (Tesla's HTTP path is the most likely candidate to need a tighter trip) |
| NFR-6  | `source-tesla-playwright` cold-start cost                                                  | unbounded (deferred via lazy `import()`); MUST NOT contribute to default-plugin cold-start |

## 7. Contracts

### 7.1 Plugin Surfaces

```ts
// packages/models/src/enums/site.enum.ts (additions)
export enum Site {
  // … existing values …
  ORACLE             = 'oracle',
  MERCOR             = 'mercor',
  TESLA              = 'tesla',
  TESLA_PLAYWRIGHT   = 'tesla_playwright', // optional, ships off by default
}

// Per-plugin service shape (uniform across the three default plugins)
@SourcePlugin({ site: Site.ORACLE, name: 'Oracle HCM Cloud', category: 'ats', isAts: true })
@Injectable()
export class OracleService implements IScraper {
  scrape(input: ScraperInputDto): Promise<JobResponseDto>;
}

@SourcePlugin({ site: Site.MERCOR, name: 'Mercor', category: 'ats', isAts: true })
@Injectable()
export class MercorService implements IScraper {
  scrape(input: ScraperInputDto): Promise<JobResponseDto>;
}

@SourcePlugin({ site: Site.TESLA, name: 'Tesla', category: 'company', isAts: false })
@Injectable()
export class TeslaService implements IScraper {
  scrape(input: ScraperInputDto): Promise<JobResponseDto>;
}

// Optional companion (NOT in ALL_SOURCE_MODULES by default; opt-in via env / config)
@SourcePlugin({ site: Site.TESLA_PLAYWRIGHT, name: 'Tesla (Playwright)', category: 'company', isAts: false })
@Injectable()
export class TeslaPlaywrightService implements IScraper {
  scrape(input: ScraperInputDto): Promise<JobResponseDto>;
}
```

### 7.2 ScraperInputDto fields consumed (subset)

| Field                     | Oracle | Mercor | Tesla | Tesla-Playwright | Notes |
| ------------------------- | :----: | :----: | :---: | :--------------: | ----- |
| `companySlug`             | ✓ (`<subdomain>-<region>` form) | ✓ (post-filter) | — (single tenant) | — | Mercor: case-insensitive substring on `companyName` |
| `companyUrl`              | ✓ (full Oracle URL override) | — | — | — | Oracle: precedence over `companySlug` |
| `siteNumber` (NEW)        | ✓ (default `CX_45001`)       | — | — | — | finder-string parameter |
| `resultsWanted`           | ✓      | ✓      | ✓     | ✓                | default 100 |
| `descriptionFormat`       | ✓ (md/html/text) | ✓ | ✓ | ✓ | optional |
| `proxies / caCert / requestTimeout` | ✓ | ✓ | ✓ | ✓ | per Spec 001 HTTP-client mandate |

### 7.3 Errors

| Code                              | Meaning                                                       |
| --------------------------------- | ------------------------------------------------------------- |
| `ERR_ORACLE_BAD_TENANT`           | Oracle: subdomain/region could not be resolved to a careers URL. |
| `ERR_ORACLE_FINDER_REJECTED`      | Oracle: finder-string returned 4xx (typically a bad `siteNumber`). |
| `ERR_MERCOR_ENVELOPE`             | Mercor: explore-page response missing `listings[]` array.     |
| `ERR_TESLA_AKAMAI_CHALLENGE`      | Tesla: board endpoint returned 403 / 503 / Akamai HTML body — install `source-tesla-playwright` for bypass. |
| `ERR_TESLA_PLAYWRIGHT_UNAVAILABLE`| Tesla-Playwright: `playwright` dep not installed at runtime.  |

(All five are caught and converted to an empty `JobResponseDto` per
`AGENTS.md §10` "Tests required" — never re-thrown to the aggregator.
The aggregator's circuit breaker counts the empty result as success
unless an upstream HTTP error bubbled, which the breaker independently
records.)

## 8. Test Plan

### 8.1 Unit (per plugin, under `packages/plugins/source-(ats-oracle|ats-mercor|tesla|tesla-playwright)/__tests__/`)

- **Happy path** — fixture HTML/JSON loaded from
  `__tests__/fixtures/<id>-page-1.{html,json}`; assert `JobPostDto[]`
  count, sample `title` / `company` / `url`.
- **Empty board** — empty `requisitionList[]` / `listings: []` /
  `lookup.listings: []`; assert empty `JobResponseDto` returned.
- **HTTP 500 error** — mocked `axios` throws; assert empty
  `JobResponseDto`, no exception bubbles.
- **`resultsWanted` cap** — fixture w/ ≥ 200 jobs, `resultsWanted: 50`;
  assert exactly 50 emitted, no extra page fetched.
- **Oracle only** — custom-tenant URL override via `companyUrl` input
  (`https://eeho.fa.us2.oraclecloud.com`); assert URL composition.
- **Oracle only** — custom `siteNumber` override (`CX_45002`); assert
  finder string carries the override.
- **Mercor only** — `companySlug` post-filter (`stripe`); assert only
  rows with `companyName` matching `stripe` (case-insensitive
  substring) survive.
- **Mercor only** — empty `companySlug` returns full catalogue
  (capped by `resultsWanted`).
- **Tesla only** — Akamai 403 sentinel response; assert empty
  `JobResponseDto` + sentinel error code recorded in service-internal
  metric.
- **Tesla only** — happy-path board fixture (≥ 50 jobs) + first
  3 detail-fetch responses; assert `description` populated for first
  3 only (FR-11), remaining `description === null`.
- **Tesla-Playwright only** — happy-path: stubbed `playwright` module
  resolves to a fixture-driven page; assert `JobPostDto[]` count
  matches fixture.
- **Tesla-Playwright only** — `playwright` module not installed
  (`require('playwright')` throws); assert
  `ERR_TESLA_PLAYWRIGHT_UNAVAILABLE` sentinel + empty `JobResponseDto`.

### 8.2 Integration (`apps/api/__tests__/integration/`)

- **`source-ats-batch-2.integration.spec.ts`** — wire all three
  default plugins (Oracle / Mercor / Tesla) through the live
  `JobsService` fan-out; assert each contributes ≥ 1 row from a
  stubbed-`createHttpClient` fixture. Verifies the four-place
  registration is correct. Tesla-Playwright is NOT included in
  this suite (default `ALL_SOURCE_MODULES` doesn't import it).

### 8.3 E2E (`apps/api/__tests__/e2e/`)

- **`source-ats-batch-2.e2e-spec.ts`** —
  `GET /api/jobs?site=oracle&companyUrl=…`,
  `&site=mercor&companySlug=stripe`,
  `&site=tesla` return `200 OK` + non-empty `JobPostDto[]` against a
  sandboxed fixture server. Asserts dedup-engine consumes the rows
  without collisions across the three plugins.

### 8.4 Performance

- Each default plugin's `scrape()` benchmark
  (`__tests__/<id>.bench.ts`) asserts NFR-2 ceilings against the
  `__tests__/fixtures/` corpus. Bench ships in this spec; CI gating
  is a follow-up.

## 9. Open Questions

- **Q-024** (resolved by this spec) — Spec packaging: 1 batched spec
  vs 3 per-plugin specs? **Default = batched, this spec.** Same
  rationale as Spec 006 / Q-021 — the per-plugin business logic is
  small (single REST GET for Mercor, REST + finder-string for Oracle,
  HTTP + 25 detail fetches for Tesla), so three independent specs
  would be 90% scaffolding noise.
- **Q-028** — Tesla Playwright dependency strategy. See
  `docs/questions.md` Q-028 (default = A: ship pure-HTTP `source-tesla`
  by default; Playwright bypass behind opt-in `source-tesla-playwright`
  companion plugin with lazy `import('playwright')`).
- **Q-029** — Mercor's catalogue-wide input semantics (no `companySlug`
  segmentation upstream). See `docs/questions.md` Q-029 (default =
  post-filter on `companySlug` after the single GET; empty slug returns
  full catalogue capped by `resultsWanted`).
- **Q-030** — Oracle `siteNumber` override default. See
  `docs/questions.md` Q-030 (default = `CX_45001`, the upstream
  Python's literal default).
- **Q-031** — Tesla detail-fetch budget (per-job description fetch
  is N+1 from the perspective of the board endpoint; cap at 25
  follow-ups). See `docs/questions.md` Q-031 (default = 25; tunable
  via `ScraperInputDto.descriptionDepth: 'board' | 'detail-25' |
  'detail-all'` with `'detail-25'` the default).

## 10. Decisions

(Empty until T01 lands. Append-only.)

## 11. References

- Upstream Python implementations:
  - `OTHERS/Ats-scrapers/oracle/scripts/oracle_ats_client/api_client.py`
    (Oracle REST client, ~300 LOC).
  - `OTHERS/Ats-scrapers/oracle/main.py` (driver script).
  - `OTHERS/Ats-scrapers/mercor/api_client.py` (Mercor explore-page,
    ~90 LOC).
  - `OTHERS/Ats-scrapers/tesla/main.py` (Playwright + Akamai bypass,
    ~700 LOC).
- Existing analogue plugins for shape reference:
  - `packages/plugins/source-ats-workday/` — multi-tenant URL
    discovery, Oracle's closest analogue.
  - `packages/plugins/source-ats-greenhouse/` — public-board JSON
    path, Mercor's closest analogue.
  - `packages/plugins/source-ats-avature/` — `companyUrl` override
    pattern, Oracle's reuses it.
- `docs/ATS_INTEGRATIONS.md` — coverage matrix to update on T-finale.
- `docs/COMPANY_SLUG_DIRECTORY.md` — append entries on each plugin's T0X.
- `competitor-watch.md §C` — backlog source (AC-4..AC-6).
- `AGENTS.md §5` — four-place plugin registration mandate.
- `Spec 001` — `PluginRegistry` discovery contract.
- `Spec 003 / FR-1` — `dedup-hybrid` consumer contract for
  `(site, externalId)`.
- `Spec 005 / FR-3` — per-plugin `getCircuitBreakerPolicy()` override.
- `Spec 006` — Batch-1 reference; this spec re-uses its phasing.
