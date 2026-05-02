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
| shipped    | `source-company-plaid`     | `company`  | **Plaid** (`plaid.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/plaid/jobs`). | Spec 030, run #240. Thin wrapper following the `source-company-lyft` pattern. |
| shipped    | `source-company-asana`     | `company`  | **Asana** (`asana.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/asana/jobs`). | Spec 031, run #241. Thin wrapper following the `source-company-plaid` pattern. |
| shipped    | `source-company-figma`     | `company`  | **Figma** (`figma.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/figma/jobs`). | Spec 032, run #242. Thin wrapper following the `source-company-asana` pattern. |
| shipped    | `source-company-gitlab`    | `company`  | **Gitlab** (`about.gitlab.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/gitlab/jobs`). | Spec 033, run #243. Thin wrapper following the `source-company-figma` pattern. |
| shipped    | `source-company-twitch`    | `company`  | **Twitch** (`twitch.tv`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/twitch/jobs`). | Spec 034, run #244. Thin wrapper following the `source-company-gitlab` pattern. |
| shipped    | `source-company-twilio`    | `company`  | **Twilio** (`twilio.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/twilio/jobs`). | Spec 035, run #245. Thin wrapper following the `source-company-twitch` pattern. |
| shipped    | `source-company-cloudflare`| `company`  | **Cloudflare** (`cloudflare.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/cloudflare/jobs`). | Spec 036, run #246. Thin wrapper following the `source-company-twilio` pattern. |
| shipped    | `source-company-mongodb`   | `company`  | **MongoDB** (`mongodb.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/mongodb/jobs`). | Spec 037, run #247. Thin wrapper following the `source-company-cloudflare` pattern. |
| shipped    | `source-company-datadog`   | `company`  | **Datadog** (`datadoghq.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/datadog/jobs`). | Spec 038, run #248. Thin wrapper following the `source-company-mongodb` pattern. |
| shipped    | `source-company-instacart` | `company`  | **Instacart** (`instacart.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/instacart/jobs`). | Spec 039, run #249. Thin wrapper following the `source-company-datadog` pattern. |
| shipped    | `source-company-dropbox`   | `company`  | **Dropbox** (`dropbox.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/dropbox/jobs`). | Spec 040, run #250. Thin wrapper following the `source-company-instacart` pattern. |
| shipped    | `source-company-roblox`    | `company`  | **Roblox** (`roblox.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/roblox/jobs`). | Spec 041, run #251. Thin wrapper following the `source-company-dropbox` pattern. |
| shipped    | `source-company-block`     | `company`  | **Block** (`block.xyz`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/block/jobs`). | Spec 042, run #252. Thin wrapper following the `source-company-roblox` pattern. |
| shipped    | `source-company-vercel`    | `company`  | **Vercel** (`vercel.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/vercel/jobs`). | Spec 043, run #253. Thin wrapper following the `source-company-block` pattern. |
| shipped    | `source-company-affirm`    | `company`  | **Affirm** (`affirm.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/affirm/jobs`). | Spec 044, run #254. Thin wrapper following the `source-company-vercel` pattern (second cohort member to use Greenhouse's new `job-boards.greenhouse.io` permalink subdomain). |
| shipped    | `source-company-klaviyo`   | `company`  | **Klaviyo** (`klaviyo.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/klaviyo/jobs`). | Spec 045, run #255. Thin wrapper following the `source-company-affirm` pattern with two D-04 / D-08 deviations: (a) `absolute_url` is a marketing-site proxy `klaviyo.com/careers/jobs?gh_jid=<id>` rather than a Greenhouse permalink subdomain (first cohort member), and (b) the description-cleanup pipeline runs `decodeHtmlEntities` before `stripHtmlTags` because this tenant emits entity-encoded content. |
| shipped    | `source-company-duolingo`  | `company`  | **Duolingo** (`duolingo.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/duolingo/jobs`). | Spec 046, run #256. Thin wrapper following the `source-company-klaviyo` pattern with one D-04 deviation: `absolute_url` is a marketing-site careers-subdomain proxy `careers.duolingo.com/jobs/<id>?gh_jid=<id>` (fourth distinct wire-shape variant — careers subdomain, path-AND-query). The D-08 entity-decode-then-tag-strip description pipeline is identical to Klaviyo's because Duolingo's `content` is also entity-encoded. |
| shipped    | `source-company-brex`      | `company`  | **Brex** (`brex.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/brex/jobs`). | Spec 047, run #257. Thin wrapper following the `source-company-duolingo` pattern with two D-04 / D-09 deviations: (a) `absolute_url` is an apex-www marketing-site proxy `www.brex.com/careers/<id>?gh_jid=<id>` (fifth distinct wire-shape variant — apex-www domain, path-AND-query), and (b) the wire `title` is `.trim()`ed before mapping (first cohort member to apply a wire-title trim — Brex's tenant pads some titles with surrounding ASCII spaces). The D-08 entity-decode-then-tag-strip description pipeline is identical to Klaviyo's and Duolingo's because Brex's `content` is also entity-encoded. |
| shipped    | `source-company-gusto`     | `company`  | **Gusto** (`gusto.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/gusto/jobs`). | Spec 048, run #258. Thin wrapper following the `source-company-affirm` pattern (third cohort member to use the new `job-boards.greenhouse.io` permalink subdomain — variant 2) with two D-08 / D-09 deviations: (a) the description-cleanup pipeline runs `decodeHtmlEntities` before `stripHtmlTags` because this tenant emits entity-encoded content (fourth cohort member after Klaviyo / Duolingo / Brex; first to combine the entity-decode pipeline with the new `job-boards.greenhouse.io` permalink subdomain), and (b) the emitted `companyName` pins the cleaned brand name `'Gusto'` rather than the wire `company_name` value `'Gusto, Inc.'` — same approach Affirm uses for `'Affirm Holdings, Inc.'`. |
| shipped    | `source-company-mercury`   | `company`  | **Mercury** (`mercury.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/mercury/jobs`). | Spec 049, run #259. Thin wrapper following the `source-company-gusto` pattern (fourth cohort member to use the new `job-boards.greenhouse.io` permalink subdomain — variant 2; second cohort member to combine variant 2 with the entity-decode-then-tag-strip description pipeline after Gusto). Sole structural deviation from the Gusto template is in D-09: Mercury's wire `company_name` is the bare brand name `'Mercury'` (no legal-entity suffix), so the brand-name pin matches the wire byte-for-byte. Discovered via the post-Spec-048 named-candidate well: a probe sweep of Stripe-adjacent fintechs (Mercury, Modern Treasury, Ramp), vertical SaaS (Notion, Linear, Loom, Front), and e-commerce (Shopify) returned HTTP 200 on `mercury` and `rampnetwork` (a different tenant: Ramp Network — Web3 fiat-to-crypto onramp, not Ramp Inc.); Mercury picked as the alphabetically-first bite, Ramp Network queued for a future run with a sixth wire-shape variant (`job-boards.eu.greenhouse.io` EU-region permalink subdomain). |
| shipped    | `source-company-buildkite` | `company`  | **Buildkite** (`buildkite.com`) — Greenhouse-hosted (`api.greenhouse.io/v1/boards/buildkite/jobs`). | Spec 050, run #260. Thin wrapper following the `source-company-mercury` pattern (fifth cohort member to use the new `job-boards.greenhouse.io` permalink subdomain — variant 2; third cohort member to combine variant 2 with the entity-decode-then-tag-strip description pipeline after Gusto and Mercury; sixth overall to use the entity-decode pipeline). Sole structural deviation from the Mercury template is in D-10: a `.trim()` on the wire `title` to handle a subset of Buildkite roles padded with trailing ASCII spaces (e.g. `'Staff Engineer - Compute & Agents '`, `'Staff GTM Engineer '`, `'Technical Account Manager '`). This is the **second** plugin in the cohort to apply a wire-title trim (after Brex). Discovered via a fresh probe sweep of developer-tools / SaaS candidates that returned HTTP 200 on **nine** slugs: `buildkite`, `circleci`, `hubspot`, `netlify`, `postman`, `rampnetwork` (carry-over), `toast`, `webflow`, and `zoominfo`. Buildkite picked as the alphabetically-first bite; the eight remaining candidates queue up for runs #261+. |

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

_Last revised: 2026-05-02 (run #260)._
