# Spec 139 — Source Company Plugin: Bloomreach

## 1. Summary

Ship a `source-company-bloomreach` plugin that pulls job listings
from Bloomreach's Greenhouse-hosted board at
`api.greenhouse.io/v1/boards/bloomreach/jobs?content=true` and emits
`JobPostDto[]` via the standard `IScraper` contract.

## 2. Background

Bloomreach (`bloomreach.com`) is a US-headquartered ecommerce-AI
platform — combining commerce-experience cloud, content-management,
discovery / search, marketing-automation, and customer-data — used
by retailers and consumer-brands for personalisation across the
mortgage / finance / consumer-goods / B2C-retail vertical. Bloomreach
publishes its consolidated careers board through Greenhouse at the
bare slug `bloomreach` (case-symmetric with the wire
`company_name === 'Bloomreach'`).

## 3. Closest cousin & deviations

Closest cousin: **Doximity (Spec 127)** — variant 2, D-08, D-09
case-symmetric bare-brand, D-10 applied (trailing-pad form), D-11
omitted (clean dept pass-through).

**Zero structural deviations.** Thirty-fifth Greenhouse-only
company-direct plugin in run history to ship as a clean re-spin.

**Notable sub-axis observation under D-10**: 1 of the 10 padded
titles carries a **mojibake-double-encoded NBSP trailing-pad
sequence** (`c3 82 c2 a0` bytes — `'Senior Security & Compliance
Analyst Â '` — wire-side double-encoding of U+00A0 NBSP).
**First cohort observation** of mojibake-NBSP pad form across 57
prior D-10-applying plugins. JavaScript `.trim()` strips the
trailing NBSP (U+00A0 is in `WhiteSpace`); the mojibake `Â`
(U+00C2) byte remains by-design — wire-faithful pass-through.

## 4. Cohort decoration axes

* **D-04** — variant 2 (canonical Greenhouse host
  `https://job-boards.greenhouse.io/bloomreach/jobs/<id>`).
  **Fifty-third** plugin in cohort to use variant 2.
* **D-08** — entity-decode-then-tag-strip description pipeline.
  **Ninety-fifth** cohort plugin to apply D-08.
* **D-09** — brand-name trim omitted (case-symmetric). Wire
  `company_name === 'Bloomreach'` byte-for-byte (10 bytes; case-
  symmetric vs the lowercase 10-byte slug `bloomreach`).
  **Eighty-sixth cohort plugin to omit D-09**.
* **D-10** — wire-title `.trim()` applied (trailing-pad form).
  10 of 78 wire titles padded (~12.8 % pad rate). **Fifty-eighth
  cohort plugin to apply D-10**. **First cohort observation of
  mojibake-NBSP trailing-pad** (1 sample carries `c3 82 c2 a0`
  byte-sequence — double-UTF-8-encoded NBSP).
* **D-11** — wire-dept `.trim()` omitted. 0 of 76 wire departments
  padded across 8 unique department names (`'Engineering'`, `'G&A
  - FLS'`, `'G&A - GIST'`, `'G&A - People'`, `'Marketing'`,
  `'Operations'`, `'Product'`, `'Revenue'` — clean multi-token
  forms). **Seventy-sixth cohort plugin** with fully-clean
  department pass-through.

## 5. FRs

1. Resolve `BlendService`-equivalent through `BloomreachModule`
   via NestJS DI.
2. Export `Site.BLOOMREACH = 'bloomreach'`.
3. Implement `IScraper.scrape(input)` → `JobResponseDto`.
4. Map wire fields to `JobPostDto`:
   * `id` → `blend-…`-style: `bloomreach-${listing.id}`.
   * `site` → `Site.BLOOMREACH`.
   * `title` → `listing.title.trim()`.
   * `companyName` → `'Bloomreach'`.
   * `jobUrl` → `listing.absolute_url` (variant 2 canonical host).
   * `location` → `LocationDto({ city: listing.location.name })`.
   * `description` → `stripHtmlTags(decodeHtmlEntities(listing.content))`.
   * `datePosted` → `listing.updated_at`.
   * `isRemote` → `location.name.toLowerCase().includes('remote')`.
   * `department` → `listing.departments[0].name` (no trim).
5. Honour `resultsWanted`, `searchTerm` (title + dept substring,
   case-insensitive), `location` substring filter, `proxies`,
   `requestTimeout`.
6. Catch all errors → empty `JobResponseDto`, never throw.
7. Log via `@nestjs/common` `Logger`.
8. Emit > 8 unit tests including:
   * NestJS DI resolution lock,
   * `Site.BLOOMREACH === 'bloomreach'` enum lock,
   * happy-path 2-listing map,
   * **D-10 trailing-pad lock**,
   * **D-09 case-symmetric lock**,
   * **D-11 clean-dept pass-through lock**,
   * `resultsWanted=1` cap,
   * `searchTerm` substring filter,
   * HTTP 500 → empty,
   * empty payload → empty.

## 6. Out-of-scope

* Per-job content endpoint hits (`?content=true` already returns
  HTML on the listing page; no second-fetch needed).
* The mojibake `Â` byte left over after the trim is **NOT**
  separately stripped — wire-faithful. (If downstream display
  layer wants to clean this, it should be a separate
  normalisation pass; the scrape layer's contract is to preserve
  wire content modulo HTML decoding.)

## 7. Run history pin

Run #349 — fifth plugin in the **ninth fresh probe sweep** after
Axon (run #345), BEAM (run #346), BigID (run #347), Blend (run
#348). Twelve more candidates queued for runs #350+ in
alphabetical order: `celonis`, `complyadvantage`, `conviva`,
`cribl`, `earnest`, `expressvpn`, `fairmarkit`, `formlabs`,
`founders`, `fox`, `gocardless`, `gofundme`.

## 8. Test count requirement

**>= 8 mandated** — see §5.8. Current spec emits **8 cases**.
