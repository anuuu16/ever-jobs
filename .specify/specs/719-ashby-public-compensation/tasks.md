# Tasks: 719 — Ashby Public API: Compensation Opt-In + Retry Resilience

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Constants & types

- [x] T01 — Add query + retry constants
  - **Files:** `packages/plugins/source-ats-ashby/src/ashby.constants.ts`
  - **Acceptance:**
    - `ASHBY_INCLUDE_COMPENSATION_QUERY === 'includeCompensation=true'`
    - `ASHBY_PUBLIC_MAX_RETRIES === 2`
    - `ASHBY_RETRY_BACKOFF = { baseDelayMs: 1000, jitterMaxMs: 500 }` (mutable object)
  - **Estimate:** 0.1 day

- [x] T02 — Model the flat public compensation shape
  - **Files:** `packages/plugins/source-ats-ashby/src/ashby.types.ts`
  - **Acceptance:**
    - `AshbyFlatCompensationComponent` (`compensationType`, `interval`, `currencyCode`, `minValue`, `maxValue`, `summary`) exported
    - `AshbyCompensation` gains optional `compensationTiers`, `compensationTierSummary`, `scrapeableCompensationSalarySummary`; `summaryComponents` accepts the flat shape
    - Purely additive — existing fields untouched
  - **Estimate:** 0.1 day

## Phase 2 — Service changes

- [x] T03 — Append `includeCompensation=true` to both request URLs
  - **Files:** `packages/plugins/source-ats-ashby/src/ashby.service.ts`
  - **Acceptance:**
    - Public GET URL: `${ASHBY_API_URL}/<slug>?includeCompensation=true`
    - Authenticated POST URL identical
    - Constant used, no inline string literal
  - **Estimate:** 0.1 day

- [x] T04 — Private retry wrapper for the public GET
  - **Files:** `packages/plugins/source-ats-ashby/src/ashby.service.ts`
  - **Acceptance:**
    - Up to `ASHBY_PUBLIC_MAX_RETRIES` (2) retries on network error/timeout or HTTP ≥ 500
    - No retry on HTTP 4xx
    - Delay = `baseDelayMs · 2^attempt + random(0..jitterMaxMs)` from `ASHBY_RETRY_BACKOFF`
    - Final failure still yields `{ jobs: [] }` (outer catch unchanged)
  - **Estimate:** 0.2 day

- [x] T05 — Dual-shape compensation extraction
  - **Files:** `packages/plugins/source-ats-ashby/src/ashby.service.ts`
  - **Acceptance:**
    - Legacy `compensationComponents[].tiers[]` extraction unchanged
    - Fallback maps `summaryComponents[]` / `compensationTiers[].components[]` (`minValue`/`maxValue`/`currencyCode`)
    - Salary component preferred; bound-less components skipped
    - `"1 YEAR"` → `CompensationInterval.YEARLY`; unknown interval → `undefined`, amounts kept
  - **Estimate:** 0.2 day

## Phase 3 — Tests

- [x] T06 — Fixture with compensation-bearing listings
  - **Files:** `packages/plugins/source-ats-ashby/__tests__/fixtures/ashby-jobs.json`
  - **Acceptance:**
    - ≥ 3 listings total
    - ≥ 1 listing with tiered `compensation.compensationComponents[].tiers[]` (`tierFloor`/`tierCeiling`/`interval`/`currency`)
    - ≥ 1 listing with the live flat shape (`summaryComponents`/`compensationTiers[].components`)
  - **Estimate:** 0.1 day

- [x] T07 — Unit suite (mocked HTTP, relative imports)
  - **Files:** `packages/plugins/source-ats-ashby/__tests__/ashby.service.spec.ts`
  - **Acceptance:**
    - Asserts public GET URL and authenticated POST URL contain `includeCompensation=true`
    - Asserts tiered + flat shapes map into `CompensationDto`
    - Retry path: first call rejects (timeout), second resolves → jobs returned, 2 calls
    - 404 → single call, empty result; exhausted retries → empty result, no throw
    - `ASHBY_RETRY_BACKOFF` shrunk in `beforeAll`, restored in `afterAll`
  - **Estimate:** 0.3 day

- [x] T08 — Full plugin suite green
  - **Files:** (verification only)
  - **Acceptance:**
    - `npx jest packages/plugins/source-ats-ashby --silent` passes (new unit spec + existing `ashby.e2e-spec.ts`)
  - **Estimate:** 0.1 day

## Notes

- Write tests alongside each implementation task; do not batch testing into a final task.
- Update `docs/log.md` with each completed task in the same commit.
