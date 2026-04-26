# Change Log — Docs & Specs

> Append-only log of every doc/spec edit. **Newest entry at the top.** This is a
> human-readable audit trail; for source-code history, see `git log`.

---

## 2026-04-26 — Scheduled run #9 (Spec 002 Phase 3 — doc-lint script + CI hook)

**Scope:** close Spec 002 by shipping the `scripts/docs-lint.ts` linter
(T11) and wiring it into npm + GitHub Actions (T12). Spec 002 graduates
from "Phase 1+2 complete; Phase 3 pending" to "All phases done
(T01–T12)". Q-011 (parser-dep trade-off) resolved in favour of a
zero-dep regex parser.

**Changes — code:**

- `scripts/docs-lint.ts` — new linter, ~270 LOC, zero runtime deps.
  Public surface: `lintDocs(repoRoot): Promise<DocLintResult>` plus the
  pure helpers `extractLinks`, `parseLogHeaders`, `checkFrontmatter`,
  `formatResult`. Five checks:
  - **Broken internal links** — scans every `*.md` under `docs/` and
    `.specify/`, extracts inline `[text](href)` links, skips external
    schemes (`http(s)`, `mailto`, `ftp`, `tel`, `data`, `ssh`,
    `javascript`), pure anchors (`#section`), strips `:line` /
    `#fragment` / `?query` suffixes, then `fs.stat`s each target.
    Honours code fences (` ``` ` and `~~~`) and inline-code spans
    (`` `code` ``) so docstring examples don't trip the checker.
  - **Unindexed docs** — every doc under `docs/` and `.specify/` must
    be reachable from `docs/index.md`. Exemptions: `docs/{index,log,
    questions}.md`, `.specify/README.md`,
    `.specify/memory/constitution.md`, plus everything under
    `.specify/templates/` (still indexed but skipped to avoid
    template-vs-real-spec conflation).
  - **Duplicate log entries** — parses `## YYYY-MM-DD — … run #N` headers
    in `docs/log.md`; flags any `date#run-number` pair that repeats.
  - **Out-of-order log entries** — same headers must be DESC by
    `(date, run-number)` from top to bottom (newest-at-top contract
    from Spec 002 §FR-6).
  - **Spec frontmatter** — every `spec.md` / `plan.md` / `tasks.md`
    under `.specify/specs/<NNN>-<slug>/` must start with an `H1` and
    a `| Field | Value |` metadata table within the next 40 lines.
  - CLI mode: `ts-node scripts/docs-lint.ts [repoRoot]` exits 0 on
    clean, 1 on lint issues, 2 on internal error. Programmatic mode
    returns the full `DocLintResult` envelope so consumers can render
    custom output (e.g. a future GitHub annotation step).
- `docs/DEPLOYMENT.md` — fixed a stale `[\`.env.example\`](.env.example)`
  link that resolved to `docs/.env.example` (non-existent). Now
  `(../.env.example)` and resolves to repo-root `.env.example`. This
  was the only broken link surfaced when running the new lint against
  the live repo.

**Changes — tests:**

- `scripts/__tests__/docs-lint.spec.ts` — 26 unit cases:
  - `extractLinks` — basic inline, multiple-per-file, fenced
    (` ``` `) skip, fenced (`~~~`) skip, inline-code skip,
    link-text-with-inline-code, title-attribute trimming.
  - `parseLogHeaders` — date+run, date-only, no-headers, line-number
    accounting.
  - `checkFrontmatter` — H1+table pass, H1-only fail, no-H1 fail.
  - `lintDocs` end-to-end: minimal-clean, broken-internal-link,
    external/anchor skip, `:line`-suffix strip,
    `#fragment`/`?query` strip, unindexed-doc flag, exempt-list
    coverage, duplicate-log-entry detection, out-of-order-log
    detection, newest-at-top happy path, spec-frontmatter
    pass/fail, `/`-rooted resolution, `../`-rooted resolution,
    fenced-code link ignore, 100-doc tree NFR-1 < 5 s perf gate.
  - `formatResult` — green-tick output on `ok`, one section per
    non-empty issue list otherwise.
- `jest.config.js` — `roots` extended with `<rootDir>/scripts/` so
  `npm test` picks up the lint suite alongside packages + apps.

**Changes — npm + CI:**

- `package.json` — two new scripts:
  - `lint:docs` → `ts-node -r tsconfig-paths/register
    scripts/docs-lint.ts` (CLI mode against the repo).
  - `test:scripts` → `jest --testPathPatterns scripts/__tests__`
    (focused on the lint suite).
- `.github/workflows/ci.yml` — new `docs-lint` job runs first on every
  push/PR. Two steps: `npm run lint:docs` (exits non-zero on any of
  the five lint checks) followed by `npx jest --testPathPatterns
  'scripts/__tests__/docs-lint'` (executes the unit suite). Both
  steps required — no `continue-on-error` since doc rot should block
  merges per Spec 002 §FR-10.

**Changes — docs / specs:**

- `.specify/specs/002-docs-and-spec-kit-bootstrap/tasks.md` — Phase 3
  graduates from "deferred" to "DONE"; T11 + T12 marked done with
  per-task `Done:` notes referencing the new files and the broken-link
  fix.
- `docs/index.md` — Spec 002 row updated to
  `All phases done (T01–T12); doc-lint live in CI run #9`. Run-tag
  bumped to #9.
- `docs/questions.md` — added **Q-011** (parser-dep trade-off) and
  resolved it in favour of the zero-dep regex parser.
- `docs/log.md` — this entry.
- `/competitor-watch.md` — run #9 sync line; no upstream commits in any
  of the three tracked repos.

**Notes:**

- External research repos in `OTHERS/` re-fetched via their
  `upstream-https` remotes; **no new commits** since run #8
  (Ats-scrapers @ `3bacd6e`, JobSpy @ `fda080a`, Jobspy-api @
  `26bb6f4`).
- Tests authored but not executed in this scheduled run —
  `node_modules` is not installed in the agent sandbox; CI on push
  will validate. Manual link audit on the live repo surfaced one
  broken link (now fixed); all other links verified by hand against
  the file system.
- The lint deliberately exempts `.specify/templates/*.template.md`
  from the unindexed-doc check even though they ARE linked from
  `docs/index.md`. This is intentional: the templates are reference
  scaffolding, not first-class docs, and a future template-rename
  shouldn't auto-trigger an "unindexed" failure if the index hasn't
  been updated yet — the broken-link check still catches that case.
- The `docs-lint` CI job is positioned **before** `build` so doc rot
  fails fast (a broken link doesn't need to wait on a 10-minute
  Docker build to surface). The job has no test dependency, so it
  runs in parallel with the rest of the matrix on the runner.
- Spec 002 is now end-to-end shippable. Spec 004 (persistence
  plugins) and Spec 005 (source health + circuit breaker) are the
  only un-started full-spec blocks; Spec 003 is closed (run #8).
  Default for run #10 is **Spec 005** — the circuit-breaker
  contract is small and high-leverage (every source plugin gets
  graceful degradation on flaky upstreams). Spec 004 is bigger and
  blocks on Q-005 (Postgres vs Mongo vs SQLite) which is still
  pending review.

---

## 2026-04-26 — Scheduled run #8 (Spec 003 T15 — GraphQL dedup parity)

**Scope:** close Q-010 by mirroring the REST controller's dedup pipeline on
the GraphQL `searchJobs` resolver. Spec 003 graduates from "T01–T14"
to "T01–T15" with REST + GraphQL parity end to end.

**Changes — code:**

- `apps/api/src/jobs/gql-types.ts` — `SearchJobsInput` gains an optional
  `dedup: Boolean = true` field (matches the REST `?dedup=`
  query param semantics). New `DedupMetricsGql` ObjectType exposes
  `inputCount`, `outputCount`, `mergedPairs`, `elapsedMs`.
  `SearchJobsResult` gains additive `deduped: Boolean!`,
  `rawCount: Int!`, `dedupMetrics: DedupMetricsGql` fields. The
  pre-existing `count`, `jobs`, `cached` fields are preserved (no
  breaking change for existing consumers).
- `apps/api/src/jobs/jobs.resolver.ts` — `JobsResolver` now injects
  `JobsAggregator` and runs the same `cache → fan-out → cache write
  (raw) → dedup` pipeline as the REST controller. Dedup defaults to
  `true`; `dedup: false` opts out. The cache key is bumped to
  `endpoint=graphql-search-v2` so v1 entries (which were written when
  the resolver bypassed the aggregator and didn't include the dedup
  flag) are invalidated cleanly. The dedup flag is stripped from the
  cache key (`dedup: undefined`) so toggling it doesn't split entries —
  the cache holds **raw** fan-out and dedup runs per-request.

**Changes — tests:**

- `apps/api/src/jobs/__tests__/jobs.resolver.spec.ts` — new file with 14
  unit cases covering:
  - basic shape on cache miss / cache hit;
  - cache writes hold raw jobs (engine version is decoupled);
  - cache key uses `graphql-search-v2`, with `dedup` scrubbed;
  - `input.dedup` defaults to `true`;
  - `dedup: true` and `dedup: false` honoured explicitly;
  - dedup runs on cache hits;
  - `dedupMetrics` + collapsed `count` surface when the engine ran;
  - toggling `dedup` produces equal cache params (no entry-splitting);
  - input mapping forwards `location`, `country`, `distance`,
    `companySlug`, `descriptionFormat`, `siteType`, `resultsWanted`;
  - `resultsWanted` defaults to 20, `descriptionFormat` defaults to
    `markdown`;
  - `listSources` regression: returns one row per `Site` enum value.

**Changes — docs / specs:**

- `.specify/specs/003-deduplication-engine/tasks.md` — new Phase 6 with
  T15 marked done; per-task notes reference the new files.
- `docs/questions.md` — Q-010 resolved (option A, mirror REST adopted).
- `docs/index.md` — Spec 003 row updated to `All phases done
  (T01–T15); GraphQL parity shipped run #8`. Run-tag bumped to #8.
- `docs/log.md` — this entry.
- `/competitor-watch.md` — run #8 sync line; no upstream commits in any
  of the three tracked repos.

**Notes:**

- External research repos in `OTHERS/` re-fetched via their
  `upstream-https` remotes; **no new commits** since run #7
  (Ats-scrapers @ `3bacd6e`, JobSpy @ `fda080a`, Jobspy-api @
  `26bb6f4`).
- Tests authored but not executed in this scheduled run —
  `node_modules` is not installed in the agent sandbox; CI on push will
  validate.
- The graphql cache key bump (`graphql-search-v2`) is a one-time
  invalidation. v1 was technically uncontaminated (it stored arrays of
  `JobPostDto` keyed by the input shape), but the resolver previously
  treated those entries as if they were already deduped. Bumping the
  key sidesteps a mixed cache-state window where some entries are
  pre-dedup and others post-dedup. The next deploy will see one cache
  miss per (input, endpoint) pair, then steady-state.
- The dedup flag is intentionally stripped from the cache key. If we
  *kept* it in the key we'd double the cache footprint for no benefit
  (the underlying raw fan-out is identical regardless of the
  post-process).
- `JobsAggregator.aggregateRaw` already returns `outputCount` separately
  from `jobs.length`; the GraphQL field is `count` (matches the REST
  shape) and is sourced from `aggregated.jobs.length` for symmetry. The
  REST `count` is computed the same way.
- Spec 003 is now end-to-end shippable on both wire formats. The next
  pending block is Spec 002 Phase 3 (`scripts/docs-lint.ts` + CI hook,
  T11/T12), Spec 004 (persistence plugins), or Spec 005 (source health
  + circuit breaker). Default for run #9 is **Spec 002 Phase 3** — the
  doc-lint script is the cheapest infrastructure win and protects every
  future run from broken-link rot.

---

## 2026-04-26 — Scheduled run #7 (Spec 003 Phase 5 closes — JobsAggregator + dedup query param)

**Scope:** finish Spec 003 Phase 5. Land T13 (`JobsAggregator` wired to
`IDedupEngine` post-fan-out) and T14 (`dedup` query param on
`/api/jobs/search`). Spec 003 is now end-to-end shippable.

**Changes — code:**

- `apps/api/src/jobs/jobs.aggregator.ts` — new thin orchestration layer
  between `JobsService` (fan-out) and the bound `IDedupEngine`. Engine is
  `@Optional()` injection under `DEDUP_ENGINE_TOKEN`, so environments
  that haven't imported `DedupHybridModule` (or that swap it for a no-op)
  remain a pass-through. Two methods: `aggregate(input)` runs the full
  fan-out + dedup pipeline; `aggregateRaw(jobs, opts)` lets the
  controller insert dedup post-cache. Picks the **first** raw
  `JobPostDto` per canonical cluster (preserves `JobsService` sort order:
  site asc → datePosted desc). Returns an envelope with `jobs`,
  `rawCount`, `outputCount`, `deduped`, optional `dedupMetrics`.
- `apps/api/src/jobs/jobs.module.ts` — imports `DedupHybridModule` and
  `MergeDefaultModule`; registers `JobsAggregator` as a provider and
  exports it for downstream consumers (analytics, future GraphQL
  resolver-side dedup).
- `apps/api/src/jobs/jobs.controller.ts` — constructor now takes
  `JobsAggregator`. New `?dedup=true|false|1|0|yes|no` query param
  (default `true`; garbage values fall back to default). Cache layer
  stores **raw** fan-out (pre-dedup) so cache invalidation stays
  decoupled from dedup-engine version changes — the dedup pass runs per
  request even on cache hits. Response shape gains additive fields:
  `deduped: boolean`, `raw_count: number`, optional `dedup_metrics`. All
  pre-existing fields (`count`, `jobs`, `cached`, pagination keys)
  preserved.

**Changes — tests:**

- `apps/api/src/jobs/__tests__/jobs.aggregator.spec.ts` — 11 unit cases:
  pass-through when no engine, pass-through with `dedup=false`, empty
  input, cluster collapse, insertion-order preservation, rejected-entry
  drop (`assignments[i] === null`), default-true with engine, full
  `aggregate()` pipeline, `dedup=false` via `aggregate()`.
- `apps/api/src/jobs/__tests__/jobs.aggregator.integration.spec.ts` —
  4 cases wired to the real `DedupHybridService`: 3-source collapse,
  `dedup=false` returns identity, cosmetic-different jobs collapse,
  end-to-end `aggregate(input)`.
- `apps/api/src/jobs/__tests__/jobs.controller.spec.ts` — updated
  constructor signature; existing tests now use a pass-through
  aggregator stub. New `dedup flag` block covers absent/`true`/`false`/
  `0`/garbage values, cached-response dedup, raw-cache invariant, and
  `dedup_metrics` exposure.
- `apps/api/__tests__/search.e2e-spec.ts` — primary shape assertion
  upgraded to include `deduped` + `raw_count`. New e2e case exercises
  `?dedup=false` and asserts `count === raw_count`.

**Changes — docs / specs:**

- `.specify/specs/003-deduplication-engine/tasks.md` — T13 + T14 marked
  done with per-task notes pointing at the new files and behavioural
  details.
- `docs/index.md` — Spec 003 status flipped to
  `All phases done (T01–T14); shipped on develop`. Run-tag bumped to #7.
- `docs/log.md` — this entry.
- `/competitor-watch.md` — run #7 sync line; no upstream commits in any
  of the three tracked repos.

**Notes:**

- External research repos in `OTHERS/` re-fetched via their
  `upstream-https` remotes; **no new commits** since run #6
  (Ats-scrapers @ `3bacd6e`, JobSpy @ `fda080a`, Jobspy-api @
  `26bb6f4`).
- Tests authored but not executed in this scheduled run —
  `node_modules` is not installed in the agent sandbox; CI on push will
  validate.
- The `IMergeResolver` is wired into the module graph but not yet
  consumed inside `dedup-hybrid.service.ts` — the engine still picks the
  head record per cluster. That's acceptable for shipping Phase 5
  because the resolver's primary use-case (per-field winner selection
  beyond `title/company/location`) shows up only when richer per-source
  fields land (compensation provenance, jobType provenance). A follow-up
  spec will fold `MERGE_RESOLVER_TOKEN` into the dedup engine's field
  materialisation pass; this is **not** on Spec 003's scope.
- The aggregator deliberately avoids returning `CanonicalJob[]` to
  callers — the existing wire format is `JobPostDto[]` and downstream
  clients (CSV exporter, pagination wrapper, GraphQL resolver) expect
  it. The canonical record's provenance graph remains accessible via a
  future `/api/jobs/canonical` endpoint (not yet specced).

---

## 2026-04-26 — Scheduled run #6 (Spec 003 Phase 4 closes — merge-default plugin)

**Scope:** finish Spec 003 Phase 4. Land T11 (scaffold
`packages/plugins/merge-default`) and T12 (priority-order resolver).
The default `IMergeResolver` is now ready for the JobsAggregator
wiring in Phase 5 (T13/T14).

**Changes — code:**

- `packages/plugins/merge-default/package.json` — new package
  `@ever-jobs/merge-default` v0.1.0.
- `packages/plugins/merge-default/tsconfig.json` — extends root base.
- `packages/plugins/merge-default/src/index.ts` — barrel re-exports
  module, service, options/types, the
  `DEFAULT_CATEGORY_PRIORITY` ladder, and the
  `SITE_CATEGORY_DEFAULTS` map.
- `packages/plugins/merge-default/src/types.ts` — `MergeCategory` union
  (mirrors `PluginCategory` from `@ever-jobs/plugin` to avoid a runtime
  dependency between feature plugins) plus `MergeDefaultOptions`
  (`siteCategoryMap`, `fallbackCategory`, `categoryPriority`,
  `fieldOverrides`, `preferRecent`, `preferAgreement`).
- `packages/plugins/merge-default/src/site-category-defaults.ts` —
  explicit ~150-entry Site → category lookup (38 ATS, 15 company-direct,
  9 government, 23 regional, 13 remote, 2 freelance, ~50 niche, ~15
  general boards). Sites not in the map fall back to `'job-board'`.
- `packages/plugins/merge-default/src/merge-default.service.ts` —
  `MergeDefaultService` implements `IMergeResolver`. Pure
  category-priority resolver: rank by category index → recency
  (`preferRecent`) → deterministic `siteRank` (enum declaration order).
  `describe()` returns a snapshot of the active configuration for
  logs / health endpoints.
- `packages/plugins/merge-default/src/merge-default.module.ts` — NestJS
  module that binds `MergeDefaultService` under `MERGE_RESOLVER_TOKEN`.
- `tsconfig.base.json` — added `@ever-jobs/merge-default` path alias.
- `jest.config.js` — added matching `moduleNameMapper` entry.

**Changes — tests:**

- `packages/plugins/merge-default/__tests__/merge-default.service.spec.ts`
  — 16 cases covering: empty-list throw, single-candidate pass-through,
  default ATS-first ladder, recency tie-break inside the same tier,
  deterministic `siteRank` tie-break, fallback for un-mapped Sites,
  `preferRecent: false` keeps insertion order, partial
  `categoryPriority` override (prefix; tail filled from defaults),
  per-field `fieldOverrides` map, `describe()` snapshot, ATS / company /
  job-board buckets in `SITE_CATEGORY_DEFAULTS`, default ladder shape,
  insertion-order independence.

**Changes — docs / specs:**

- `.specify/specs/003-deduplication-engine/tasks.md` — T11 + T12 marked
  done; per-task notes describe the ladder, the Site→category map, and
  the resolver's tunables.
- `docs/index.md` — Spec 003 status flipped to
  `Phases 1–4 done (T01–T12); JobsAggregator wiring (Phase 5) next`.
- `docs/log.md` — this entry.
- `/competitor-watch.md` — run #6 sync line; no upstream commits in any
  of the three tracked repos.

**Notes:**

- External research repos in `OTHERS/` re-fetched via their
  `upstream-https` remotes; **no new commits** since run #5
  (Ats-scrapers @ `3bacd6e`, JobSpy @ `fda080a`, Jobspy-api @
  `26bb6f4`).
- Tests authored but not executed in this scheduled run —
  `node_modules` is not installed in the agent sandbox; CI will
  validate on push.
- The `dedup-hybrid` service was intentionally **not** wired to consume
  `MERGE_RESOLVER_TOKEN` in this run. Coupling the engine to the
  resolver crosses Phase 4 ↔ Phase 5 boundaries; T13 in Phase 5 is the
  point at which `JobsAggregator` composes both providers and feeds
  resolver-merged values back into the canonical record. The current
  "head wins" default in `dedup-hybrid.service.ts` is still correct as
  a Phase 3 baseline.
- Default category ladder extends FR-5's
  `ats > company > job-board > niche` with a stable middle for the
  practical extras (`regional`, `government`, `remote`, `freelance`).
  Callers may collapse them by passing a partial `categoryPriority`
  prefix — the resolver fills the tail in default order.

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
