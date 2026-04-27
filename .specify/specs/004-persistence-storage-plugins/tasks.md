# Tasks: 004 — Persistence & Storage Plugins

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Plugin infrastructure

- [x] T01 — Add `IJobStore`, `IStoreMetadata`, `JobStoreQuery`, `IJobObservationStore`.
  - **Files (planned):** `packages/models/src/interfaces/job-store.interface.ts`,
    `packages/models/src/interfaces/job-store-query.interface.ts`,
    `packages/models/src/index.ts`.
  - **Files (actual):** `packages/models/src/interfaces/job-store.interface.ts`
    (~170 LOC), `packages/models/src/interfaces/job-store-query.interface.ts`
    (~60 LOC), `packages/models/src/interfaces/index.ts` (re-export the
    two new modules — note that `packages/models/src/index.ts` already
    `export *`s from `./interfaces`, so the higher-level barrel needs no
    edit), `packages/models/__tests__/job-store.interface.spec.ts`
    (~170 LOC, 11 unit cases).
  - **Acceptance:** Interfaces exported. **Done:** run #17 (2026-04-27).
    `IJobStore` covers `upsert / upsertMany / getById / findByCanonicalId
    / listByQuery / delete` per Spec 004 §7.1 / FR-1 / FR-7 / FR-8;
    `IJobObservationStore` covers `putAll / listByCanonicalId /
    deleteByCanonicalId` per FR-2 with replace-not-merge semantics
    (single writer = the dedup engine). `JobStoreQuery` adds the four
    documented filters (`company / title / location / since`), opaque
    `cursor`, plus a `limit` clamped by two new constants
    (`JOB_STORE_QUERY_DEFAULT_LIMIT = 100`,
    `JOB_STORE_QUERY_MAX_LIMIT = 1_000`) — bounded so a misbehaving
    caller cannot exhaust memory. `JobStorePage<T>` envelopes the
    `{ items, nextCursor? }` page tuple. `IStoreMetadata = { id,
    description? }` per FR-4 / §7.2. Three error codes
    (`ERR_STORE_NOT_FOUND`, `ERR_STORE_BACKEND_DOWN`,
    `ERR_STORE_INVALID_CURSOR`) and three DI/metadata symbols
    (`JOB_STORE_TOKEN`, `JOB_OBSERVATION_STORE_TOKEN`,
    `STORE_PLUGIN_METADATA_KEY = 'ever-jobs:store-plugin'`) are
    exported alongside, so T02–T04 can import everything from
    `@ever-jobs/models` without further plumbing. Test suite locks in
    the constants, asserts `nextCursor` is `undefined` (not `null`)
    when omitted, round-trips a stub observation store, and compiles
    a stub `IJobStore` against the contract — 22 / 22 passed across
    all `packages/models` suites and 111 / 111 across the regression
    bundle.
  - **Estimate:** 0.25 day. **Actual:** ~0.25 day.

- [ ] T02 — Add `@StorePlugin()` decorator.
  - **Files:** `packages/plugin/src/store/store-plugin.decorator.ts`.
  - **Acceptance:** Decorator attaches metadata via `SetMetadata`.
  - **Estimate:** 0.25 day.

- [ ] T03 — Add `StoreRegistry`.
  - **Files:** `packages/plugin/src/store/store-registry.service.ts`,
    `packages/plugin/src/store/__tests__/store-registry.service.spec.ts`.
  - **Acceptance:** register/get/listIds; duplicate id throws.
  - **Estimate:** 0.5 day.

- [ ] T04 — Add `StoreModule.forActive(storeId)` factory.
  - **Files:** `packages/plugin/src/store/store.module.ts`.
  - **Acceptance:** Returns dynamic module binding `IJobStore` to chosen plugin.
  - **Estimate:** 0.25 day.

## Phase 2 — `store-memory`

- [ ] T05 — Scaffold `packages/plugins/store-memory/`.
  - **Acceptance:** Builds standalone.
  - **Estimate:** 0.25 day.

- [ ] T06 — Implement in-memory `Map`-backed store + cursor pagination.
  - **Files:** `src/store-memory.service.ts`, `__tests__/store-memory.spec.ts`.
  - **Acceptance:** All conformance tests pass.
  - **Estimate:** 0.5 day.

## Phase 3 — `store-sqlite-drizzle`

- [ ] T07 — Scaffold + add Drizzle schema for `canonical_job`, `source_observation`.
  - **Files:** `drizzle/schema.ts`, `drizzle/migrations/0000_init.sql`.
  - **Acceptance:** `drizzle-kit generate` produces clean SQL.
  - **Estimate:** 0.5 day.

- [ ] T08 — Implement `IJobStore` over Drizzle.
  - **Files:** `src/store-sqlite-drizzle.service.ts`,
    `__tests__/store-sqlite-drizzle.spec.ts`.
  - **Acceptance:** Conformance + NFR-1.
  - **Estimate:** 1 day.

## Phase 4 — `store-postgres-prisma`

- [ ] T09 — Scaffold + Prisma schema for `canonical_job`, `source_observation`.
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_init/migration.sql`.
  - **Acceptance:** `prisma migrate dev` works in CI Pg container.
  - **Estimate:** 0.5 day.

- [ ] T10 — Implement `IJobStore` over Prisma.
  - **Files:** `src/store-postgres-prisma.service.ts`,
    `__tests__/store-postgres-prisma.spec.ts` (Testcontainers).
  - **Acceptance:** Conformance + NFR-1/NFR-2.
  - **Estimate:** 1 day.

## Phase 5 — Wire into aggregator

- [ ] T11 — Aggregator persists post-dedup output.
  - **Files:** `apps/api/src/jobs/jobs.aggregator.ts`.
  - **Acceptance:** Default behaviour persists; `persist=false` bypasses.
  - **Estimate:** 0.5 day.

- [ ] T12 — `EVER_JOBS_STORE` env-var honoured at bootstrap.
  - **Files:** `apps/api/src/app.module.ts`.
  - **Acceptance:** Bootstrap fails fast with `ERR_STORE_NOT_FOUND` on bad value.
  - **Estimate:** 0.25 day.

## Notes

- Conformance test suite is shared via `packages/plugin/src/store/__tests__/conformance.ts`
  and re-imported in each backend's tests.
- Phase 4 depends on Testcontainers — gate its CI on `RUN_PG_TESTS=1` so dev runs stay fast.
