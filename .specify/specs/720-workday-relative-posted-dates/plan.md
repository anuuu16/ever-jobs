# Plan: 720 — Workday: parse relative `postedOn` labels into ISO dates

| Field        | Value      |
| ------------ | ---------- |
| Spec         | spec.md    |
| Created      | 2026-06-11 |
| Last updated | 2026-06-11 |

## 1. Approach

The fix is contained entirely in
`packages/plugins/source-ats-workday/`. A new exported pure function
`parseWorkdayPostedOn(postedOn?, now?)` is added to
`workday.constants.ts`, next to the existing pure helpers
(`parseWorkdaySlug`, `buildWorkdayUrl`), keeping all stateless
string/date utilities for the plugin in one place.

The helper normalises the input (trim, collapse internal whitespace,
lower-case) and then matches the three relative label shapes Workday
emits on its list endpoint: `posted today`, `posted yesterday`, and
`posted N[+] day(s) ago`. The `N+` variant ("30+ Days Ago") is an
open lower bound, so it resolves to `null` rather than a fabricated
date. Anything else falls through to an absolute-date fallback that
accepts only ISO-shaped input (`YYYY-MM-DD`, optional time part) and
returns the calendar date as written after a UTC round-trip validity
check; non-ISO strings yield `null` because `Date.parse` reads them in
host-local time (spec D-05). Day subtraction is done as UTC
millisecond arithmetic on the injected `now` (default `new Date()`),
and the result is `toISOString().split('T')[0]` with an Invalid-Date
guard returning `null` (spec D-06), so output never depends on the
host timezone and the helper never throws.

`WorkdayService.processListing` then replaces its
`new Date(postedOn).toISOString()` try/catch IIFE (which throws on
relative labels and falls back to the raw string) with a single call
to the helper. No other emitted field changes.

Tests are split to mirror the source layout: branch-exhaustive helper
tests in `__tests__/workday.constants.spec.ts` using a fixed injected
`now`, and a `__tests__/workday.service.spec.ts` that mocks
`createHttpClient` (same pattern as recent source-plugin suites),
feeds ≥ 3 listings with relative labels through `scrape`, and asserts
`datePosted` is an ISO date or `null` — never the raw label.

## 2. Phases

### Phase 1 — Spec scaffolding

- Goal: spec/plan/tasks recorded before code.
- Deliverables: `.specify/specs/720-workday-relative-posted-dates/{spec,plan,tasks}.md`.
- Exit criteria: metadata tables filled, decisions D-01..D-04 logged.

### Phase 2 — Helper + service wiring

- Goal: `parseWorkdayPostedOn` implemented and used by `processListing`.
- Deliverables: edits to `workday.constants.ts`, `workday.service.ts`.
- Exit criteria: TypeScript compiles; helper exported; raw-label
  fallback removed.

### Phase 3 — Tests

- Goal: every helper branch covered with fixed `now`; service-level
  regression for the `datePosted` integration.
- Deliverables: `__tests__/workday.constants.spec.ts`,
  `__tests__/workday.service.spec.ts`.
- Exit criteria: `npx jest packages/plugins/source-ats-workday --silent`
  green from repo root.

## 3. Packages Touched

| Package                                | Change                                              |
| -------------------------------------- | --------------------------------------------------- |
| `packages/plugins/source-ats-workday`  | new helper, `processListing` fix, new test suite    |
| everything else                        | (no change)                                         |

## 4. Dependencies

| Library | Version | Rationale                                  |
| ------- | ------- | ------------------------------------------ |
| (none)  | —       | native `Date` + regex suffice; zero deps   |

## 5. Risks & Mitigations

| Risk                                                        | Likelihood | Impact | Mitigation                                                        |
| ----------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------- |
| Unseen label variants (localised tenants, new phrasings)    | M          | L      | Fallback chain ends in `null`, never a bogus date or raw label     |
| Consumers relying on the old raw-label passthrough          | L          | L      | Breaking fix documented in spec D-02; raw labels were never dates  |
| Local-TZ drift in date arithmetic on CI vs dev hosts        | L          | M      | UTC-only arithmetic + injected `now` in every test (D-03)          |

## 6. Rollback Plan

Single-package change: revert the commit. No data migration, no
schema change; `datePosted` consumers degrade back to the previous
(buggy) strings.

## 7. Migration Plan (if applicable)

n/a — scrape-time transformation only; no stored data is rewritten.

## 8. Open Questions for Plan

(none — resolved into spec § 10 Decisions.)
