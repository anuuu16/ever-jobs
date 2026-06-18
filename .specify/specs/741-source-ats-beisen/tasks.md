# Tasks 741 — Source ATS Plugin: Beisen (iTalent)

Implements [plan.md](./plan.md). All tasks completed in run #435 (2026-06-18).

- [x] **T01 — Package scaffold.** `package.json` (`@ever-jobs/source-ats-beisen`, MIT) +
  `tsconfig.json` (extends base) + `src/index.ts` re-exports.
- [x] **T02 — Constants.** `beisen.constants.ts` — hosts, register/search paths, `beisenJobUrl`,
  pagination + timeout bounds, headers, `BSGlobal`/tenant-id/remote regexes, display fields,
  unset-date prefix.
- [x] **T03 — Types.** `beisen.types.ts` — `BeisenBsGlobal`, `BeisenJobRecord`,
  `BeisenListEnvelope`, `BeisenJob`, `ResolvedBeisenTenant`.
- [x] **T04 — Module.** `beisen.module.ts` — NestJS `@Module` providing + exporting the service.
- [x] **T05 — Service.** `beisen.service.ts` — `@SourcePlugin({ site: Site.BEISEN, category:
  'ats', isAts: true })` + `IScraper`: two-step resolve→list flow, balanced-brace `BSGlobal`
  extraction, paginated `Promise`-isolated fetch, defensive normalisation, graceful degradation.
- [x] **T06 — Wiring (4 files).** `site.enum.ts` (Phase 737 / `BEISEN`), `packages/plugins/index.ts`
  (import + `ALL_SOURCE_MODULES`), `tsconfig.base.json` (path alias), `jest.config.js` (mapper).
- [x] **T07 — Fixtures.** `beisen-register.html` (BSGlobal homepage) + `beisen-jobs.json`
  (3 real-shape roles incl. an unset-date `0001-01-01` case and a remote-flagged role).
- [x] **T08 — Unit tests.** `beisen.service.spec.ts` — ≥ 10 mocked-HTTP cases (see plan §Tests).
- [x] **T09 — E2E test.** `beisen.e2e-spec.ts` — tolerant live probe + missing-input case.
- [x] **T10 — Docs.** `docs/index.md` spec-index row 741; `docs/log.md` run #435 entry; doc-lint.
- [x] **T11 — Build + verify.** `npm run build` green; `npx jest packages/plugins/source-ats-beisen`
  green; commit + push; CI green.
