# Tasks: 004 — Persistence & Storage Plugins

> Status legend: `[ ]` pending • `[~]` in-progress • `[x]` done • `[-]` dropped

## Phase 1 — Plugin infrastructure

- [ ] T01 — Add `IJobStore`, `IStoreMetadata`, `JobStoreQuery`, `IJobObservationStore`.
  - **Files:** `packages/models/src/interfaces/job-store.interface.ts`,
    `packages/models/src/interfaces/job-store-query.interface.ts`,
    `packages/models/src/index.ts`.
  - **Acceptance:** Interfaces exported.
  - **Estimate:** 0.25 day.

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
