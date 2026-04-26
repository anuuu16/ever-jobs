# Tasks: 003 — Job Deduplication Engine

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Models & contracts

- [x] T01 — Add `CanonicalJob`, `SourceObservation`, `FieldWithProvenance` types.
  - **Files:** `packages/models/src/interfaces/canonical-job.interface.ts`,
    `packages/models/src/interfaces/source-observation.interface.ts`,
    `packages/models/src/interfaces/field-with-provenance.interface.ts`,
    `packages/models/src/index.ts` (re-export).
  - **Acceptance:** Types compile; barrel exports them; sample fixture parses.
  - **Estimate:** 0.5 day.
  - **Done:** 2026-04-26 (run #3) — interfaces shipped, all `readonly`,
    `provenance()` helper exported.

- [x] T02 — Add `IDedupEngine`, `IMergeResolver` interfaces.
  - **Files:** `packages/models/src/interfaces/dedup-engine.interface.ts`,
    `packages/models/src/interfaces/merge-resolver.interface.ts`.
  - **Acceptance:** Interfaces exported; consumed by Phase 3 plugin.
  - **Estimate:** 0.25 day.
  - **Done:** 2026-04-26 (run #3) — `IDedupEngine` returns a
    `DedupResult` envelope with assignments, errors, metrics; tokens
    `DEDUP_ENGINE_TOKEN` & `MERGE_RESOLVER_TOKEN` exported.

- [x] T03 — Add zod schemas for `CanonicalJob` and `RawJob` boundaries.
  - **Files:** `packages/models/src/schemas/canonical-job.schema.ts`,
    `packages/models/__tests__/canonical-job.schema.spec.ts`.
  - **Acceptance:** `CanonicalJobSchema.parse()` round-trips a fixture.
  - **Estimate:** 0.25 day.
  - **Done:** 2026-04-26 (run #3) — schemas, `safeParse` tests for
    happy + sad paths, zod added as runtime dep at root.

## Phase 2 — Canonicalisation helpers

- [x] T04 — Implement `normalizeCompany`, `normalizeTitle`, `normalizeLocation`.
  - **Files:** `packages/common/src/normalize.ts`,
    `packages/common/__tests__/normalize.spec.ts`.
  - **Acceptance:** golden-input table tests pass; idempotent.
  - **Estimate:** 0.5 day.
  - **Done:** 2026-04-26 (run #3) — 30+ golden-table cases, idempotency
    proved per-helper, US-state abbreviation expansion, remote-token
    canonicalisation.

- [x] T05 — Implement `canonicalKey(job)` and `canonicalJobId(job)` (sha-256).
  - **Files:** `packages/common/src/canonical-key.ts`,
    `packages/common/__tests__/canonical-key.spec.ts`.
  - **Acceptance:** Same input → same id; different input → different id.
  - **Estimate:** 0.25 day.
  - **Done:** 2026-04-26 (run #3) — sha-256 lower-case hex digest,
    deterministic, cosmetic-only differences collapse to same id.

## Phase 3 — `dedup-hybrid` plugin

- [x] T06 — Scaffold `packages/plugins/dedup-hybrid/`.
  - **Files:** `package.json`, `tsconfig.json`, `src/index.ts`,
    `src/dedup-hybrid.module.ts`, `src/dedup-hybrid.service.ts`.
  - **Acceptance:** Package builds standalone.
  - **Estimate:** 0.25 day.
  - **Done:** 2026-04-26 (run #4) — package scaffolded with NestJS module
    that binds `DedupHybridService` under `DEDUP_ENGINE_TOKEN`. Path
    aliases registered in `tsconfig.base.json` + `jest.config.js`.

- [x] T07 — Implement hash-only fast path.
  - **Files:** `src/strategies/hash-strategy.ts`.
  - **Acceptance:** O(N) bucketing; collisions surfaced for Phase 3 stage 2.
  - **Estimate:** 0.5 day.
  - **Done:** 2026-04-26 (run #4) — `HashStrategy` buckets by
    precomputed `canonicalJobId`; preserves stable insertion order; six
    unit tests including a 1 000-input < 25 ms perf assertion.

- [x] T08 — Implement MinHash + LSH stage 2.
  - **Files:** `src/minhash.ts`, `src/strategies/minhash-strategy.ts`.
  - **Acceptance:** Threshold-config respected; near-dupes merged.
  - **Estimate:** 1 day.
  - **Done:** 2026-04-26 (run #5) — in-tree MinHash + LSH per Q-009
    default. `MinHasher` produces a deterministic `Uint32Array`
    signature (default size 128) using FNV-1a-hashed word-shingles
    (default k=3) and seeded affine permutations.
    `MinHashStrategy` uses LSH banding (default B=16, R=8) for
    candidate generation and verifies each candidate with
    `signatureSimilarity ≥ similarityThreshold` (default 0.85). The
    strategy is pure / allocation-light: typed-array signatures, no
    global state, deterministic given options + seed.

- [x] T09 — Wire strategies into `DedupHybridService`.
  - **Files:** `src/dedup-hybrid.service.ts`,
    `__tests__/dedup-hybrid.service.spec.ts`.
  - **Acceptance:** Spec tests + golden set ≥ 99% precision.
  - **Estimate:** 0.5 day.
  - **Done:** 2026-04-26 (run #5) — service composes
    `[HashStrategy(), MinHashStrategy()]` and unions partitions via
    `UnionFind`. Two new tests exercise Stage-2 only (different titles,
    same description → merged via MinHash; unrelated descriptions → not
    merged). Stage 1 still drives the fast path; Stage 2 handles
    near-duplicates that the canonical-id-only hash misses.

- [x] T10 — Performance benchmark.
  - **Files:** `__tests__/dedup-perf.spec.ts`.
  - **Acceptance:** 1 K jobs < 250 ms p95; 10 K jobs < 2.5 s p95.
  - **Estimate:** 0.5 day.
  - **Done:** 2026-04-26 (run #5) — dedicated benchmark suite measures
    the worst-of-N elapsed across N=5 runs (override via
    `DEDUP_PERF_RUNS`, `DEDUP_PERF_NFR1_MS`, `DEDUP_PERF_NFR2_MS`).
    Runs use a 5x duplication factor with long descriptions so both
    stages do real work. The smoke gate in
    `dedup-hybrid.service.spec.ts` is preserved as a fast pre-check.

## Phase 4 — `merge-default` plugin

- [ ] T11 — Scaffold `packages/plugins/merge-default/`.
  - **Files:** standard plugin layout.
  - **Estimate:** 0.25 day.

- [ ] T12 — Implement priority-order resolver (ATS > company > board > niche).
  - **Files:** `src/merge-default.service.ts`,
    `__tests__/merge-default.service.spec.ts`.
  - **Acceptance:** Precedence + provenance preserved.
  - **Estimate:** 0.5 day.

## Phase 5 — Wire into `JobsAggregator`

- [ ] T13 — Update `JobsAggregator` to invoke `IDedupEngine` after fan-out.
  - **Files:** `apps/api/src/jobs/jobs.aggregator.ts`,
    `apps/api/__tests__/integration/jobs.aggregator.spec.ts`.
  - **Acceptance:** Multi-source response is deduped; `dedup=false` opt-out works.
  - **Estimate:** 0.5 day.

- [ ] T14 — Expose `dedup` query param on `/api/jobs/search`.
  - **Files:** `apps/api/src/jobs/jobs.controller.ts`,
    `apps/api/__tests__/e2e/jobs-search.e2e-spec.ts`.
  - **Acceptance:** Backwards compatible; default true.
  - **Estimate:** 0.25 day.

## Notes

- Phase 1 and Phase 2 can run in parallel.
- Phase 3 task T08 is the hardest; budget MinHash carefully with `datasketch-js`.
- Performance gate (T10) is mandatory before T13 lands.
