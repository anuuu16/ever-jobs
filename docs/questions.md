# Open Questions

> Each question records:
> - **Context** — why the question came up.
> - **Options** — A/B/C with trade-offs.
> - **Default** — option proceeded with so the schedule isn't blocked.
> - **Resolution** — set when the human owner decides; note the date and the chosen option.
>
> Add new questions at the **top**. Resolved questions stay here for traceability.

---

## Q-012 — Circuit-breaker engine: `opossum` vs hand-rolled state machine (Spec 005 Phase 1)

**Context:** Spec 005 plan.md §1 suggested wrapping the
[`opossum`](https://www.npmjs.com/package/opossum) Node circuit-breaker
library inside a NestJS service to "avoid hand-rolling state transitions
(would otherwise be a primary risk)". Spec 005 §FR-2 then specifies the
default policy as **"5 consecutive failures → open"** with a 30 s
cooldown. While inspecting `opossum`'s API for T02 we found that the
library models failures as an `errorThresholdPercentage` over a rolling
count window (`rollingCountTimeout` × `rollingCountBuckets`). It does
**not** ship a "N consecutive failures" trigger; emulating consecutive-
failure semantics requires post-event monkey-patching of the breaker's
internals, which would itself be a fragility risk.

**Options:**

- **A. Wrap `opossum`.** Configure `volumeThreshold: 5` +
  `errorThresholdPercentage: 100` so 5 errors in the rolling window
  open the breaker. Approximates the contract but is not strictly
  consecutive — a single mid-window success does not reset the count
  the way Spec 005 / FR-2 expects. Downside: behavioural drift
  surfaces only under load, where it's hardest to debug.
- **B. Wrap `opossum` + custom counter overlay.** Use `opossum` for
  cooldown/half-open mechanics, add a side-channel counter that
  resets on `success` and triggers `breaker.open()` on the threshold.
  Touches `opossum`'s public events but doesn't subclass it.
  ~80 LOC of glue plus the dep.
- **C. Hand-rolled state machine in
  `packages/plugin/src/circuit-breaker/circuit-breaker.service.ts`.**
  ~250 LOC including doc comments. Implements the exact FR-2
  contract: counter increments on failure, resets on success, opens
  at threshold, half-open after `cooldownMs`, reopens with a fresh
  cooldown on probe failure. Fully unit-testable via an injectable
  clock seam (`setClock`). No new dependencies.

**Default (proceeding):** **C. Hand-rolled state machine** — Spec 005's
contract is firmer than its plan; consecutive-failure semantics is
explicit (`§5 / FR-2`) and matches operator intuition ("the source
broke five times in a row, kill it"). The `opossum` wrap path's
behavioural drift would only show up at production scale. Hand-rolling
also lets us:
  - inject a deterministic clock for unit tests (no `jest.useFakeTimers`
    timing-flake risk),
  - cap memory at `MAX_SAMPLES = 600` per site explicitly, satisfying
    Spec 005 / NFR-3,
  - publish exactly the `ICircuitBreakerService` shape declared in
    `@ever-jobs/models` without leaking `opossum`'s event-emitter API.

**Resolution:** Adopted **C. Hand-rolled state machine** in run #10
(2026-04-26). Implementation in
`packages/plugin/src/circuit-breaker/circuit-breaker.service.ts`. 14
unit tests in
`__tests__/circuit-breaker.service.spec.ts` cover the full state-machine
matrix. Will revisit option A only if a future requirement (e.g.
half-open back-pressure, distributed breaker) makes a battle-tested
library a better fit. The `setClock` test seam plus the strict
`ICircuitBreakerService` interface keeps that swap a 1-day commit if
ever needed.

---

## Q-011 — Doc-lint markdown parser choice (Spec 002 Phase 3, T11)

**Context:** Spec 002 plan.md §4 listed `remark-parse` + `unified` as the
suggested deps for `scripts/docs-lint.ts`. Both are popular and battle-tested,
but they pull a 30+ transitive-dep graph into the build for what is a small
build-time tool. The five lint checks (broken internal links, unindexed docs,
duplicate log entries, newest-at-top ordering, spec-file frontmatter
presence) all operate on a small surface of the markdown grammar — inline
`[text](href)` links plus `## YYYY-MM-DD — Scheduled run #N` headers.

**Options:**

- **A. `remark-parse` + `unified` (the plan's suggestion).** Full markdown AST.
  Future-proof if we later want to lint heading levels, table integrity,
  list nesting, footnotes, etc. ~30 transitive deps; ~2 MB install footprint;
  startup cost ~150 ms.
- **B. `remark-parse` only, no `unified`.** Same AST without the streaming
  pipeline. Saves ~5 deps. Still a heavy install for a build-time tool.
- **C. Zero-dep regex parser in-tree.** ~150 LOC; no install footprint;
  startup cost negligible. Requires us to handle code fences (` ``` ` and
  `~~~`), inline-code spans, link-text escapes, and `:line` / `#frag` /
  `?query` URL suffixes manually. Falls down on reference-style links
  (`[text][ref]` + `[ref]: url`), nested brackets, and HTML inside markdown
  — none of which appear in our docs today.

**Default (proceeding):** **C. Zero-dep regex parser** — keeps the doc-lint
job lightweight (CI step <10 s end to end including `npm ci`), avoids the
risk of a future remark major bump breaking the lint, and matches the
shape of the markdown we actually write. If we ever need full-AST checks
(table-divider validation, list-nesting consistency, frontmatter YAML), we
can swap to option A behind the same `lintDocs(repoRoot)` interface
without touching CI wiring.

**Resolution:** Adopted **C. Zero-dep regex parser** in run #9 (2026-04-26).
Implementation in `scripts/docs-lint.ts`. Will revisit option A only if a
real lint check requires AST traversal that the regex parser can't
deliver cleanly.

---

## Q-010 — Should the GraphQL `searchJobs` query also dedup by default?

**Context:** Spec 003 Phase 5 (run #7) wired the dedup engine into the REST
endpoint `/api/jobs/search` and added the opt-out `?dedup=false` query param.
The GraphQL resolver in `apps/api/src/jobs/jobs.resolver.ts` still calls
`JobsService.searchJobs()` directly and bypasses `JobsAggregator`, so it
returns raw fan-out. Spec 003 didn't itemise GraphQL parity.

**Options:**

- **A. Mirror REST.** Inject `JobsAggregator` into `JobsResolver` and add a
  `dedup: Boolean = true` arg to the `searchJobs` GraphQL input. Maximum
  consistency; one extra optional arg in the schema.
- **B. Leave GraphQL as raw-only.** Document the divergence and add a
  follow-up spec for GraphQL `canonicalJobs` that returns `CanonicalJob[]`
  with full provenance. Keeps the current schema stable; clients with
  bespoke ranking logic don't pay the dedup tax.
- **C. Dedup by default with no opt-out.** Smallest schema change; matches
  the "default true" REST migration. But denies GraphQL clients a way to
  inspect raw fan-out for debugging.

**Default (proceeding):** **A. Mirror REST** — keeps the public surface
coherent and avoids a class of "why is REST count != GraphQL count" support
tickets. Ship in a future run as a tiny follow-up (T15 candidate); not a
Spec 003 blocker.

**Resolution:** Adopted **A. Mirror REST** in run #8 (2026-04-26). Implementation
in `apps/api/src/jobs/jobs.resolver.ts` — `JobsResolver` now injects
`JobsAggregator` and runs the same `cache → fan-out → cache write
(raw) → dedup` pipeline as the REST controller. `SearchJobsInput.dedup`
defaults to `true` (opt-out via `dedup: false`). `SearchJobsResult`
gains additive fields (`deduped`, `rawCount`, `dedupMetrics`) for
parity with the REST envelope. Cache key is bumped to
`endpoint=graphql-search-v2` to invalidate v1 entries cleanly. 14
resolver unit tests cover the parity matrix.

---

## Q-009 — MinHash library choice for Spec 003 Phase 3 stage 2 (T08)

**Context:** Spec 003 plan.md §4 Dependencies suggests `datasketch-js`. Run #4
verified that crate's npm presence is patchy (only one published version, last
push 2017, no TypeScript types). The next stage of the dedup pipeline needs
MinHash + LSH for near-duplicate detection of long descriptions; we have to
choose between a third-party library and a small in-tree implementation.

**Options:**

- **A. `minhash` npm package** (~12 KB, MIT, ~150 K weekly downloads,
  TypeScript types via `@types/minhash`) — battle-tested, but does not ship
  LSH bucketing; we would still write the LSH banding wrapper in-tree.
- **B. `datasketch-js`** — the spec's original suggestion. Stale and untyped;
  mostly a port of Python's `datasketch`. Risk: pulls in extra deps, no
  recent maintainer.
- **C. In-tree implementation** under `packages/plugins/dedup-hybrid/src/strategies/minhash.ts`
  using `crypto.createHash('sha1')` for permutation hashing plus a small LSH
  banding helper. ~150 LOC; no extra deps; full control over signature
  width, band count, and the hot loop.

**Default (proceeding):** **C. In-tree** — keeps the Phase 3 commit zero-dep,
gives us a deterministic baseline for the perf gate (NFR-1 / NFR-2), and
matches AGENTS.md §6 ("Reuse existing libs **when popular & well-maintained**"
— `minhash` qualifies on popularity but we still need to write the LSH layer
ourselves either way, so the dep buys us very little). If perf or correctness
falls short we'll revisit option A in T08 follow-up.

**Resolution:** Adopted **C. In-tree** in run #5 (2026-04-26). Implementation
in `packages/plugins/dedup-hybrid/src/minhash.ts` — 128-permutation MinHash,
LSH banding (B=16, R=8), seeded affine permutations, FNV-1a shingle hashing.
Zero dependencies; deterministic given seed. Will revisit option A only if
the perf benchmark or golden-set precision regresses.

---

## Q-008 — Scrubbing legacy "ported from <competitor>" comments in source files

**Context:** The scheduled-task brief forbids competitor mentions inside this
repo. Run #3 found ~7 pre-existing files with `Ported from <repo>/...` doc
comments (`packages/common/src/utils/experience-extractor.ts`, several
`packages/plugins/source-ats-*/src/*.types.ts`, README acknowledgements,
plus a "StapplyMap" UA string in
`packages/plugins/source-company-cursor/src/cursor.service.ts`).

The brief also says "do NOT remove anything (move or improve is OK)", so a
silent purge isn't appropriate.

**Options:**

- **A. Spec it.** Open a small "Spec 006 — Scrub external-project mentions"
  with a deterministic find-and-rewrite list. Each comment becomes a neutral
  "Reference implementation in upstream Python project" with no name. README
  acknowledgements move to an external file (`/competitor-watch.md`).
- **B. Drop the comments wholesale.** Safe for code; loses provenance breadcrumb.
- **C. Leave as-is** — accept the brief's rule is about *new* mentions, not
  pre-existing breadcrumbs.

**Default (proceeding):** **A. Spec it** — keeps history navigable, satisfies
the rule, and gives the cleanup a reviewable diff. Spec will be authored
next run; this run does not touch the legacy comments to keep the
Spec-003-Phase-1+2 commit focused.

**Resolution:** _pending review._

---

## Q-007 — One spec per new source plugin, or one bulk spec for multiple adoptions?

**Context:** Run #2 identified 6 new platforms to adopt
(`source-ats-avature`, `source-ats-gem`, `source-ats-joincom`, `source-ats-oracle`,
`source-mercor`, `source-company-tesla`). Each is similar in shape (URL-pattern
discovery, list endpoint, detail endpoint), so per-plugin specs would be
repetitive.

**Options:**

- **A. One spec per plugin** — six specs (006–011). Cleaner status tracking; each
  plugin can ship independently.
- **B. One bulk "Source-plugin batch — Apr 2026" spec** — single spec with six
  Phase blocks. Less duplication; cohesive review.
- **C. One per category:** an "ATS batch" spec (Avature, Gem, Join.com, Oracle),
  a "Niche / Marketplace" spec (Mercor), a "Company-direct batch" spec (Tesla).

**Default (proceeding):** **A. One spec per plugin** — gives the scheduling
loop a finer granularity and matches the 1-spec-1-package convention used for
the existing 160 plugins. Future runs can opt into bulk specs if review fatigue
shows up.

**Resolution:** _pending review._

---

## Q-006 — Should we adopt **NestJS BullMQ** or **NestJS Bull** for background jobs?

**Context:** Many planned features (scheduled scrapes, dedup, alerts) need queues.

**Options:**

- **A. BullMQ + `@nestjs/bullmq`** — modern, TypeScript-first, supports flows, latest.
- **B. Bull + `@nestjs/bull`** — older, more legacy examples online.
- **C. PostgreSQL-based pg-boss** — no Redis dep, single store.

**Default (proceeding):** **A. BullMQ + `@nestjs/bullmq`** — newest stable, fits perf goals.

**Resolution:** _pending review._

---

## Q-005 — Default persistence backend for jobs?

**Context:** Spec 004 introduces a pluggable persistence layer.

**Options:**

- **A. PostgreSQL (Prisma)** — relational, mature, ecosystem-friendly.
- **B. MongoDB (Mongoose)** — flexible schema for varying source payloads.
- **C. SQLite (Drizzle)** — zero-ops local dev; not for prod.

**Default (proceeding):** **A. PostgreSQL via Prisma** for prod, plus a SQLite Drizzle
adaptor for dev. Both behind the `IJobStore` plugin contract.

**Resolution:** _pending review._

---

## Q-004 — Dedup hashing strategy?

**Context:** Spec 003 needs to identify "the same job" across sources.

**Options:**

- **A. SHA-256 of `(canonicalCompanyName, canonicalJobTitle, canonicalLocation)`** —
  simple, deterministic, collisions on edge cases.
- **B. MinHash / Locality-Sensitive Hashing on description** — handles minor wording
  changes, more compute.
- **C. Hybrid:** A for fast path, fall back to B when score below threshold.

**Default (proceeding):** **C. Hybrid** with B reserved for pairs with same hash prefix.

**Resolution:** _pending review._

---

## Q-003 — How aggressive should the circuit breaker default be?

**Context:** Spec 005.

**Options:**

- **A. Open after 5 consecutive failures, half-open at 30 s.**
- **B. Open after 3 consecutive failures, half-open at 60 s.**
- **C. Failure-rate window (50% over last 30 calls).**

**Default (proceeding):** **A** (matches constitution Article 6 §2).

**Resolution:** _pending review._

---

## Q-002 — Should specs live under `.specify/specs/` *or* `docs/specs/` *or both*?

**Context:** GitHub Spec Kit canonical location is `.specify/specs/`. The task brief
also asks for everything to be discoverable in `docs/`.

**Options:**

- **A. Canonical `.specify/specs/` + auto-generated `docs/specs/` mirrors.**
- **B. Single location: `.specify/specs/`; `docs/index.md` links to them.**
- **C. Single location: `docs/specs/`; abandon `.specify/`.**

**Default (proceeding):** **B. Canonical `.specify/specs/`**, indexed from `docs/index.md`.
Avoids duplication; preserves Spec-Kit conventions.

**Resolution:** _pending review._

---
