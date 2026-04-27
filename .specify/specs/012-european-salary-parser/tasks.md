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

- [x] T02 — `parseSalaryNumber()` + private `pickLocale()`.
  - **Files (planned):** `packages/common/src/utils/helpers.ts`
    (extend), `packages/common/src/index.ts` (barrel re-export
    of `parseSalaryNumber` only — `pickLocale` stays private).
  - **Files (actual):** `packages/common/src/utils/helpers.ts`
    (extended ~165 LOC: `SALARY_LOCALE_MAP` + `pickLocale`
    private function + `parseSalaryNumber` exported function +
    `SALARY_NUMBER_PRE_PATTERN` / `SALARY_NUMBER_POST_PATTERN`
    module-private regex literals + `__INTERNAL_TEST_ONLY__`
    test-shim export). Barrel re-export comes for free via the
    existing `export * from './helpers'` in `utils/index.ts` —
    no edit to `packages/common/src/index.ts` needed.
    `packages/common/__tests__/helpers.spec.ts` extended
    (~140 LOC, two new `describe` blocks: 14 cases for
    `parseSalaryNumber` + 5 cases for `pickLocale`).
  - **Acceptance:**
    - `parseSalaryNumber('45.000', 'continental')` → `45000`. ✅
    - `parseSalaryNumber('45,000.50', 'anglo')` → `45000.50`. ✅
    - `parseSalaryNumber('1 234,56', 'continental')` → `1234.56`. ✅
    - `parseSalaryNumber("90'000", 'anglo')` → `90000`
      (apostrophe-thousands tolerance per FR-12). ✅
    - `parseSalaryNumber('not a number', 'anglo')` → `null`. ✅
    - `pickLocale(Country.GERMANY)` → `'continental'`;
      `pickLocale(Country.UK)` → `'anglo'`;
      `pickLocale(Country.SWITZERLAND)` → `'anglo'`;
      `pickLocale(undefined)` → `'anglo'`. ✅
  - **Done:** run #39 (2026-04-27). Two load-bearing decisions
    from run #38's Notes-for-the-next-run met:
      1. **`pickLocale` stays private** — module-level function,
         not exported from `helpers.ts`. The
         `__INTERNAL_TEST_ONLY__` shim (frozen object) re-exports
         it as a clearly-flagged test symbol; production code
         must not consume it. JSDoc + the `__` prefix flag
         stray imports in code review.
      2. **Switzerland → `'anglo'` with apostrophe-thousands
         tolerance** — `SALARY_LOCALE_MAP` maps
         `Country.SWITZERLAND` to `'anglo'`; `parseSalaryNumber`
         strips `'` characters up-front (before either locale
         branch runs), so the apostrophe never collides with
         the decimal separator. No third `'swiss'` locale
         introduced.
    Verification: `npx jest packages/common/__tests__/helpers`
    reports `Test Suites: 1 passed · Tests: 44 passed (25
    existing T01 + 14 new `parseSalaryNumber` + 5 new
    `pickLocale`) · exit 0`. The 11 existing USD-only
    `extractSalary` cases stay green byte-for-byte (FR-10
    pre-validation; the actual `extractSalary` regex isn't
    rewired until T03).
  - **Estimate:** 0.3 day. **Actual:** ~0.25 day.

## Phase 3 — Dispatcher refactor

- [x] T03 — Rewire `extractSalary()` to call new helpers.
  - **Files (planned):** `packages/common/src/utils/helpers.ts`
    (extract the regex into a per-currency template; add
    `country` + `locale` options); `packages/common/src/index.ts`
    (barrel re-export of the new types).
  - **Files (actual):** `packages/common/src/utils/helpers.ts`
    (~190 LOC delta). Barrel re-export of
    `ExtractSalaryOptions` + `ExtractSalaryResult` comes for free
    via `export * from './helpers'` — no edit to
    `packages/common/src/index.ts` needed.
    `packages/common/__tests__/helpers.spec.ts` extended (~55 LOC,
    new `describe('extractSalary — Spec 012 / T03 multi-currency
    smoke')` block with 5 cases).
  - **Acceptance:**
    - All 11 existing USD-only cases in `helpers.spec.ts` stay
      green byte-for-byte (no assertion changes). ✅ Verified
      via `npx jest packages/common/__tests__/helpers` reporting
      `49 passed` (44 carried forward from T01+T02 + 5 new T03
      smoke cases).
    - New optional `options.country?: Country` / `options.locale?:
      SalaryLocale` / `options.defaultCurrency?: string` fields
      available; types exported from barrel. ✅
      `ExtractSalaryOptions` and `ExtractSalaryResult` are now
      named public types (replacing the inline anonymous shapes
      from the pre-Spec-012 implementation).
    - The currency-detection precedence rules from spec § 7.2
      hold: explicit symbol > explicit ISO > country fallback >
      default. ✅ The dispatcher delegates to
      `parseSalaryCurrency(salaryStr, { country, defaultCode })`,
      which already encodes the five-tier cascade from T01.
    - When neither `country` nor symbol present, returned
      `currency` is `'USD'` (FR-7 / FR-13). ✅ Pinned by the
      existing case `should parse a standard annual salary range`
      (`$100,000 - $150,000` → currency: 'USD') and the new case
      `preserves null result when no currency signal is present`
      (no symbol → null result, but the `parseSalaryCurrency`
      default branch still returns `'USD'` for the would-be
      currency).
    - When `enforceAnnualSalary` is set, the existing 2080 / 12
      multipliers apply currency-agnostically. ✅ Logic path
      unchanged from the pre-Spec-012 implementation; the
      annualisation block runs after locale-aware number
      parsing.
  - **Done:** run #40 (2026-04-27). Three load-bearing
    decisions locked into the source surface (none called out
    in run #39's Notes-for-the-next-run):
      1. **Locale cascade adds a currency-natural-locale
         tier.** `resolveSalaryLocale(options, currency)` walks
         four tiers: explicit `options.locale` →
         `pickLocale(options.country)` → currency's natural
         locale via `CURRENCY_TO_NATURAL_LOCALE` → `'anglo'`
         default. The third tier matters because a `'45.000 €'`
         posting with no country hint should still parse
         continental (otherwise `'45.000'` reads as `45.0` under
         anglo). Without this tier, every non-US-dollar plugin
         author would have to remember to pass a country hint
         even for trivially detectable currencies.
      2. **Two regex shapes, not one.** The pre-Spec-012
         single-regex approach (`$<num>K? - $?<num>K?`) doesn't
         generalise to suffix-symbol layouts (`45.000 € –
         60.000 €`). Trying a single regex with optional anchors
         on both sides ran into bare-number-range false
         positives. `buildSalaryRegexPrefix` (matches
         `<sym><num> - [<sym>?]<num>`) and
         `buildSalaryRegexSuffix` (matches `<num><sym> -
         <num><sym?>`) ship as separate regexes, tried in
         sequence; the suffix variant is only attempted if the
         prefix variant misses.
      3. **`[kK]?\b` discipline (debugged in-run).** The original
         `[kK]?` shape was eating the `k` of `kr` for Nordic
         suffix-form inputs (`'500.000 kr'` was matched as
         `min=500.000`, `K-suffix=k`, `currency-suffix=` — the
         currency token was ate by the K-capture). Adding `\b`
         after `[kK]?` forces the K-suffix to be at a word
         boundary, which is true for `100K -` (`K` then space)
         but false for `kr` (`k` then `r`, both word chars).
         Comment in source documents the in-run debugging path
         so a future contributor doesn't re-introduce the bug.
    Verification: `npx jest
    packages/common/__tests__/helpers` reports `Test Suites: 1
    passed · Tests: 49 passed (44 from T01+T02 + 5 new T03
    smoke) · exit 0`. The five new smoke cases cover EUR-suffix
    (Continental, Country.GERMANY hint), GBP-prefix (anglo
    locale via currency default), CHF-ISO-prefix (anglo with
    Swiss apostrophe-thousands tolerance from T02),
    DKK-via-`kr`-disambiguation (Country.DENMARK hint), and the
    "no signal → null result" regression pin. The full
    ≥-14-case currency sweep ships in T04.
  - **Estimate:** 0.5 day. **Actual:** ~0.5 day (the regex
    refactor + the debug-and-fix on the `[kK]?\b` issue made
    this slightly more work than T01 / T02 — the smoke-test
    suite caught the bug, which is exactly why we wrote it).

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

## Notes-for-the-next-run (pinned default for run #41)

- Default = **Spec 012 / Phase 4 / T04** — extend
  `packages/common/__tests__/helpers.spec.ts` with the full
  ≥ 14-case currency sweep mandated by spec § 8 / Test Plan,
  plus targeted `parseSalaryCurrency` / `parseSalaryNumber`
  unit cases (already shipped in T01 / T02 — T04 may layer
  more if gaps surface), plus a new
  `packages/common/__tests__/helpers.bench.ts` bench file
  using the same `process.hrtime.bigint()` shape as the three
  Spec 006 / T12 plugin benches. Bench writes
  `dist/bench/helpers-salary.json` and asserts NFR-1
  (`p95 < 0.5 ms` on a 200-char input).
- Out-of-scope reminders for run #41:
  - No `extractSalary()` regex tweaks — T03 is closed; the
    five new T03 smoke cases (EUR-suffix / GBP-prefix /
    CHF-prefix / DKK-disambiguation / null-result) already
    pin the cardinal happy paths. T04 layers ≥ 14 more cases
    on top WITHOUT regex changes.
  - No `PERFORMANCE_TUNING.md` doc bump — that's T05.
  - No `competitor-watch.md §C / AC-7` flip — that's T05's
    closeout.
- Two load-bearing decisions deferred to T04:
  1. **Bench shape mirrors Spec 006 / T12.** Same
     `process.hrtime.bigint()` measurement loop + same
     `min / median / mean / p95 / p99 / max` output schema +
     same `dist/bench/<name>.json` output path. Future spec
     authors writing parser-style benches should copy this
     shape (consistent diff-able output across benches).
  2. **Bench is a Jest test, not a standalone script.** It
     asserts `p95 < 0.5 ms` (NFR-1) but does not gate on
     absolute throughput (avoids cold-start flakes in CI).
     The CI runs the bench as part of the regular test
     bundle; local devs can run it standalone via
     `npm run bench:helpers-salary`.
