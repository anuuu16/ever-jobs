# Spec: 720 — Workday: parse relative `postedOn` labels into ISO dates

| Field          | Value                                  |
| -------------- | -------------------------------------- |
| Spec ID        | 720                                    |
| Slug           | workday-relative-posted-dates          |
| Status         | done                                   |
| Owner          | agent                                  |
| Created        | 2026-06-11                             |
| Last updated   | 2026-06-11                             |
| Supersedes     | (none)                                 |
| Related specs  | (none)                                 |

## 1. Problem Statement

Workday's public job-list endpoint
(`/wday/cxs/{company}/{site}/jobs`) returns the `postedOn` field as a
**relative, human-readable label** — `"Posted Today"`, `"Posted
Yesterday"`, `"Posted 3 Days Ago"`, `"Posted 30+ Days Ago"` — not an
ISO date.

`WorkdayService.processListing`
(`packages/plugins/source-ats-workday/src/workday.service.ts`) feeds
that string straight into the JS `Date` constructor. For these labels
the result is an Invalid Date, `.toISOString()` throws a
`RangeError`, the surrounding `catch` falls back to the raw input,
and `JobPostDto.datePosted` ends up as the useless literal string
`"Posted 3 Days Ago"`. Downstream consumers (dedup, sorting,
freshness filters) receive a non-date value for **every** Workday
job.

## 2. Goals

- Convert relative Workday `postedOn` labels into calendar-correct
  ISO dates (`YYYY-MM-DD`) at scrape time.
- Provide the conversion as an exported **pure** helper,
  `parseWorkdayPostedOn(postedOn?, now?)`, that is deterministic
  under test via an injectable `now`.
- Stop emitting raw non-date labels in `datePosted` — unparseable
  input maps to `null`.
- Full branch-level unit coverage of the helper plus a service-level
  regression test of the `processListing` integration.

## 3. Non-Goals

- Fetching the per-job detail endpoint (`jobPostingInfo.postedOn`)
  to obtain exact dates — out of scope; list-endpoint only.
- Localised label variants (non-English tenants). Unrecognised
  labels degrade safely to `null`.
- Changing any other `JobPostDto` field emitted by the Workday
  plugin.

## 4. User / Caller Stories

> As an **aggregator caller**, I want **`datePosted` on Workday jobs
> to be a real ISO date or `null`**, so that **date-based sorting,
> deduplication and freshness filtering work instead of silently
> comparing strings like "Posted 3 Days Ago"**.

## 5. Functional Requirements

| ID    | Requirement                                                                                            | Priority |
| ----- | ------------------------------------------------------------------------------------------------------ | -------- |
| FR-1  | New exported pure helper `parseWorkdayPostedOn(postedOn?: string \| null, now?: Date): string \| null` in `workday.constants.ts`, `now` defaulting to the current time. | must |
| FR-2  | `"Posted Today"` → ISO date (`YYYY-MM-DD`) of `now`.                                                   | must     |
| FR-3  | `"Posted Yesterday"` → ISO date of `now` minus 1 day.                                                  | must     |
| FR-4  | `"Posted N Days Ago"` (N integer) → ISO date of `now` minus N days; `null` if the offset leaves the representable ECMAScript date range. | must |
| FR-5  | `"Posted N+ Days Ago"` (e.g. `"Posted 30+ Days Ago"`) → `null`.                                        | must     |
| FR-6  | Matching is case-insensitive and tolerant of extra/irregular whitespace.                               | must     |
| FR-7  | Any other string: ISO-shaped absolute date (`YYYY-MM-DD`, optional time part) → that calendar date as written; anything else — incl. non-ISO date formats, which `Date.parse` reads in host-local time — → `null`. | must |
| FR-8  | `null` / `undefined` / empty / whitespace-only input → `null`.                                          | must     |
| FR-9  | `processListing` uses the helper for `datePosted`; the raw-label fallback is removed.                  | must     |
| FR-10 | Unit tests cover every branch above with a fixed injected `now`.                                       | must     |

## 6. Non-Functional Requirements

| ID     | Requirement                                              | Target                       |
| ------ | -------------------------------------------------------- | ---------------------------- |
| NFR-1  | Helper is pure & synchronous (no I/O, no global state)   | deterministic given args     |
| NFR-2  | No new runtime dependencies                              | 0 added packages             |
| NFR-3  | Date arithmetic is UTC-based (no local-TZ drift in CI)   | same output on any host TZ   |

## 7. Contracts

### 7.1 API / Interface

```ts
/**
 * Parse Workday's relative `postedOn` label into an ISO date
 * (YYYY-MM-DD) or null when no calendar date can be derived.
 */
export function parseWorkdayPostedOn(
  postedOn?: string | null,
  now?: Date, // defaults to new Date()
): string | null;
```

### 7.2 Errors

The helper never throws; every input path resolves to a string or
`null`. In particular, relative offsets that would leave the
representable ECMAScript date range (e.g. `"Posted 999999999 Days
Ago"`) degrade to `null` rather than letting `.toISOString()` throw a
`RangeError`.

## 8. Test Plan

- Unit (`__tests__/workday.constants.spec.ts`): one case per branch —
  Today / Yesterday / `N Days Ago` (incl. singular `1 Day Ago` and
  month-boundary subtraction, out-of-range offset → null) /
  `N+ Days Ago` → null / absolute-date fallback (ISO date and ISO
  datetime → date as written; non-ISO date and impossible calendar
  date → null) / garbage string → null / null / undefined / empty /
  whitespace-only → null / case- and whitespace-tolerance. All with a
  fixed injected `now` (`2026-06-11T12:00:00Z`).
- Unit (`__tests__/workday.service.spec.ts`): mocked HTTP post
  returning ≥ 3 listings with relative labels; asserts `datePosted`
  is an ISO date or `null`, never the raw label; plus DI scaffolding
  and error-path checks.
- E2E / Performance: n/a (pure function + existing scrape path).

## 9. Open Questions

(none open — see § 10 Decisions.)

## 10. Decisions

- **D-01 (2026-06-11):** `"Posted N+ Days Ago"` maps to `null`, not
  `now − N` days. The label is a lower bound only ("30 or more days
  ago"); emitting `now − 30d` would fabricate precision the source
  never provided. `null` is the honest value.
- **D-02 (2026-06-11):** Unrecognised strings that also fail
  `Date.parse` map to `null` instead of being passed through
  verbatim. The previous raw-label passthrough was a bug (an
  exception fallback), not behaviour to preserve — this is a
  **deliberate breaking fix**: consumers that previously received
  `"Posted 3 Days Ago"` in `datePosted` now receive a real ISO date,
  and ones that received other non-date labels now receive `null`.
- **D-03 (2026-06-11):** Day arithmetic uses UTC millisecond offsets
  from the injected `now` and `toISOString()` slicing, so results are
  identical regardless of host timezone or DST.
- **D-04 (2026-06-11):** Helper lives in `workday.constants.ts`
  beside the existing pure helpers (`parseWorkdaySlug`,
  `buildWorkdayUrl`); no new file needed for one function.
- **D-05 (2026-06-11):** The FR-7 absolute-date fallback accepts only
  ISO-shaped input (`YYYY-MM-DD`, optional time part) and returns the
  calendar date as written. The original unrestricted `Date.parse`
  fallback violated NFR-1/NFR-3: non-ISO strings are parsed in
  host-**local** time (verified: under `TZ=Pacific/Kiritimati`,
  `"May 20, 2026"` yielded `2026-05-19`). Calendar validity is checked
  via a UTC component round-trip, rejecting rollovers such as
  `2026-02-30` (which V8's legacy parser would otherwise roll into
  March, also in local time).
- **D-06 (2026-06-11):** `toIsoDate` guards `Number.isNaN(getTime())`
  and returns `null` for Invalid Dates, so the § 7.2 never-throws
  contract holds even for pathological labels like
  `"Posted 999999999 Days Ago"` (which previously escaped as a
  `RangeError` from `.toISOString()`).

## 11. References

- `packages/plugins/source-ats-workday/src/workday.service.ts` —
  `processListing`, `datePosted` block (the bug site).
- `packages/plugins/source-ats-workday/src/workday.constants.ts` —
  existing pure-helper home.
- `packages/plugins/source-ats-workday/src/workday.types.ts` —
  `WorkdayJobListItem.postedOn` wire shape.
