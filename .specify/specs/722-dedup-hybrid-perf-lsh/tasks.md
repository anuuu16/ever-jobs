# Tasks: 722 — Dedup-Hybrid Performance Gates & Adaptive LSH Banding

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Hot-path hardening

- [x] T01 — Hoist `Math.imul`; restructure `MinHasher.signature()` hot loop
  - **Files:** `packages/plugins/dedup-hybrid/src/minhash.ts`
  - **Acceptance:** module-scope `imul` const; permutation-major nested loops over a
    materialised `Uint32Array` of shingles; inlined mixing arithmetic; no per-shingle
    closure; constants/coefficients/fold order unchanged.
  - **Estimate:** 0.5 day

- [x] T02 — Golden signature regression test
  - **Files:** `packages/plugins/dedup-hybrid/__tests__/minhash.spec.ts`
  - **Acceptance:** a fixed text's signature elements match pre-refactor values
    (captured before the change); determinism test still green.
  - **Estimate:** 0.5 day

## Phase 2 — Adaptive banding + component clustering

- [x] T03 — `deriveBands()` from `similarityThreshold`
  - **Files:** `packages/plugins/dedup-hybrid/src/strategies/minhash-strategy.ts`
  - **Acceptance:** smallest divisor B with recall ≥ 0.95 at the threshold; defaults derive
    B=16; explicit `bands` wins; invalid explicit combo still throws; unit table for
    0.85→16 / 0.6→32 / 0.95→8 (size 128).
  - **Estimate:** 0.5 day

- [x] T04 — Slot grouping + internal Union-Find + component emission
  - **Files:** `packages/plugins/dedup-hybrid/src/strategies/minhash-strategy.ts`
  - **Acceptance:** identical texts share one signature (call-count spy); connected
    candidates skip verification; emitted clusters are deterministic merged components
    (≥2 members); lenient-threshold test passes; transitive-merge test passes.
  - **Estimate:** 1 day

- [x] T05 — Update 500-input gate to component semantics
  - **Files:** `packages/plugins/dedup-hybrid/__tests__/minhash-strategy.spec.ts`
  - **Acceptance:** asserts full 500-index coverage of the partition + <500 ms at default
    budget; comment explains the component shape.
  - **Estimate:** 0.5 day

- [x] T06 — Full local verification
  - **Files:** (none — verification)
  - **Acceptance:** `npx jest packages/plugins/dedup-hybrid --silent` fully green at
    default budgets; `merge-default`, `store-memory`, `liveness-http` suites green.
  - **Estimate:** 0.5 day

## Phase 3 — CI coverage

- [x] T07 — `Test (Feature Plugins)` job
  - **Files:** `.github/workflows/ci.yml`
  - **Acceptance:** job mirrors existing checkout/node/npm-ci pattern; runs the four
    hermetic feature-plugin suites; `DEDUP_PERF_NFR1_MS=1000`, `DEDUP_PERF_NFR2_MS=8000`.
  - **Estimate:** 0.5 day

## Phase 4 — Docs

- [x] T08 — Registry/log/lint
  - **Files:** `docs/index.md`, `docs/log.md`
  - **Acceptance:** spec row added; log entry with measured before/after numbers;
    `npm run lint:docs` exits 0.
  - **Estimate:** 0.5 day

## Notes

- Write tests alongside each implementation task; do not batch testing into a final task.
- Update `docs/log.md` with each completed task in the same commit.
