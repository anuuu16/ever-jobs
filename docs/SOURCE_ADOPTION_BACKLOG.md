# Source Adoption Backlog

> Inbound queue of job-source platforms identified for adoption as Ever Jobs source
> plugins. Each entry becomes a `.specify/specs/<NNN>-source-<id>/` spec when we
> commit to building it.
>
> Do **not** add motivation or rationale here that references third-party tools.
> Adoption rationale (market share, public API stability, data quality) belongs
> in the per-spec `spec.md`.

## Status legend

- **proposed** — listed; no spec yet.
- **scoped** — a `spec.md` exists.
- **planned** — a `plan.md` and `tasks.md` exist.
- **in-progress** — code work has started.
- **shipped** — published and registered in `PluginRegistry`.

---

## Backlog

| Status     | Plugin id (planned)     | Category   | Platform / source                                   | Notes |
| ---------- | ----------------------- | ---------- | --------------------------------------------------- | ----- |
| proposed   | `source-ats-avature`    | `ats`      | **Avature** career-site platform.                   | Used by Bloomberg, IBM, and other large enterprises. URL pattern varies per tenant. |
| proposed   | `source-ats-gem`        | `ats`      | **Gem** ATS / recruiting CRM (`gem.com`).           | URL: `gem.com/<company-slug>/jobs`. |
| proposed   | `source-ats-joincom`    | `ats`      | **Join.com** ATS (`join.com/companies/<slug>/jobs`).| Public REST API. |
| proposed   | `source-ats-oracle`     | `ats`      | **Oracle HCM Cloud** Recruiting (`*.fa.<region>.oraclecloud.com`). | Distinct from `source-ats-taleo` (legacy Oracle). Some tenants need a `--site-number` param (`CX_45001`). |
| proposed   | `source-mercor`         | `niche`    | **Mercor** talent marketplace (`mercor.com`).       | Single-tenant — categorise as `niche` or `freelance`. |
| proposed   | `source-company-tesla`  | `company`  | **Tesla** careers site (reverse-engineered API).    | Single company-direct plugin. |

## Logic-improvement candidates (existing plugins)

| Status     | Plugin id              | Improvement                                                    |
| ---------- | ---------------------- | -------------------------------------------------------------- |
| proposed   | `@ever-jobs/common`    | European salary-format edge cases (e.g. `€179.600,00`, `R$ 1.234,56`, `$179.600.00`) — extend `extractSalary()` golden set and tighten `parseCurrency()` thousand-separator handling. |
| proposed   | `source-ats-workable`  | Audit recent upstream behaviour change in pagination/rate-limit handling — diff and absorb. |
| proposed   | `source-ats-workday`   | Add a search-URL discovery helper for tenants without a known career-site URL. |
| proposed   | `source-company-apple` | Adopt cache-manager + dedicated api-client decomposition for memory ergonomics. |
| proposed   | (seed lists)           | Refresh `COMPANY_SLUG_DIRECTORY.md` from latest public seed lists (Greenhouse ≥ 5 K, Lever ≥ 3.7 K, Workable ≥ 7.5 K, SmartRecruiters ≥ 0.8 K). |

## Conventions

- New ATS adopters MUST implement `IScraper` and decorate with
  `@SourcePlugin({ category: 'ats', isAts: true })`.
- New company-direct adopters use `category: 'company'`, `isAts: false`.
- Niche / talent-marketplace adopters use `category: 'niche'` or `freelance`.
- One spec per plugin (default) — if the user prefers a single bulk spec, see
  `docs/questions.md` Q-007.

---

_Last revised: 2026-04-26._
