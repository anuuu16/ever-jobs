# Tasks: 005 — Source Health & Circuit Breaker

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Service & interceptor

- [x] T01 — Add types `CircuitState`, `CircuitPolicy`, `SourceHealth`.
  - **Files:** `packages/models/src/interfaces/circuit-breaker.interface.ts`,
    `packages/models/src/interfaces/index.ts`.
  - **Done:** run #10 (2026-04-26). New file declares
    `CircuitState`, `CircuitPolicy`, `SourceHealth`, `SourceHealthError`,
    `ICircuitBreakerService`, `ICircuitBreakerPolicyProvider` plus the
    `DEFAULT_CIRCUIT_POLICY` constant (Q-003 option A: 5 / 30 s / 1 probe /
    60 s window) and the `ERR_SOURCE_CIRCUIT_OPEN` + `CIRCUIT_BREAKER_TOKEN`
    string symbols. Re-exported from `@ever-jobs/models`.
  - **Estimate:** 0.25 day.

- [x] T02 — Implement `CircuitBreakerService`.
  - **Files:** `packages/plugin/src/circuit-breaker/circuit-breaker.service.ts`,
    `packages/plugin/src/circuit-breaker/__tests__/circuit-breaker.service.spec.ts`.
  - **Acceptance:** State-machine tests pass: closed → 5 fail → open;
    open → cooldown → half-open → success → closed; half-open → fail → open.
  - **Done:** run #10 (2026-04-26). Hand-rolled state machine (NOT `opossum`
    — see Q-012) backs `ICircuitBreakerService`. Per-site `BreakerEntry`
    holds policy, state, consecutive-failure counter, ring-buffer of
    samples (capped at 600). Exposes `exec`, `state`, `health`,
    `forceOpen`, `forceReset`, `setPolicy`, `list` plus a `setClock` test
    seam. 14 unit cases cover the full state-machine matrix, policy
    override, rolling-window pruning, half-open quota exhaustion, and the
    isolation-by-site invariant. Memory cap (`MAX_SITES = 250`) keeps the
    breaker pool ≤ ~250 KB per Spec 005 / NFR-3.
  - **Estimate:** 1 day.

- [x] T03 — Implement `CircuitBreakerInterceptor`.
  - **Files:** `packages/plugin/src/circuit-breaker/circuit-breaker.interceptor.ts`,
    `packages/plugin/src/circuit-breaker/__tests__/circuit-breaker.interceptor.spec.ts`,
    `packages/plugin/src/circuit-breaker/circuit-breaker.module.ts`.
  - **Acceptance:** Wraps `Promise<T>` calls with `exec()`; throws `ERR_SOURCE_CIRCUIT_OPEN`.
  - **Done:** run #10 (2026-04-26). `CircuitBreakerInterceptor.wrap(site, fn)`
    is a thin facade over `ICircuitBreakerService.exec`; `@Optional`
    injection lets aggregator code stay test-friendly. Bundled
    `CircuitBreakerModule` registers the service under
    `CIRCUIT_BREAKER_TOKEN` and exports the interceptor for the
    aggregator. 5 unit cases cover happy-path, error rethrow, open-state
    short-circuit, missing-binding error, and per-site isolation.
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
  - **Note:** the `ICircuitBreakerPolicyProvider` interface and
    `setPolicy(site, policy)` setter are already in place from T01/T02; T08
    is the discovery-side wiring (scan registered plugins at bootstrap and
    call `setPolicy` for any that implement the provider).

## Phase 5 — Persistence (optional)

- [ ] T09 — Cron job snapshots health to active `IJobStore` every 60 s.
  - **Files:** `apps/api/src/jobs/health-snapshot.cron.ts`.
  - **Acceptance:** Rows appear in chosen backend; bypass when no store.
  - **Estimate:** 0.5 day.

## Notes

- Phase 5 depends on Spec 004 Phase 5 (aggregator persist).
- Default policy values come from `Constitution Article 6 §2`.
- Phase 1 closed in run #10 (T01–T03 done).
