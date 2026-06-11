# Plan: 719 — Ashby Public API: Compensation Opt-In + Retry Resilience

| Field        | Value      |
| ------------ | ---------- |
| Spec         | spec.md    |
| Created      | 2026-06-11 |
| Last updated | 2026-06-11 |

## 1. Approach

The change is confined to `packages/plugins/source-ats-ashby/`. The plugin
is already registered (Site enum, module list, tsconfig alias, jest
mapper), so no shared files are touched.

First, `ashby.constants.ts` gains three exports: the query-string constant
`ASHBY_INCLUDE_COMPENSATION_QUERY`, the retry cap
`ASHBY_PUBLIC_MAX_RETRIES`, and a mutable backoff config object
`ASHBY_RETRY_BACKOFF` (`baseDelayMs`, `jitterMaxMs`). The config object is
deliberately not frozen: the unit suite mutates it to ~1 ms delays in
`beforeAll` and restores it in `afterAll`, keeping the retry test fast
without fake timers.

Second, `ashby.types.ts` is extended additively. A live probe on
2026-06-11 showed the public API (with `includeCompensation=true`) serves
a flat component shape — `summaryComponents[]` and
`compensationTiers[].components[]` carrying
`minValue`/`maxValue`/`currencyCode`/`interval` — rather than the tiered
`compensationComponents[].tiers[]` shape already modeled. New optional
interfaces (`AshbyFlatCompensationComponent`, `AshbyCompensationTierGroup`)
and new optional fields on `AshbyCompensation` describe it; nothing
existing is removed or narrowed, so current call sites compile unchanged.

Third, `ashby.service.ts`:

- Both URL builders append `?${ASHBY_INCLUDE_COMPENSATION_QUERY}` (public
  GET and authenticated POST — same endpoint family, harmless and
  consistent).
- The public `client.get(url)` call moves behind a private
  `getWithRetry()` helper: attempts `1 + ASHBY_PUBLIC_MAX_RETRIES` times,
  retrying only on errors without an HTTP status (network/timeout) or
  with status ≥ 500, sleeping `baseDelayMs · 2^attempt + jitter` between
  attempts. 4xx rethrows immediately; the existing outer catch still
  converts the final failure into `{ jobs: [] }`.
- `extractCompensation()` first runs the legacy tiered extraction
  (unchanged semantics), then falls back to the flat shape: gather
  `summaryComponents` plus all `compensationTiers[].components`, prefer
  the salary component, skip components without numeric bounds, map
  `minValue`/`maxValue`/`currencyCode`, and normalize intervals by
  stripping a leading count (`"1 YEAR"` → `"YEAR"`) before
  `getCompensationInterval()`.

Finally, a new unit spec `__tests__/ashby.service.spec.ts` (mocked
`createHttpClient`, relative imports per house rules) plus a fixture
`__tests__/fixtures/ashby-jobs.json` with 4 listings — one tiered-shape
compensation, one live flat-shape compensation, one without compensation,
one unlisted — cover URLs, both mappings, and the retry paths. The
existing live E2E spec is left untouched.

## 2. Phases

### Phase 1 — Constants & types

- Goal: new constants and additive wire-shape types.
- Deliverables: `ashby.constants.ts`, `ashby.types.ts` updated.
- Exit criteria: package compiles; no existing import breaks.

### Phase 2 — Service changes

- Goal: query param on both paths, retry wrapper, dual-shape extraction.
- Deliverables: `ashby.service.ts` updated.
- Exit criteria: behavior matches FR-1..FR-9.

### Phase 3 — Tests

- Goal: lock the new behavior with a mocked unit suite.
- Deliverables: `__tests__/ashby.service.spec.ts`,
  `__tests__/fixtures/ashby-jobs.json`.
- Exit criteria: `npx jest packages/plugins/source-ats-ashby --silent`
  fully green (new unit suite + pre-existing E2E suite).

## 3. Packages Touched

| Package                                  | Change                                       |
| ---------------------------------------- | -------------------------------------------- |
| `packages/plugins/source-ats-ashby`      | constants, types, service, new unit tests    |
| everything else                          | (no change)                                  |

## 4. Dependencies

| Library | Version | Rationale                                  |
| ------- | ------- | ------------------------------------------ |
| (none)  | —       | retry/backoff implemented with `setTimeout` |

## 5. Risks & Mitigations

| Risk                                                        | Likelihood | Impact | Mitigation                                                        |
| ----------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------- |
| Param triggers an error on the authenticated POST           | L          | M      | Auth path already falls back to public scraping on any failure    |
| Wire shape shifts again (fields renamed)                    | L          | M      | Extraction is null-safe at every step; job still emitted          |
| Retry inflates run latency on hard-down boards              | M          | L      | Cap at 2 retries, ≤ ~4 s worst-case added delay                   |
| Test suite slowed by real backoff sleeps                    | M          | L      | Mutable `ASHBY_RETRY_BACKOFF` shrunk to ~1 ms in tests            |

## 6. Rollback Plan

Single-package change; revert the commit. No data, schema, or config
migration involved. Removing the query parameter only reverts to
compensation-less public payloads.

## 7. Migration Plan (if applicable)

Not applicable — output contract (`JobPostDto`) is unchanged; only the
`compensation` field starts being populated on the public path.

## 8. Open Questions for Plan

(none — decisions D-1..D-5 recorded in spec.md § 10.)
