# Spec: 740 — Corpus Signals on the Public DTO (liveness + legitimacy)

| Field          | Value                              |
| -------------- | ---------------------------------- |
| Spec ID        | 740                                |
| Slug           | corpus-signals-dto                 |
| Status         | accepted                           |
| Owner          | agent                              |
| Created        | 2026-06-15                         |
| Last updated   | 2026-06-15                         |
| Supersedes     | (none)                             |
| Related specs  | 721 (liveness-http), 003 (deduplication-engine), 001 (plugin-architecture-foundation) |

## 1. Problem Statement

The Hust frontend (candidate-side, separate repo) consumes the Ever Jobs API and already renders
two corpus-level trust signals **forward-compatibly** — per-posting **liveness**
(`active|expired|uncertain`) and posting **legitimacy / ghost-job** risk
(`verified|likely|uncertain`). Today the Ever Jobs public `JobPostDto` emits **neither**:

- The **liveness-http** feature plugin (Spec 721) computes a per-URL verdict, but the verdict is
  not attached to the public DTO — it's an opt-in post-aggregation call with no API surface.
- **Legitimacy** detection does not exist at all.

So the corpus-level data those features need is not produced. This spec produces it: surface
liveness on the DTO, and add a `legitimacy-detector` feature plugin whose verdict is also surfaced
— both **opt-in** so the default response shape and latency are unchanged.

## 2. Goals

- Add optional `liveness` and `legitimacy` fields to the public `JobPostDto` (additive, nullable).
- Surface the existing **liveness-http** verdict on the DTO via an **opt-in** query flag.
- Add a new **`legitimacy-detector`** feature plugin (per Spec 001 plugin architecture) that scores
  posting legitimacy from corpus signals (source count, compensation presence, company metadata,
  description depth, off-platform redirect from liveness).
- Keep both **off by default**: `?liveness=true` / `?legitimacy=true` opt-in; no change to the
  default payload or latency.
- Match the exact field shapes Hust already consumes (forward-compatible — no client change needed).

## 3. Non-Goals

- Automatic/always-on liveness or legitimacy on every search (cost + latency) — opt-in only.
- A machine-learning legitimacy model — deterministic, explainable heuristics in v1.
- Persisting verdicts to the store (a later spec may cache them).
- Cross-source identity resolution beyond what the dedup engine (Spec 003) already provides.

## 4. User / Caller Stories

> As **Hust (an API consumer)**, I want each job to optionally carry `liveness` and `legitimacy`
> so that I can warn the candidate about dead listings and possible ghost jobs — **orthogonally to
> fit score** — without building corpus-level analysis myself.

> As an **API caller**, I want these signals **opt-in** so my default searches stay fast and cheap.

## 5. Functional Requirements

| ID    | Requirement                                                                                  | Priority |
| ----- | -------------------------------------------------------------------------------------------- | -------- |
| FR-1  | `JobPostDto` gains optional `liveness?: { state: 'active'\|'expired'\|'uncertain'; checkedAt?: string } \| null`. | must |
| FR-2  | `JobPostDto` gains optional `legitimacy?: { state: 'verified'\|'likely'\|'uncertain'; reasons?: string[] } \| null`. | must |
| FR-3  | `?liveness=true` triggers a post-aggregation `ILivenessChecker.checkBatch` over result URLs; verdicts mapped to `liveness`. | must |
| FR-4  | A new `ILegitimacyChecker` (token `LEGITIMACY_CHECKER`) + `legitimacy-detector` plugin computes a `LegitimacyVerdict`. | must |
| FR-5  | `?legitimacy=true` runs the detector over the result set; verdicts mapped to `legitimacy`. | must |
| FR-6  | Default responses (no flags) are byte-for-byte unchanged (both fields absent/undefined). | must |
| FR-7  | Legitimacy scoring is deterministic + explainable: each verdict carries human-readable `reasons[]`. | should |
| FR-8  | Liveness enrichment failures degrade gracefully (verdict `uncertain`, never abort the request). | must |

## 6. Non-Functional Requirements

| ID     | Requirement                            | Target            |
| ------ | -------------------------------------- | ----------------- |
| NFR-1  | Default-path latency (no flags)        | unchanged (0 added work) |
| NFR-2  | Legitimacy scoring is pure/in-memory   | < 1 ms per job    |
| NFR-3  | Liveness enrichment fan-out            | bounded concurrency (reuse 721 batch limits) |
| NFR-4  | No new always-on dependency            | detector is a feature plugin, DI-bound, toggleable |

## 7. Contracts

### 7.1 Interface

```ts
// packages/models/src/interfaces/legitimacy-checker.interface.ts
export const LEGITIMACY_CHECKER_TOKEN = 'LEGITIMACY_CHECKER';
export type LegitimacyState = 'verified' | 'likely' | 'uncertain';

export interface LegitimacyVerdict {
  state: LegitimacyState;
  reasons: string[];
  checkedAt: string;
}

export interface LegitimacyInput {
  hasCompensation: boolean;
  sourceCount: number;        // distinct sources observed (dedup engine)
  isFromAts: boolean;         // an ATS source is higher-trust
  hasCompanyLogo: boolean;
  descriptionLength: number;
  redirectsOffPlatform?: boolean; // from liveness 'expired_url' code
}

export interface ILegitimacyChecker {
  assess(input: LegitimacyInput): LegitimacyVerdict;          // pure
  assessBatch(inputs: LegitimacyInput[]): LegitimacyVerdict[];
}
```

### 7.2 DTO additions (additive, nullable)

```ts
liveness?: { state: 'active' | 'expired' | 'uncertain'; checkedAt?: string } | null;
legitimacy?: { state: 'verified' | 'likely' | 'uncertain'; reasons?: string[] } | null;
```

### 7.3 Errors

| Code             | Meaning                                   |
| ---------------- | ----------------------------------------- |
| (none new)       | Enrichment failures degrade to `uncertain`; never a request-level error. |

## 8. Test Plan

- **Unit:** `legitimacy-detector` scoring — verified (multi-source + comp + ATS), likely (single
  mild concern), uncertain (no comp + thin desc), off-platform-redirect → uncertain. Pure, table-driven.
- **Unit:** DTO shape — `liveness`/`legitimacy` optional, default-absent.
- **Integration:** controller with `?liveness=true` maps liveness-http verdicts onto the DTO;
  `?legitimacy=true` maps detector verdicts; both absent without flags.
- **E2E:** a search with `?legitimacy=true` returns `legitimacy` on each job; default search does not.

## 9. Open Questions

- Should legitimacy reuse the liveness `expired_url` redirect signal when `?liveness=true` is also
  set? (default — yes, fold it in when available; standalone otherwise.)
- Spec number 740 chosen to clear the hourly source-plugin allocation (last was 731). `(default — proceeding)`

## 10. Decisions

- Both signals are **opt-in** (query flags), preserving default payload + latency (FR-6, NFR-1).
- Legitimacy is **deterministic heuristics** in v1 (explainable `reasons[]`), not ML.
- Field shapes mirror exactly what Hust already consumes — zero client change.

## 11. References

- Spec 721 — liveness-http feature plugin (`ILivenessChecker`, `LivenessVerdict`).
- Spec 003 — deduplication engine (source-count / `SourceObservation[]`).
- Spec 001 — plugin architecture (feature-plugin pattern + DI tokens).
- Hust forward-compat consumer: `packages/jobs-api/src/types.ts` (`liveness`, `legitimacy`).
