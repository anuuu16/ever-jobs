# Tasks: 721 — Feature Plugin: liveness-http

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Contract in `@ever-jobs/models`

- [x] T01 — Liveness-checker contract + barrel export
  - **Files:** `packages/models/src/interfaces/liveness-checker.interface.ts`,
    `packages/models/src/interfaces/index.ts`
  - **Acceptance:** `LIVENESS_CHECKER_TOKEN`, `LivenessResult`,
    `LivenessCode`, `LivenessVerdict`, `LivenessCheckOptions`,
    `LivenessBatchOptions`, `ILivenessChecker` importable from
    `@ever-jobs/models`; JSDoc mirrors the dedup-engine contract style;
    no other models file touched.
  - **Estimate:** 0.5 day

## Phase 2 — Heuristics core

- [x] T02 — Plugin scaffold
  - **Files:** `packages/plugins/liveness-http/package.json`,
    `packages/plugins/liveness-http/tsconfig.json`,
    `packages/plugins/liveness-http/src/index.ts`
  - **Acceptance:** package named `@ever-jobs/liveness-http`; tsconfig
    extends the base config; barrel exports module, service, heuristics
    and constants.
  - **Estimate:** 0.5 day

- [x] T03 — Constants + pure heuristics
  - **Files:** `packages/plugins/liveness-http/src/liveness-http.constants.ts`,
    `packages/plugins/liveness-http/src/liveness-heuristics.ts`
  - **Acceptance:** precompiled module-scope regexes only;
    `classifyHttpStatus` (FR-1..FR-3), `hasExpiredUrlMarker` (FR-5),
    `classifyBody` implementing the FR-6..FR-12 priority order; marker
    sets per spec § 7.3; all functions pure.
  - **Estimate:** 0.5–1 day

## Phase 3 — Service + module

- [x] T04 — `LivenessHttpService`
  - **Files:** `packages/plugins/liveness-http/src/liveness-http.service.ts`
  - **Acceptance:** implements `ILivenessChecker`; non-2xx captured via
    `validateStatus` override + axios-style `err.response?.status`
    fallback; 15 s default timeout; desktop Chrome UA +
    `Accept: text/html`; `check()` never throws; `checkBatch` bounded
    concurrency (default 5), jittered throttle, order-preserving,
    failure-isolating (`Promise.allSettled`); `Logger` only.
  - **Estimate:** 1 day

- [x] T05 — Module + token binding
  - **Files:** `packages/plugins/liveness-http/src/liveness-http.module.ts`
  - **Acceptance:** `{ provide: LIVENESS_CHECKER_TOKEN, useExisting:
    LivenessHttpService }`; exports token + service; no Site enum /
    ALL_SOURCE_MODULES / shared-file edits.
  - **Estimate:** 0.5 day

## Phase 4 — Tests

- [x] T06 — Heuristics unit tests (branch-complete)
  - **Files:** `packages/plugins/liveness-http/__tests__/liveness-heuristics.spec.ts`
  - **Acceptance:** ≥ 1 test per classification branch; synthetic HTML
    incl. DE/FR/ES/PL expired pages, a challenge interstitial with a
    short body, a short dead body, a listing page, an apply page;
    priority-order locks (expired beats apply; challenge beats
    short-content; apply beats short-content); relative imports.
  - **Estimate:** 1 day

- [x] T07 — Service unit tests (mocked HTTP)
  - **Files:** `packages/plugins/liveness-http/__tests__/liveness-http.service.spec.ts`
  - **Acceptance:** mocked `createHttpClient`; 404 → `expired`/`http_gone`;
    403 → `uncertain`/`access_blocked`; network error →
    `uncertain`/`fetch_failed`; thrown error carrying
    `response.status`; happy active page (status, `checkedAt` ISO
    shape, headers); `error=true` redirect; `checkBatch` ≥ 3 URLs with
    mixed outcomes preserving input order; DI resolution via
    `LIVENESS_CHECKER_TOKEN`.
  - **Estimate:** 1 day

- [x] T08 — Green run + spec close-out
  - **Files:** `.specify/specs/721-liveness-http/{spec.md,tasks.md}`
  - **Acceptance:** `npx jest packages/plugins/liveness-http --silent`
    and `npx jest packages/models --silent` pass from the repo root;
    spec Status set to `done`; all boxes ticked.
  - **Estimate:** 0.5 day

## Notes

- Write tests alongside each implementation task; do not batch testing into a final task.
- Update `docs/log.md` with each completed task in the same commit.
  (Shared docs files are owned by a later serial step in this run —
  this spec's tasks deliberately do not edit them.)
