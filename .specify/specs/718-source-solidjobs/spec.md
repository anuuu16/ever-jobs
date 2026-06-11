# Spec: 718 — Source Job Board Plugin: Solid.Jobs

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Spec ID        | 718                                    |
| Slug           | source-solidjobs                       |
| Status         | done                                   |
| Owner          | agent                                  |
| Created        | 2026-06-11                             |
| Last updated   | 2026-06-11                             |
| Supersedes     | (none)                                 |
| Related specs  | 001, 003, 005                          |

## 1. Problem Statement

solid.jobs is a Polish job board with a strong IT focus and mandatory
salary transparency. It exposes a free, unauthenticated public JSON API
at `https://solid.jobs/public-api/offers/{division}?campaign={campaign}`.

A live probe of the public API on 2026-06-11 confirmed eight working
divisions with substantial volume: `it` (500 jobs), `sales` (377),
`finances` (237), `marketing` (202), `logistics` (155), `engineering`
(137), `other` (126) and `hr` (113). Every offer in the probed `it`
snapshot carried a salary object (board policy appears to mandate salary
disclosure), making this a high-signal source for compensation data in
the Polish/CEE market. The aggregator currently has no plugin for it.

Naming note: the existing `Site.SOLIDES = 'solides'` entry is a
**different** product — Sólides (solides.com.br), a Brazilian ATS. The
new entry `Site.SOLIDJOBS = 'solidjobs'` (solid.jobs, Poland) must not
collide with it, and the two must not be confused in registry tooling.

## 2. Goals

- Ship a `source-solidjobs` regional job-board plugin returning live
  `JobPostDto` rows from the solid.jobs public API.
- Scrape the `it` division by default; allow a comma-separated division
  override via the `SOLIDJOBS_DIVISIONS` env var, fanned out with
  `Promise.allSettled`.
- Map salary (`PLN`/`Month`), contract time, locations, remote flag and
  HTML descriptions into the canonical DTO shape.
- Bundle a fixture-backed unit-test suite (mocked HTTP) plus a live-API
  e2e spec mirroring the regional-plugin convention.

## 3. Non-Goals

- Registration in `packages/plugins/index.ts`, `tsconfig.base.json` and
  `jest.config.js` (owned by a later serial wiring step).
- Pagination (the API returns the full division in one response).
- Scraping divisions beyond those verified live.
- Per-offer detail fetches (the list payload already contains the full
  HTML description).

## 4. User / Caller Stories

> As an **aggregator caller**, I want **`Site.SOLIDJOBS`** in the source
> registry, so that **a single `siteType: [Site.SOLIDJOBS]` request
> returns live Polish IT roles with salary data**.

> As an **operator**, I want **`SOLIDJOBS_DIVISIONS=it,engineering`**
> to widen coverage, so that **non-IT divisions can be enabled without a
> code change**.

## 5. Functional Requirements

| ID    | Requirement                                                                  | Priority |
| ----- | ---------------------------------------------------------------------------- | -------- |
| FR-1  | Add `Site.SOLIDJOBS = 'solidjobs'` to the `Site` enum (distinct from `SOLIDES`). | must |
| FR-2  | New plugin package `@ever-jobs/source-solidjobs` decorated `@SourcePlugin({ site: Site.SOLIDJOBS, name: 'Solid.Jobs', category: 'regional' })` (not an ATS). | must |
| FR-3  | `SolidJobsService.scrape(input)` GETs `https://solid.jobs/public-api/offers/{division}?campaign=api` per division; the `campaign` query param is mandatory (server replies HTTP 400 without it). | must |
| FR-4  | Default division `it`; `SOLIDJOBS_DIVISIONS` (comma-separated) overrides; fan-out via `Promise.allSettled`, results concatenated, capped at `input.resultsWanted ?? 100`. | must |
| FR-5  | `id = "solidjobs-" + jobOfferKey`; `jobUrl = url`; `companyName = company`; `site = Site.SOLIDJOBS`. | must |
| FR-6  | `location.city = locations[0] ?? null`; state/country left null (see Q-1). `isRemote = isRemote === true`. | must |
| FR-7  | `descriptionFormat` honoured: `HTML` → raw HTML pass-through; `MARKDOWN` → `markdownConverter`; otherwise `htmlToPlainText`. | must |
| FR-8  | Salary present → `CompensationDto` with `minAmount = from`, `maxAmount = to`, `currency`, `interval` from `getCompensationInterval(period.toLowerCase())`. | must |
| FR-9  | `jobType` resolved from `contractTime` via `getJobTypeFromString` (underscores normalised to spaces: `full_time` → fulltime, `part_time` → parttime). | must |
| FR-10 | `input.searchTerm` matched case-insensitively against title, category, subCategory and skill names. | should |
| FR-11 | Per-offer mapping failures skip the single offer with `Logger.warn`; HTTP failures yield an empty `JobResponseDto` with `Logger.error`; `scrape()` never throws. | must |
| FR-12 | `emails` extracted from the rendered description via `extractEmails`. | must |

## 6. Non-Functional Requirements

| ID     | Requirement                                            | Target                  |
| ------ | ------------------------------------------------------ | ----------------------- |
| NFR-1  | No new runtime dependencies                            | 0 added packages        |
| NFR-2  | One HTTP request per configured division               | ≤ N(divisions) requests |
| NFR-3  | `Logger` (`@nestjs/common`) only — no `console.*`      | 0 console calls         |
| NFR-4  | Resilient to malformed/partial payloads                | no unhandled throw      |

## 7. Contracts

### 7.1 API / Interface

```ts
@SourcePlugin({ site: Site.SOLIDJOBS, name: 'Solid.Jobs', category: 'regional' })
@Injectable()
export class SolidJobsService implements IScraper {
  scrape(input: ScraperInputDto): Promise<JobResponseDto>;
}
```

Wire shape (verified live 2026-06-11):

```ts
interface SolidJobsOffer {
  jobOfferKey: string;          // uuid
  title: string;
  division: string;             // e.g. "IT"
  category: string;             // e.g. "Developer"
  subCategory: string;          // e.g. "Java"
  company: string;
  companyLogoUrl: string;
  salary: {
    from: number; to: number;
    currency: string;           // "PLN" observed
    period: string;             // "Month" observed
    employmentType: string;     // "UoP" | "B2B" | "UZ" observed
  } | null;
  contractTime: string;         // "full_time" | "part_time" observed
  locations: string[];          // city names; single entry in probed snapshot
  benefits: string[];
  isRemote: boolean;
  isHybrid: boolean;
  url: string;                  // absolute offer URL (campaign echoed as suffix)
  experienceLevel: string;
  skills: Array<{ level: string; name: string }>;
  languages: Array<{ level: string; name: string }>;
  description: string;          // HTML
}
// response envelope: { jobs: SolidJobsOffer[] }
```

### 7.2 Errors

| Condition                          | Behaviour                                   |
| ---------------------------------- | ------------------------------------------- |
| Missing `campaign` param           | server HTTP 400 — plugin always sends `campaign=api` |
| Division request fails             | `Logger.error`, division contributes 0 jobs |
| Payload missing `jobs[]`           | `Logger.warn`, division contributes 0 jobs  |
| Single offer malformed             | `Logger.warn`, offer skipped                |
| Anything else inside `scrape()`    | caught — caller sees `{ jobs: [] }`         |

## 8. Test Plan

- Unit (`__tests__/solidjobs.service.spec.ts`, mocked `createHttpClient`,
  fixture `__tests__/fixtures/solidjobs-jobs.json` — 3 real offers
  captured live on 2026-06-11):
  - happy path: ≥ 3 jobs mapped; ids/titles/urls/site/company/city correct;
    request URL is `https://solid.jobs/public-api/offers/it?campaign=api`;
  - salary mapping (PLN, monthly interval, from/to amounts) and the
    salary-null branch (compensation absent, job still mapped);
  - jobType mapping (`full_time` → fulltime, `part_time` → parttime);
  - descriptionFormat: HTML pass-through vs markdown vs plain-text conversion;
  - searchTerm: title / subCategory / skill-name hit; non-matching term → 0;
  - resultsWanted cap; `SOLIDJOBS_DIVISIONS` override fans out per division;
  - empty payload → `[]`; HTTP rejection → `[]` without throwing;
  - malformed offer (missing title) skipped while siblings map.
- E2E (`__tests__/solidjobs.e2e-spec.ts`): live API smoke — result shape,
  `resultsWanted` cap, searchTerm tolerance (regional-plugin convention).

## 9. Open Questions

- **Q-1 — Default `location.country` to Poland?** All offers in the
  probed snapshot are Polish cities, but the wire payload carries no
  country field, and some boards add foreign locations later. Default:
  leave `country` (and `state`) `null` and let downstream enrichment
  geocode the city `(default — proceeding)`. `docs/questions.md` is owned
  by a later serial step; recorded here per spec-first convention.
- **Q-2 — Map `validFrom` to `datePosted`?** The wire payload exposes
  `validFrom`/`validTo`/`updatedAt` timestamps, but `validFrom` looks like
  a validity-window start rather than a posting date. Default: do not map
  `datePosted` in this spec `(default — proceeding)`.

## 10. Decisions

- **D-1 (2026-06-11):** Campaign value fixed to `api` — verified accepted
  live; the server echoes it into offer URLs as a referral suffix, and
  rejects requests without a campaign (HTTP 400, lowercase/number/dash
  ≤ 64-char constraint quoted in the error body).
- **D-2 (2026-06-11):** Only the eight live-verified divisions are
  documented (`it`, `engineering`, `finances`, `marketing`, `sales`,
  `hr`, `logistics`, `other`); default scrape uses `it` only.
- **D-3 (2026-06-11):** `contractTime` underscores normalised to spaces
  before `getJobTypeFromString` (its alias normaliser strips whitespace
  and hyphens but not underscores).
- **D-4 (2026-06-11):** Unit tests follow the mocked-`createHttpClient`
  + real-fixture pattern of the most recent source-plugin cohort; the
  e2e spec follows the regional-plugin live-API smoke convention. Both
  import the code under test via relative paths so they run before
  global wiring exists.
- **D-5 (2026-06-11, post-review):** Three review fixes: (a) offers
  rejected by `mapJob` for a missing `jobOfferKey`/`title`/`url` now emit
  the FR-11 `Logger.warn` instead of being skipped silently; (b)
  `DescriptionFormat.MARKDOWN` (the `ScraperInputDto` default) is honoured
  via the shared `markdownConverter`, matching the arbeitnow regional
  pattern (FR-7 updated); (c) observed `employmentType` values extended
  with `"UZ"` (umowa zlecenie), present in offer 2 of the captured fixture.

## 11. References

- `packages/plugins/source-nofluffjobs/` — structural template
  (regional Polish board, public JSON API).
- `packages/plugins/source-arbeitnow/src/arbeitnow.service.ts` —
  `descriptionFormat` handling pattern (`markdownConverter` for MARKDOWN).
- `packages/models/src/enums/compensation-interval.enum.ts` —
  `getCompensationInterval`.
- `packages/models/src/enums/job-type.enum.ts` — `getJobTypeFromString`.
- `packages/models/src/dtos/job-post.dto.ts`
