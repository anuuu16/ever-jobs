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
| 014 | [Salary Parser Residuals (`$` symbol / Swiss apostrophe / bare-number country fallback)](../.specify/specs/014-salary-parser-residuals/spec.md) — [plan](../.specify/specs/014-salary-parser-residuals/plan.md) — [tasks](../.specify/specs/014-salary-parser-residuals/tasks.md) | T01..T03 landed runs #60..#62; T04 partial run #63 (Q-035 + Q-036 blocked literal cases); T05 pending |

## 8. Templates

| File                                                           | Purpose             |
| -------------------------------------------------------------- | ------------------- |
| [`/.specify/templates/spec.template.md`](../.specify/templates/spec.template.md)   | Spec template.      |
| [`/.specify/templates/plan.template.md`](../.specify/templates/plan.template.md)   | Plan template.      |
| [`/.specify/templates/tasks.template.md`](../.specify/templates/tasks.template.md) | Tasks template.     |

---

_Last revised: 2026-04-28 (run #63)._
