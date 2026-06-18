# Plan: 741 — Source ATS Plugin: Beisen (iTalent)

| Field          | Value                              |
| -------------- | ---------------------------------- |
| Spec ID        | 741                                |
| Slug           | source-ats-beisen                  |
| Status         | accepted                           |
| Owner          | agent                              |
| Created        | 2026-06-18                         |
| Last updated   | 2026-06-18                         |

Implements [spec.md](./spec.md). Mirrors the structure of the sibling China-region adapter
(`source-ats-mokahr`, Spec 387) and the generic multi-tenant ATS adapters, adapted to Beisen's
two-step (resolve → list) flow.

## Package layout

```
packages/plugins/source-ats-beisen/
  package.json                       # @ever-jobs/source-ats-beisen, MIT, src entry
  tsconfig.json                      # extends ../../../tsconfig.base.json
  src/
    index.ts                         # re-exports module + service
    beisen.constants.ts              # hosts, paths, regexes, pagination + timeout bounds
    beisen.types.ts                  # wire interfaces (BSGlobal, envelope, role) + normalised job
    beisen.module.ts                 # NestJS @Module wrapping the service
    beisen.service.ts                # @SourcePlugin + IScraper implementation
  __tests__/
    beisen.service.spec.ts           # mocked-HTTP unit suite (fixtures, ≥ 10 cases)
    beisen.e2e-spec.ts               # tolerant live e2e (zero results acceptable)
    fixtures/
      beisen-register.html           # BSGlobal homepage HTML fixture
      beisen-jobs.json               # GetJobAdPageList envelope fixture (3 real-shape roles)
```

## Component design

### `beisen.constants.ts`
- `BEISEN_ROOT_DOMAIN = 'zhiye.com'`, `BEISEN_TENANT_HOST = (slug) => https://{slug}.zhiye.com`.
- `BEISEN_REGISTER_PATH = '/portal/registerSystemInfo'`, `BEISEN_SEARCH_PATH = '/api/Jobad/GetJobAdPageList'`.
- `beisenJobUrl(base, jobAdId)` → `${base}/portal/jobs/{id}`.
- `BEISEN_PAGE_SIZE = 50`, `BEISEN_MAX_PAGES = 100`, `BEISEN_DEFAULT_RESULTS = 100`,
  `BEISEN_DEFAULT_TIMEOUT_SECONDS = 20`.
- `BEISEN_HEADERS` (browser UA, JSON Accept, zh Accept-Language).
- `BEISEN_BSGLOBAL_REGEX = /var\s+BSGlobal\s*=\s*\{/`, `BEISEN_TENANT_ID_REGEX =
  /stcms\.beisen\.com\/image\/(\d+)/`, `BEISEN_DISPLAY_FIELDS`, `BEISEN_REMOTE_REGEX`
  (English + 远程/居家办公), `BEISEN_UNSET_DATE_PREFIX = '0001-01-01'`.

### `beisen.types.ts`
- `BeisenBsGlobal` (`Key?`, `Name?`, `PortalId?`, `Code?`).
- `BeisenJobRecord` (`JobAdId?`, `JobAdName?`, `LocNames?`, `Duty?`, `Require?`, `Description?`,
  `Salary?`, `Category?`, `Department?`, `ChangeDate?`, `PostDate?`, `Status?`, `OrgId?`).
- `BeisenListEnvelope` (`Code?`, `Message?`, `Count?`, `Data?`).
- `BeisenJob` — normalised role ready for `JobPostDto`.
- `ResolvedBeisenTenant` (`slug`, `base`, `portalId`, `companyName?`, `tenantId?`).

### `beisen.service.ts`
1. `scrape(input)` — resolve slug → `{base}`; if none, empty. Build a timeout-bounded
   `HttpClient`; `setHeaders(BEISEN_HEADERS)`.
2. `resolveTenant(client, base)` — GET `registerSystemInfo` as text; extract `BSGlobal` via a
   balanced-brace scan (string/escape aware) + `JSON.parse`; require `PortalId`. Missing ⇒ null.
3. `fetchJobList(client, tenant, resultsWanted)` — POST pages `PageIndex=0..MAX_PAGES`; per page
   `fetchPage` returns `{ records, count, hostReachable }`. Dedup by `JobAdId`; stop on empty /
   short page / no-new / count-reached. Transport failure aborts the walk (degrade to partial).
4. `processRecord` → `normaliseRecord` → `processJob` → `JobPostDto`, mirroring MokaHR.
5. Helpers: `deriveAtsId`, `pickTitle`, `formatLocation(LocNames)`, `joinBody(Duty,Require)`,
   `formatDescription`, `parseDate` (ignore `0001-01-01…`), `detectRemote`, `cleanText`,
   `extractBsGlobal`, `deriveCompanyName`.

All HTTP wrapped: HTTP status (4xx/5xx) ⇒ reachable, no body; transport error ⇒ host-down stop.
Never throws out of `scrape`.

## Wiring (4 touch-points)
1. `packages/models/src/enums/site.enum.ts` — `// Phase 737: Spec 741 …` + `BEISEN = 'beisen'`.
2. `packages/plugins/index.ts` — `import { BeisenModule } from './source-ats-beisen';` + add to `ALL_SOURCE_MODULES`.
3. `tsconfig.base.json` — `"@ever-jobs/source-ats-beisen": ["packages/plugins/source-ats-beisen/src/index.ts"]`.
4. `jest.config.js` — `'^@ever-jobs/source-ats-beisen$': '<rootDir>/packages/plugins/source-ats-beisen/src/index.ts'`.

## Tests
- **Unit** (`beisen.service.spec.ts`, mocked `createHttpClient`): DI resolution; enum value;
  happy-path mapping of all fixture roles; tenant from bare slug / full URL / `companyUrl`;
  missing `BSGlobal` ⇒ empty; missing `PortalId` ⇒ empty; HTTP 404 on register ⇒ empty;
  transport failure ⇒ empty; malformed body ⇒ empty; empty board ⇒ empty; `resultsWanted` cap;
  date parsing (`0001-01-01` ignored); remote detection. (≥ 10 cases.)
- **E2E** (`beisen.e2e-spec.ts`): hits a known public tenant; zero results acceptable; shape
  assertions only when roles returned; missing-input ⇒ empty.

## Verification
- `npm run build` (api+cli+mcp) green.
- `npx jest packages/plugins/source-ats-beisen` green.
- `node scripts/docs-lint.ts` (or repo doc-lint) clean after index/log updates.
