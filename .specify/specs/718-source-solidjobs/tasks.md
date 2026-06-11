# Tasks: 718 — Source Job Board Plugin: Solid.Jobs

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Spec & live verification

- [x] T01 — Live-probe the public API and author spec/plan/tasks
  - **Files:** `.specify/specs/718-source-solidjobs/{spec.md,plan.md,tasks.md}`
  - **Acceptance:** eight divisions verified HTTP 200 with job counts;
    campaign-less request verified HTTP 400; wire shape documented from a
    live payload; `SOLIDES` vs `SOLIDJOBS` distinction recorded.
  - **Estimate:** 0.5 day

- [x] T02 — Capture real fixture
  - **Files:** `packages/plugins/source-solidjobs/__tests__/fixtures/solidjobs-jobs.json`
  - **Acceptance:** ≥ 3 real offers from the live `it` division; includes
    a remote offer, a `part_time` offer and a `full_time` on-site offer;
    valid UTF-8 JSON under a `{ jobs: [...] }` envelope.
  - **Estimate:** 0.5 day

## Phase 2 — Enum + plugin package

- [x] T03 — Add `Site.SOLIDJOBS`
  - **Files:** `packages/models/src/enums/site.enum.ts`
  - **Acceptance:** trailing entry `SOLIDJOBS = 'solidjobs'` with the
    phase-comment convention; no collision with `SOLIDES = 'solides'`.
  - **Estimate:** 0.5 day

- [x] T04 — Scaffold package + constants + types
  - **Files:** `packages/plugins/source-solidjobs/{package.json,tsconfig.json}`,
    `packages/plugins/source-solidjobs/src/{index.ts,solidjobs.module.ts,solidjobs.constants.ts,solidjobs.types.ts}`
  - **Acceptance:** mirrors the regional-plugin template; constants
    `SOLIDJOBS_API_URL`, `SOLIDJOBS_CAMPAIGN = 'api'`,
    `SOLIDJOBS_DEFAULT_DIVISION = 'it'`, Accept + desktop-Chrome headers;
    types match the live wire shape (nullable `salary`).
  - **Estimate:** 0.5 day

- [x] T05 — Implement `SolidJobsService`
  - **Files:** `packages/plugins/source-solidjobs/src/solidjobs.service.ts`
  - **Acceptance:** FR-2..FR-12 — division fan-out via
    `Promise.allSettled`; `resultsWanted ?? 100` cap; mapping rules
    (id prefix, jobUrl, company, city, isRemote, descriptionFormat,
    salary→CompensationDto, contractTime→JobType, emails, searchTerm);
    per-offer try/catch with `Logger.warn`; `scrape()` never throws.
  - **Estimate:** 1 day

## Phase 3 — Tests

- [x] T06 — Unit tests (mocked HTTP, fixture-backed)
  - **Files:** `packages/plugins/source-solidjobs/__tests__/solidjobs.service.spec.ts`
  - **Acceptance:** covers happy path (≥ 3 jobs; titles/urls/site),
    request-URL assertion, salary mapping + salary-null branch, jobType
    mapping, descriptionFormat branches, searchTerm (title/subCategory/
    skill hit + miss), resultsWanted cap, `SOLIDJOBS_DIVISIONS` fan-out,
    empty payload, HTTP error → `[]`, malformed-offer skip.
  - **Estimate:** 1 day

- [x] T07 — E2E live-API smoke + green suite
  - **Files:** `packages/plugins/source-solidjobs/__tests__/solidjobs.e2e-spec.ts`
  - **Acceptance:** tolerant live smoke (shape, cap, searchTerm) per
    regional-plugin convention; `npx jest packages/plugins/source-solidjobs --silent`
    passes from repo root.
  - **Estimate:** 0.5 day

## Notes

- Write tests alongside each implementation task; do not batch testing into a final task.
- Registration in `packages/plugins/index.ts`, `tsconfig.base.json` and
  `jest.config.js` is owned by a later serial wiring step (spec Non-Goal).
- Update `docs/log.md` with each completed task in the same commit
  (docs files owned by the later serial step in this run).
