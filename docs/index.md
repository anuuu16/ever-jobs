# Documentation Index — Ever Jobs

> Auto-maintained index of every document under `docs/` and `.specify/`.
> Update this file whenever a doc is added, renamed, or removed.

## 0. Top-of-Repo Pointers

| File             | Purpose                                                   |
| ---------------- | --------------------------------------------------------- |
| [`/AGENTS.md`](../AGENTS.md)             | Authoritative rules for AI coding agents.   |
| [`/CLAUDE.md`](../CLAUDE.md)             | Claude-specific operating notes.            |
| [`/README.md`](../README.md)             | Public-facing project overview.             |
| [`/CHANGELOG.md`](../CHANGELOG.md)       | Release-level changelog (semver).           |
| [`/CONTRIBUTING.md`](../CONTRIBUTING.md) | Human contributor guide.                    |
| [`/tool_manifest.json`](../tool_manifest.json) | Machine-readable API/source manifest. |

## 1. Operational Logs (this folder)

| File            | Purpose                                                     |
| --------------- | ----------------------------------------------------------- |
| [`index.md`](./index.md)         | This index.                                |
| [`log.md`](./log.md)             | Append-only changelog of doc/spec edits.   |
| [`questions.md`](./questions.md) | Open questions ledger w/ defaults.         |

## 2. Architecture & Reference

| File                                           | Purpose                                  |
| ---------------------------------------------- | ---------------------------------------- |
| [`ARCHITECTURE_OVERVIEW.md`](./ARCHITECTURE_OVERVIEW.md) | High-level system architecture. |
| [`PLUGIN_ARCHITECTURE.md`](./PLUGIN_ARCHITECTURE.md)     | Plugin discovery & registry model. |
| [`API_CHANGELOG.md`](./API_CHANGELOG.md)                 | API endpoint history.            |
| [`ATS_INTEGRATIONS.md`](./ATS_INTEGRATIONS.md)           | ATS plugin coverage.             |
| [`COMPANY_SLUG_DIRECTORY.md`](./COMPANY_SLUG_DIRECTORY.md) | Slug catalogue for ATS.        |
| [`GLOSSARY.md`](./GLOSSARY.md)                           | Domain terminology.              |
| [`FAQ.md`](./FAQ.md)                                     | Frequently asked questions.      |
| [`AUTHENTICATION.md`](./AUTHENTICATION.md)               | API-key & auth model.            |
| [`SECURITY_GUIDELINES.md`](./SECURITY_GUIDELINES.md)     | Security baseline.               |
| [`PERFORMANCE_TUNING.md`](./PERFORMANCE_TUNING.md)       | Performance knobs.               |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md)                       | Docker / deployment.             |
| [`UPGRADE_GUIDE.md`](./UPGRADE_GUIDE.md)                 | Version-to-version upgrade path. |
| [`CLI.md`](./CLI.md)                                     | CLI command reference.           |

## 3. Roadmap & Product

| File                                | Purpose                                           |
| ----------------------------------- | ------------------------------------------------- |
| [`ROADMAP.md`](./ROADMAP.md)        | Feature roadmap by version.                       |
| [`PRD_NEW_JOB_SOURCES.md`](./PRD_NEW_JOB_SOURCES.md) | Product reqs for new sources.    |
| [`SOURCE_ADOPTION_BACKLOG.md`](./SOURCE_ADOPTION_BACKLOG.md) | Inbound queue of platforms to adopt as source plugins. |

## 4. Plans (`docs/plans/`)

| File | Purpose |
| ---- | ------- |
| _none yet_ | Plans will be added as new specs ship. |

## 5. ADRs (`docs/adr/`)

| File | Purpose |
| ---- | ------- |
| _none yet_ | Architectural decision records will land here. |

## 6. Runbooks (`docs/runbooks/`)

| File | Purpose |
| ---- | ------- |
| _none yet_ | Operational runbooks will land here. |

## 7. Specs (`.specify/specs/`)

| ID  | Title                                       | Status   |
| --- | ------------------------------------------- | -------- |
| 001 | [Plugin Architecture Foundation](../.specify/specs/001-plugin-architecture-foundation/spec.md) — [plan](../.specify/specs/001-plugin-architecture-foundation/plan.md) — [tasks](../.specify/specs/001-plugin-architecture-foundation/tasks.md) | done (retroactive); FR-6 in-progress |
| 002 | [Documentation & Spec-Kit Bootstrap](../.specify/specs/002-docs-and-spec-kit-bootstrap/spec.md) — [plan](../.specify/specs/002-docs-and-spec-kit-bootstrap/plan.md) — [tasks](../.specify/specs/002-docs-and-spec-kit-bootstrap/tasks.md) | All phases done (T01–T12); doc-lint live in CI run #9 |
| 003 | [Job Deduplication Engine](../.specify/specs/003-deduplication-engine/spec.md) — [plan](../.specify/specs/003-deduplication-engine/plan.md) — [tasks](../.specify/specs/003-deduplication-engine/tasks.md) | All phases done (T01–T15); GraphQL parity shipped run #8 |
| 004 | [Persistence & Storage Plugins](../.specify/specs/004-persistence-storage-plugins/spec.md) — [plan](../.specify/specs/004-persistence-storage-plugins/plan.md) — [tasks](../.specify/specs/004-persistence-storage-plugins/tasks.md) | All phases done (T01 run #17, T02 run #18, T03 run #19, T04 run #20, T05+T06 run #21, T07+T08 run #22, T09 run #23, T10 run #24, T11 run #25, T12 run #26); spec complete |
| 005 | [Source Health & Circuit Breaker](../.specify/specs/005-source-health-circuit-breaker/spec.md) — [plan](../.specify/specs/005-source-health-circuit-breaker/plan.md) — [tasks](../.specify/specs/005-source-health-circuit-breaker/tasks.md) | All phases done (T01–T08 runs #10–#16; T09 run #27); spec complete |
| 006 | [ATS-Scrapers Parity, Batch 1 (Avature / Gem / Join.com)](../.specify/specs/006-ats-scrapers-parity-batch-1/spec.md) — [plan](../.specify/specs/006-ats-scrapers-parity-batch-1/plan.md) — [tasks](../.specify/specs/006-ats-scrapers-parity-batch-1/tasks.md) | All phases done (T01..T13 runs #29..#36); spec complete |
| 012 | [European-style Salary Parser](../.specify/specs/012-european-salary-parser/spec.md) — [plan](../.specify/specs/012-european-salary-parser/plan.md) — [tasks](../.specify/specs/012-european-salary-parser/tasks.md) | All phases done (T01..T05 runs #38..#42); spec complete |
| 013 | [ATS-Scrapers Parity, Batch 2 (Oracle HCM Cloud / Mercor / Tesla)](../.specify/specs/013-ats-scrapers-parity-batch-2/spec.md) — [plan](../.specify/specs/013-ats-scrapers-parity-batch-2/plan.md) — [tasks](../.specify/specs/013-ats-scrapers-parity-batch-2/tasks.md) | All phases done (T01..T15 runs #44..#58); spec complete |
| 014 | [Salary Parser Residuals (`$` symbol / Swiss apostrophe / bare-number country fallback)](../.specify/specs/014-salary-parser-residuals/spec.md) — [plan](../.specify/specs/014-salary-parser-residuals/plan.md) — [tasks](../.specify/specs/014-salary-parser-residuals/tasks.md) | All phases done (T01..T05 runs #60..#64); T04 closed via Spec 015 (runs #65..#68) |
| 015 | [Salary Parser Locale & Prose Immunity (`resolveSalaryLocale` symbol-tier short-circuit / bare-path raw-value pre-check)](../.specify/specs/015-salary-parser-locale-and-prose-immunity/spec.md) — [plan](../.specify/specs/015-salary-parser-locale-and-prose-immunity/plan.md) — [tasks](../.specify/specs/015-salary-parser-locale-and-prose-immunity/tasks.md) | All phases done (T01..T03 runs #65..#68); spec complete |
| 016 | [`helpers.bench.spec.ts` TS1127 fix (`×` U+00D7 → ASCII `x` in template literal)](../.specify/specs/016-bench-file-ts1127-fix/spec.md) — [plan](../.specify/specs/016-bench-file-ts1127-fix/plan.md) — [tasks](../.specify/specs/016-bench-file-ts1127-fix/tasks.md) | All phases done (T01 run #69); spec complete — bench p95 baseline = 0.0174 ms |
| 017 | [Seed-Companies Slug Directory Refresh — Batch 1 (Greenhouse / Lever / Workable / SmartRecruiters)](../.specify/specs/017-seed-companies-refresh-batch-1/spec.md) — [plan](../.specify/specs/017-seed-companies-refresh-batch-1/plan.md) — [tasks](../.specify/specs/017-seed-companies-refresh-batch-1/tasks.md) | All phases done (T01..T05 runs #71..#75); spec complete |
| 018 | [Workable Upstream Parity (`workable/main.py` @ commit `312c7b6` diff against `source-ats-workable` plugin)](../.specify/specs/018-workable-upstream-parity/spec.md) — [plan](../.specify/specs/018-workable-upstream-parity/plan.md) — [tasks](../.specify/specs/018-workable-upstream-parity/tasks.md) | All phases done (T01 run #77); spec complete |
| 019 | [Salary Parser Residuals, Batch 2 (bare-path raw-value pre-check threshold bump — closes Spec 015 / FR-8 documented limitation)](../.specify/specs/019-salary-parser-residuals-batch-2/spec.md) — [plan](../.specify/specs/019-salary-parser-residuals-batch-2/plan.md) — [tasks](../.specify/specs/019-salary-parser-residuals-batch-2/tasks.md) | All phases done (T01..T03 runs #79..#81); spec complete |
| 020 | [Source Company Plugin: Anthropic](../.specify/specs/020-source-company-anthropic/spec.md) — [plan](../.specify/specs/020-source-company-anthropic/plan.md) — [tasks](../.specify/specs/020-source-company-anthropic/tasks.md) | All phases done (T01..T05 run #230); spec complete |
| 021 | [Source Company Plugin: Databricks](../.specify/specs/021-source-company-databricks/spec.md) — [plan](../.specify/specs/021-source-company-databricks/plan.md) — [tasks](../.specify/specs/021-source-company-databricks/tasks.md) | All phases done (T01..T05 run #231); spec complete |
| 022 | [Source Company Plugin: Discord](../.specify/specs/022-source-company-discord/spec.md) — [plan](../.specify/specs/022-source-company-discord/plan.md) — [tasks](../.specify/specs/022-source-company-discord/tasks.md) | All phases done (T01..T05 run #232); spec complete |
| 023 | [Source Company Plugin: Coinbase](../.specify/specs/023-source-company-coinbase/spec.md) — [plan](../.specify/specs/023-source-company-coinbase/plan.md) — [tasks](../.specify/specs/023-source-company-coinbase/tasks.md) | All phases done (T01..T05 run #233); spec complete |
| 024 | [Source Company Plugin: DoorDash](../.specify/specs/024-source-company-doordash/spec.md) — [plan](../.specify/specs/024-source-company-doordash/plan.md) — [tasks](../.specify/specs/024-source-company-doordash/tasks.md) | All phases done (T01..T05 run #234); spec complete |
| 025 | [Source Company Plugin: Airbnb](../.specify/specs/025-source-company-airbnb/spec.md) — [plan](../.specify/specs/025-source-company-airbnb/plan.md) — [tasks](../.specify/specs/025-source-company-airbnb/tasks.md) | All phases done (T01..T05 run #235); spec complete |
| 026 | [Source Company Plugin: Robinhood](../.specify/specs/026-source-company-robinhood/spec.md) — [plan](../.specify/specs/026-source-company-robinhood/plan.md) — [tasks](../.specify/specs/026-source-company-robinhood/tasks.md) | All phases done (T01..T05 run #236); spec complete |
| 027 | [Source Company Plugin: Reddit](../.specify/specs/027-source-company-reddit/spec.md) — [plan](../.specify/specs/027-source-company-reddit/plan.md) — [tasks](../.specify/specs/027-source-company-reddit/tasks.md) | All phases done (T01..T05 run #237); spec complete |
| 028 | [Source Company Plugin: Pinterest](../.specify/specs/028-source-company-pinterest/spec.md) — [plan](../.specify/specs/028-source-company-pinterest/plan.md) — [tasks](../.specify/specs/028-source-company-pinterest/tasks.md) | All phases done (T01..T05 run #238); spec complete |
| 029 | [Source Company Plugin: Lyft](../.specify/specs/029-source-company-lyft/spec.md) — [plan](../.specify/specs/029-source-company-lyft/plan.md) — [tasks](../.specify/specs/029-source-company-lyft/tasks.md) | All phases done (T01..T05 run #239); spec complete |
| 030 | [Source Company Plugin: Plaid](../.specify/specs/030-source-company-plaid/spec.md) — [plan](../.specify/specs/030-source-company-plaid/plan.md) — [tasks](../.specify/specs/030-source-company-plaid/tasks.md) | All phases done (T01..T05 run #240); spec complete |
| 031 | [Source Company Plugin: Asana](../.specify/specs/031-source-company-asana/spec.md) — [plan](../.specify/specs/031-source-company-asana/plan.md) — [tasks](../.specify/specs/031-source-company-asana/tasks.md) | All phases done (T01..T05 run #241); spec complete |
| 032 | [Source Company Plugin: Figma](../.specify/specs/032-source-company-figma/spec.md) — [plan](../.specify/specs/032-source-company-figma/plan.md) — [tasks](../.specify/specs/032-source-company-figma/tasks.md) | All phases done (T01..T05 run #242); spec complete |
| 033 | [Source Company Plugin: Gitlab](../.specify/specs/033-source-company-gitlab/spec.md) — [plan](../.specify/specs/033-source-company-gitlab/plan.md) — [tasks](../.specify/specs/033-source-company-gitlab/tasks.md) | All phases done (T01..T05 run #243); spec complete |
| 034 | [Source Company Plugin: Twitch](../.specify/specs/034-source-company-twitch/spec.md) — [plan](../.specify/specs/034-source-company-twitch/plan.md) — [tasks](../.specify/specs/034-source-company-twitch/tasks.md) | All phases done (T01..T05 run #244); spec complete |
| 035 | [Source Company Plugin: Twilio](../.specify/specs/035-source-company-twilio/spec.md) — [plan](../.specify/specs/035-source-company-twilio/plan.md) — [tasks](../.specify/specs/035-source-company-twilio/tasks.md) | All phases done (T01..T05 run #245); spec complete |
| 036 | [Source Company Plugin: Cloudflare](../.specify/specs/036-source-company-cloudflare/spec.md) — [plan](../.specify/specs/036-source-company-cloudflare/plan.md) — [tasks](../.specify/specs/036-source-company-cloudflare/tasks.md) | All phases done (T01..T05 run #246); spec complete |
| 037 | [Source Company Plugin: MongoDB](../.specify/specs/037-source-company-mongodb/spec.md) — [plan](../.specify/specs/037-source-company-mongodb/plan.md) — [tasks](../.specify/specs/037-source-company-mongodb/tasks.md) | All phases done (T01..T05 run #247); spec complete |
| 038 | [Source Company Plugin: Datadog](../.specify/specs/038-source-company-datadog/spec.md) — [plan](../.specify/specs/038-source-company-datadog/plan.md) — [tasks](../.specify/specs/038-source-company-datadog/tasks.md) | All phases done (T01..T05 run #248); spec complete |
| 039 | [Source Company Plugin: Instacart](../.specify/specs/039-source-company-instacart/spec.md) — [plan](../.specify/specs/039-source-company-instacart/plan.md) — [tasks](../.specify/specs/039-source-company-instacart/tasks.md) | All phases done (T01..T05 run #249); spec complete |
| 040 | [Source Company Plugin: Dropbox](../.specify/specs/040-source-company-dropbox/spec.md) — [plan](../.specify/specs/040-source-company-dropbox/plan.md) — [tasks](../.specify/specs/040-source-company-dropbox/tasks.md) | All phases done (T01..T05 run #250); spec complete |
| 041 | [Source Company Plugin: Roblox](../.specify/specs/041-source-company-roblox/spec.md) — [plan](../.specify/specs/041-source-company-roblox/plan.md) — [tasks](../.specify/specs/041-source-company-roblox/tasks.md) | All phases done (T01..T05 run #251); spec complete |
| 042 | [Source Company Plugin: Block](../.specify/specs/042-source-company-block/spec.md) — [plan](../.specify/specs/042-source-company-block/plan.md) — [tasks](../.specify/specs/042-source-company-block/tasks.md) | All phases done (T01..T05 run #252); spec complete |
| 043 | [Source Company Plugin: Vercel](../.specify/specs/043-source-company-vercel/spec.md) — [plan](../.specify/specs/043-source-company-vercel/plan.md) — [tasks](../.specify/specs/043-source-company-vercel/tasks.md) | All phases done (T01..T05 run #253); spec complete |
| 044 | [Source Company Plugin: Affirm](../.specify/specs/044-source-company-affirm/spec.md) — [plan](../.specify/specs/044-source-company-affirm/plan.md) — [tasks](../.specify/specs/044-source-company-affirm/tasks.md) | All phases done (T01..T05 run #254); spec complete |
| 045 | [Source Company Plugin: Klaviyo](../.specify/specs/045-source-company-klaviyo/spec.md) — [plan](../.specify/specs/045-source-company-klaviyo/plan.md) — [tasks](../.specify/specs/045-source-company-klaviyo/tasks.md) | All phases done (T01..T05 run #255); spec complete |
| 046 | [Source Company Plugin: Duolingo](../.specify/specs/046-source-company-duolingo/spec.md) — [plan](../.specify/specs/046-source-company-duolingo/plan.md) — [tasks](../.specify/specs/046-source-company-duolingo/tasks.md) | All phases done (T01..T05 run #256); spec complete |
| 047 | [Source Company Plugin: Brex](../.specify/specs/047-source-company-brex/spec.md) — [plan](../.specify/specs/047-source-company-brex/plan.md) — [tasks](../.specify/specs/047-source-company-brex/tasks.md) | All phases done (T01..T05 run #257); spec complete |
| 048 | [Source Company Plugin: Gusto](../.specify/specs/048-source-company-gusto/spec.md) — [plan](../.specify/specs/048-source-company-gusto/plan.md) — [tasks](../.specify/specs/048-source-company-gusto/tasks.md) | All phases done (T01..T05 run #258); spec complete |
| 049 | [Source Company Plugin: Mercury](../.specify/specs/049-source-company-mercury/spec.md) — [plan](../.specify/specs/049-source-company-mercury/plan.md) — [tasks](../.specify/specs/049-source-company-mercury/tasks.md) | All phases done (T01..T05 run #259); spec complete |
| 050 | [Source Company Plugin: Buildkite](../.specify/specs/050-source-company-buildkite/spec.md) — [plan](../.specify/specs/050-source-company-buildkite/plan.md) — [tasks](../.specify/specs/050-source-company-buildkite/tasks.md) | All phases done (T01..T05 run #260); spec complete |
| 051 | [Source Company Plugin: CircleCI](../.specify/specs/051-source-company-circleci/spec.md) — [plan](../.specify/specs/051-source-company-circleci/plan.md) — [tasks](../.specify/specs/051-source-company-circleci/tasks.md) | All phases done (T01..T05 run #261); spec complete |
| 052 | [Source Company Plugin: Ramp Network](../.specify/specs/052-source-company-rampnetwork/spec.md) — [plan](../.specify/specs/052-source-company-rampnetwork/plan.md) — [tasks](../.specify/specs/052-source-company-rampnetwork/tasks.md) | All phases done (T01..T05 run #262); spec complete |
| 053 | [Source Company Plugin: Netlify](../.specify/specs/053-source-company-netlify/spec.md) — [plan](../.specify/specs/053-source-company-netlify/plan.md) — [tasks](../.specify/specs/053-source-company-netlify/tasks.md) | All phases done (T01..T05 run #263); spec complete |
| 054 | [Source Company Plugin: Postman](../.specify/specs/054-source-company-postman/spec.md) — [plan](../.specify/specs/054-source-company-postman/plan.md) — [tasks](../.specify/specs/054-source-company-postman/tasks.md) | All phases done (T01..T05 run #264); spec complete |
| 055 | [Source Company Plugin: Toast](../.specify/specs/055-source-company-toast/spec.md) — [plan](../.specify/specs/055-source-company-toast/plan.md) — [tasks](../.specify/specs/055-source-company-toast/tasks.md) | All phases done (T01..T05 run #265); spec complete |
| 056 | [Source Company Plugin: Webflow](../.specify/specs/056-source-company-webflow/spec.md) — [plan](../.specify/specs/056-source-company-webflow/plan.md) — [tasks](../.specify/specs/056-source-company-webflow/tasks.md) | All phases done (T01..T05 run #266); spec complete |
| 057 | [Source Company Plugin: ZoomInfo](../.specify/specs/057-source-company-zoominfo/spec.md) — [plan](../.specify/specs/057-source-company-zoominfo/plan.md) — [tasks](../.specify/specs/057-source-company-zoominfo/tasks.md) | All phases done (T01..T05 run #267); spec complete |
| 058 | [Source Company Plugin: Attentive](../.specify/specs/058-source-company-attentive/spec.md) — [plan](../.specify/specs/058-source-company-attentive/plan.md) — [tasks](../.specify/specs/058-source-company-attentive/tasks.md) | All phases done (T01..T05 run #268); spec complete |
| 059 | [Source Company Plugin: Chime](../.specify/specs/059-source-company-chime/spec.md) — [plan](../.specify/specs/059-source-company-chime/plan.md) — [tasks](../.specify/specs/059-source-company-chime/tasks.md) | All phases done (T01..T05 run #269); spec complete |
| 060 | [Source Company Plugin: Elastic](../.specify/specs/060-source-company-elastic/spec.md) — [plan](../.specify/specs/060-source-company-elastic/plan.md) — [tasks](../.specify/specs/060-source-company-elastic/tasks.md) | All phases done (T01..T05 run #270); spec complete |
| 061 | [Source Company Plugin: Intercom](../.specify/specs/061-source-company-intercom/spec.md) — [plan](../.specify/specs/061-source-company-intercom/plan.md) — [tasks](../.specify/specs/061-source-company-intercom/tasks.md) | All phases done (T01..T05 run #271); spec complete |
| 062 | [Source Company Plugin: Mixpanel](../.specify/specs/062-source-company-mixpanel/spec.md) — [plan](../.specify/specs/062-source-company-mixpanel/plan.md) — [tasks](../.specify/specs/062-source-company-mixpanel/tasks.md) | All phases done (T01..T05 run #272); spec complete |
| 063 | [Source Company Plugin: Faire](../.specify/specs/063-source-company-faire/spec.md) — [plan](../.specify/specs/063-source-company-faire/plan.md) — [tasks](../.specify/specs/063-source-company-faire/tasks.md) | All phases done (T01..T05 run #273); spec complete |
| 064 | [Source Company Plugin: Scale AI](../.specify/specs/064-source-company-scaleai/spec.md) — [plan](../.specify/specs/064-source-company-scaleai/plan.md) — [tasks](../.specify/specs/064-source-company-scaleai/tasks.md) | All phases done (T01..T05 run #274); spec complete |
| 065 | [Source Company Plugin: Cameo](../.specify/specs/065-source-company-cameo/spec.md) — [plan](../.specify/specs/065-source-company-cameo/plan.md) — [tasks](../.specify/specs/065-source-company-cameo/tasks.md) | All phases done (T01..T05 run #275); spec complete |
| 066 | [Source Company Plugin: Carta](../.specify/specs/066-source-company-carta/spec.md) — [plan](../.specify/specs/066-source-company-carta/plan.md) — [tasks](../.specify/specs/066-source-company-carta/tasks.md) | All phases done (T01..T05 run #276); spec complete |
| 067 | [Source Company Plugin: ClassPass](../.specify/specs/067-source-company-classpass/spec.md) — [plan](../.specify/specs/067-source-company-classpass/plan.md) — [tasks](../.specify/specs/067-source-company-classpass/tasks.md) | All phases done (T01..T05 run #277); spec complete |
| 068 | [Source Company Plugin: Coursera](../.specify/specs/068-source-company-coursera/spec.md) — [plan](../.specify/specs/068-source-company-coursera/plan.md) — [tasks](../.specify/specs/068-source-company-coursera/tasks.md) | All phases done (T01..T05 run #278); spec complete |
| 069 | [Source Company Plugin: Epic Games](../.specify/specs/069-source-company-epicgames/spec.md) — [plan](../.specify/specs/069-source-company-epicgames/plan.md) — [tasks](../.specify/specs/069-source-company-epicgames/tasks.md) | All phases done (T01..T05 run #279); spec complete |
| 070 | [Source Company Plugin: Flexport](../.specify/specs/070-source-company-flexport/spec.md) — [plan](../.specify/specs/070-source-company-flexport/plan.md) — [tasks](../.specify/specs/070-source-company-flexport/tasks.md) | All phases done (T01..T05 run #280); spec complete |
| 071 | [Source Company Plugin: fuboTV](../.specify/specs/071-source-company-fubotv/spec.md) — [plan](../.specify/specs/071-source-company-fubotv/plan.md) — [tasks](../.specify/specs/071-source-company-fubotv/tasks.md) | All phases done (T01..T05 run #281); spec complete |

## 8. Templates

| File                                                           | Purpose             |
| -------------------------------------------------------------- | ------------------- |
| [`/.specify/templates/spec.template.md`](../.specify/templates/spec.template.md)   | Spec template.      |
| [`/.specify/templates/plan.template.md`](../.specify/templates/plan.template.md)   | Plan template.      |
| [`/.specify/templates/tasks.template.md`](../.specify/templates/tasks.template.md) | Tasks template.     |

---

_Last revised: 2026-05-03 (run #277)._
