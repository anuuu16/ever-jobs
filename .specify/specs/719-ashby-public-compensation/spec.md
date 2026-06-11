# Spec: 719 — Ashby Public API: Compensation Opt-In + Retry Resilience

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Spec ID        | 719                                    |
| Slug           | ashby-public-compensation              |
| Status         | done                                   |
| Owner          | agent                                  |
| Created        | 2026-06-11                             |
| Last updated   | 2026-06-11                             |
| Supersedes     | (none)                                 |
| Related specs  | (none)                                 |

## 1. Problem Statement

`AshbyService` (`packages/plugins/source-ats-ashby/src/ashby.service.ts`)
fetches public boards via
`GET https://api.ashbyhq.com/posting-api/job-board/{slug}` **without** the
`includeCompensation=true` query parameter. The public Job Posting API only
serializes the `compensation` payload when that parameter is passed, so
`extractCompensation()` virtually never receives data on the public path and
every public-path `JobPostDto.compensation` silently stays `null`.

A live probe of the public API on 2026-06-11 confirmed this end to end:

- `GET …/job-board/ramp` → 110 jobs, **0** carry a `compensation` key.
- `GET …/job-board/ramp?includeCompensation=true` → 110 jobs, **110** carry
  `compensation`.
- `GET …/job-board/linear?includeCompensation=true` → 25 jobs, 25 carry
  `compensation`.

The same probe also showed that the public wire shape for compensation is
**flat**, not the tiered shape currently modeled in `ashby.types.ts`:

```json
{
  "compensationTierSummary": "$211.4K – $290.6K • Offers Equity",
  "scrapeableCompensationSalarySummary": "$211.4K - $290.6K",
  "compensationTiers": [
    { "tierSummary": "…", "components": [
      { "compensationType": "Salary", "interval": "1 YEAR",
        "currencyCode": "USD", "minValue": 211400, "maxValue": 290600 } ] }
  ],
  "summaryComponents": [
    { "compensationType": "Salary", "interval": "1 YEAR",
      "currencyCode": "USD", "minValue": 211400, "maxValue": 290600 } ]
}
```

`extractCompensation()` today only understands
`compensationComponents[].tiers[].tierFloor/tierCeiling`, so even with the
query parameter fixed it would still map the live flat shape to `null`.
Both gaps must be closed together for the fix to have any effect.

Secondary problem: the public endpoint exhibits high server-side latency
(multi-second responses are routine; spikes can exceed a 10 s client
timeout). A single transient timeout currently drops the whole board to
`{ jobs: [] }` for that run.

## 2. Goals

- Public GET requests opt in to compensation data via
  `?includeCompensation=true` (constant in `ashby.constants.ts`).
- Apply the same parameter to the authenticated POST path URL — same
  endpoint family, parameter is harmless there and keeps the two paths
  consistent.
- Map the live flat compensation shape (`summaryComponents[]` /
  `compensationTiers[].components[]` with `minValue`/`maxValue`/
  `currencyCode`/`interval`) into `CompensationDto`, while keeping the
  existing tiered-shape extraction working.
- Normalize wire intervals like `"1 YEAR"` so they resolve through
  `getCompensationInterval()`.
- Small private retry around the public GET: up to 2 retries on network
  error/timeout/HTTP 5xx with exponential backoff (1000 ms · 2^attempt)
  plus 0–500 ms random jitter. Constants live in `ashby.constants.ts`;
  the backoff base is overridable so unit tests finish quickly.

## 3. Non-Goals

- No changes outside `packages/plugins/source-ats-ashby/` (plugin is
  already wired; no registry/tsconfig/jest edits).
- No retry on the authenticated POST path (it already falls back to the
  public path on failure).
- No retry on HTTP 4xx (a 404/401 will not heal on retry).
- No equity/bonus component modeling — only the salary component maps to
  `CompensationDto`.
- No pagination or board discovery changes.

## 4. User / Caller Stories

> As an **aggregator caller**, I want **public Ashby scrapes to return
> salary ranges**, so that **downstream compensation filters and
> enrichment work without an API key**.

> As an **operator**, I want **transient Ashby latency spikes retried**,
> so that **a single slow response does not blank out a board for the
> whole run**.

## 5. Functional Requirements

| ID    | Requirement                                                                                      | Priority |
| ----- | ------------------------------------------------------------------------------------------------ | -------- |
| FR-1  | Public GET URL ends with `?includeCompensation=true`; query string is a named constant `ASHBY_INCLUDE_COMPENSATION_QUERY` in `ashby.constants.ts`. | must |
| FR-2  | Authenticated POST URL carries the same query parameter.                                         | must     |
| FR-3  | Flat compensation shape (`summaryComponents[]` / `compensationTiers[].components[]`, fields `minValue`/`maxValue`/`currencyCode`/`interval`) maps to `CompensationDto`. | must |
| FR-4  | Existing tiered shape (`compensationComponents[].tiers[].tierFloor/tierCeiling/interval/currency`) keeps mapping as before. | must |
| FR-5  | Interval strings with a leading count (e.g. `"1 YEAR"`) resolve to `CompensationInterval.YEARLY` etc. | must |
| FR-6  | Salary component preferred (`compensationType` contains `salary` / equals `base`); components without numeric bounds are skipped. | must |
| FR-7  | Public GET retried up to 2 times on network error/timeout or HTTP ≥ 500; HTTP 4xx fails immediately. | should |
| FR-8  | Backoff delay = `baseDelayMs * 2^attempt + random(0..jitterMaxMs)`; defaults 1000 ms / 500 ms, defined in `ashby.constants.ts` as a mutable config object so tests can shrink delays. | should |
| FR-9  | `scrape()` still never throws — final failure returns `{ jobs: [] }`.                            | must     |
| FR-10 | Unit tests assert: request URL contains `includeCompensation=true`; flat + tiered shapes map into `CompensationDto`; retry path (timeout then success) returns jobs. | must |

## 6. Non-Functional Requirements

| ID     | Requirement                                          | Target                          |
| ------ | ---------------------------------------------------- | ------------------------------- |
| NFR-1  | Worst-case added retry delay (2 retries)             | ≤ 1000 + 2000 + 2·500 = 4000 ms |
| NFR-2  | Unit suite runtime with shrunk backoff               | < 5 s                           |
| NFR-3  | No new runtime dependencies                          | 0 added packages                |
| NFR-4  | `Logger` (`@nestjs/common`) only; no `console.*`     | enforced by review              |

## 7. Contracts

### 7.1 API / Interface

```ts
// ashby.constants.ts
export const ASHBY_INCLUDE_COMPENSATION_QUERY = 'includeCompensation=true';
export const ASHBY_PUBLIC_MAX_RETRIES = 2;
export const ASHBY_RETRY_BACKOFF = { baseDelayMs: 1000, jitterMaxMs: 500 };

// ashby.types.ts — additive only
export interface AshbyFlatCompensationComponent {
  compensationType?: string | null;
  interval?: string | null;     // e.g. "1 YEAR", "1 HOUR", "NONE"
  currencyCode?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  summary?: string | null;
}
// AshbyCompensation gains: compensationTiers?, compensationTierSummary?,
// scrapeableCompensationSalarySummary?; summaryComponents widens to
// accept the flat component shape.

// ashby.service.ts — private surface
private async getWithRetry(client, url): Promise<AxiosResponse<AshbyResponse>>;
private extractCompensation(job: AshbyJob): CompensationDto | null; // both shapes
```

### 7.2 Errors

| Condition                              | Behavior                                  |
| -------------------------------------- | ----------------------------------------- |
| Network error / timeout / HTTP ≥ 500   | retry (≤ 2), then `{ jobs: [] }` + warn   |
| HTTP 4xx                               | no retry, `{ jobs: [] }` + error log      |
| Malformed/absent compensation payload  | `compensation: null`, job still emitted   |

## 8. Test Plan

- Unit (`__tests__/ashby.service.spec.ts`, mocked `createHttpClient`,
  relative imports, fixture with ≥ 3 listings):
  - public GET URL contains `includeCompensation=true`;
  - authenticated POST URL contains `includeCompensation=true`;
  - tiered-shape fixture listing maps to `CompensationDto`
    (min/max/interval/currency);
  - flat-shape fixture listing (live wire shape) maps to
    `CompensationDto`, `"1 YEAR"` → `yearly`;
  - retry: first GET rejects (timeout), second resolves → jobs returned,
    exactly 2 GET calls;
  - 404 → no retry (1 call), empty result;
  - all retries exhausted → empty result, never throws.
- E2E (existing `ashby.e2e-spec.ts`): unchanged, keeps passing against
  the live API.

## 9. Open Questions

(none open — see § 10 Decisions.)

## 10. Decisions

- **D-1 (2026-06-11):** Append the query string to the authenticated POST
  URL too. Live probe shows the parameter is a no-op where compensation
  is already authorized, and a single URL recipe avoids path divergence.
- **D-2 (2026-06-11):** Keep the legacy tiered extraction as the first
  attempt and fall back to the flat shape, so any payload that still uses
  `compensationComponents[].tiers[]` maps exactly as before.
- **D-3 (2026-06-11):** Retry scope is the public GET only; the
  authenticated path already has a public-path fallback, and stacking
  retries would multiply worst-case latency.
- **D-4 (2026-06-11):** `ASHBY_RETRY_BACKOFF` is a mutable config object
  (not frozen) so the unit suite can shrink `baseDelayMs`/`jitterMaxMs`
  to ~1 ms and restore them afterwards.
- **D-5 (2026-06-11):** Interval normalization strips a leading
  `<count><space>` (`"1 YEAR"` → `"YEAR"`) before calling
  `getCompensationInterval()`; unknown intervals (e.g. `"NONE"`) yield
  `interval: undefined` rather than dropping the amounts.

## 11. References

- `packages/plugins/source-ats-ashby/src/ashby.service.ts`
- `packages/plugins/source-ats-ashby/src/ashby.constants.ts`
- `packages/plugins/source-ats-ashby/src/ashby.types.ts`
- `packages/models/src/enums/compensation-interval.enum.ts`
- `packages/common/src/http/http-client.ts`
- Live probe (2026-06-11): `GET https://api.ashbyhq.com/posting-api/job-board/{ramp,linear}` with/without `?includeCompensation=true`
