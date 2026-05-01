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

| Status     | Plugin id (planned)        | Category   | Platform / source                                   | Notes |
| ---------- | -------------------------- | ---------- | --------------------------------------------------- | ----- |
| proposed   | `source-ats-avature`       | `ats`      | **Avature** career-site platform.                   | Used by Bloomberg, IBM, and other large enterprises. URL pattern varies per tenant. |
| proposed   | `source-ats-gem`           | `ats`      | **Gem** ATS / recruiting CRM (`gem.com`).           | URL: `gem.com/<company-slug>/jobs`. |
| proposed   | `source-ats-joincom`       | `ats`      | **Join.com** ATS (`join.com/companies/<slug>/jobs`).| Public REST API. |
| proposed   | `source-ats-oracle`        | `ats`      | **Oracle HCM Cloud** Recruiting (`*.fa.<region>.oraclecloud.com`). | Distinct from `source-ats-taleo` (legacy Oracle). Some tenants need a `--site-number` param (`CX_45001`). |
| proposed   | `source-mercor`            | `niche`    | **Mercor** talent marketplace (`mercor.com`).       | Single-tenant — categorise as `niche` or `freelance`. |
| proposed   | `source-company-tesla`     | `company`  | **Tesla** careers site (reverse-engineered API).    | Single company-direct plugin. |
| shipped    | `source-company-anthropic` | `company`  | **Anthropic** (`anthropic.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/anthropic/jobs`). | Spec 020, run #230. Thin wrapper following the `source-company-stripe` pattern. |
| shipped    | `source-company-databricks`| `company`  | **Databricks** (`databricks.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/databricks/jobs`). | Spec 021, run #231. Thin wrapper following the `source-company-anthropic` pattern. |
| shipped    | `source-company-discord`   | `company`  | **Discord** (`discord.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/discord/jobs`). | Spec 022, run #232. Thin wrapper following the `source-company-databricks` pattern. |
| shipped    | `source-company-coinbase`  | `company`  | **Coinbase** (`coinbase.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/coinbase/jobs`). | Spec 023, run #233. Thin wrapper following the `source-company-discord` pattern. |
| shipped    | `source-company-doordash`  | `company`  | **DoorDash** (`doordash.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/doordash/jobs`). | Spec 024, run #234. Thin wrapper following the `source-company-coinbase` pattern. |
| shipped    | `source-company-airbnb`    | `company`  | **Airbnb** (`airbnb.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/airbnb/jobs`). | Spec 025, run #235. Thin wrapper following the `source-company-doordash` pattern. |
| shipped    | `source-company-robinhood` | `company`  | **Robinhood** (`robinhood.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/robinhoodjobs/jobs` — note: tenant slug is `robinhoodjobs`, not the bare `robinhood`). | Spec 026, run #236. Thin wrapper following the `source-company-airbnb` pattern. |
| shipped    | `source-company-reddit`    | `company`  | **Reddit** (`reddit.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/reddit/jobs`). | Spec 027, run #237. Thin wrapper following the `source-company-robinhood` pattern. |
| shipped    | `source-company-pinterest` | `company`  | **Pinterest** (`pinterest.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/pinterest/jobs`). | Spec 028, run #238. Thin wrapper following the `source-company-reddit` pattern. |
| shipped    | `source-company-lyft`      | `company`  | **Lyft** (`lyft.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/lyft/jobs`). | Spec 029, run #239. Thin wrapper following the `source-company-pinterest` pattern. |

## Logic-improvement candidates (existing plugins)

| Status     | Plugin id              | Improvement                                                    |
| ---------- | ---------------------- | -------------------------------------------------------------- |
| proposed   | `@ever-jobs/common`    | European salary-format edge cases (e.g. `€179.600,00`, `R$ 1.234,56`, `$179.600.00`) — extend `extractSalary()` golden set and tighten `parseCurrency()` thousand-separator handling. |
| proposed   | `source-ats-workable`  | Audit recent upstream behaviour change in pagination/rate-limit handling — diff and absorb. |
| proposed   | `source-ats-workday`   | Add a search-URL discovery helper for tenants without a known career-site URL. |
| proposed   | `source-company-apple` | Adopt cache-manager + dedicated api-client decomposition for memory ergonomics. |
| shipped    | (seed lists)           | ≥ 25 sampled per vendor (Greenhouse 53 / Lever 30 / Workable 27 / SmartRecruiters 29 — refreshed Spec 017 runs #71..#74). |

## Conventions

- New ATS adopters MUST implement `IScraper` and decorate with
  `@SourcePlugin({ category: 'ats', isAts: true })`.
- New company-direct adopters use `category: 'company'`, `isAts: false`.
- Niche / talent-marketplace adopters use `category: 'niche'` or `freelance`.
- One spec per plugin (default) — if the user prefers a single bulk spec, see
  `docs/questions.md` Q-007.

---

_Last revised: 2026-05-01 (run #239)._
