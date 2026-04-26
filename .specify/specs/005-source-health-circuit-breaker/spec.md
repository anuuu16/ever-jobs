# Spec 005 — Source Health & Circuit Breaker

| Field          | Value                                                |
| -------------- | ---------------------------------------------------- |
| Spec ID        | 005                                                  |
| Slug           | source-health-circuit-breaker                        |
| Status         | Phase 1 done (T01–T03); Phase 2+ pending             |
| Owner          | scheduled-task agent                                 |
| Created        | 2026-04-26                                           |
| Last updated   | 2026-04-26                                           |
| Supersedes     | (none)                                               |
| Related specs  | 001, 003, 004                                        |

## 1. Problem Statement

A single misbehaving source (e.g. LinkedIn rate-limits us, Indeed returns HTML 502)
currently slows or fails the entire fan-out request. Per the constitution
(Article 6 §2), every plugin must have a circuit breaker that **opens** on consecutive
failures and **half-opens** later to probe recovery. We also need per-source health
metrics surfaced over `/api/sources/health` so operators can see at-a-glance which
sources are degraded.

## 2. Goals

- Wrap every plugin's `scrape()` call in a circuit breaker.
- Default policy: open after 5 consecutive failures, half-open after 30 s.
- Per-plugin override via `getCircuitBreakerPolicy()` on the service.
- Expose `/api/sources/health` returning `{ site, state: open|half|closed, successRate, p95Latency }`.
- Emit Prometheus metrics: `source_request_total`, `source_request_failures_total`,
  `source_request_duration_seconds`, `source_circuit_state`.

## 3. Non-Goals

- Cross-instance circuit-breaker sharing (deferred — uses per-process state).
- Auto-disable a plugin permanently (deferred — operator decision).

## 4. User / Caller Stories

- *As an operator*, I want a single endpoint that tells me which sources are degraded.
- *As a downstream user*, I want my request to succeed even if 1 of 50 sources is down.
- *As a plugin author*, I want sane defaults but the option to override (e.g. 10 failures
  for a known-flaky niche site).

## 5. Functional Requirements

| ID    | Requirement                                                                | Priority |
| ----- | -------------------------------------------------------------------------- | -------- |
| FR-1  | `CircuitBreakerInterceptor` wraps every `IScraper.scrape()` call.          | must     |
| FR-2  | Default policy: 5 failures → open; 30 s cool-down; 1-call probe.           | must     |
| FR-3  | Plugin-side override: `getCircuitBreakerPolicy?: () => CircuitPolicy`.     | should   |
| FR-4  | Open circuit short-circuits with `ERR_SOURCE_CIRCUIT_OPEN`; aggregator     | must     |
|       | logs and skips the source.                                                 |          |
| FR-5  | `/api/sources/health` returns per-site state + last 5 min stats.           | must     |
| FR-6  | Per-site Prometheus metrics exported via `/metrics`.                       | must     |
| FR-7  | Force-state admin endpoint: `POST /api/sources/:site/circuit/{open|reset}` | should   |
|       | (auth-required).                                                           |          |
| FR-8  | Health snapshot persisted to active `IJobStore` every 60 s (best-effort).  | should   |

## 6. Non-Functional Requirements

| ID     | Requirement                                       | Target            |
| ------ | ------------------------------------------------- | ----------------- |
| NFR-1  | Interceptor overhead per call                     | < 100 µs          |
| NFR-2  | `/api/sources/health` p95 latency                 | < 25 ms           |
| NFR-3  | Memory per source breaker                         | < 1 KB            |

## 7. Contracts

### 7.1 Interfaces

```ts
export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitPolicy {
  failureThreshold: number;     // consecutive failures before opening
  cooldownMs: number;           // ms in 'open' before half-open probe
  halfOpenProbes: number;       // probe attempts in half-open
  rollingWindowMs: number;      // window for stats (default 60_000)
}

export interface SourceHealth {
  site: Site;
  state: CircuitState;
  successRate: number;          // 0..1 in rolling window
  p95LatencyMs: number;
  lastError?: { code: string; message: string; at: string };
  windowMs: number;
}

export interface ICircuitBreakerService {
  exec<T>(site: Site, fn: () => Promise<T>): Promise<T>;
  state(site: Site): CircuitState;
  health(site: Site): SourceHealth;
  forceOpen(site: Site): void;
  forceReset(site: Site): void;
  list(): SourceHealth[];
}
```

### 7.2 Errors

| Code                          | Meaning                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `ERR_SOURCE_CIRCUIT_OPEN`     | Site's circuit is open; request short-circuited.          |
| `ERR_SOURCE_TIMEOUT`          | Source call exceeded plugin timeout (counts as failure).  |
| `ERR_SOURCE_RATE_LIMITED`     | Source returned 429; counts as failure with backoff hint. |

## 8. Test Plan

- Unit (`circuit-breaker.service.spec.ts`):
  - Closed → 5 failures → Open.
  - Open → cooldown elapsed → Half-open probe success → Closed.
  - Half-open probe failure → Open + new cooldown.
- Integration: 3 fake plugins, 1 always-fails → aggregator returns 2 results, 1 skipped.
- E2E: `/api/sources/health` reflects live state.
- Performance: interceptor benchmark < 100 µs.

## 9. Open Questions

- Q-003 in `docs/questions.md` (default policy aggressiveness).
- Q-012 in `docs/questions.md` (`opossum` vs hand-rolled engine).

## 10. Decisions

- 2026-04-26: Default = Q-003 option A (5 / 30 s) per Constitution Article 6 §2.
- 2026-04-26 (run #10): Q-012 resolved → hand-rolled state machine adopted
  for Phase 1 to honour FR-2's consecutive-failure semantics exactly.
  Plan §1 (`opossum` wrap) superseded; replacement remains a 1-day commit
  through the `ICircuitBreakerService` seam if a future need surfaces.

## 11. References

- `opossum` (Node circuit-breaker library) — considered, deferred per Q-012.
- Constitution Article 6.
