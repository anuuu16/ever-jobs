# Tasks: 740 — Corpus Signals on the Public DTO (liveness + legitimacy)

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Models: interfaces + DTO fields

- [ ] T01 — Add `legitimacy-checker.interface.ts` (LEGITIMACY_CHECKER_TOKEN, LegitimacyState, LegitimacyVerdict, LegitimacyInput, ILegitimacyChecker).
  - **Files:** `packages/models/src/interfaces/legitimacy-checker.interface.ts`, `packages/models/src/interfaces/index.ts`
  - **Acceptance:** exported from models; type-checks.
  - **Estimate:** 0.25 day
- [ ] T02 — Add optional `liveness` + `legitimacy` to `JobPostDto`; re-export liveness verdict type from dtos index.
  - **Files:** `packages/models/src/dtos/job-post.dto.ts`, `packages/models/src/dtos/index.ts`
  - **Acceptance:** both fields optional/nullable; default-absent; `npm run build` green.
  - **Estimate:** 0.25 day

## Phase 2 — legitimacy-detector plugin

- [ ] T03 — Scaffold `packages/plugins/legitimacy-detector` (package.json, tsconfig, src/index, module, service).
  - **Files:** `packages/plugins/legitimacy-detector/**`
  - **Acceptance:** module binds `LEGITIMACY_CHECKER_TOKEN` → service; exports built.
  - **Estimate:** 0.5 day
- [ ] T04 — Implement deterministic scoring (`assess`/`assessBatch`) with explainable reasons.
  - **Files:** `packages/plugins/legitimacy-detector/src/legitimacy-detector.service.ts`
  - **Acceptance:** verified/likely/uncertain rules per spec §5; off-platform redirect → uncertain.
  - **Estimate:** 0.5 day
- [ ] T05 — Unit tests for the scorer (table-driven).
  - **Files:** `packages/plugins/legitimacy-detector/__tests__/legitimacy-detector.service.spec.ts`
  - **Acceptance:** covers each verdict + the redirect case; green.
  - **Estimate:** 0.25 day
- [ ] T06 — Register path alias + jest moduleNameMapper.
  - **Files:** `tsconfig.base.json`, `jest.config.js`
  - **Acceptance:** `@ever-jobs/legitimacy-detector` resolves in build + tests.
  - **Estimate:** 0.25 day

## Phase 3 — Controller enrichment (opt-in)

- [ ] T07 — Wire opt-in liveness enrichment in `JobsController` (`?liveness=true` → checkBatch → map; degrade to `uncertain`).
  - **Files:** `apps/api/src/jobs/jobs.controller.ts`, `apps/api/src/jobs/jobs.module.ts`
  - **Acceptance:** flag on → `liveness` present; off → absent; failures never abort.
  - **Estimate:** 0.5 day
- [ ] T08 — Wire opt-in legitimacy enrichment (`?legitimacy=true` → derive input → assessBatch → map).
  - **Files:** `apps/api/src/jobs/jobs.controller.ts`, `apps/api/src/jobs/jobs.module.ts`
  - **Acceptance:** flag on → `legitimacy` present with reasons; off → absent.
  - **Estimate:** 0.5 day

## Phase 4 — Tests + docs

- [ ] T09 — Integration test: flags on/off behaviour for both signals.
  - **Files:** `apps/api/__tests__/jobs/corpus-signals.spec.ts`
  - **Acceptance:** both fields present with flags, absent without; green.
  - **Estimate:** 0.5 day
- [ ] T10 — Update `docs/index.md` + append `docs/log.md`; confirm CI green; land session branch → develop.
  - **Files:** `docs/index.md`, `docs/log.md`
  - **Acceptance:** docs reflect the new signals; CI green; merged.
  - **Estimate:** 0.25 day

## Notes

- Write tests alongside each implementation task; do not batch testing into a final task.
- Both signals are opt-in — never change the default payload or latency.
- Work in the isolated worktree; land via the session branch to avoid racing the hourly task.
