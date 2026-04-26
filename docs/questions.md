# Open Questions

> Each question records:
> - **Context** — why the question came up.
> - **Options** — A/B/C with trade-offs.
> - **Default** — option proceeded with so the schedule isn't blocked.
> - **Resolution** — set when the human owner decides; note the date and the chosen option.
>
> Add new questions at the **top**. Resolved questions stay here for traceability.

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

**Resolution:** _pending review._

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
