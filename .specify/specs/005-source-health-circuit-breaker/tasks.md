# Tasks: 005 — Source Health & Circuit Breaker

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Service & interceptor

- [ ] T01 — Add types `CircuitState`, `CircuitPolicy`, `SourceHealth`.
  - **Files:** `packages/models/src/interfaces/circuit-breaker.interface.ts`,
    `packages/models/src/index.ts`.
  - **Estimate:** 0.25 day.

- [ ] T02 — Implement `CircuitBreakerService` over `opossum`.
  - **Files:** `packages/plugin/src/circuit-breaker/circuit-breaker.service.ts`,
    `packages/plugin/src/circuit-breaker/__tests__/circuit-breaker.service.spec.ts`.
  - **Acceptance:** State-machine tests pass: closed → 5 fail → open;
    open → cooldown → half-open → success → closed; half-open → fail → open.
  - **Estimate:** 1 day.

- [ ] T03 — Implement `CircuitBreakerInterceptor`.
  - **Files:** `packages/plugin/src/circuit-breaker/circuit-breaker.interceptor.ts`,
    `__tests__/circuit-breaker.interceptor.spec.ts`.
  - **Acceptance:** Wraps `Promise<T>` calls with `exec()`; throws `ERR_SOURCE_CIRCUIT_OPEN`.
  - **Estimate:** 0.5 day.

## Phase 2 — Aggregator integration

- [ ] T04 — Wire interceptor into `JobsAggregator`.
  - **Files:** `apps/api/src/jobs/jobs.aggregator.ts`,
    `apps/api/__tests__/integration/circuit-breaker.spec.ts`.
  - **Acceptance:** 1-of-3 always-fail fake plugins → aggregator returns 2 results.
  - **Estimate:** 0.5 day.

## Phase 3 — Health endpoint & Prometheus

- [ ] T05 — Add `health.controller.ts` exposing `/api/sources/health`.
  - **Files:** `apps/api/src/jobs/health.controller.ts`,
    `apps/api/__tests__/e2e/health.e2e-spec.ts`.
  - **Acceptance:** Returns array of `SourceHealth`; cache-control 1 s.
  - **Estimate:** 0.5 day.

- [ ] T06 — Add Prometheus exposition under `/metrics`.
  - **Files:** `apps/api/src/metrics/metrics.module.ts`,
    `apps/api/src/metrics/metrics.controller.ts`.
  - **Acceptance:** `curl /metrics` includes `source_circuit_state{site=...}`.
  - **Estimate:** 0.5 day.

## Phase 4 — Admin endpoints & per-plugin override

- [ ] T07 — Add `POST /api/sources/:site/circuit/{open,reset}` (auth-required).
  - **Files:** `apps/api/src/jobs/health.controller.ts`,
    `apps/api/__tests__/e2e/health-admin.e2e-spec.ts`.
  - **Acceptance:** Force-open succeeds with valid API key; 401 otherwise.
  - **Estimate:** 0.5 day.

- [ ] T08 — Honour per-plugin `getCircuitBreakerPolicy()` override.
  - **Files:** `packages/plugin/src/circuit-breaker/circuit-breaker.service.ts`.
  - **Acceptance:** Plugin-defined policy wins over default at registration.
  - **Estimate:** 0.5 day.

## Phase 5 — Persistence (optional)

- [ ] T09 — Cron job snapshots health to active `IJobStore` every 60 s.
  - **Files:** `apps/api/src/jobs/health-snapshot.cron.ts`.
  - **Acceptance:** Rows appear in chosen backend; bypass when no store.
  - **Estimate:** 0.5 day.

## Notes

- Phase 5 depends on Spec 004 Phase 5 (aggregator persist).
- Default policy values come from `Constitution Article 6 §2`.
