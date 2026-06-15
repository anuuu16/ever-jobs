# Plan: 740 — Corpus Signals on the Public DTO (liveness + legitimacy)

| Field        | Value      |
| ------------ | ---------- |
| Spec         | spec.md    |
| Created      | 2026-06-15 |
| Last updated | 2026-06-15 |

## 1. Approach

Two additive, opt-in signals on the public `JobPostDto`. **Liveness** already has a working feature
plugin (`liveness-http`, Spec 721) exposing `ILivenessChecker.checkBatch`; we only need to (a) add
the optional DTO field and (b) wire an opt-in controller enrichment step that calls the checker and
maps verdicts onto results. **Legitimacy** is net-new: a deterministic `legitimacy-detector` feature
plugin (per Spec 001) bound under a `LEGITIMACY_CHECKER` DI token, plus the optional DTO field and a
parallel opt-in enrichment step.

Both signals are gated behind query flags (`?liveness=true`, `?legitimacy=true`) so the default
search path does **zero** extra work and the default payload is byte-for-byte unchanged (FR-6,
NFR-1). The field shapes are copied exactly from what the Hust frontend already consumes, so this is
forward-compatible with no client change.

The legitimacy scorer is pure and explainable: it derives `LegitimacyInput` from the already-present
job fields + dedup source count, and returns a `verified|likely|uncertain` verdict with
human-readable `reasons[]`. No ML, no network, no persistence in v1.

## 2. Phases

### Phase 1 — Models: interfaces + DTO fields
- Goal: type contracts + DTO surface.
- Deliverables: `legitimacy-checker.interface.ts` (token, types, `ILegitimacyChecker`); export it;
  add optional `liveness` + `legitimacy` to `JobPostDto`; re-export liveness types from models dtos.
- Exit: `npm run build` type-checks; DTO fields optional/nullable.

### Phase 2 — legitimacy-detector plugin
- Goal: the deterministic scorer.
- Deliverables: `packages/plugins/legitimacy-detector/` (service + module + index + tests); path
  alias in `tsconfig.base.json` + jest `moduleNameMapper`.
- Exit: unit tests green (verified/likely/uncertain/off-platform cases).

### Phase 3 — Controller enrichment (opt-in)
- Goal: surface both signals on the API.
- Deliverables: `JobsController` reads `liveness`/`legitimacy` query flags; injects the checkers;
  after aggregation, maps verdicts onto `jobs[]`. Liveness failures degrade to `uncertain`.
- Exit: integration test — flags on → fields present; flags off → fields absent.

### Phase 4 — Tests + docs
- Goal: prove it + record it.
- Deliverables: integration + (light) e2e; update `docs/index.md` + `docs/log.md`.
- Exit: `npm test` green; CI green.

## 3. Packages Touched

| Package                                   | Change                                                            |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `packages/models`                         | new `legitimacy-checker.interface.ts`; `JobPostDto` += liveness/legitimacy; dtos index re-exports |
| `packages/plugins/legitimacy-detector`    | NEW feature plugin (service + module + tests)                     |
| `packages/plugins/liveness-http`          | (no change) — reused via `ILivenessChecker`                       |
| `apps/api/src/jobs`                        | controller opt-in enrichment; module imports the two checker modules |
| `tsconfig.base.json` + `jest.config.js`   | path alias + moduleNameMapper for the new plugin                  |

## 4. Dependencies

| Library | Version | Rationale |
| ------- | ------- | --------- |
| (none new) | — | Pure heuristics + reuse of the existing liveness plugin + NestJS DI. |

## 5. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Liveness enrichment slows opt-in requests | M | M | Bounded concurrency (reuse 721); opt-in only; never on default path |
| Legitimacy false-positives label real jobs as ghost | M | M | Conservative thresholds; explainable `reasons[]`; `uncertain` is the safe default |
| Spec-number collision with the hourly source-plugin task | L | L | Chose 740 (clear of the 7xx source-plugin band, last 731) |
| Concurrent writes to `develop` from the hourly task | M | M | Work in an isolated git worktree; land via session branch |

## 6. Rollback Plan

Both fields are optional/nullable and both enrichment steps are query-flag-gated. Removing the
controller wiring (or never passing the flags) restores the exact prior behaviour. The new plugin is
DI-bound and unused unless `?legitimacy=true` is passed — dropping it is inert.

## 7. Migration Plan

No data migration. DTO additions are additive/optional; existing consumers are unaffected. The Hust
frontend already tolerates the fields' absence and renders them when present.

## 8. Open Questions for Plan

- Fold the liveness `expired_url` redirect into legitimacy when both flags are set (lean: yes).
- Whether to also expose a combined `?signals=liveness,legitimacy` param (lean: no, keep two flags).
