# Plan: 721 — Feature Plugin: liveness-http

| Field        | Value      |
| ------------ | ---------- |
| Spec         | spec.md    |
| Created      | 2026-06-11 |
| Last updated | 2026-06-11 |

## 1. Approach

The plugin follows the established feature-plugin shape: the public
contract (`ILivenessChecker`, verdict/option types and
`LIVENESS_CHECKER_TOKEN`) lives in `@ever-jobs/models` next to the
dedup-engine contract, and the implementation package
`packages/plugins/liveness-http/` binds its service under the token via
`{ provide: LIVENESS_CHECKER_TOKEN, useExisting: LivenessHttpService }`.
Consumers inject by token, never by class, so the HTTP implementation
stays swappable (a future renderer-backed checker can bind the same
token).

The implementation is split along a purity boundary. Everything that
can be a pure function *is* one: `liveness-heuristics.ts` exposes
`classifyHttpStatus`, `hasExpiredUrlMarker` and `classifyBody` plus the
individual marker matchers, all driven by precompiled module-scope
regexes (the classifier runs per stored URL, so per-call `new RegExp`
churn matters). The service is a thin I/O shell: build an HTTP client,
issue one GET, hand status/final-URL/body to the heuristics, wrap the
outcome in a `LivenessVerdict`.

HTTP transport reuses `createHttpClient` from `@ever-jobs/common`.
Two of its semantics drive the design: (a) the client throws on non-2xx
by default, so the service passes a per-request
`validateStatus: () => true` to receive 4xx/5xx responses for
classification (with an axios-style `err.response?.status` fallback in
the catch path); (b) its constructor timeout is in *seconds*, so the
service converts `timeoutMs` and additionally sets the per-request
millisecond timeout. Redirects follow the client default; the
post-redirect URL is read from the Node adapter's
`request.res.responseUrl` for the `error=true` check. Retries are
disabled (`retries: 0`) — a liveness probe wants one cheap verdict, not
a retry storm against an already-suspect host.

`checkBatch` is a shared-cursor worker pool: `min(concurrency, N)`
workers pull the next index, optionally sleep a jittered
`[throttleMs, 2·throttleMs]` delay between request starts, and write
verdicts into a results array by input index (order preservation for
free). Workers are joined with `Promise.allSettled` and each iteration
is individually try/caught, so a single poisoned URL degrades to an
`uncertain`/`fetch_failed` verdict instead of rejecting the batch. One
HTTP client instance is shared across the batch so proxy rotation in
the common client remains meaningful.

A live probe of several public job boards on 2026-06-11 informed the
marker sets: tombstone pages phrase expiry in the languages of the
boards we aggregate (EN/DE/FR/ES/PL), challenge interstitials carry
their markers in `<title>`/script attributes rather than visible text,
and anti-bot walls answer 403/503 for live postings — hence the
hard rule that those statuses can never produce `expired`.

## 2. Phases

### Phase 1 — Contract in `@ever-jobs/models`

- Goal: public, implementation-free contract.
- Deliverables: `liveness-checker.interface.ts`, barrel export in
  `interfaces/index.ts`.
- Exit criteria: types importable from `@ever-jobs/models`; no other
  models file touched.

### Phase 2 — Heuristics core

- Goal: pure, fast classification.
- Deliverables: `liveness-http.constants.ts`,
  `liveness-heuristics.ts` (precompiled regexes, priority-ordered
  `classifyBody`).
- Exit criteria: every FR-1..FR-12 branch reachable through exported
  pure functions.

### Phase 3 — Service + module

- Goal: I/O shell and DI binding.
- Deliverables: `liveness-http.service.ts`, `liveness-http.module.ts`,
  `src/index.ts`, package scaffolding.
- Exit criteria: `LIVENESS_CHECKER_TOKEN` resolves to the service via
  the module; `check`/`checkBatch` honour FR-13..FR-17.

### Phase 4 — Tests

- Goal: branch-complete unit coverage.
- Deliverables: `__tests__/liveness-heuristics.spec.ts`,
  `__tests__/liveness-http.service.spec.ts`.
- Exit criteria: `npx jest packages/plugins/liveness-http --silent`
  green; every classification branch asserted at least once.

## 3. Packages Touched

| Package                          | Change                                                       |
| -------------------------------- | ------------------------------------------------------------ |
| `packages/models`                | new `liveness-checker.interface.ts` + interfaces barrel line  |
| `packages/plugins/liveness-http` | new package                                                   |
| `packages/common`                | (no change — consumed only)                                   |
| `packages/plugins/index.ts`      | (no change — feature plugin, not a source)                    |
| `tsconfig.base.json` / `jest.config.js` | (no change here — global wiring owned by a later serial step; tests import relatively) |

## 4. Dependencies

| Library | Version | Rationale                                                        |
| ------- | ------- | ---------------------------------------------------------------- |
| (none)  | —       | axios (via `@ever-jobs/common`) and `@nestjs/common` already ship in the workspace. |

## 5. Risks & Mitigations

| Risk                                                            | Likelihood | Impact | Mitigation                                                                 |
| --------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------- |
| Anti-bot walls (403/503/challenge pages) cause false `expired`   | H          | H      | FR-2/FR-8 hard rules: blocked/challenged → `uncertain`, never `expired`     |
| SPA boards render ~no server-side HTML → `insufficient_content`  | M          | M      | configurable `minContentLength`; code is distinct so consumers can soften  |
| Hammering one host from a batch triggers rate-limiting           | M          | M      | bounded concurrency + jittered `throttleMs`; retries disabled              |
| Locale phrase set drifts (new tombstone wordings)                | M          | L      | marker sets centralised in one constants-adjacent module; append-only      |
| Slow hosts stall a batch                                         | M          | L      | 15 s default timeout per request; failures isolate to one verdict          |

## 6. Rollback Plan

Feature plugin behind a DI token with no global wiring in this change:
removing the module import from any consumer (or deleting
`packages/plugins/liveness-http/` and the two models lines) fully
disables the feature. No persisted data, no migrations.

## 7. Migration Plan (if applicable)

Not applicable — new capability, no existing consumers or data.

## 8. Open Questions for Plan

(none — resolved into spec § 10 Decisions.)
