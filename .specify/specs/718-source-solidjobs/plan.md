# Plan: 718 — Source Job Board Plugin: Solid.Jobs

| Field        | Value      |
| ------------ | ---------- |
| Spec         | spec.md    |
| Created      | 2026-06-11 |
| Last updated | 2026-06-11 |

## 1. Approach

The plugin mirrors the established regional job-board template
(`packages/plugins/source-nofluffjobs/`): a self-contained package with
`package.json`, `tsconfig.json`, a module/service pair, a constants file
and a types file describing the wire payload. The solid.jobs public API
was probed live on 2026-06-11; all facts in the spec (divisions, the
mandatory `campaign` parameter, the offer shape, salary fields) come
from that probe.

`SolidJobsService.scrape()` resolves the division list (default `it`,
overridable via `SOLIDJOBS_DIVISIONS`), issues one GET per division
through `createHttpClient` with `Promise.allSettled` so a single failing
division cannot sink the batch, concatenates the fulfilled payloads,
then maps offers one by one inside per-offer `try/catch`. Mapping uses
existing shared helpers only: `htmlToPlainText` and `extractEmails`
from `@ever-jobs/common`, `getCompensationInterval` and
`getJobTypeFromString` from `@ever-jobs/models`. `descriptionFormat`
follows the established pattern where `HTML` passes the raw markup
through and every other format converts to plain text.

Testing is two-layered. Unit tests mock `createHttpClient` via
`jest.mock('@ever-jobs/common')` (the pattern used by the most recent
source-plugin cohort) and feed a fixture of three real offers captured
from the live `it` division. An e2e spec performs a tolerant live-API
smoke test, matching the convention of the other regional plugins. Both
suites import the service via relative paths because the global path
alias and jest mapper are owned by a later serial wiring step.

The only shared file edited is
`packages/models/src/enums/site.enum.ts` (explicitly granted): one new
trailing enum entry `SOLIDJOBS = 'solidjobs'`, carefully distinct from
the pre-existing `SOLIDES = 'solides'` (a Brazilian ATS).

## 2. Phases

### Phase 1 — Spec & live verification

- Goal: confirm endpoint behaviour, divisions and payload shape live.
- Deliverables: spec.md / plan.md / tasks.md; fixture captured.
- Exit criteria: eight divisions verified HTTP 200; campaign-less
  request verified HTTP 400; fixture contains ≥ 3 real offers.

### Phase 2 — Enum + plugin package

- Goal: compileable plugin package.
- Deliverables: `Site.SOLIDJOBS`; `packages/plugins/source-solidjobs/`
  (package.json, tsconfig.json, src/index.ts, solidjobs.module.ts,
  solidjobs.service.ts, solidjobs.types.ts, solidjobs.constants.ts).
- Exit criteria: service implements `IScraper`; mapping rules FR-5..FR-12.

### Phase 3 — Tests

- Goal: green suite proving the contract.
- Deliverables: `__tests__/solidjobs.service.spec.ts`,
  `__tests__/solidjobs.e2e-spec.ts`,
  `__tests__/fixtures/solidjobs-jobs.json`.
- Exit criteria: `npx jest packages/plugins/source-solidjobs --silent`
  passes from the repo root.

## 3. Packages Touched

| Package                              | Change                                |
| ------------------------------------ | ------------------------------------- |
| `packages/plugins/source-solidjobs`  | new package                           |
| `packages/models`                    | one `Site` enum value                 |
| `packages/plugins/index.ts`          | (no change — later wiring step)       |
| `tsconfig.base.json` / `jest.config.js` | (no change — later wiring step)    |

## 4. Dependencies

| Library | Version | Rationale                                    |
| ------- | ------- | -------------------------------------------- |
| (none)  | —       | shared `@ever-jobs/common` HTTP client + helpers suffice |

## 5. Risks & Mitigations

| Risk                                            | Likelihood | Impact | Mitigation                                      |
| ----------------------------------------------- | ---------- | ------ | ----------------------------------------------- |
| Campaign policy changes (param rejected/renamed) | L          | H      | constant in one place; HTTP errors degrade to `[]` |
| Division renamed/removed                        | L          | M      | `Promise.allSettled` + per-division error log    |
| Offer shape drift (e.g. salary becomes optional in practice) | M | L | salary already nullable; per-offer try/catch     |
| Polish-language searchTerm misses               | M          | L      | match across title, category, subCategory, skills |

## 6. Rollback Plan

The plugin is unwired (no registry/alias entries yet), so rollback is
deleting `packages/plugins/source-solidjobs/` and the single
`SOLIDJOBS` enum line. No data migration involved.

## 7. Migration Plan (if applicable)

Not applicable — new source, no existing consumers.

## 8. Open Questions for Plan

None beyond spec Q-1/Q-2 (defaults chosen, proceeding).
