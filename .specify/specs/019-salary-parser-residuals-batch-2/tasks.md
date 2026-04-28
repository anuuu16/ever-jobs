# Tasks 019 — Salary Parser Residuals, Batch 2

> Ordered task list for [Spec 019](./spec.md). Each task targets ≤ 1 day
> of agent work. Acceptance criteria are explicit; phases gate on the
> tasks of the prior phase being `[x]`.

| Field          | Value                              |
| -------------- | ---------------------------------- |
| Tasks ID       | 019                                |
| Spec           | [`spec.md`](./spec.md)             |
| Plan           | [`plan.md`](./plan.md)             |
| Created        | 2026-04-28 (run #78)               |
| Last updated   | 2026-04-28 (run #78)               |

---

## Phase 0 — Scaffold (run #78, this pass)

> Phase 0 is overhead and not counted against the NFR-4 ≤ 3-run
> implementation budget (same convention as Spec 015 / Phase 0).

| ID  | Task                                                                                  | Acceptance                                                                                                                                                          | Status |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T00 | Create `.specify/specs/019-salary-parser-residuals-batch-2/{spec,plan,tasks}.md`. Open Q-041 in `docs/questions.md`. Update `docs/index.md` Spec 019 row. Prepend run #78 entry to `docs/log.md` (and a parallel entry to the out-of-repo upstream-watch ledger Sync Log). Bump `CLAUDE.md` run-tag to `2026-04-28 (scheduled run #78)`. | Doc-lint clean. No `.ts` in diff. Four new files (`spec.md`, `plan.md`, `tasks.md`, plus updated `questions.md` block). Five edits (`docs/index.md`, `docs/log.md`, the out-of-repo upstream-watch ledger, `CLAUDE.md`, `docs/questions.md`). | [x]    |

## Phase 1 — T01: source-side threshold bump (target run #79)

| ID  | Task                                                                                  | Acceptance                                                                                                                                                          | Status |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T01 | Single-token edit at [`packages/common/src/utils/helpers.ts:803`](../../../packages/common/src/utils/helpers.ts:803): `minSalary < lowerLimit / 12` → `minSalary < lowerLimit` (FR-1, spec § 7.1). | (a) `npx jest packages/common/__tests__/helpers.spec` returns 73/73 passed (no new test cases yet — regression sweep only). (b) `npx jest packages/common/__tests__/helpers.bench` reports p95 ≤ 0.1174 ms (Spec 016 baseline + 0.1 ms NFR-1). (c) FR-5 idempotence verified: `grep -c 'lowerLimit / 12' packages/common/src/utils/helpers.ts` returns 0 post-edit (was 1 pre-edit). (d) Diff shows exactly one file changed (`helpers.ts`) with the four-token reduction. (e) Spec 019 / spec.md / § 10 gains Decision D-01 documenting the T01 acceptance + bench p95 numbers + idempotence verification. (f) `docs/log.md` gains a run #79 entry. | [ ]    |

## Phase 2 — T02: test pins for new behaviour (target run #80)

| ID  | Task                                                                                  | Acceptance                                                                                                                                                          | Status |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T02 | Add three new `it(...)` blocks in [`packages/common/__tests__/helpers.spec.ts`](../../../packages/common/__tests__/helpers.spec.ts) per spec § 7.2. Cases 74 (FR-2.a — `"100 - 150"` reject), 75 (FR-2.b — `"team of 100 - 150 employees"` reject), 76 (FR-2.c — `"1000 - 1500"` admit at threshold boundary). | (a) `npx jest packages/common/__tests__/helpers.spec` returns 76/76 passed (Spec 015's 73 + Spec 019's 3). (b) Bench p95 stays ≤ 0.1174 ms. (c) Diff shows exactly one file changed (`helpers.spec.ts`); no source-side edit. (d) NFR-5 verified: test count delta is exactly +3 (73 → 76). (e) Spec 019 / spec.md / § 10 gains Decision D-02 documenting the T02 acceptance + the three case literals. (f) `docs/log.md` gains a run #80 entry. | [ ]    |

## Phase 3 — T03: closeout (target run #81)

| ID  | Task                                                                                  | Acceptance                                                                                                                                                          | Status |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| T03 | (a) Update [`docs/PERFORMANCE_TUNING.md`](../../../docs/PERFORMANCE_TUNING.md): rewrite the Spec 015 / FR-8 paragraph to reflect Spec 019 closure (the `"100 - 150" + country=GERMANY` shape is now rejected; recommended escape hatches are prefix-anchored EUR symbol or suffix-anchored EUR ISO). (b) Flip Spec 019 / spec.md Status from `draft (Phase 0 scaffolded run #78); Phase 1..3 pending` to `All phases done (T03 run #81); spec complete`. (c) Update `docs/index.md` Spec 019 row Status to match. (d) Append Decision D-03 to Spec 019 / § 10 documenting T03 acceptance + the doc edit summary. (e) Prepend run #81 entry to `docs/log.md` (and a parallel entry to the out-of-repo upstream-watch ledger Sync Log). (f) Bump `CLAUDE.md` run-tag to run #81. | (a) `npm run lint:docs` exits 0. (b) No `.ts` file in the diff (T03 is docs-only — FR-9 / Non-Goal). (c) Spec 019 / spec.md Status reads `All phases done (T03 run #81); spec complete`. (d) Spec 019 closes its full lifecycle in **3 implementation runs** (T01 + T02 + T03 at runs #79..#81). (e) Q-041 Resolution stays `_open — agent default = A` (the user owner reviews; resolution flip is human-driven, not agent-driven). | [ ]    |

---

## Notes for the next run (run #79)

- **Default for run #79** = Spec 019 / Phase 1 / T01 — single-
  token source edit at
  [`helpers.ts:803`](../../../packages/common/src/utils/helpers.ts:803):
  `minSalary < lowerLimit / 12` → `minSalary < lowerLimit`.
  T01 is the load-bearing source-side change; T02 (test pins)
  and T03 (closeout) cannot proceed without T01 landed.

  **T01 acceptance recipe:**

  1. Edit `helpers.ts:803` per spec § 7.1.
  2. `npx jest packages/common/__tests__/helpers.spec` —
     expect 73/73 passed (regression sweep). If a regression
     surfaces, abort; the bump narrowed too aggressively.
     Investigate via Spec 019 / plan.md / § 3.1 (substitute-
     case regression risk) before proceeding.
  3. `npx jest packages/common/__tests__/helpers.bench` —
     expect p95 ≤ 0.1174 ms (Spec 016 baseline + 0.1 ms NFR-1
     budget).
  4. `grep -c 'lowerLimit / 12' packages/common/src/utils/helpers.ts`
     — expect 0 (FR-5 idempotence).
  5. Append D-01 to Spec 019 / spec.md / § 10 with the bench
     p95 number + the regression-sweep result.
  6. Flip Spec 019 / tasks.md / T01 row from `[ ]` to `[x]`.
  7. Prepend run #79 entry to `docs/log.md`.
  8. Bump `CLAUDE.md` run-tag to `2026-04-28 (scheduled run #79)`.
  9. `npm run lint:docs` clean.
  10. Commit + push.

- **Default for run #80** (after T01 lands) = Spec 019 /
  Phase 2 / T02 — add three new `it(...)` blocks in
  `helpers.spec.ts` per spec § 7.2. T02 acceptance is 76/76
  green + bench p95 within range.

- **Default for run #81** (after T01 + T02 land) = Spec 019 /
  Phase 3 / T03 — closeout pass. Doc-edit
  `PERFORMANCE_TUNING.md` + status flips. T03 acceptance is
  doc-lint clean + zero `.ts` in diff.

- **If the external-snapshot tag set changes at run #79..#81**:
  prepend a fresh row to the out-of-repo upstream-watch ledger
  capturing the new tag, but do NOT block Spec 019. The
  internal-correctness backlog (Spec 019) and the
  upstream-driven backlog (out-of-repo ledger) are independent.

## Out-of-scope reminders (do NOT do these in Spec 019)

- Do NOT modify
  [`buildSalaryRegexBare`](../../../packages/common/src/utils/helpers.ts:692).
  The Q-041 Option C alternative was explicitly rejected.
- Do NOT modify
  [`buildSalaryRegexPrefix`](../../../packages/common/src/utils/helpers.ts:621)
  or `buildSalaryRegexSuffix`. Both stay byte-identical.
- Do NOT modify the K-suffix bypass guard
  (`match[2] !== 'k' && match[4] !== 'k'`). FR-6 is
  load-bearing.
- Do NOT introduce a stop-word filter (Q-041 Option B
  explicitly rejected — fragile / i18n-brittle).
- Do NOT change `lowerLimit`, `upperLimit`, `hourlyThreshold`,
  `monthlyThreshold`, or `enforceAnnualSalary` defaults in
  `ExtractSalaryOptions`. The threshold bump is to the
  **multiplier** of `lowerLimit` in the pre-check (1/12 → 1/1),
  not to `lowerLimit` itself.
- Do NOT modify `parseSalaryCurrency`, `parseSalaryNumber`, or
  `resolveSalaryLocale` (FR-9 inherited from Spec 015).
- Do NOT modify `CURRENCY_TO_NATURAL_LOCALE`,
  `SALARY_NUMBER_REGEX_SRC`, `SALARY_SYMBOL_ALTERNATIONS`, or
  `SALARY_LOCALE_MAP`. All four module-private constants stay
  byte-identical.
- Do NOT modify any plugin source code (FR-9 inherited from
  Spec 015). Plugins inherit the new behaviour via the
  `@ever-jobs/common` barrel transparently.
- Do NOT add a new bench fixture. The existing
  [`helpers.bench.spec.ts`](../../../packages/common/__tests__/helpers.bench.spec.ts)
  already exercises the dispatcher hot path (Spec 016 / T01
  restored compilation; Spec 019 honours the gate).
- Do NOT extend the Spec 019 scope to cover `country` enum
  additions, new currency support, or new dispatcher paths.
  Forward-compat candidates (`bareNumericThreshold` operator
  opt-in, graduated per-country thresholds) are tracked in
  Spec 019 / plan.md / § 8 for a future Spec 020 if telemetry
  warrants.
- Do NOT delete the Spec 015 / FR-8 paragraph from
  `PERFORMANCE_TUNING.md`. Rewrite it to reflect the closure
  (the limitation existed; Spec 019 closed it; the audit
  trail stays).
- Do NOT add a new row to the out-of-repo upstream-watch
  ledger at any phase. Spec 019 is internal-correctness
  driven (Q-041); the out-of-repo ledger did not motivate it.
  The Sync Log entries for runs #78..#81 are appropriate;
  upstream-watch row additions are not.
- **Lockfile sync:** Spec 019 / T01 adds zero deps; no
  `package-lock.json` regeneration this spec.
