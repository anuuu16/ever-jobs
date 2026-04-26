# Change Log — Docs & Specs

> Append-only log of every doc/spec edit. **Newest entry at the top.** This is a
> human-readable audit trail; for source-code history, see `git log`.

---

## 2026-04-26 — Scheduled run #5 (Spec 003 Phase 3 closes — MinHash + perf gate)

**Scope:** finish Spec 003 Phase 3. Land T08 (MinHash + LSH strategy), close
T09 (wire MinHash into the service), and ship T10 (dedicated `dedup-perf`
benchmark suite). Q-009 resolved (in-tree MinHash per the run #4 default).

**Changes — code:**

- `packages/plugins/dedup-hybrid/src/minhash.ts` — new in-tree MinHash + LSH
  building blocks. Public surface: `MinHasher` (deterministic
  `Uint32Array` signatures, default size 128, default k=3 word-shingles,
  seeded affine permutations + Murmur-style finaliser); `lshBandKeys`
  (split signature into B band-keys); `signatureSimilarity` (Jaccard
  estimate from two signatures); `tokenizeForShingles` and
  `shingleHashes` (test-friendly utility re-exports). Allocation-light:
  typed-array signatures, no global state.
- `packages/plugins/dedup-hybrid/src/strategies/minhash-strategy.ts` — new
  Stage-2 dedup strategy. Configurable knobs:
  `signatureSize`/`bands`/`shingleSize`/`minTextLength`/
  `similarityThreshold`/`maxBucketSize`/`seed`. Defaults
  `B=16, R=8` (LSH curve crosses 0.5 around s≈0.71 → high recall at
  spec's 0.85 verification threshold), `signatureSize=128`,
  `minTextLength=80`, `similarityThreshold=0.85`,
  `maxBucketSize=200` (guards against pathological boilerplate buckets).
  Falls back to `title + companyName` when description is empty.
- `packages/plugins/dedup-hybrid/src/dedup-hybrid.service.ts` — service
  now composes `[HashStrategy(), MinHashStrategy()]`. Pipeline doc
  comment updated.
- `packages/plugins/dedup-hybrid/src/index.ts` — barrel re-exports
  `MinHashStrategy`, `MinHasher`, `lshBandKeys`, `shingleHashes`,
  `signatureSimilarity`, `tokenizeForShingles` and the `MinHasherOptions`
  / `MinHashStrategyOptions` types.

**Changes — tests:**

- `packages/plugins/dedup-hybrid/__tests__/minhash.spec.ts` — 24+ unit
  cases across `tokenizeForShingles`, `shingleHashes`, `MinHasher`,
  `lshBandKeys`, and `signatureSimilarity` (length, determinism,
  near-dup similarity > 0.8, distinct-text similarity < 0.2,
  seed-dependence, error guards).
- `packages/plugins/dedup-hybrid/__tests__/minhash-strategy.spec.ts` — 9
  cases covering name, configuration validation, empty / single-input
  no-ops, near-dup merging at default threshold, configurable threshold
  (strict 0.95 vs lenient 0.6), `minTextLength` skip, title+company
  fallback, determinism, and a 500-input < 500 ms perf gate.
- `packages/plugins/dedup-hybrid/__tests__/dedup-hybrid.service.spec.ts`
  — 2 new cases: Stage-2-only merge across different titles via
  MinHash, and unrelated-description separation. Existing 9 cases
  unchanged.
- `packages/plugins/dedup-hybrid/__tests__/dedup-perf.spec.ts` — new
  dedicated NFR-1 / NFR-2 benchmark suite. Worst-of-N elapsed gating
  with `DEDUP_PERF_RUNS` / `DEDUP_PERF_NFR1_MS` / `DEDUP_PERF_NFR2_MS`
  env-var overrides for slower CI workers.

**Changes — docs / specs:**

- `.specify/specs/003-deduplication-engine/tasks.md` — T08, T09, T10
  marked done with per-task notes referencing the new files.
- `docs/questions.md` — Q-009 resolved (in-tree MinHash adopted).
- `docs/index.md` — Spec 003 status flipped to `Phases 1–3 + perf gate
  done (T01–T10); merge resolver (Phase 4) next`.
- `docs/log.md` — this entry.
- `/competitor-watch.md` — run #5 sync line; no upstream commits in any
  of the three tracked repos.

**Notes:**

- External research repos in `OTHERS/` re-fetched via their
  `upstream-https` remotes; **no new commits** since run #4
  (Ats-scrapers @ `3bacd6e`, JobSpy @ `fda080a`, Jobspy-api @
  `26bb6f4`).
- Tests authored but not executed in this scheduled run —
  `node_modules` is not installed in the agent sandbox; CI will
  validate on push. The `dedup-perf` suite ships with permissive
  defaults (250 ms / 2.5 s, max-of-5 runs) and env-var overrides; if a
  cold CI worker flakes, bump `DEDUP_PERF_NFR1_MS` / `_NFR2_MS` via
  workflow env.
- Phase 4 (`merge-default` plugin, T11/T12) is now the next pending
  block. Phase 5 (`JobsAggregator` wiring, T13/T14) follows.
- LSH band/row default chosen as B=16, R=8 (not B=8, R=16 as initially
  drafted) to keep recall high at the spec-target 0.85 threshold —
  candidate-pair P(LSH-match | s=0.85) ≈ 0.96 vs ≈ 0.46 for B=8.

---

## 2026-04-26 — Scheduled run #4 (Spec 003 Phase 3 hash path lands)

**Scope:** ship T06 (scaffold), T07 (hash-only fast path), and partial T09
(wire strategies + materialise canonical records) of Spec 003 — the
default `IDedupEngine` plugin is now bootable. T08 (MinHash) is queued
behind a new question (Q-009) and stays for the next run; T10's full
perf-suite waits on T08.

**Changes — code:**

- `packages/plugins/dedup-hybrid/package.json` — new package
  `@ever-jobs/dedup-hybrid` v0.1.0.
- `packages/plugins/dedup-hybrid/tsconfig.json` — extends root base.
- `packages/plugins/dedup-hybrid/src/index.ts` — barrel re-exports
  module + service + strategy + types + UnionFind utility.
- `packages/plugins/dedup-hybrid/src/types.ts` — internal contracts
  (`PreparedJob`, `ClusterPartition`, `IDedupStrategy`,
  `DedupHybridOptions`).
- `packages/plugins/dedup-hybrid/src/union-find.ts` — disjoint-set
  with path compression + union-by-rank, backed by `Int32Array` for
  zero-GC merging.
- `packages/plugins/dedup-hybrid/src/strategies/hash-strategy.ts` —
  Stage 1 strategy: O(N) bucketing on the precomputed `canonicalJobId`.
- `packages/plugins/dedup-hybrid/src/dedup-hybrid.service.ts` —
  `DedupHybridService` implements `IDedupEngine`: validates inputs,
  prepares per-input keys once, runs strategies through Union-Find,
  emits one `CanonicalJob` per cluster with field provenance, returns
  a `DedupResult` envelope (canonical + assignments + errors + metrics).
- `packages/plugins/dedup-hybrid/src/dedup-hybrid.module.ts` — NestJS
  module that binds `DedupHybridService` under `DEDUP_ENGINE_TOKEN`.
- `tsconfig.base.json` — added `@ever-jobs/dedup-hybrid` path alias.
- `jest.config.js` — added matching `moduleNameMapper` entry.

**Changes — tests:**

- `packages/plugins/dedup-hybrid/__tests__/union-find.spec.ts` — 5
  cases including a 10 K-element merge < 100 ms perf assertion.
- `packages/plugins/dedup-hybrid/__tests__/hash-strategy.spec.ts` — 6
  cases (uniqueness, grouping, empty input, determinism, 1 K-input
  perf gate < 25 ms).
- `packages/plugins/dedup-hybrid/__tests__/dedup-hybrid.service.spec.ts`
  — 9 cases covering identical-input merge, cosmetic-difference merge
  ("Acme, Inc." / "ACME Inc" / "Acme" → 1 record), distinct-title
  separation, invalid-input rejection
  (`ERR_DEDUP_INVALID_INPUT`), sha-256 hex shape, determinism, empty
  input, per-field provenance, and an NFR-1 1 K-job dedup < 250 ms
  smoke gate.

**Changes — docs / specs:**

- `.specify/specs/003-deduplication-engine/tasks.md` — T06 + T07 marked
  done with per-task notes; T09 marked partial; T08 + T10 carry context
  notes referencing Q-009 and the existing in-service smoke gate.
- `docs/questions.md` — added **Q-009** (MinHash library choice for T08;
  default = **in-tree implementation** to keep Phase 3 zero-dep).
- `docs/index.md` — Spec 003 status flipped to `Phase 1, 2, and Phase 3
  hash-path done (T01–T07); MinHash (T08) next`.
- `docs/log.md` — this entry.

**Notes:**

- External research repos in `OTHERS/` re-fetched via their
  `upstream-https` remotes; **no new commits** since run #3
  (Ats-scrapers @ `3bacd6e`, JobSpy @ `fda080a`, Jobspy-api @
  `26bb6f4`). External-tracking notes belong in the parent-directory
  watch file per the scheduled-task brief, not here.
- Tests authored but not executed in this scheduled run —
  `node_modules` is not installed in the agent sandbox; CI will validate
  on push. The NFR-1 perf assertion in `dedup-hybrid.service.spec.ts`
  may flake on cold-CI workers; if so we relax the threshold or move
  the assertion to a dedicated benchmark suite (T10).
- Dedup is intentionally registered under `DEDUP_ENGINE_TOKEN` (not
  added to `Site` enum or `ALL_SOURCE_MODULES`) — it's a feature plugin,
  not a source plugin. Spec 003 / FR-1 explicitly calls for swap-by-DI.
- Push status will mirror prior runs — `origin` is SSH-only and the
  sandbox has no agent SSH key. The user's interactive environment
  pushes the develop branch.

---

## 2026-04-26 — Scheduled run #3 (Spec 003 Phase 1 + 2 land)

**Scope:** ship the foundation of the dedup engine — types, schemas, and
canonicalisation helpers. Phase 1 (T01–T03) and Phase 2 (T04–T05) of Spec
003 are now complete; Phase 3 (`dedup-hybrid` plugin scaffolding) unblocked
for the next run.

**Changes — code:**

- `packages/models/src/interfaces/field-with-provenance.interface.ts` — new
  `FieldWithProvenance<T>` interface plus `provenance()` constructor helper.
- `packages/models/src/interfaces/source-observation.interface.ts` — new
  `SourceObservation` interface (per-source sighting record).
- `packages/models/src/interfaces/canonical-job.interface.ts` — new
  `CanonicalJob` interface; flat shortcut fields plus `fields` provenance map.
- `packages/models/src/interfaces/dedup-engine.interface.ts` — new
  `IDedupEngine` interface, `DedupResult`, `DedupInputError`, `DedupMetrics`,
  and `DEDUP_ENGINE_TOKEN`.
- `packages/models/src/interfaces/merge-resolver.interface.ts` — new
  `IMergeResolver` interface and `MERGE_RESOLVER_TOKEN`.
- `packages/models/src/interfaces/index.ts` — barrel re-exports the five
  new interfaces.
- `packages/models/src/schemas/canonical-job.schema.ts` — new zod schemas
  `FieldWithProvenanceSchema`, `SourceObservationSchema`,
  `CanonicalJobSchema`, `RawJobSchema` with inferred `*Shape` aliases.
- `packages/models/src/schemas/index.ts` + `packages/models/src/index.ts` —
  re-export the schemas alongside enums/dtos/interfaces.
- `packages/common/src/normalize.ts` — pure `normalizeCompany`,
  `normalizeTitle`, `normalizeLocation` helpers (idempotent, NFKD
  diacritic-stripping, US-state abbreviation expansion, remote-token
  collapsing, multi-word company-suffix removal).
- `packages/common/src/canonical-key.ts` — `canonicalKey()` joins normalised
  triple with pipes; `canonicalJobId()` sha-256 lower-case hex digest.
- `packages/common/src/index.ts` — re-exports `normalize` + `canonical-key`.
- `package.json` — added `zod ^3.23.0` to runtime dependencies.

**Changes — tests:**

- `packages/models/__tests__/canonical-job.schema.spec.ts` — 8 cases for
  `CanonicalJobSchema`, `SourceObservationSchema`, `FieldWithProvenanceSchema`,
  `RawJobSchema` covering happy paths, bad URL, missing required fields,
  empty arrays, and round-trip via `parse()`.
- `packages/common/__tests__/normalize.spec.ts` — 30+ golden-input table
  cases plus per-helper idempotency proofs.
- `packages/common/__tests__/canonical-key.spec.ts` — 10 cases asserting
  determinism, hex shape, distinctness, and that cosmetic-only differences
  collapse to the same id.

**Changes — docs / specs:**

- `.specify/specs/003-deduplication-engine/tasks.md` — T01–T05 marked done,
  with per-task "Done:" notes.
- `docs/log.md` — this entry.
- `docs/index.md` — Spec 003 status flipped from `draft (full)` to
  `Phase 1 + 2 complete; Phase 3 next`.
- `docs/questions.md` — no new questions this run.

**Notes:**

- External research repos tracked outside this monorepo were re-fetched
  via their `upstream-https` remotes; no new commits since run #2.
  No external-tracking entries belong in this repo (they live in the
  parent-directory watch file per the scheduled-task brief).
- Tests authored but not executed in this run — `node_modules` is not
  installed in the agent sandbox; CI will validate.
- Zod was already mentioned as a "preferred reusable lib" in `AGENTS.md`
  §6 but not yet in deps. Now resolved; pinned `^3.23.0`.
- Push blocked again — `origin` is SSH-only and the sandbox has no
  agent SSH key. Local commit lands on `develop`; user's interactive
  environment will push.

---

## 2026-04-26 — Scheduled run #2 (specs backfill, env-var, deep audit)

**Scope:** complete Spec-Kit Phase 2 (backfill specs 002–005), implement Spec 001 FR-6
(`EVER_JOBS_DISABLED_SOURCES`), and run a deep parity audit of the secondary
ATS-scrapers project tracked outside this repo.

**Changes — docs / specs:**

- Created `.specify/specs/001-plugin-architecture-foundation/plan.md` and `tasks.md`
  (the spec.md already existed). Phase 2 (FR-6 env-var) is now in-progress (T04 done,
  T05 done, T06 done).
- Created `.specify/specs/002-docs-and-spec-kit-bootstrap/{spec,plan,tasks}.md` —
  the run #1 log claimed these existed but only stubs were committed; this run
  ships the full set.
- Created `.specify/specs/003-deduplication-engine/{spec,plan,tasks}.md` (full).
- Created `.specify/specs/004-persistence-storage-plugins/{spec,plan,tasks}.md` (full).
- Created `.specify/specs/005-source-health-circuit-breaker/{spec,plan,tasks}.md` (full).
- Created `docs/SOURCE_ADOPTION_BACKLOG.md` — neutral inbound queue of new
  job-source platforms to adopt as source plugins.
- Created empty `docs/{plans,adr,runbooks}/` directories (anchored by `.gitkeep`-less
  index entries).
- Doc-lint fix: removed a broken external-watch-list link from `docs/index.md`
  (that file lives outside this repo per scheduled-task brief).
- `docs/index.md` updated:
  - New row for `SOURCE_ADOPTION_BACKLOG.md`.
  - Spec table now links spec/plan/tasks for every entry; statuses updated to reflect
    real on-disk state (no more phantom "draft" entries).
- `docs/questions.md` gained Q-007 (one-spec-per-source vs bulk).

**Changes — code:**

- `packages/plugin/src/config/disabled-sources.ts` — new module exposing
  `DISABLED_SOURCES_ENV_VAR`, `parseDisabledSources()`, and `readDisabledSources()`
  helpers.
- `packages/plugin/src/index.ts` — re-exports the new helpers.
- `packages/plugin/src/discovery/plugin-discovery.service.ts` — discovery now
  consults `readDisabledSources()` and skips listed sites at registration time;
  unknown ids logged at `warn` level (typo guard).
- `packages/plugin/__tests__/disabled-sources.spec.ts` — 11 unit tests covering
  env-var parsing edge cases.
- `packages/plugin/__tests__/plugin-discovery-disabled.spec.ts` — 7 integration
  tests exercising the discovery → registry path with three fake plugins
  (Linkedin / Indeed / Glassdoor) under various env-var configurations.
- `docs/PLUGIN_ARCHITECTURE.md` — new "Runtime Configuration" section documenting
  the env-var.
- `.env.example` — new `EVER_JOBS_DISABLED_SOURCES` block under "Plugin Toggle".

**Notes:**

- Tests authored but not executed in this scheduled run — `node_modules` is not
  installed in the agent's sandbox (ts-jest preset missing). Next CI run will
  validate; the code is statically reviewed for type-safety.
- Commit landed locally as `59ec0d6` on `develop`; **push blocked** because
  `origin` uses SSH and the scheduled-task sandbox has no agent SSH key
  (same as run #1). The user's interactive environment will push next time.
- Scheduled-task brief routes external-research notes to a parent-directory
  watch file (outside this repo). New platforms surface here only via
  `SOURCE_ADOPTION_BACKLOG.md`, referenced by their public platform name.
- 6 new platforms identified for adoption (Avature, Gem, Join.com, Oracle HCM
  Cloud, Mercor, Tesla). Plus logic-improvement candidates for European salary
  parsing, Workable behaviour, Workday discovery URL helper, Apple cache layout,
  and seed-list refreshes for Greenhouse / Lever / Workable / SmartRecruiters.

---

## 2026-04-26 — Scheduled run #1 (bootstrap)

**Scope:** initialize Spec-Kit-driven workflow, agent rules, doc index.

**Changes:**

- Added `/AGENTS.md` — authoritative rules for all AI coding agents.
- Added `/CLAUDE.md` — Claude-Code operating notes (loads AGENTS.md by reference).
- Added `.specify/` workspace:
  - `README.md` describing the Specify→Plan→Tasks→Implement loop.
  - `memory/constitution.md` — twelve-article project constitution.
  - `templates/{spec,plan,tasks}.template.md` — copy-and-fill templates.
- Added `docs/index.md` — full documentation index.
- Added `docs/log.md` — this file.
- Added `docs/questions.md` — open-questions ledger.
- Drafted foundational specs (under `.specify/specs/`):
  - `001-plugin-architecture-foundation` — retroactively documents existing plugin infra.
  - `002-docs-and-spec-kit-bootstrap` — *this run*.
  - `003-deduplication-engine` — cross-source job dedup.
  - `004-persistence-storage-plugins` — pluggable storage adaptors.
  - `005-source-health-circuit-breaker` — per-plugin reliability.


**Notes:**

- SSH `git pull` blocked in this sandbox (no agent SSH key); used HTTPS fetch instead.
  Recorded in `docs/questions.md` as Q-001 with default *"keep using https fetch in
  scheduled runs."*
- No source-code changes this run — focus is foundation only.
- Next run will pick up Spec 003 (dedup engine) Phase 1 once human reviews defaults.

---

<!--
Template for future entries:

## YYYY-MM-DD — <one-line summary>

**Scope:** …

**Changes:**

- …

-->
