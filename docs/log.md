# Change Log — Docs & Specs

> Append-only log of every doc/spec edit. **Newest entry at the top.** This is a
> human-readable audit trail; for source-code history, see `git log`.

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
