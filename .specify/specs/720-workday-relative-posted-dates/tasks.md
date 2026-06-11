# Tasks: 720 — Workday: parse relative `postedOn` labels into ISO dates

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Spec scaffolding

- [x] T01 — Author spec.md / plan.md / tasks.md
  - **Files:** `.specify/specs/720-workday-relative-posted-dates/{spec,plan,tasks}.md`
  - **Acceptance:** metadata tables filled; D-01..D-04 decisions recorded
  - **Estimate:** 0.5 day

## Phase 2 — Helper + service wiring

- [x] T02 — Implement `parseWorkdayPostedOn` pure helper
  - **Files:** `packages/plugins/source-ats-workday/src/workday.constants.ts`
  - **Acceptance:**
    - exported `parseWorkdayPostedOn(postedOn?: string | null, now?: Date): string | null`
    - `now` defaults to current time; matching case-insensitive and whitespace-tolerant
    - Today / Yesterday / `N Days Ago` → ISO `YYYY-MM-DD`; `N+ Days Ago` → `null`
    - other strings: ISO-shaped absolute date → calendar date as written,
      anything else (incl. non-ISO date formats) → `null`; nullish/empty → `null`
    - never throws (out-of-range day offsets → `null`); UTC arithmetic only,
      no host-TZ dependence on any path
  - **Estimate:** 0.5 day

- [x] T03 — Wire helper into `processListing`
  - **Files:** `packages/plugins/source-ats-workday/src/workday.service.ts`
  - **Acceptance:** `datePosted` computed via `parseWorkdayPostedOn(listing.postedOn)`;
    the `new Date(...)` try/catch IIFE and raw-label fallback are removed
  - **Estimate:** 0.5 day

## Phase 3 — Tests

- [x] T04 — Branch-exhaustive helper unit tests
  - **Files:** `packages/plugins/source-ats-workday/__tests__/workday.constants.spec.ts`
  - **Acceptance:** fixed injected `now`; one case per spec FR-2..FR-8 branch,
    incl. singular `1 Day Ago`, month-boundary subtraction, out-of-range
    offset → null, `30+` → null, ISO date/datetime fallback, non-ISO and
    impossible-calendar-date fallback → null, nullish/empty/whitespace inputs,
    case + whitespace tolerance; existing helper coverage (`parseWorkdaySlug`,
    `buildWorkdayUrl`) untouched/passing
  - **Estimate:** 0.5 day

- [x] T05 — Service-level `datePosted` regression test
  - **Files:** `packages/plugins/source-ats-workday/__tests__/workday.service.spec.ts`
  - **Acceptance:** mocked `createHttpClient` post returns ≥ 3 listings with
    relative labels; emitted `datePosted` is ISO `YYYY-MM-DD` or `null`, never
    the raw label; DI scaffolding + error-path checks pass
  - **Estimate:** 0.5 day

- [x] T06 — Run suite green from repo root
  - **Files:** (none — verification)
  - **Acceptance:** `npx jest packages/plugins/source-ats-workday --silent` passes;
    spec Status set to `done`; all tasks ticked
  - **Estimate:** 0.5 day

## Notes

- Write tests alongside each implementation task; do not batch testing into a final task.
- Update `docs/log.md` with each completed task in the same commit.
