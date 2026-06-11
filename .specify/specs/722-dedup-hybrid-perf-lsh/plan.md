# Plan: 722 — Dedup-Hybrid Performance Gates & Adaptive LSH Banding

| Field        | Value      |
| ------------ | ---------- |
| Spec         | spec.md    |
| Created      | 2026-06-11 |
| Last updated | 2026-06-11 |

## 1. Approach

The work splits into three independent code changes inside `packages/plugins/dedup-hybrid`
plus one CI workflow addition. All are driven by measured evidence (spec §10 D-1): the perf
failures are a hot-loop environment-sensitivity bug (per-call `Math.imul` global lookups,
which Jest's vm-contextified global turns into interceptor calls), and the lenient-threshold
failure is a fixed LSH banding configuration that ignores the configured verification
threshold.

**`minhash.ts`** gets the mechanical hot-path hardening: `Math.imul` hoisted to a module
const, and `signature()` rewritten from a per-shingle `Set.forEach` closure that calls
`permute()` per (shingle × permutation) into permutation-major nested `for` loops over a
materialised `Uint32Array` of shingles with the mixing arithmetic inlined. The constants,
coefficient generation and fold order are untouched, so signatures remain byte-identical —
asserted by a golden test.

**`minhash-strategy.ts`** gets the two semantic fixes. First, when the caller does not pass
`bands`, the band count is derived from `similarityThreshold` by scanning the divisors of
`signatureSize` for the smallest band count whose LSH recall at the threshold is ≥ 0.95
(formula in spec D-2); explicit `bands` keeps winning, and the defaults still derive B=16 so
existing behaviour is bit-for-bit stable. Second, clustering moves from
verify-every-bucket-pair + emit-2-clusters to: group identical texts into slots (one
signature per distinct text), LSH-bucket the slots, and run an internal Union-Find where
already-connected candidates skip verification and verified pairs union. Components expand
back to job indices at the end. The service already unions whatever partitions strategies
emit, so end-to-end results are unchanged while the strategy's own work and output drop from
quadratic to near-linear on duplicate-heavy input.

**Tests:** the three perf gates keep their original budgets. The 500-input test's
`clusters.length > 50` assertion encoded the old pair-emission shape; it now asserts the
product property (all 500 indices covered by the partition). New unit tests cover banding
derivation, identical-text grouping (signature call count), transitive component merge, and
signature byte-stability.

**CI:** a new `Test (Feature Plugins)` job mirrors the existing test jobs' checkout/node/
npm-ci steps and runs the four hermetic feature-plugin suites with CI-relaxed perf budgets
via the pre-existing env overrides.

## 2. Phases

### Phase 1 — Hot-path hardening (`minhash.ts`)

- Goal: perf gates pass at original budgets under Jest.
- Deliverables: hoisted `imul`, loop restructure, golden signature test.
- Exit criteria: `dedup-perf.spec.ts` and the 500-input gate green at default budgets.

### Phase 2 — Adaptive banding + component clustering (`minhash-strategy.ts`)

- Goal: lenient-threshold test green; near-linear verification on duplicate-heavy batches.
- Deliverables: `deriveBands()`, slot grouping, internal Union-Find, component emission,
  updated + new unit tests.
- Exit criteria: full dedup-hybrid suite green (58+ tests), service suite green.

### Phase 3 — CI coverage

- Goal: feature-plugin suites run on every push/PR.
- Deliverables: `Test (Feature Plugins)` job in `.github/workflows/ci.yml` with
  `DEDUP_PERF_NFR1_MS=1000` / `DEDUP_PERF_NFR2_MS=8000`.
- Exit criteria: CI run green including the new job.

### Phase 4 — Docs

- Goal: registry/log/lint hygiene.
- Deliverables: `docs/index.md` row, `docs/log.md` entry, doc-lint pass.
- Exit criteria: `npm run lint:docs` exits 0.

## 3. Packages Touched

| Package                          | Change                                            |
| -------------------------------- | ------------------------------------------------- |
| `packages/plugins/dedup-hybrid`  | hot-path + strategy rewrite, tests                |
| `.github/workflows/ci.yml`       | new Test (Feature Plugins) job                    |
| `docs/`                          | index/log entries                                 |
| `packages/models`, `apps/*`      | (no change)                                       |

## 4. Dependencies

| Library | Version | Rationale                                  |
| ------- | ------- | ------------------------------------------ |
| (none)  | —       | package stays zero-dep per Spec 003 / Q-009 |

## 5. Risks & Mitigations

| Risk                                                          | Likelihood | Impact | Mitigation                                                                 |
| ------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Loop restructure silently changes signatures                  | L          | H      | golden byte-equality test against pre-refactor values                      |
| Derived banding changes default behaviour                     | L          | M      | FR-4 unit test pins defaults → B=16                                        |
| Component emission breaks a service-level expectation         | L          | M      | full service suite re-run; service already unions partitions               |
| Perf gates flake on shared CI runners                         | M          | L      | CI env budgets 1 000/8 000 ms (still catches the 24× class of regression)  |
| New CI job reveals latent failures in merge-default/store-memory | L       | M      | suites verified locally green before push                                  |

## 6. Rollback Plan

Single revert of the spec-722 commit restores the previous strategy and hot path; no data,
schema or API surface is involved. The CI job is independent and can be deleted alone.

## 7. Migration Plan (if applicable)

None — internal algorithm change behind an unchanged DI contract.

## 8. Open Questions for Plan

None — decisions D-1…D-6 recorded in spec.md.
