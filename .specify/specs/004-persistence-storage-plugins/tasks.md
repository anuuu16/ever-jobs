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

- [x] T02 — Add `@StorePlugin()` decorator.
  - **Files (planned):** `packages/plugin/src/store/store-plugin.decorator.ts`.
  - **Files (actual):** `packages/plugin/src/store/store-plugin.decorator.ts`
    (~40 LOC; thin `SetMetadata(STORE_PLUGIN_METADATA_KEY, …)` wrapper +
    re-export of the metadata-key constant so plugin authors can import it
    from `@ever-jobs/plugin` without reaching back into `@ever-jobs/models`),
    `packages/plugin/src/index.ts` (added two exports — `StorePlugin`,
    `STORE_PLUGIN_METADATA_KEY`),
    `packages/plugin/src/store/__tests__/store-plugin.decorator.spec.ts`
    (~120 LOC, 8 unit cases).
  - **Acceptance:** Decorator attaches metadata via `SetMetadata`. **Done:**
    run #18 (2026-04-27). Validation of `id` (kebab-case, non-empty,
    duplicate-id) is intentionally deferred to `StoreRegistry` (T03)
    — mirrors `@SourcePlugin()` deferring `Site` uniqueness to
    `PluginDiscoveryService`. Decoration runs at class-load time before
    the logger is wired, so a thrown error there would surface as a
    cryptic stack instead of a structured registry log line. Test suite
    asserts: (1) the re-exported key string equals
    `'ever-jobs:store-plugin'` and is referentially identical to the
    `@ever-jobs/models` constant; (2) the decorator round-trips
    `{ id, description }` and id-only metadata via `Reflector.get`;
    (3) raw `Reflect.getMetadata` returns the same value (dev tooling
    that doesn't import Nest still works); (4) undecorated classes
    return `undefined`; (5) `@StorePlugin()` and `@SourcePlugin()` use
    distinct keys; (6) class identity / `instanceof` / `.name` are
    preserved; (7) two distinct classes carry independent metadata
    objects (no shared-prototype leak). 8 / 8 passed.
  - **Estimate:** 0.25 day. **Actual:** ~0.25 day.

- [x] T03 — Add `StoreRegistry`.
  - **Files (planned):** `packages/plugin/src/store/store-registry.service.ts`,
    `packages/plugin/src/store/__tests__/store-registry.service.spec.ts`.
  - **Files (actual):** `packages/plugin/src/store/store-registry.service.ts`
    (~190 LOC; injectable Nest provider exposing `register / get / tryGet
    / has / getMetadata / listIds / listMetadata / size`),
    `packages/plugin/src/store/__tests__/store-registry.service.spec.ts`
    (~290 LOC; **39 cases** across 7 describe-blocks),
    `packages/plugin/src/index.ts` (added 4 exports — `StoreRegistry`,
    `StoreRegistryError`, `ERR_STORE_INVALID_ID`, `ERR_STORE_DUPLICATE_ID`).
  - **Acceptance:** register/get/listIds; duplicate id throws. **Done:**
    run #19 (2026-04-27). Validation policy (deferred from T02 / decorator)
    now lives here:
      - id MUST be a non-empty kebab-case string
        (regex `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`) — rejects empty,
        whitespace, uppercase, snake_case, leading / trailing / double
        hyphens, leading digit, punctuation, and non-string types
        (`null`, `undefined`, `number`, `object`).
      - Duplicate id rejected on second `register()` — existing
        registration MUST NOT be overwritten (silent overwrite is the
        original sin this registry pattern was created to prevent;
        Spec 004 §7.3 reasoning).
      - All registration failures are atomic: a thrown error MUST
        leave the registry's `size` unchanged. Tests verify by
        asserting `size === 0` after every reject path.
    Three error codes carry the failure modes for ops-grep:
      - `ERR_STORE_NOT_FOUND` (Spec 004 §7.3) — `get(unknown)`.
      - `ERR_STORE_INVALID_ID` (registry-local; not in §7.3 because
        it's a bootstrap-time programmer error rather than a runtime
        wire error) — `register({ id: <bad> })`.
      - `ERR_STORE_DUPLICATE_ID` (registry-local; same rationale) —
        `register()` of an already-registered id.
    Errors flow through a thin `StoreRegistryError` subclass with a
    `code: string` field so `instanceof` works in interceptors and
    structured-log middleware. Both registry-local codes are exported
    from `@ever-jobs/plugin` so the eventual `StoreModule.forActive()`
    (T04) and the future `GET /api/storage` endpoint can grep them
    consistently. Test suite locks: empty-state behaviour, happy-path
    register / get / listIds (insertion order — matches
    `PluginRegistry.listSiteKeys()`), error-message-contains-registered-ids
    for triage, `tryGet()` non-throwing variant, full invalid-id
    catalog (17 cases via `it.each`), accepts-valid-id catalog (8
    cases), duplicate-id rejection + state-preservation, error class
    identity, and NestJS DI singleton resolution.
  - **Estimate:** 0.5 day. **Actual:** ~0.5 day.

- [x] T04 — Add `StoreModule.forActive(storeId)` factory.
  - **Files (planned):** `packages/plugin/src/store/store.module.ts`.
  - **Files (actual):** `packages/plugin/src/store/store.module.ts`
    (~250 LOC; `@Module({})` shell exposing the static
    `forActive(storeId, options)` returning a `global: true` dynamic
    module that provides `StoreRegistry`, every backend in
    `options.backends`, a `useFactory` for `JOB_STORE_TOKEN`, and —
    by default — a `useFactory` for `JOB_OBSERVATION_STORE_TOKEN`),
    `packages/plugin/src/store/__tests__/store.module.spec.ts`
    (~340 LOC; **16 cases** across 10 describe-blocks),
    `packages/plugin/src/index.ts` (added 5 exports — `StoreModule`,
    `StoreModuleConfigurationError`, `StoreModuleForActiveOptions`,
    `ERR_STORE_ACTIVE_ID_REQUIRED`, `ERR_STORE_BACKEND_NOT_DECORATED`).
  - **Acceptance:** Returns dynamic module binding `IJobStore` to chosen
    plugin. **Done:** run #20 (2026-04-27). The factory wires four pieces
    together:
      1. `StoreRegistry` — provider so admin endpoints (`GET /api/storage`)
         can list every declared backend, not just the active one.
      2. Each `options.backends` class as a NestJS provider — instantiated
         on bootstrap, then registered into the registry from
         `@StorePlugin()` metadata.
      3. `JOB_STORE_TOKEN` — `useFactory` that depends on
         `[StoreRegistry, ...backends]`, walks the parallel arrays to
         register each instance, and returns `registry.get(storeId)`.
      4. `JOB_OBSERVATION_STORE_TOKEN` (default-on, opt-out via
         `bindObservationStore: false`) — `useFactory` that simply
         returns the active `IJobStore` cast to `IJobObservationStore`,
         enforcing Spec 004 §7's "single backend implements both
         contracts" recommendation by default.
    Validation runs at two layers:
      - **Factory-time (synchronous in `forActive()`):** empty / blank
        `storeId` → throws `StoreModuleConfigurationError` with code
        `ERR_STORE_ACTIVE_ID_REQUIRED`. Class missing `@StorePlugin()`
        in `backends` → throws same error type with code
        `ERR_STORE_BACKEND_NOT_DECORATED`. Both names the offending
        class / lists the available ids in the message for ops triage.
      - **Bootstrap-time (async in `useFactory`):** duplicate-id
        across two backends → propagates `ERR_STORE_DUPLICATE_ID` from
        `StoreRegistry.register` (deliberately NOT swallowed —
        idempotent skip-on-duplicate would let a typo silently bind
        the wrong implementation). Unknown `storeId` → propagates
        `ERR_STORE_NOT_FOUND` from `StoreRegistry.get`.
    Module is `global: true` (mirrors `PluginModule`) so feature
    modules can `@Inject(JOB_STORE_TOKEN)` without re-importing
    per-feature. Test suite locks: chosen-backend resolution by id,
    same-instance dual-token binding, opt-out of observation-token
    binding, multi-backend registry visibility, instance-identity
    across multiple consumers (no transient scope), global module
    reach via downstream feature module, every error code wired
    end-to-end, no-backends edge case, error-class identity, and
    error-code constant string values. 16 / 16 passed.
  - **Estimate:** 0.25 day. **Actual:** ~0.4 day (slightly over —
    the test fixture for downstream-feature-module integration and
    the duplicate-id path required two extra describe-blocks beyond
    what the original task description called out).

## Phase 2 — `store-memory`

- [x] T05 — Scaffold `packages/plugins/store-memory/`.
  - **Files (planned):** `package.json`, `tsconfig.json`,
    `src/{index.ts, store-memory.module.ts, store-memory.service.ts}`,
    `__tests__/store-memory.spec.ts`.
  - **Files (actual):** `packages/plugins/store-memory/package.json`
    (mirrors `merge-default` shape — `@ever-jobs/store-memory@0.1.0`,
    `main`/`types` → `src/index.ts`),
    `packages/plugins/store-memory/tsconfig.json` (extends
    `tsconfig.base.json`; `outDir → dist/packages/store-memory`),
    `packages/plugins/store-memory/src/store-memory.module.ts`
    (~30 LOC; `@Module({ providers: [InMemoryJobStore], exports: […] })`
    — does NOT bind `JOB_STORE_TOKEN` itself, leaving that to
    `StoreModule.forActive()` so the active-backend selection stays
    in one place),
    `packages/plugins/store-memory/src/index.ts` (barrel — re-exports
    `InMemoryJobStore`, `StoreMemoryModule`, `STORE_MEMORY_ID`,
    `STORE_MEMORY_DESCRIPTION`),
    `tsconfig.base.json` (added path alias
    `@ever-jobs/store-memory → packages/plugins/store-memory/src/index.ts`),
    `jest.config.js` (mirror `moduleNameMapper` entry).
  - **Acceptance:** Builds standalone. **Done:** run #21 (2026-04-27).
    `tsc --project apps/api/tsconfig.build.json --noEmit` clean;
    `npx jest packages/plugins/store-memory` green (42 / 42 — see T06
    for the test breakdown). `StoreMemoryModule` resolves
    `InMemoryJobStore` as a singleton via `Test.createTestingModule`
    (regression guard for the NestJS module surface).
    Plugin is intentionally NOT registered in
    `packages/plugins/index.ts` / `ALL_SOURCE_MODULES` — that barrel
    is for source plugins; `store-memory` is a feature plugin per
    AGENTS.md §5 ("feature plugins only register in tsconfig + jest").
  - **Estimate:** 0.25 day. **Actual:** ~0.25 day.

- [x] T06 — Implement in-memory `Map`-backed store + cursor pagination.
  - **Files (planned):** `src/store-memory.service.ts`,
    `__tests__/store-memory.spec.ts`.
  - **Files (actual):** `packages/plugins/store-memory/src/store-memory.service.ts`
    (~280 LOC; `InMemoryJobStore` decorated with
    `@StorePlugin({ id: 'memory', description: STORE_MEMORY_DESCRIPTION })`,
    backed by `Map<canonicalJobId, CanonicalJob>` and
    `Map<canonicalJobId, SourceObservation[]>`; opaque-cursor pagination
    via base64-encoded `{ v: 1, offset: number }` envelope; cursor
    decode raises `MemoryStoreCursorError` carrying
    `code = ERR_STORE_INVALID_CURSOR` for not-base64 / not-JSON /
    missing-version / wrong-version / non-integer-offset /
    negative-offset / string-offset / fractional-offset; deterministic
    listing order — `mergedAt` DESC, `canonicalJobId` ASC tie-break;
    case-insensitive substring filters on `company` / `title` /
    `location`; inclusive lower-bound filter on `mergedAt` via
    `since.toISOString()` comparison),
    `packages/plugin/src/store/__tests__/conformance.ts` (~360 LOC;
    shared `runStoreConformance(label, factory)` exported for re-use
    by every later backend — T08 sqlite-drizzle, T10 postgres-prisma,
    and any future plugin; **24 contract cases** across 7
    describe-blocks: upsert/getById round-trip + null vs undefined,
    upsertMany insert/update accounting + empty-array edge,
    delete-cascades-observations, listByQuery filters
    (company/title/location/since/combined), limit clamping +
    defaulting, cursor pagination full-traversal + final-page
    `nextCursor`-omitted + malformed-cursor → `ERR_STORE_INVALID_CURSOR`,
    observation putAll/replace-not-merge/deleteByCanonicalId/idempotence/
    listByCanonicalId-unknown),
    `packages/plugins/store-memory/__tests__/store-memory.spec.ts`
    (~190 LOC; runs `runStoreConformance` against
    `() => new InMemoryJobStore()` plus **18 backend-specific cases**
    in 4 describe-blocks: cursor-envelope failure modes — 9 invalid
    cursor shapes via `it.each` (empty-string, plain-text, base64
    of non-JSON, base64 of literal `42`, missing version, wrong
    version, negative offset, fractional offset, string offset) +
    nextCursor-round-trips, `@StorePlugin` metadata wiring (raw
    `Reflect.getMetadata` AND `Reflector.get` both return the same
    `IStoreMetadata` for `InMemoryJobStore`), `StoreMemoryModule`
    NestJS singleton resolution + downstream injection, diagnostic
    `size`/`clear` surface).
  - **Acceptance:** All conformance tests pass. **Done:** run #21
    (2026-04-27). 24 / 24 conformance cases + 18 backend-specific
    cases = **42 / 42** via `npx jest packages/plugins/store-memory`;
    full focused regression bundle `npx jest --testPathPatterns
    'packages/models|packages/plugin/__tests__|packages/plugin/src/store|
    packages/plugin/src/circuit-breaker|packages/plugins/store-memory'`
    runs **170 / 170 across 10 suites**; the broad regression bundle
    (legacy `/health` + `/ping`, Spec 005 / T01–T08, Spec 004 /
    T01–T06, plugin-policy, sources-admin, api-key guard, metrics
    service) runs **236 / 236 across 20 suites**. Three latent
    decisions locked into the test surface (rather than as new
    questions): **(1)** opaque-cursor envelope is `{ v: 1, offset }`
    base64-encoded — base64 chosen over hex/url-encoded JSON because
    every later backend (sqlite, postgres) will also need to encode
    a wire-safe resume token; standardising on base64 here means the
    aggregator and the future `GET /api/jobs?cursor=…` endpoint don't
    need to fork on backend type. **(2)** Empty-string `cursor: ''`
    is REJECTED with `ERR_STORE_INVALID_CURSOR` (NOT silently
    short-circuited to "page 1"). The naive `query.cursor ? … : 0`
    pattern would have let an empty-string typo silently desync a
    paginating caller; the test suite pins this with an explicit
    `it.each` row so a future "simplification" can't drift back to
    the truthy check. **(3)** `listByQuery` ordering is **`mergedAt`
    DESC, `canonicalJobId` ASC tie-break** — DESC because the dedup
    engine emits "freshest first" (Spec 003 / FR-3) and operators
    expect the API to surface the most recent match without an
    explicit `?sort=` parameter, ASC tie-break because two jobs
    sharing an identical `mergedAt` (common in batch upserts) MUST
    yield a total order so cursor pagination resumes deterministically
    — silent ordering drift across pages is what the conformance
    suite's no-dupes guard would catch, but pinning the order here
    keeps it predictable for assertion writers as well. The shared
    conformance suite is the load-bearing artefact for Phases 3 / 4
    — every later backend MUST `runStoreConformance(label, factory)`
    to ship, so the contract is self-enforcing.
  - **Estimate:** 0.5 day. **Actual:** ~0.5 day.

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
