# Tasks: 012 — European-style Salary Parser

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Currency detection

- [ ] T01 — `parseSalaryCurrency()` helper + lookup tables.
  - **Files (planned):** `packages/common/src/utils/helpers.ts`
    (extend), `packages/common/src/index.ts` (barrel re-export).
  - **Acceptance:**
    - `parseSalaryCurrency('45.000 €')` →
      `{ code: 'EUR', symbol: '€', confidence: 'symbol' }`.
    - `parseSalaryCurrency('NOK 500000')` →
      `{ code: 'NOK', symbol: null, confidence: 'iso' }`.
    - `parseSalaryCurrency('500 kr', { country: Country.DENMARK })` →
      `{ code: 'DKK', symbol: 'kr', confidence: 'country' }`.
    - `parseSalaryCurrency('foo bar')` →
      `{ code: 'USD', symbol: null, confidence: 'default' }`.
    - `parseSalaryCurrency('foo bar', { defaultCode: 'EUR' })` →
      `{ code: 'EUR', symbol: null, confidence: 'default' }`.
    - Lookup tables (private constants) cover all eight ISO codes
      from spec § 7.2 + the seven Continental countries from
      spec § 7.3.
  - **Estimate:** 0.4 day.

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

## Notes-for-the-next-run (pinned default for run #38)

- Default = **Spec 012 / Phase 1 / T01** —
  `parseSalaryCurrency()` helper + the symbol / ISO / country
  lookup tables in `packages/common/src/utils/helpers.ts`. This
  is the smallest first task: pure dispatcher, no regex
  refactoring of `extractSalary()` itself. Lockfile is
  unchanged (zero new deps per NFR-2). The unit-test
  verification lands as 5 targeted `parseSalaryCurrency` cases
  in `helpers.spec.ts`.
- Out-of-scope reminders for run #38:
  - No `extractSalary()` regex refactoring this run — that's
    T03's job; T01 only adds the new helper.
  - No bench file this run — that's T04.
  - No `PERFORMANCE_TUNING.md` doc bump this run — that's T05.
- Three load-bearing decisions deferred to T01:
  1. **`Currency` ISO codes inlined as a string-literal union**
     (`'USD' | 'EUR' | 'GBP' | ...`) rather than a new
     `Currency` enum in `@ever-jobs/models`. Reasoning: the
     codes are well-known ISO 4217 strings, and adding an enum
     forces every plugin to import it — too much churn for a
     one-spec parser change. A future spec can promote the
     union to a proper enum if call-sites multiply.
  2. **`parseSalaryCurrency` is exported, `pickLocale` is not.**
     The locale picker is an implementation detail; if a
     plugin needs locale dispatch directly, it should pass
     `country` to `extractSalary()` rather than hand-rolling
     against `pickLocale()`. Keeps the public surface minimal.
  3. **Q-025 default = SEK** for the `kr` no-hint case. Reasoning
     in spec § 5 / FR-4 + `docs/questions.md` Q-025. Revisit
     if real-world fixture counts show DKK / NOK higher.
