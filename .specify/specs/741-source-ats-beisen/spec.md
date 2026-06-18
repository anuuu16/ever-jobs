# Spec: 741 — Source ATS Plugin: Beisen (iTalent)

| Field          | Value                              |
| -------------- | ---------------------------------- |
| Spec ID        | 741                                |
| Slug           | source-ats-beisen                  |
| Status         | accepted                           |
| Owner          | agent                              |
| Created        | 2026-06-18                         |
| Last updated   | 2026-06-18                         |
| Supersedes     | (none)                             |
| Related specs  | 387 (source-ats-mokahr), 001 (plugin-architecture-foundation) |

> Status: **Implemented** (run #435, 2026-06-18). Generic, multi-tenant adapter for the
> Beisen (北森 / iTalent) cloud-HR recruitment platform. No authentication required — every
> Beisen tenant publishes a public, anonymous candidate-facing career site.

## 1. Why

Beisen (北森, brand "iTalent") is the largest enterprise cloud-HR / talent-management SaaS in
the China region — frequently described as the "Workday of China". Its recruitment ("招聘云")
product powers the public career sites of a very large roster of major Chinese and
China-operating employers (dairy, apparel, electronics, automotive, retail, electronics
manufacturing, insurance, etc.). Each customer ("tenant") gets a branded public career site at
`https://{slug}.zhiye.com`.

The corpus already carries a sibling China-region ATS adapter (MokaHR, Spec 387 / `Site.MOKAHR`).
Beisen is a distinct, larger platform with its own wire contract and is **not** yet covered.
Adding it materially widens China-region corpus coverage with a single generic multi-tenant
adapter (one adapter → thousands of tenants), consistent with the project's
"one adapter per platform, not per company" strategy for ATS sources.

This spec adds **only a new source plugin** plus its four registration touch-points. No core
behaviour changes; the adapter is opt-in per `siteType`/`companySlug` exactly like every other
ATS source plugin and degrades to an empty result on any failure.

## 2. Public surface (researched 2026-06-18, no authentication — `verified=false`)

Beisen tenants live at `https://{slug}.zhiye.com` (e.g. `mengniu.zhiye.com`). The career site is
a client-rendered SPA that boots from an inline config block and pulls roles from a public,
anonymous JSON listing endpoint. The adapter is a deterministic **two-step** flow:

### Step 1 — tenant resolution (one HTML GET)

```
GET https://{slug}.zhiye.com/portal/registerSystemInfo
```

The returned HTML inlines the tenant's portal config as a JavaScript object literal:

```html
<script>
  var BSGlobal = {"Key":"…","Name":"追梦之旅","PortalId":"cb59e44a-…","Code":"template10"};
</script>
```

From it the adapter reads:
- **`PortalId`** — required; the tenant portal id sent in every listing request body.
- **`Name`** — the tenant's branded company display name (preferred over the slug).
- **`Key`** — opaque tenant key (kept for provenance only).

The numeric tenant id is additionally exposed in the page's image-CDN URLs
(`stcms.beisen.com/image/{tenantId}/…`) and is read best-effort for provenance.

A tenant whose page carries no `BSGlobal` block (legacy / non-2022 portal) or no `PortalId`
degrades to an empty result.

### Step 2 — paginated listing (one POST per page)

```
POST https://{slug}.zhiye.com/api/Jobad/GetJobAdPageList
Content-Type: application/json

{ "PageIndex": 0, "PageSize": 50, "KeyWords": "", "SpecialType": 0,
  "PortalId": "{PortalId}",
  "DisplayFields": ["Category","Description","Location","Department","Salary"] }
```

Response envelope:

```json
{ "Code": 200, "Message": "operation success", "Count": 1,
  "Data": [ { "JobAdId": 621097372, "JobAdName": "配料工(J64518)",
              "Category": "社会招聘", "LocNames": ["呼和浩特","内蒙古"],
              "Salary": "面议", "Duty": "…", "Require": "…",
              "ChangeDate": "2026-05-07T09:28:46", "PostDate": "…",
              "OrgId": 700312145, "Status": 1 } ] }
```

Per-role fields the adapter consumes (all optional, defensively narrowed):
- **`JobAdId`** — numeric, the stable ATS id and the `/portal/jobs/{id}` URL segment.
- **`JobAdName`** — role title.
- **`LocNames`** — array of city/region name strings → joined location.
- **`Duty`** + **`Require`** — the role body (joined into the description).
- **`Salary`** — free-text salary summary, when present.
- **`Category`** — recruitment category label, used as the department.
- **`ChangeDate`** / **`PostDate`** — ISO timestamps (`0001-01-01…` ⇒ unset ⇒ ignored).

Canonical per-role public URL: `https://{slug}.zhiye.com/portal/jobs/{JobAdId}`.

Pagination: walk `PageIndex` from 0 with `PageSize=50`; stop when a page returns no roles,
fewer than `PageSize`, no NEW roles, or once the cumulative count reaches the envelope `Count`.
Bounded by a hard `MAX_PAGES` ceiling.

## 3. Inputs

| Field | Source | Meaning |
|-------|--------|---------|
| `companySlug` | `ScraperInputDto.companySlug` | Bare tenant subdomain (`mengniu`), or a full `*.zhiye.com` URL. |
| `companyUrl` | `ScraperInputDto.companyUrl` | Any URL on a `zhiye.com` host; the subdomain is the tenant slug. |
| `resultsWanted` | `ScraperInputDto.resultsWanted` | Max roles to ingest (default 100). |
| `descriptionFormat` | `ScraperInputDto.descriptionFormat` | HTML / Markdown / Plain rendering of the role body. |
| `requestTimeout` | `ScraperInputDto.requestTimeout` | Upper-bounded by the adapter's default ceiling. |

## 4. Output

Standard `JobPostDto` per role: `id = beisen-{JobAdId}`, `site = Site.BEISEN`,
`atsType = 'beisen'`, `atsId`, `title`, `companyName` (BSGlobal `Name`, else de-slugified),
`jobUrl`, `applyUrl`, `location` (`LocationDto` from `LocNames`), `description` (formatted
`Duty`+`Require`), `datePosted`, `department` (`Category`), `isRemote`.

## 5. Non-goals / deferred

- Campus / intern boards via the `Category` business-type filter (default fetch is all roles).
- WAF / risk-control-gated tenants that require a browser challenge (deferred; degrade to empty).
- Per-role detail enrichment (the listing payload already carries `Duty`/`Require`).
- Legacy (pre-2022) portals that do not expose a `BSGlobal` block.

## 6. Acceptance criteria

1. `Site.BEISEN = 'beisen'` exists and resolves via NestJS DI through `BeisenModule`.
2. A fixture-driven happy path maps every listing role to a `JobPostDto` with the fields in §4.
3. Tenant resolves from a bare slug, a full `*.zhiye.com` URL, and a `companyUrl`.
4. Missing `BSGlobal` / `PortalId`, HTTP errors, transport failures, malformed bodies, and an
   empty board all degrade to an empty / partial result — never throw.
5. `npm run build` green; the unit suite (≥ 10 cases) green; registered in all four wiring files.
6. The adapter is documented purely from Beisen's own public surface; no external project,
   research tool, or third-party codebase is named anywhere in the repo.

## 7. Cross-checks against AGENTS.md

- **TypeScript only**; modular plugin package under `packages/plugins/`. ✔
- **Graceful degradation** via `Promise.allSettled`-equivalent per-page isolation; no throw. ✔
- **Latest deps**, no new runtime dependency added (reuses `@ever-jobs/common`). ✔
- **Tests**: collocated unit spec (mocked HTTP, fixtures) + tolerant e2e. ✔
- **No external project / research-tool names** anywhere in the repo. ✔
