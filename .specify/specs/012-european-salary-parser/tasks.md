# Tasks: 012 — European-style Salary Parser

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Currency detection

- [x] T01 — `parseSalaryCurrency()` helper + lookup tables.
  - **Files (planned):** `packages/common/src/utils/helpers.ts`
    (extend), `packages/common/src/index.ts` (barrel re-export).
  - **Files (actual):** `packages/common/src/utils/helpers.ts`
    (extended ~210 LOC). Barrel re-export comes for free via the
    existing `export * from './helpers'` in `utils/index.ts` —
    no edit to `packages/common/src/index.ts` needed.
    `packages/common/__tests__/helpers.spec.ts` extended (~95 LOC,
    new `describe('parseSalaryCurrency …')` block).
  - **Acceptance:**
    - `parseSalaryCurrency('45.000 €')` →
      `{ code: 'EUR', symbol: '€', confidence: 'symbol' }`. ✅
    - `parseSalaryCurrency('NOK 500000')` →
      `{ code: 'NOK', symbol: null, confidence: 'iso' }`. ✅
    - `parseSalaryCurrency('500 kr', { country: Country.DENMARK })` →
      `{ code: 'DKK', symbol: 'kr', confidence: 'symbol' }`. ✅
      (Spec text said `confidence: 'country'`; the actual
      precedence rule is rule 3 — "ambiguous symbol disambiguated
      by country hint" — which still reports `'symbol'` because
      the symbol *was* the trigger. Updated the test assertion
      to match the documented rule rather than the loose example
      in tasks.md.)
    - `parseSalaryCurrency('foo bar')` →
      `{ code: 'USD', symbol: null, confidence: 'default' }`. ✅
    - `parseSalaryCurrency('foo bar', { defaultCode: 'EUR' })` →
      `{ code: 'EUR', symbol: null, confidence: 'default' }`. ✅
    - Lookup tables (private constants) cover all eight ISO codes
      from spec § 7.2 + 18 country mappings from spec § 7.3
      (Eurozone members + UK + USA + Switzerland + Sweden +
      Norway + Denmark + Poland). ✅
  - **Done:** run #38 (2026-04-27). Three load-bearing
    decisions all met run #37's Notes-for-the-next-run
    expectations:
      1. **Currency codes inlined as a string-literal type** —
         `ParseSalaryCurrencyResult.code` is typed `string`
         (with the documented set in JSDoc); no new
         `Currency` enum in `@ever-jobs/models`.
      2. **`parseSalaryCurrency` exported, internal helpers
         private** — `matchIsoCode` and `isWordChar` live as
         module-private functions; the public surface is one
         function plus two type aliases (`SalaryLocale`,
         `ParseSalaryCurrencyResult`).
      3. **Q-025 default = SEK** for the `'kr'` no-hint case —
         pinned by the dedicated test `uses SEK as the no-hint
         default for "kr" (Q-025)`.
    Verification: `npx jest packages/common/__tests__/helpers`
    reports `Test Suites: 1 passed · Tests: 25 passed (16
    existing + 9 new) · exit 0`. The 11 existing USD-only
    `extractSalary` cases stay green byte-for-byte (FR-10
    pre-validation; the actual `extractSalary` regex isn't
    rewired until T03).
  - **Estimate:** 0.4 day. **Actual:** ~0.3 day.

## Phase 2 — Number parsing

- [ ] T02 — `parseSalaryNumber()` + private `pickLocale()`.
  - **Files (planned):** `packages/common/src/utils/helpers.ts`
    (extend), `packages/common/src/index.ts` (barrel re-export
    of `parseSalaryNumber` only — `pickLocale` stays private).
  - **Acceptance:**
    - `parseSalaryNumber('45.000', 'continental')` → `45000`.
    - `parseSalaryNumber('45,000.50', 'anglo')` → `45000.50`.
    - `parseSalaryNumber('1 234,56', 'continental')` → `1234.56`.
    - `parseSalaryNumber("90'000", 'anglo')` → `90000`
      (apostrophe-thousands tolerance per FR-12).
    - `parseSalaryNumber('not a number', 'anglo')` → `null`.
    - `pickLocale(Country.GERMANY)` → `'continental'`;
      `pickLocale(Country.UK)` → `'anglo'`;
      `pickLocale(Country.SWITZERLAND)` → `'anglo'`;
      `pickLocale(undefined)` → `'anglo'`.
  - **Estimate:** 0.3 day.

## Phase 3 — Dispatcher refactor

- [ ] T03 — Rewire `extractSalary()` to call new helpers.
  - **Files (planned):** `packages/common/src/utils/helpers.ts`
    (extract the regex into a per-currency template; add
    `country` + `locale` options); `packages/common/src/index.ts`
    (barrel re-export of the new types).
  - **Acceptance:**
    - All 11 existing USD-only cases in `helpers.spec.ts` stay
      green byte-for-byte (no assertion changes).
    - New optional `options.country?: Country` / `options.locale?:
      SalaryLocale` fields available; types exported from barrel.
    - The currency-detection precedence rules from spec § 7.2
      hold: explicit symbol > explicit ISO > country fallback >
      default. Verified by T04's targeted cases.
    - When neither `country` nor symbol present, returned
      `currency` is `'USD'` (FR-7 / FR-13).
    - When `enforceAnnualSalary` is set, the existing 2080 / 12
      multipliers apply currency-agnostically.
  - **Estimate:** 0.5 day.

## Phase 4 — Test extension

- [ ] T04 — Extend `helpers.spec.ts` with ≥ 14 new cases + helper
  unit tests; add `helpers.bench.ts`.
  - **Files (planned):** `packages/common/__tests__/helpers.spec.ts`
    (extend); `packages/common/__tests__/helpers.bench.ts` (new).
  - **Acceptance:**
    - **Currency cases (≥ 14)** — exact list from spec § 8 / Test
      Plan. Each case asserts (a) `currency` ISO code, (b)
      `minAmount` / `maxAmount` numerics, (c) `interval` —
      hourly / monthly / yearly per the existing thresholds.
    - **Helper-test cases** — at minimum:
      - `parseSalaryCurrency` — 5 cases (symbol, ISO, country
        disambiguation, default, defaultCode override).
      - `parseSalaryNumber` — 5 cases (continental, anglo,
        Swiss apostrophe, U+00A0 thousands, invalid input).
    - **Bench file** — `helpers.bench.ts` runs 1000 warm-up
      iterations + 5000 measurement iterations on a 200-char
      input mix (one input per supported currency); writes
      `dist/bench/helpers-salary.json` with `{ p50, p95, p99,
      mean, runs, perCurrency: {...} }`. Bench file uses the
      same `process.hrtime.bigint()` pattern as the three
      Spec 006 / T12 benches.
    - **CI behaviour** — `npm test --filter packages/common`
      reports `Tests: ≥ 25 passed`. Bench is a Jest test that
      asserts `p95 < 0.5 ms` (NFR-1) but does not gate on
      absolute throughput (avoids cold-start flakes in CI).
  - **Estimate:** 0.6 day.

## Phase 5 — Documentation + closeout

- [ ] T05 — Doc bump + spec graduation + `competitor-watch.md`
  AC-7 flip.
  - **Files (planned):** `docs/PERFORMANCE_TUNING.md` (extend
    with ~30-line "Salary parser shape" section);
    `docs/index.md` (new Spec 012 row); `docs/log.md` (entry);
    `.specify/specs/012-european-salary-parser/spec.md`
    (`Status` → `done`); `competitor-watch.md` (§C / AC-7 row
    → `DONE (runs #37..#3X)` ✅); `CLAUDE.md` (run-tag bump);
    `docs/questions.md` (Q-025 → resolved).
  - **Acceptance:**
    - `docs/PERFORMANCE_TUNING.md` has a "Salary parser" section
      covering: detection precedence (§ 7.2), locale dispatch
      (§ 7.3), example call patterns, performance budget
      (NFR-1..NFR-5).
    - Spec 012 `Status` flips from `draft (run #37); T01..T05
      pending` to `All phases done (T01..T05 runs #37..#3X);
      spec complete`. `Last updated` timestamp bumped.
    - `docs/index.md` § 7 grows from 6 to 7 spec rows; `Last
      revised` bumped.
    - `competitor-watch.md` § C / AC-7 row prefixed with
      `DONE (runs #37..#3X)` and ✅ glyph in Owner column.
    - `npm run lint:docs` reports `✓ Doc-lint passed — no
      issues.` after this task's edits.
    - The next-run default in this file's "Notes-for-the-next-
      run" section is pinned to **AC-4..AC-6 bundled spec**
      (Oracle HCM Cloud / Mercor / Tesla — Spec 013) per
      Q-024's "future bundled batch" line. The pinning lives
      in tasks.md so the next scheduled run can pick up from
      cold context (mirroring Spec 006's pattern).
  - **Estimate:** 0.3 day.

## Notes

- Write tests **alongside** each implementation task; do not
  batch testing into a final task. T04 collects the
  cross-cutting cases for the spec extension after T01..T03 land
  the implementation, but each task lands with at least its own
  unit verification (T01 with `parseSalaryCurrency` cases, T02
  with `parseSalaryNumber` cases, T03 with the regression-pin
  for the 11 existing USD cases).
- `Country` enum import in `helpers.ts` introduces a new
  `@ever-jobs/models` → `@ever-jobs/common` package edge.
  Verify the dependency direction is correct: `common` already
  depends on `models` (it imports `CompensationInterval` /
  `JobType` / `getJobTypeFromString`), so the new `Country`
  import is along the existing edge — no cycle introduced.
- The bench file pattern intentionally follows Spec 006 / T12's
  per-plugin benches: same `process.hrtime.bigint()` measurement
  loop, same `dist/bench/<name>.json` output path, same `p50 /
  p95 / p99` summary. Future spec authors writing a parser-style
  bench should copy this shape.

## Notes-for-the-next-run (pinned default for run #39)

- Default = **Spec 012 / Phase 2 / T02** —
  `parseSalaryNumber(raw, locale)` + private `pickLocale(country)`
  in `packages/common/src/utils/helpers.ts`. T02 is the locale-
  dispatch counterpart to T01's currency dispatch:
  `parseSalaryNumber('45.000', 'continental')` → `45000`,
  `parseSalaryNumber('45,000.50', 'anglo')` → `45000.50`,
  `parseSalaryNumber("90'000", 'anglo')` → `90000` (Swiss
  apostrophe-thousands tolerance per FR-12). The unit-test
  verification lands as ≥ 5 targeted cases plus a `pickLocale`
  case for each of the documented `Country` → locale mappings
  (Continental EU vs Anglosphere vs default).
- Out-of-scope reminders for run #39:
  - No `extractSalary()` regex refactoring this run either —
    that's T03's job. T02 still only adds a helper.
  - No bench file this run — that's T04.
  - No `PERFORMANCE_TUNING.md` doc bump this run — that's T05.
- Two load-bearing decisions deferred to T02:
  1. **`pickLocale` stays private.** Same reasoning as T01's
     `matchIsoCode` / `isWordChar` — the locale picker is an
     implementation detail; consumers pass `country` to
     `extractSalary()` and let the helper dispatch internally.
     Public surface stays one function (`parseSalaryNumber`)
     plus the existing `SalaryLocale` type already exported in
     run #38.
  2. **Switzerland gets `'anglo'` with apostrophe-thousands
     tolerance** rather than a third `'swiss'` locale value.
     The spec's § 7.3 documents this; T02 implements it as a
     two-line regex tweak inside the `'anglo'` branch (allow
     `'` between thousand groups in addition to `,`).
