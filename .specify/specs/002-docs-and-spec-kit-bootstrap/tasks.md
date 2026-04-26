# Tasks: 002 — Documentation & Spec-Kit Bootstrap

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Foundation files (DONE)

- [x] T01 — Create `AGENTS.md` with rule set, layout, plugin contract.
  - **Files:** `AGENTS.md`
  - **Acceptance:** §0 North Star, §2 Hard Rules, §3 Layout, §5 Plugin Contract, §10 Cross-Check.
  - **Estimate:** 0.5 day.

- [x] T02 — Create `CLAUDE.md` Claude-specific operating notes.
  - **Files:** `CLAUDE.md`
  - **Acceptance:** Loads AGENTS.md by reference; documents per-run checklist.
  - **Estimate:** 0.25 day.

- [x] T03 — Create `.specify/{memory,templates}/` skeleton.
  - **Files:** `.specify/README.md`, `.specify/memory/constitution.md`, `.specify/templates/{spec,plan,tasks}.template.md`.
  - **Acceptance:** Templates produce a valid spec/plan/tasks file when copied.
  - **Estimate:** 0.5 day.

- [x] T04 — Create `docs/index.md`, `docs/log.md`, `docs/questions.md`.
  - **Files:** as listed.
  - **Acceptance:** index.md links resolve; log.md template appended; 5 open questions logged.
  - **Estimate:** 0.5 day.

## Phase 2 — Backfill specs 002–005 (in-progress)

- [x] T05 — Add `.specify/specs/002-docs-and-spec-kit-bootstrap/{spec,plan,tasks}.md`.
  - **Files:** under `.specify/specs/002-…/`.
  - **Acceptance:** All three files present.

- [x] T06 — Add `.specify/specs/003-deduplication-engine/{spec,plan,tasks}.md`.
  - **Files:** under `.specify/specs/003-…/`.

- [x] T07 — Add `.specify/specs/004-persistence-storage-plugins/{spec,plan,tasks}.md`.
  - **Files:** under `.specify/specs/004-…/`.

- [x] T08 — Add `.specify/specs/005-source-health-circuit-breaker/{spec,plan,tasks}.md`.
  - **Files:** under `.specify/specs/005-…/`.

- [x] T09 — Update `docs/index.md` to reflect spec status truthfully (not "draft" for missing files).
  - **Acceptance:** No file referenced by index.md is missing.

## Phase 3 — Doc-lint script + CI hook

- [ ] T11 — Implement `scripts/docs-lint.ts` per Spec 002 §7.1 contract.
  - **Files:** `scripts/docs-lint.ts`, `scripts/__tests__/docs-lint.spec.ts`.
  - **Acceptance:** Detects broken links, unindexed docs, mis-ordered log entries.
  - **Estimate:** 1 day.

- [ ] T12 — Wire doc-lint into `npm run lint:docs` and CI workflow.
  - **Files:** `package.json`, `.github/workflows/ci.yml`.
  - **Acceptance:** PR with broken link fails CI.
  - **Estimate:** 0.5 day.

## Notes

- Phase 1 was completed on 2026-04-26 by scheduled run #1.
- Phase 2 was completed on 2026-04-26 by scheduled run #2.
- Phase 3 deferred to a later scheduled run (depends on `remark-parse` + CI work).
