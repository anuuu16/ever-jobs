# Spec: 721 — Feature Plugin: liveness-http (HTTP job-posting liveness checker)

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Spec ID        | 721                                    |
| Slug           | liveness-http                          |
| Status         | done                                   |
| Owner          | agent                                  |
| Created        | 2026-06-11                             |
| Last updated   | 2026-06-11                             |
| Supersedes     | (none)                                 |
| Related specs  | 003                                    |

## 1. Problem Statement

Aggregated job URLs go stale: postings get filled, withdrawn, or expire,
but the stored `jobUrl` keeps resurfacing in queries and re-runs. Today
the pipeline has no way to tell a live posting from a dead one without
a human (or an expensive headless-browser pass) opening every link.

A cheap, HTTP-only liveness classifier lets the pipeline drop dead
postings and avoid re-surfacing them — one GET per URL, a status-code
check, and a set of fast text heuristics over the response body. No
browser dependency, no per-source code.

## 2. Goals

- Ship a `liveness-http` **feature plugin** (like the dedup engine, not
  a source plugin): no `Site` enum entry, no `ALL_SOURCE_MODULES` entry,
  bound under a dedicated DI token.
- Public contract in `@ever-jobs/models`
  (`liveness-checker.interface.ts`): `ILivenessChecker`,
  `LivenessVerdict`, `LivenessResult`, `LivenessCode`, option types and
  `LIVENESS_CHECKER_TOKEN`.
- Deterministic, prioritised classification: HTTP status first, then
  final-URL marker, then body heuristics (expired text → bot challenge →
  apply control → content length → listing page → fallback).
- Batch mode with bounded concurrency, optional jittered throttling,
  input-order-preserving results, and per-URL failure isolation.
- Heavy unit coverage — the heuristics are pure functions and every
  classification branch is testable with synthetic HTML.

## 3. Non-Goals

- Headless-browser rendering or JavaScript execution (SPA-only boards
  that render nothing server-side will land in `uncertain`).
- Persisting verdicts or scheduling re-checks (a later consumer owns
  the store / recheck cadence).
- Solving anti-bot challenges — challenge pages are *classified*
  (`uncertain`/`bot_challenge`), never bypassed.
- Per-ATS specialised selectors; the heuristics are intentionally
  source-agnostic.

## 4. User / Caller Stories

> As an **aggregator pipeline stage**, I want to inject a checker via
> **`LIVENESS_CHECKER_TOKEN`** and call **`checkBatch(urls)`**, so that
> **stale postings can be dropped before they reach consumers**.

> As a **store maintenance job**, I want a per-URL
> **`LivenessVerdict` with a machine-readable `code`**, so that
> **`expired` rows can be evicted while `uncertain` rows are retried
> later instead of being deleted on a false positive**.

## 5. Functional Requirements

Classification is evaluated in strict priority order — the first
matching rule wins:

| ID    | Requirement                                                                                                   | Priority |
| ----- | ------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1  | HTTP 404 or 410 → `expired` / `http_gone`.                                                                     | must     |
| FR-2  | HTTP 403 or 503 → `uncertain` / `access_blocked` (anti-bot walls masquerade as these; NEVER mark `expired`).   | must     |
| FR-3  | Any other HTTP status ≥ 400 → `uncertain` / `http_error`.                                                      | must     |
| FR-4  | Network failure / timeout → `uncertain` / `fetch_failed`; `check()` never throws.                              | must     |
| FR-5  | Final (post-redirect) URL carries an `error=true` query parameter → `expired` / `expired_url`.                 | must     |
| FR-6  | Response body is converted to plain text via `htmlToPlainText` (`@ever-jobs/common`) and lowercased before text rules run. | must |
| FR-7  | Hard-expired text pattern (multilingual EN/DE/FR/ES/PL set, see § 7.3) → `expired` / `expired_text`.           | must     |
| FR-8  | Bot-challenge marker (see § 7.3) → `uncertain` / `bot_challenge`. MUST be evaluated before the short-content rule so challenge interstitials are not misclassified as dead. | must |
| FR-9  | Apply-control marker visible (see § 7.3) → `active` / `apply_control_visible`.                                 | must     |
| FR-10 | Plain text shorter than `minContentLength` (default 300 chars) → `expired` / `insufficient_content`.           | must     |
| FR-11 | Body looks like a jobs *listing* page rather than a single posting (e.g. `/\d+\s+(jobs?\|open positions\|openings)\s+(found\|available)/`) → `uncertain` / `listing_page`. | must |
| FR-12 | Otherwise → `uncertain` / `no_apply_control`.                                                                  | must     |
| FR-13 | `checkBatch` runs with bounded concurrency (default 5) and optional `throttleMs` (jittered delay in `[throttleMs, 2·throttleMs]` between request starts within a worker). | must |
| FR-14 | `checkBatch` preserves input order and one URL's failure never rejects the batch — failed entries become `uncertain` / `fetch_failed` verdicts. | must |
| FR-15 | Module binds the service under `LIVENESS_CHECKER_TOKEN` (`useExisting`); contract lives in `@ever-jobs/models` and is exported from the interfaces barrel. | must |
| FR-16 | Heuristics are pure functions with precompiled module-scope regexes (no per-call `new RegExp`).                | must     |
| FR-17 | Every verdict carries `url`, `result`, `code`, `checkedAt` (ISO-8601) and, when a response was received, `httpStatus`. | must |

## 6. Non-Functional Requirements

| ID     | Requirement                                                        | Target                          |
| ------ | ------------------------------------------------------------------ | ------------------------------- |
| NFR-1  | Body classification (pure heuristics) per 100 KB page              | < 10 ms                         |
| NFR-2  | Default per-request timeout                                        | 15 000 ms                       |
| NFR-3  | No new runtime dependencies (axios/Nest already in the workspace)  | 0 new packages                  |
| NFR-4  | `Logger` (`@nestjs/common`) only — no `console.log`                | enforced by review              |
| NFR-5  | A single 403/503 must never produce a destructive (`expired`) verdict | enforced by unit tests       |

## 7. Contracts

### 7.1 API / Interface

```ts
export const LIVENESS_CHECKER_TOKEN = 'LIVENESS_CHECKER';

export type LivenessResult = 'active' | 'expired' | 'uncertain';

export type LivenessCode =
  | 'http_gone' | 'http_error' | 'access_blocked' | 'bot_challenge'
  | 'expired_text' | 'expired_url' | 'apply_control_visible'
  | 'insufficient_content' | 'listing_page' | 'no_apply_control'
  | 'fetch_failed';

export interface LivenessVerdict {
  url: string;
  result: LivenessResult;
  code: LivenessCode;
  httpStatus?: number;
  checkedAt: string; // ISO-8601
}

export interface LivenessCheckOptions {
  timeoutMs?: number;        // default 15000
  minContentLength?: number; // default 300
  proxies?: string[];
}

export interface LivenessBatchOptions extends LivenessCheckOptions {
  concurrency?: number; // default 5
  throttleMs?: number;  // jittered to [throttleMs, 2·throttleMs]
}

export interface ILivenessChecker {
  check(url: string, options?: LivenessCheckOptions): Promise<LivenessVerdict>;
  checkBatch(urls: string[], options?: LivenessBatchOptions): Promise<LivenessVerdict[]>;
}
```

### 7.2 Errors

There are no thrown errors — failures are encoded in the verdict:

| Code                    | Result      | Meaning                                              |
| ----------------------- | ----------- | ---------------------------------------------------- |
| `http_gone`             | `expired`   | HTTP 404 / 410                                       |
| `access_blocked`        | `uncertain` | HTTP 403 / 503 (likely anti-bot wall)                |
| `http_error`            | `uncertain` | other HTTP status ≥ 400                              |
| `fetch_failed`          | `uncertain` | network failure / timeout                            |
| `expired_url`           | `expired`   | post-redirect URL carries `error=true`               |
| `expired_text`          | `expired`   | hard-expired phrase found in body text               |
| `bot_challenge`         | `uncertain` | challenge interstitial detected                      |
| `apply_control_visible` | `active`    | apply control found in body text                     |
| `insufficient_content`  | `expired`   | plain text shorter than `minContentLength`           |
| `listing_page`          | `uncertain` | body looks like a multi-job listing page             |
| `no_apply_control`      | `uncertain` | substantial page, but no apply control found         |

### 7.3 Heuristic marker sets (case-insensitive)

- **Expired text** — EN: "job is no longer available" / "job no longer
  available", "position has been filled", "this job has expired",
  "no longer accepting applications", "applications are closed" /
  "applications have closed", "this posting has been closed";
  DE: "nicht mehr verfügbar", "bereits besetzt"; FR: "offre expirée",
  "n'est plus disponible" (straight or typographic apostrophe);
  ES: "ya no está disponible", "esta oferta ha expirado";
  PL: "oferta wygasła", "oferta jest nieaktualna".
- **Bot challenge** (matched on the raw lowercased HTML, since markers
  often live in `<title>`/script attributes): "just a moment",
  "verify you are a human" / "verify you are not a robot" /
  "verifying you are human", "performing security verification",
  "attention required" + "cloudflare", "cf-ray", "hcaptcha",
  "press and hold" + "human".
- **Apply control** — `\bapply\b`, "submit application",
  "start application", "easy apply", "solicitar", "bewerben",
  "postuler", "aplikuj", "wyślij cv", "wyślij aplikację".

## 8. Test Plan

- Unit (`liveness-heuristics.spec.ts`): at least one test per
  classification branch — every status bucket, the `error=true` URL
  marker, an expired page per language (EN, DE, FR, ES, PL), a
  challenge interstitial (short body — proves FR-8 ordering), an apply
  page (incl. a short apply page — proves apply beats short-content),
  non-English apply controls, a short dead body, a listing page, and
  the `no_apply_control` fallback. Priority-order locks (expired text
  beats apply control).
- Unit (`liveness-http.service.spec.ts`): mocked HTTP client — 404 →
  `expired`/`http_gone`, 403 → `uncertain`/`access_blocked`, network
  error → `uncertain`/`fetch_failed`, thrown axios-style error carrying
  `response.status`, happy active page, `error=true` redirect, and a
  `checkBatch` of ≥ 3 URLs (mixed outcomes incl. one rejection)
  preserving input order. DI resolution through
  `LIVENESS_CHECKER_TOKEN`.
- E2E: out of scope here (no live hosts in unit CI).
- Performance: heuristics are precompiled-regex pure functions; NFR-1
  is enforced by construction (no per-call regex compilation).

## 9. Open Questions

(none open — see § 10 Decisions.)

## 10. Decisions

- **D-01:** HTTP 403/503 are classified `uncertain`/`access_blocked`,
  never `expired` — anti-bot walls routinely answer with these codes
  for perfectly live postings (FR-2 / NFR-5).
- **D-02:** Bot-challenge detection runs on the raw lowercased HTML
  (not the plain text) because challenge markers commonly sit in
  `<title>` tags, script URLs and attributes that tag-stripping would
  discard.
- **D-03:** Bot-challenge detection precedes the short-content rule —
  challenge interstitials are short and would otherwise be
  misclassified as dead pages (FR-8).
- **D-04:** Non-2xx statuses are captured via a per-request
  `validateStatus: () => true` override instead of letting the HTTP
  client throw; the catch path still reads axios-style
  `err.response?.status` as a defensive fallback.
- **D-05:** `checkBatch` creates one shared HTTP client for the whole
  batch (proxy rotation stays meaningful) and uses a shared-cursor
  worker pool with `Promise.allSettled` so a poisoned URL can never
  nuke the batch.
- **D-06:** `insufficient_content` maps to `expired` (default
  `minContentLength` 300): server-rendered postings reliably exceed
  that; near-empty bodies on a 200 are overwhelmingly tombstone pages.
  Consumers that aggregate SPA-heavy boards can lower the threshold or
  treat the code specially.

## 11. References

- `packages/models/src/interfaces/dedup-engine.interface.ts` — token +
  interface contract style for feature plugins.
- `packages/plugins/dedup-hybrid/src/dedup-hybrid.module.ts` — DI-token
  binding pattern (`provide` + `useExisting`).
- `packages/common/src/http/http-client.ts` — HTTP client semantics
  (retry, proxy rotation, default UA, second-based constructor timeout).
- `packages/common/src/utils/html-utils.ts` — `htmlToPlainText`.
