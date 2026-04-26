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

- [x] T04 — Wire interceptor into `JobsAggregator`.
  - **Files (planned):** `apps/api/src/jobs/jobs.aggregator.ts`,
    `apps/api/__tests__/integration/circuit-breaker.spec.ts`.
  - **Files (actual):** `apps/api/src/jobs/jobs.service.ts`,
    `apps/api/src/jobs/jobs.module.ts`,
    `apps/api/src/metrics/metrics.service.ts`,
    `apps/api/__tests__/integration/circuit-breaker.spec.ts`.
  - **Acceptance:** 1-of-3 always-fail fake plugins → aggregator returns 2 results.
  - **Done:** run #12 (2026-04-27). The per-source dispatch lives in
    `JobsService.searchJobs` (where `selectedScrapers.map(...)` calls
    each plugin's `scrape()`) — **not** in `JobsAggregator`, which
    delegates fan-out to the service. Wiring the interceptor inside
    `JobsAggregator` would have required a refactor to move dispatch
    upstream; instead the interceptor was injected `@Optional()` into
    `JobsService` and the per-site `scraper.scrape()` call is now
    `circuitBreaker.wrap(site, () => scraper.scrape(...))` when bound.
    `JobsModule` now imports `CircuitBreakerModule` so production
    bootstraps get the breaker; tests that don't import it degrade to
    the prior pass-through behaviour. Short-circuit failures are tagged
    `status='circuit_open'` on the Prom counter (was `error`) so the
    `/metrics` view distinguishes "source down" from "we stopped
    calling source".
    Integration suite at
    `apps/api/__tests__/integration/circuit-breaker.spec.ts` covers
    four scenarios: closed-state pass-through with 1 failing source,
    breaker opens after 5 consecutive failures and short-circuits the
    6th call, `forceOpen` isolation per-site, and back-compat (no
    interceptor bound). All four pass; full breaker unit suite (23
    cases) and aggregator suite (13 cases) remain green.
  - **Estimate:** 0.5 day. **Actual:** ~0.4 day.

## Phase 3 — Health endpoint & Prometheus

- [x] T05 — Add `health.controller.ts` exposing `/api/sources/health`.
  - **Files (planned):** `apps/api/src/jobs/health.controller.ts`,
    `apps/api/__tests__/e2e/health.e2e-spec.ts`.
  - **Files (actual):** `apps/api/src/jobs/health.controller.ts`,
    `apps/api/src/jobs/jobs.module.ts`,
    `apps/api/__tests__/e2e/sources-health.e2e-spec.ts`.
  - **Acceptance:** Returns array of `SourceHealth`; cache-control 1 s.
  - **Done:** run #13 (2026-04-27). New `SourcesHealthController`
    (Spec 005 / FR-5) is `@Controller('api/sources')` with a single
    `GET health` route returning `{ count, sources: SourceHealth[] }`
    sorted alphabetically by `Site`. Reads from `CIRCUIT_BREAKER_TOKEN`
    via `@Optional()` injection (degrades to an empty list when the
    token is unbound — same back-compat pattern T04 chose for
    `JobsService`). Carries `Cache-Control: public, max-age=1` exactly
    as the acceptance asks. The optional `?include=all` query overlays
    every registered plugin from `PluginRegistry.listSiteKeys()` with a
    synthetic closed/no-data row **without** calling
    `breaker.health(site)` for unseen sites — the lazy-init property
    that keeps the breaker pool inside the NFR-3 ceiling is preserved.
    The actual e2e test file is named `sources-health.e2e-spec.ts` (not
    `health.e2e-spec.ts`) so it can sit alongside the legacy `/health`
    + `/ping` suite at `apps/api/__tests__/health.e2e-spec.ts` without
    a name collision. The legacy file stays as-is. The five e2e cases
    cover (a) shape + `Cache-Control: max-age=1`, (b) reflection of a
    `forceOpen` state, (c) alphabetical sort stability, (d) overlay
    additive semantics with default windowMs=60_000, and (e) overlay
    not masking a force-open. Q-014 records the envelope-shape +
    opt-in-overlay + no-extra-auth defaults.
  - **Estimate:** 0.5 day. **Actual:** ~0.4 day.

- [x] T06 — Add Prometheus exposition under `/metrics`.
  - **Files (planned):** `apps/api/src/metrics/metrics.module.ts`,
    `apps/api/src/metrics/metrics.controller.ts`.
  - **Files (actual):** `apps/api/src/metrics/metrics.service.ts`,
    `apps/api/src/metrics/metrics.controller.ts`,
    `apps/api/src/jobs/metrics-circuit-breaker.bridge.ts` (new),
    `apps/api/src/jobs/jobs.module.ts`.
  - **Acceptance:** `curl /metrics` includes `source_circuit_state{site=...}`.
  - **Done:** run #14 (2026-04-27). New per-site Gauge
    `ever_jobs_source_circuit_state{site}` is registered on the
    `MetricsService`'s prom-client registry with a `collect()` callback
    that delegates to the breaker via a thin closure
    (`bindCircuitBreakerSource(fn)`). The closure is wired at
    `OnApplicationBootstrap` by a new `MetricsCircuitBreakerBridge`
    provider in `JobsModule` (where both `MetricsService` and
    `CIRCUIT_BREAKER_TOKEN` resolve). Encoding `closed=0, half-open=1,
    open=2` (severity ascending) is documented in the Gauge's HELP
    text and exported as `CIRCUIT_STATE_GAUGE_VALUE` for re-use. When
    no source is bound (test bootstraps that don't import `JobsModule`),
    the Gauge has no samples and `source_circuit_state` is simply
    absent from `/metrics` — back-compat preserved. Q-015 records the
    bridge-vs-global, encoding, and label-cardinality choices.
    Side-fix: the `/metrics` controller switched from `@Res() res` +
    `res.end()` to `@Res({ passthrough: true })` + `return ...`
    because `LoggingInterceptor.tap.next` was setting
    `X-Process-Time` *after* the body was sent and turning every
    `/metrics` scrape into a 500. Bug was latent — there was no
    pre-existing `/metrics` e2e suite to surface it. The new T06
    e2e suite exercises the path so the regression can never recur.
  - **Estimate:** 0.5 day. **Actual:** ~0.4 day.

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
