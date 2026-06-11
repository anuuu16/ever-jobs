# Spec: 722 — Dedup-Hybrid Performance Gates & Adaptive LSH Banding

| Field          | Value                              |
| -------------- | ---------------------------------- |
| Spec ID        | 722                                |
| Slug           | 722-dedup-hybrid-perf-lsh          |
| Status         | done                               |
| Owner          | agent                              |
| Created        | 2026-06-11                         |
| Last updated   | 2026-06-11                         |
| Supersedes     | (none) — refines Spec 003 details  |
| Related specs  | 003, 721                           |

## 1. Problem Statement

Four `packages/plugins/dedup-hybrid` tests have been failing locally since they were
flagged as follow-ups in the run #11 log (and again in the Spec 718–721 session test
report). None of them run in CI today, so the breakage is invisible to the pipeline:

1. **NFR-1 perf gate** (`dedup-perf.spec.ts`): 1 000 jobs measured at ~6 100 ms against a
   250 ms budget.
2. **NFR-2 perf gate** (`dedup-perf.spec.ts`): 10 000 jobs measured at ~60 300 ms against a
   2 500 ms budget.
3. **MinHash 500-input sub-budget** (`minhash-strategy.spec.ts`): ~3 500 ms against 500 ms.
4. **Lenient-threshold clustering** (`minhash-strategy.spec.ts`): a pair with Jaccard ≈ 0.7
   produces **zero** clusters at `similarityThreshold: 0.6` although the verification
   threshold should accept it.

Root causes were measured, not guessed (see §10 Decisions for the full evidence):

- **Perf (1–3):** a V8 CPU profile of the Jest run attributes **72.7 % of total self-time
  (~61 s) to `permute()`** in `minhash.ts`. The function reads `Math.imul` (a global
  property) three times per call, ~79 M calls per 10 K-job dedup. Jest executes test code
  inside a `vm` context whose contextified global object resolves named properties through
  an interceptor — every `Math.imul` access is a slow C++-mediated lookup instead of an
  inline-cache hit. The identical code under plain `ts-node` (no vm context) completes the
  10 K batch in ~880 ms. This is an environment-sensitivity bug in our hot loop, not a Jest
  configuration problem: production code should not pay per-iteration global lookups in its
  hottest path regardless of host.
- **Lenient threshold (4):** `MinHashStrategy` fixes its LSH banding at B=16/R=8, whose
  candidate cutoff is `(1/16)^(1/8) ≈ 0.71`. Lowering `similarityThreshold` to 0.6 only
  relaxes the *verification* step — candidate *generation* still requires ≈ 0.71+
  similarity, so a Jaccard-0.7 pair deterministically never surfaces as a candidate and the
  verification threshold is moot.

Additionally, the strategy verifies **every** pair inside each LSH bucket and emits each
verified pair as a separate 2-element cluster. On duplicate-heavy batches (exactly the
perf-gate shape: 5× duplication) this is O(n²) verification work and O(n²) emitted pairs
(observed: 39 889 pair-clusters for 1 000 inputs) that the service's Union-Find then
re-merges anyway.

## 2. Goals

- All four failing dedup-hybrid tests pass at their **original** budgets (250 ms / 2 500 ms
  / 500 ms) — no budget relaxation in the test defaults.
- `similarityThreshold` is honoured end-to-end: candidate generation adapts to the
  configured threshold instead of silently filtering below ≈ 0.71.
- Near-duplicate verification work scales ~linearly on duplicate-heavy batches instead of
  quadratically.
- Dedup-hybrid (plus the other offline feature-plugin suites) runs in CI so this class of
  rot cannot recur invisibly.

## 3. Non-Goals

- No change to the dedup pipeline contract (`IDedupEngine`, `DedupResult`, DI token) or to
  Spec 003's two-stage hash→MinHash architecture.
- No new dependencies (the package stays zero-dep).
- No tuning of similarity *quality* (shingle size, signature size, seed defaults stay).
- No Jest configuration workarounds (e.g. relaxing budgets by default or skipping suites
  locally); the code is fixed, not the messenger.

## 4. User / Caller Stories

> As the **aggregation pipeline**, I want dedup of a 10 K-job batch to stay within the
> Spec 003 latency envelope, so that scrape cycles do not back up.

> As a **caller configuring `similarityThreshold`**, I want a lenient threshold (e.g. 0.6)
> to actually surface lenient matches, so that the knob does what its name says.

> As a **maintainer**, I want the feature-plugin suites to run in CI, so that a regression
> in dedup/merge/store/liveness code fails the build instead of rotting silently.

## 5. Functional Requirements

| ID    | Requirement                                                                                                   | Priority |
| ----- | ------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1  | `minhash.ts` hot paths must not perform per-iteration global-property lookups; `Math.imul` is hoisted to a module-scope binding.                                        | must     |
| FR-2  | `MinHasher.signature()` iterates a materialised shingle array with permutation-major nested loops and the mixing arithmetic inlined — no per-shingle closure invocation, no per-element function-call in the innermost loop. Signatures stay byte-identical to the previous implementation (same constants, same coefficients, same fold order). | must     |
| FR-3  | When `bands` is **not** explicitly configured, `MinHashStrategy` derives it from `similarityThreshold`: the smallest divisor B of `signatureSize` whose LSH candidate recall `1-(1-s^R)^B` at `s = similarityThreshold` is ≥ 0.95 (fallback: `signatureSize` bands). An explicit `bands` option always wins. | must     |
| FR-4  | The derivation in FR-3 must yield B=16 for the defaults (`signatureSize` 128, threshold 0.85) — existing default behaviour is unchanged.                                | must     |
| FR-5  | Jobs whose picked text is **identical** share one signature computation and are clustered together directly (still gated by `minTextLength`).                          | must     |
| FR-6  | `MinHashStrategy` maintains an internal Union-Find over signature slots; a candidate pair already in the same component skips signature verification; verified pairs union their components. The strategy emits **merged components** (≥ 2 member jobs) instead of one 2-element cluster per verified pair. | must     |
| FR-7  | Emitted clusters remain deterministic for identical inputs/options/seed: member order follows input order, component order follows first-touch order.                   | must     |
| FR-8  | The four previously failing tests pass at their original budgets; all other dedup-hybrid, merge-default, store-memory and service-level suites keep passing. The 500-input test's pair-count assertion is updated to component semantics (full input coverage instead of a pair count). | must     |
| FR-9  | A new CI job **Test (Feature Plugins)** runs the offline feature-plugin suites (`dedup-hybrid`, `merge-default`, `store-memory`, `liveness-http`) on every push/PR. CI sets `DEDUP_PERF_NFR1_MS=1000` / `DEDUP_PERF_NFR2_MS=8000` to absorb shared-runner variance while still catching order-of-magnitude regressions (the bug being fixed was 24×/24× over budget). | should   |

## 6. Non-Functional Requirements

| ID     | Requirement                                          | Target                                  |
| ------ | ---------------------------------------------------- | --------------------------------------- |
| NFR-1  | 1 000-job dedup latency (Spec 003 budget, under Jest) | < 250 ms max over 5 runs               |
| NFR-2  | 10 000-job dedup latency (Spec 003 budget, under Jest)| < 2 500 ms max over 5 runs             |
| NFR-3  | 500-input MinHashStrategy.cluster latency (under Jest)| < 500 ms                                |
| NFR-4  | Memory for unique-text grouping                       | ≤ one Map entry per distinct input text |
| NFR-5  | Determinism                                           | identical output across runs/processes  |

## 7. Contracts

### 7.1 API / Interface

```ts
// MinHashStrategyOptions — unchanged shape; `bands` becomes optional-with-derivation:
//   bands?: number   // explicit value wins; otherwise derived from similarityThreshold
// ClusterPartition — unchanged type; clusters are now merged components (>=2 indices,
// may exceed 2 members) rather than exclusively 2-element pairs.
```

### 7.2 Errors

| Code             | Meaning                                                        |
| ---------------- | -------------------------------------------------------------- |
| (constructor)    | `signatureSize` not divisible by explicit `bands` still throws |

## 8. Test Plan

- Unit: banding derivation table (0.85→16, 0.6→32, 0.95→8 for size 128; explicit `bands`
  override respected; invalid explicit combination throws).
- Unit: identical-text grouping clusters duplicates and computes one signature (spy on
  `MinHasher.signature` call count).
- Unit: lenient-threshold test (existing, currently failing) passes; strict-threshold
  behaviour unchanged.
- Unit: component emission — transitive merge (A≈B, B≈C ⇒ one [A,B,C] cluster).
- Unit: signature byte-equality regression — a fixed text's signature matches the
  pre-refactor values (golden assertion derived from the unchanged constants).
- Performance: the three existing gates at original budgets.
- CI: new Test (Feature Plugins) job green.

## 9. Open Questions

(none — see Decisions)

## 10. Decisions

- **D-1 (root cause evidence).** Stage-level timing (plain `ts-node`): prepare 162 ms,
  HashStrategy 3 ms, signatures 403 ms, MinHashStrategy total 674 ms, service end-to-end
  883 ms for the 10 K batch — already inside budget outside Jest. V8 CPU profile of the
  Jest run (`node --cpu-prof node_modules/jest/bin/jest.js …`): `permute` 61 276 ms self
  (72.7 %), `fnv1a` 2 848 ms (3.4 %). Hoisting `Math.imul` to a module const dropped the
  full perf suite from 83 s to 16.7 s and both gates passed at original budgets.
  Mechanism: Jest's `vm`-contextified global resolves named properties via interceptor,
  defeating V8's global-load inline caches; a module-scope binding is a closure-variable
  load and stays fast in any realm.
- **D-2 (banding math).** LSH candidate recall for a pair with Jaccard `s` under B bands of
  R rows is `1-(1-s^R)^B`. Derivation picks the smallest B (fewest, longest bands — fewest
  buckets) meeting recall ≥ 0.95 at `s = similarityThreshold`. 0.95 keeps the default
  (B=16, R=8, recall 0.994 at s=0.85) intact per FR-4.
- **D-3 (component emission).** The service merges strategy partitions through Union-Find
  regardless, so moving the union *into* the strategy changes no end-to-end behaviour; it
  removes O(n²) emitted pairs and lets connected candidates skip verification. The
  500-input test asserted an implementation detail (pair count > 50); it now asserts the
  product property (every input index appears in the emitted partition).
- **D-4 (identical-text fast path).** Identical text ⇒ identical signature ⇒ similarity
  1.0 ≥ any threshold ≤ 1, so direct grouping is outcome-equivalent and skips both
  signature recomputation and pair verification.
- **D-5 (CI budgets).** CI gets relaxed budgets via the pre-existing
  `DEDUP_PERF_NFR1_MS`/`DEDUP_PERF_NFR2_MS` env overrides (1 000/8 000 ms) rather than
  changing test defaults: shared runners are 2–4× noisier than dev machines, and the gate's
  job is to catch order-of-magnitude regressions, which it still does at those ceilings.
  The 500 ms sub-budget in `minhash-strategy.spec.ts` has no env override and historically
  passes at ~5–60 ms post-fix; left as-is.
- **D-6 (store-sqlite-drizzle / store-postgres-prisma excluded from the CI job).** Their
  suites need native/db scaffolding; the new job covers only suites that are fully offline
  and hermetic today. Extending coverage is future work.

## 11. References

- `packages/plugins/dedup-hybrid/src/minhash.ts` — hot path.
- `packages/plugins/dedup-hybrid/src/strategies/minhash-strategy.ts` — banding/verification.
- `.specify/specs/003-*/spec.md` — original dedup engine spec (NFR budgets).
- `docs/log.md` run #11 entry — original follow-up flag.
