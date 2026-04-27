# Open Questions

> Each question records:
> - **Context** — why the question came up.
> - **Options** — A/B/C with trade-offs.
> - **Default** — option proceeded with so the schedule isn't blocked.
> - **Resolution** — set when the human owner decides; note the date and the chosen option.
>
> Add new questions at the **top**. Resolved questions stay here for traceability.

---

## Q-020 — Health-snapshot store interface shape; cron scheduler choice (Spec 005 / T09)

**Context:** T09's acceptance is exactly two lines — "Cron job
snapshots health to active `IJobStore` every 60 s" and "Rows appear
in chosen backend; bypass when no store." Spec 005 / FR-8 says
"Health snapshot persisted to active `IJobStore` every 60 s
(best-effort)." Two latent design choices weren't called out in
`tasks.md`:

1. **Where do health snapshots actually live?** `IJobStore` only has
   methods for `CanonicalJob` (Spec 004 §7.1 — `upsert / upsertMany
   / getById / findByCanonicalId / listByQuery / delete`). There is
   no `putHealthSnapshot` or equivalent. Three options:

   - **Option A — new `IHealthSnapshotStore` sibling interface.**
     Mirrors the `IJobObservationStore` pattern (Spec 004 / T01
     introduced a separate sibling interface for `SourceObservation`
     records under `JOB_OBSERVATION_STORE_TOKEN` because
     observations have a different lifecycle from canonical jobs).
     New token `HEALTH_SNAPSHOT_STORE_TOKEN`, new interface with
     `putAll(snapshots) / listSince(since, opts?) / latest(site)`.
     Backends implement it lazily — none ship by default; T09 ships
     the cron + the contract, and a future spec (or this one as a
     follow-up) wires real backends. The cron `@Optional()`-injects
     the store and silently bypasses when unbound, matching FR-8's
     "best-effort" wording exactly.
   - **Option B — extend `IJobObservationStore` with
     `putHealthSnapshot(site, health)`.** Reuses an existing token,
     no new interface. But it forces every backend to implement an
     unrelated method, and every existing test that stubs
     `IJobObservationStore` (Spec 004 / T05–T10 ship four backends'
     worth of conformance fixtures) breaks. Architectural drift —
     observations are "facts about a canonical job"; health
     snapshots are "facts about a source plugin". Different
     dimensions.
   - **Option C — coerce `SourceHealth` into `CanonicalJob`.**
     Smallest diff possible (no new interface, no new token), but
     fundamentally misuses the canonical-jobs table. Future
     analytics queries like `SELECT … WHERE site='linkedin' AND
     successRate < 0.9` would have to inner-join against the
     health-shaped subset of jobs, and the `CanonicalJob` schema
     (Spec 003 §7) doesn't carry `successRate / p95LatencyMs`
     fields. Strongly negative.

2. **Cron scheduler implementation.** NestJS has `@nestjs/schedule`
   (an optional package wrapping `node-cron` + `@Cron()` decorators)
   but it's NOT currently a dependency. Three options:

   - **Option A — `setInterval` inside an `@Injectable()` provider
     that implements `OnApplicationBootstrap` + `OnApplicationShutdown`.**
     Zero new dependencies. The provider stores the
     `NodeJS.Timeout` handle in a private field and calls
     `clearInterval(...)` in `onApplicationShutdown()`. Test seam
     is a constructor-injectable interval-ms value (default
     `60_000`) so jest fake timers exercise the tick logic.
     Downside: no cron-syntax expressiveness — but Spec 005 / FR-8
     literally says "every 60 s", which is `setInterval`'s exact
     contract.
   - **Option B — add `@nestjs/schedule` and use `@Cron('*/60 *
     * * * *')`.** Cleaner if multiple cron jobs land later; one
     more devDependency + one more lockfile sync (`testcontainers`
     in run #26 set the precedent — `npm install
     --package-lock-only` is feasible in the sandbox). But Spec 005
     ships only this one timer; adding a 1.4 MB dep tree for a
     single `setInterval` is over-investment.
   - **Option C — re-use NestJS's built-in `setTimeout`-style
     `Logger`-attached interval.** No such facility exists; NestJS
     defers all scheduling to `@nestjs/schedule`. Skip.

**Default — proceeding with Option A on both axes (run #27).**

Reasons (interface):
- The `IJobObservationStore` precedent locks in the "sibling
  interface per data shape" pattern. Spec 004 / T01 chose this for
  observations vs canonical jobs; mirroring it here keeps the
  architecture coherent.
- Spec 005 / FR-8's "active `IJobStore`" wording is a specification
  artefact (the spec was authored before T01 split observations
  out as a separate interface). The spirit — "persist health
  snapshots via the active store backend" — is honoured by Option A
  with a separate token; Option B silently misreads "store" as "the
  one and only store interface", and Option C inverts the data
  model entirely.
- Adding a new token is cheap: bootstrap (T12 / Spec 004 / Q-019
  Option C) is "lazy resolve by id"; backends opt-in to
  `HEALTH_SNAPSHOT_STORE_TOKEN` by including the token in their
  module's `providers`. None do today; that's intentional —
  **bypass when no store** is the literal acceptance line, and
  Option A makes it the default behaviour rather than a special
  case.

Reasons (scheduler):
- NFR-1 (interceptor overhead `< 100 µs`) and NFR-3 (memory per
  source breaker `< 1 KB`) are about per-call cost; the cron's
  cost is per-tick, dominated by `breaker.list()` and `store.putAll()`.
  `setInterval(60_000)` adds zero hot-path cost.
- Adding `@nestjs/schedule` would require a lockfile regenerate
  (the run #26 pattern works but adds churn). One timer doesn't
  justify a 1.4 MB dep tree.
- The `OnApplicationBootstrap` lifecycle hook fires AFTER every
  module's `onModuleInit` — including
  `PluginPolicyBootstrapper.onApplicationBootstrap` from T08, which
  pushes per-plugin policy overrides into the breaker. This means
  the first `breaker.list()` snapshot already reflects every
  plugin's policy. `OnApplicationShutdown` fires before NestJS
  closes the HTTP listener, so no in-flight `store.putAll()` is
  abandoned.

**Resolution:** _pending_ — proceeding with Option A on both axes
(adopted in run #27). Two in-run refinements lock alongside the
default:
1. The interface's primary insert method is named `putBatch`
   (NOT `putAll`) so a single class implementing both
   `IJobObservationStore` (Spec 004 / T01) AND
   `IHealthSnapshotStore` (this run) doesn't suffer
   method-overload ambiguity at the call site —
   `IJobObservationStore.putAll(canonicalJobId, observations)`
   keeps its name, the snapshot-store sibling uses the distinct
   `putBatch(snapshots, ts)`. The in-memory reference backend
   implements all three contracts on a single class.
2. The in-memory reference backend ships an
   `IHealthSnapshotStore` impl as part of T09 itself (deviating
   from the initial draft "no backend ships an impl yet"),
   wired via `StoreModule.forActive`'s new
   `bindHealthSnapshotStore: true` default and the runtime
   type-guard `isHealthSnapshotStore(active)`. sqlite-drizzle
   and postgres-prisma intentionally remain opt-in; the cron
   silently bypasses for those deployments.

Revisit if the interface-extension argument resurfaces from
operator feedback (e.g. "we want one transactional `putAll`
covering canonical + observation + health"); revisit the
scheduler choice if a second cron-based feature lands and the
investment in `@nestjs/schedule` is paid back across two
consumers.

---

## Q-019 — Default backend-fleet shape for `EVER_JOBS_STORE` bootstrap (Spec 004 / T12)

**Context:** T12's acceptance is exactly two lines — "Bootstrap fails
fast with `ERR_STORE_NOT_FOUND` on bad value" and "`apps/api/src/app.module.ts`".
The mechanical part is one `StoreModule.forActive(...)` import; the
load-bearing question is **which `@StorePlugin`-decorated classes
populate the `backends:` array by default**. Three classes exist
(`InMemoryJobStore`, `SqliteDrizzleJobStore`, `PostgresPrismaJobStore`),
each with different operational pre-conditions:

1. **`InMemoryJobStore`.** Zero deps, zero config — instantiating it
   costs nothing.
2. **`SqliteDrizzleJobStore`.** `@Optional()` config; defaults
   `databaseUrl` to `:memory:` (test-friendly). Pulls `better-sqlite3`
   native bindings at import time — irrelevant on developer machines
   but adds ~80–120 ms cold-start on bare-metal Linux.
3. **`PostgresPrismaJobStore`.** `@Optional()` config; **fails fast**
   in the constructor when `STORE_POSTGRES_PRISMA_CONFIG` is unbound
   (no `client`). Including it in `backends` for a deployment that
   selects `EVER_JOBS_STORE=memory` is safe — Nest only constructs
   what `forActive` selects, but our `StoreModule.forActive` factory
   instantiates **every** declared backend (registry-listing
   contract). So including `PostgresPrismaJobStore` without binding
   `STORE_POSTGRES_PRISMA_CONFIG` would break boot for `memory` /
   `sqlite` deployments too.

The deeper question: should the API's bootstrap know about every
`@StorePlugin` class statically, or should it instantiate **only**
the backend matching the requested id ("pay-for-what-you-use" mode)?

**Options:**

- **Option A — Eager all-three list.** Hard-code `backends:
  [InMemoryJobStore, SqliteDrizzleJobStore, PostgresPrismaJobStore]`
  in `app.module.ts`. Pros: simplest mental model; the registry's
  `listIds()` always returns all three so a future
  `GET /api/storage/backends` admin endpoint sees every option. Cons:
  every API boot pays the `better-sqlite3` native-binding load AND
  fails fast on missing `STORE_POSTGRES_PRISMA_CONFIG` — i.e. nobody
  can run `EVER_JOBS_STORE=memory` without first wiring a Prisma
  client. Operationally hostile for the "I just want to try it"
  developer flow.

- **Option B — Lightweight default fleet (memory + sqlite-drizzle).**
  Hard-code `backends: [InMemoryJobStore, SqliteDrizzleJobStore]` in
  `app.module.ts`; ship `PostgresPrismaJobStore` as opt-in via
  explicit module import (operator wires `STORE_POSTGRES_PRISMA_CONFIG`
  + adds `PostgresPrismaJobStore` to the `backends` list themselves
  in their fork / config). Pros: zero-config local dev works for
  `memory` AND `sqlite`; postgres opt-in is loud (operator
  consciously enables it). Cons: setting `EVER_JOBS_STORE=postgres`
  with the stock build raises `ERR_STORE_NOT_FOUND` even though the
  plugin EXISTS in the repo — operator has to read docs to learn the
  opt-in shape.

- **Option C — Lazy resolve by env id ("pay-for-what-you-use").**
  Read `EVER_JOBS_STORE` synchronously at module-evaluation time;
  switch on the id to pick the **single** backend class to pass to
  `StoreModule.forActive`. Unknown id → throw structured error
  (`ERR_STORE_NOT_FOUND`) before NestJS construction with a message
  listing the **known** ids (`memory`, `sqlite`, `postgres`). Pros:
  zero `better-sqlite3` cost when running `memory`; zero
  `prisma` constructor cost when running `memory` or `sqlite`; the
  error message names the three known ids exactly so an operator
  setting `EVER_JOBS_STORE=mongo` learns "did you mean memory /
  sqlite / postgres?" without combing docs. Postgres still opts in
  via `STORE_POSTGRES_PRISMA_CONFIG` (the existing fail-fast in the
  service constructor catches missing config). Cons: the registry's
  `listIds()` returns `[<active>]` only, so a future admin endpoint
  that wants "what backends are wired in this build?" needs a
  separate code path. (The existing `StoreRegistry.listIds()` is
  per-module — a future admin spec can add a static
  `KNOWN_STORE_IDS` constant to `apps/api` for this; not blocking.)

**Default — proceeding with Option C (run #26).** Reasons:
- **Lowest cold-start in every deployment shape.** NFR-4 budgets
  cold-start at 750 ms and Option C is the only option that keeps
  the per-id overhead proportional. Eager-all (Option A) pays for
  every backend on every boot; lightweight (Option B) pays for
  `better-sqlite3` even in pure-memory mode.
- **Best operator UX for unknown id.** The bootstrap factory raises
  `ERR_STORE_NOT_FOUND` with a message naming `memory / sqlite /
  postgres` literally — the same set the operator is trying to
  pick from. Both Option A and Option B emit the registry's
  generic `Registered ids: [...]` — semantically equivalent but less
  helpful when the operator's typo is `postres` (close to
  `postgres`).
- **Postgres opt-in is by *config*, not by *code*.** `EVER_JOBS_STORE=postgres`
  in Option C still selects `PostgresPrismaJobStore` from the
  built-in fleet — the operator just needs to additionally bind
  `STORE_POSTGRES_PRISMA_CONFIG` (an explicit wire-up step they'd
  do anyway in production). The stock build supports all three ids
  out of the box with config.
- **Future admin endpoint is unblocked.** A separate spec can add
  a `KNOWN_STORE_IDS = ['memory', 'sqlite', 'postgres'] as const`
  constant to `apps/api/src/jobs/store-bootstrap.factory.ts` so
  `GET /api/storage/backends` lists every available id (not just
  the active one).

**Resolution:** _pending_ — proceeding with Option C. Revisit if the
"lazy resolve = registry only sees active" trade-off bites a future
admin / observability feature, at which point an
`AppStoreModule.forActiveWithRegistry(...)` variant could fan out
metadata-only registration without instantiation.

---

## Q-018 — Aggregator persistence wiring: opt-in vs opt-out, error policy, observation-store coupling, AggregateResult shape (Spec 004 / T11)

**Context:** T11's acceptance is two lines — "Default behaviour
persists; `persist=false` bypasses." The aggregator already runs the
dedup engine and emits `DedupResult.canonical` (the `CanonicalJob[]`
to persist) plus per-input `assignments`. Five latent design choices
weren't called out in `tasks.md`:

1. **Default `persist`?** The acceptance line spells it out — "Default
   behaviour persists" → default `true`. Confirmed; no question.
2. **What happens when no `IJobStore` is bound?** Two reasonable
   shapes: (a) silently treat as `persist=false` (back-compat: every
   existing test runs without a store binding); (b) hard fail at
   request time with `ERR_STORE_NOT_FOUND`. (a) keeps tests honest
   without forcing every test fixture to wire a store; (b) makes
   misconfigured prod loud. Spec 004 §7.3 reserves the
   `ERR_STORE_NOT_FOUND` code for **bootstrap** (T12), so request-time
   should NOT raise it.
3. **Persistence failures: throw or swallow?** The aggregator is on
   the hot path of `POST /api/jobs/search`. Three options: (a) bubble
   any `IJobStore.upsertMany` rejection to the caller — a transient
   DB blip turns every search into a 500; (b) swallow + `logger.warn`
   + still return the deduped list — the user gets results, the
   operator gets a log line; (c) swallow + structured `persistError`
   field on `AggregateResult` so the controller can surface a
   header / metric without blocking the response. Spec 004 §7.3's
   `ERR_STORE_BACKEND_DOWN` doctrine ("bubble with retry hints") was
   written for explicit store callers (`GET /api/jobs/:id`), not for
   the aggregator's optional persistence side-effect.
4. **Observation-store coupling.** Each `CanonicalJob` carries
   `sources: ReadonlyArray<SourceObservation>`. Two options:
   (a) call `observationStore.putAll(canonicalJobId, sources)` for
   every canonical record so observation history is captured;
   (b) skip observations and let a future T13 add it. Spec 004
   §7 / FR-2 already requires `IJobObservationStore` to be wired by
   the same backend (T04's default `bindObservationStore: true`),
   so capturing observations now is a one-line addition that keeps
   the contract complete.
5. **AggregateResult shape.** Two options: (a) leave `AggregateResult`
   alone — persistence is a side effect — and document the contract
   in JSDoc; (b) extend with optional `persisted?: boolean`,
   `persistCounts?: { inserted: number; updated: number }`, and
   `persistError?: { code: string; message: string }` so the
   controller can echo the outcome in a response header / metric.
   (a) keeps the wire shape stable; (b) gives operators a one-roundtrip
   answer for "did the search persist?".

**Options:**

- **Option A — Default `persist=true`; no-store → silent skip; on
  upsertMany failure log + structured `persistError` (option 3.c);
  capture observations via `IJobObservationStore.putAll`; extend
  `AggregateResult` with `persisted` + `persistCounts` + `persistError`.**
  Lowest blast radius for the hot path: a failing store NEVER turns
  a successful search into a 500. The new fields on
  `AggregateResult` are all optional — every existing controller /
  resolver / test continues to compile unchanged. Persistence is
  best-effort but observable: a future metrics interceptor can read
  `result.persistError?.code` to count `store_persist_failures_total`.
- **Option B — Default `persist=true`; no-store → silent skip;
  bubble upsertMany failures (option 3.a); capture observations;
  extend `AggregateResult` minimally (`persisted` boolean only).**
  Loudest signal but every transient DB blip is a 500 to the user.
  Operationally hostile for the search hot path.
- **Option C — Default `persist=true`; no-store → silent skip;
  swallow upsertMany failures with `logger.warn` (option 3.b); skip
  observations for now; do NOT extend `AggregateResult`.** Smallest
  diff but the controller can't tell whether persistence happened —
  the caller / dashboard has to issue a follow-up `GET /api/jobs`
  to verify, which is racy with concurrent writes.

**Default — proceeding with Option A (run #25).** Reasons:
- Best-effort persistence keeps the search hot path 100 % available
  during an unrelated DB blip (Spec 004 / NFR-4 budgets cold-start
  at 750 ms but says nothing about graceful degradation; Option A
  fills that gap).
- Capturing observations alongside canonical records keeps the
  store contract (FR-1 + FR-2) complete in the only writer the API
  has, so a future analytics query can rely on
  `IJobObservationStore.listByCanonicalId` without a backfill.
- The `persistError` field on `AggregateResult` is the cheapest way
  to surface partial failure to the caller without breaking the
  response envelope. The controller stays a one-liner; metrics /
  alerting can be added later by a separate spec without re-wiring
  the aggregator.
- Silently skipping when no store is bound matches the dedup-engine
  precedent (Spec 003 / T13: "When no engine is bound the aggregator
  is a pass-through"). Operators who set `EVER_JOBS_STORE` get
  bootstrap-time validation in T12; until then, persistence is a
  no-op rather than a runtime error.

**Resolution:** _pending_ — proceeding with Option A. Revisit if
operator feedback shows the swallow-and-log pattern is hiding real
production issues, at which point a `STORE_PERSIST_FAILURE_THRESHOLD`
(consecutive failures → bootstrap-style fail-fast) would be a
cleaner escalation than per-request bubbling.

---

## Q-017 — Admin force-open / force-reset endpoint: route shape, auth strictness, response payload, invalid-site code (Spec 005 / T07)

**Context:** T07's acceptance is exactly two lines —
"Add `POST /api/sources/:site/circuit/{open,reset}` (auth-required)"
and "Force-open succeeds with valid API key; 401 otherwise." Four
latent design choices aren't called out in `tasks.md`:

1. **Where does the route live?** Two reasonable homes:
   - Same `SourcesHealthController` (`@Controller('api/sources')`)
     so the URL surface stays grouped under one controller and one DI
     graph (the breaker is already injected here).
   - A separate `SourcesAdminController` so the read-only `GET health`
     stays logically distinct from mutating writes.
2. **How is "auth-required" enforced when the global `ApiKeyGuard` is
   currently a no-op?** Today the guard returns `true` whenever
   `auth.enabled=false` **or** `apiKeys.length === 0`. That's fine for
   read-mostly routes but an attacker could force-open every source in
   a deploy that hasn't set `ENABLE_API_KEY_AUTH=true`. The route
   contract needs a stricter, per-route override. Three shapes:
   - **Reflector-driven `@AdminAuth()` decorator** + the existing
     `ApiKeyGuard` reads metadata. When the route is marked admin, it
     **always** validates a key (ignoring `auth.enabled`); when no
     keys are configured at all, it returns 503 (admin disabled by
     misconfiguration) rather than silently allowing the request.
   - A second guard (`AdminApiKeyGuard`) wired with `@UseGuards()` on
     the route only. Cleaner separation, but two guards now read the
     same `ConfigService` config-tree.
   - A `requireAuth: true` flag wired into `ApiKeyGuard` via a
     class-level prop. Doesn't compose with multiple admin routes that
     could live in different controllers.
3. **What does the admin endpoint return?** Two natural choices:
   - 200 + `{ ok: true, site, health: SourceHealth }` — operator
     dashboards can re-render the per-site row from the same payload.
   - 204 No Content — smaller wire, but the dashboard then has to
     issue a follow-up `GET /api/sources/health` to confirm the state.
4. **What status code for an unknown `:site`?** Two natural choices:
   - 404 Not Found ("URL identifies no such source").
   - 400 Bad Request ("path param is not a `Site` enum value").

**Options:**

- **Option A — Same controller, `@AdminAuth()` decorator + Reflector
  read in `ApiKeyGuard`, 200 + `{ ok, site, health }`, 404 for unknown
  site.** Adds one new file (`apps/api/src/auth/admin-auth.decorator.ts`)
  and one new branch in `ApiKeyGuard.canActivate`. The existing
  `health.controller.ts` grows two methods. The 401-on-missing /
  401-on-invalid contract is exact (T07 acceptance: "401 otherwise"
  — both branches throw `UnauthorizedException`). Misconfigured
  deploys with `apiKeys=[]` get 503, which is operator-fixable.
- **Option B — Separate `SourcesAdminController` + dedicated
  `AdminApiKeyGuard` via `@UseGuards()`, 204 No Content, 400 for
  unknown site.** Cleanest physical separation; two new files. The
  204 path means the e2e test for "valid key force-opens the breaker"
  has to issue a second request to verify state, which is brittle if
  another test interleaves a `forceReset`. The 503-on-misconfigure
  branch is the same.
- **Option C — Same controller, in-place `requireAuth` flag on
  `ApiKeyGuard`, 200 + bare `SourceHealth`, 400 for unknown site.**
  Lowest-LOC, but the in-place flag doesn't compose if a future
  controller needs admin auth in another module — the flag is a
  global instance property.

**Default — proceeding with Option A (run #16).** Reasons:
- Reflector-driven decorator composes cleanly with future admin
  routes in any controller (e.g. a future `POST /api/plugins/:id/disable`
  re-uses `@AdminAuth()` with no extra wiring).
- Returning the full `SourceHealth` after the action lets dashboards
  re-render the per-site row from one round-trip — matches operator
  workflow ("force-open → confirm in UI").
- 404 for unknown `:site` matches REST conventions: the URL points
  to a resource (the source) that doesn't exist.
- The same controller keeps the DI graph shallow — both routes need
  the breaker that's already injected.

**Resolution:** _pending_ — proceeding with Option A. Revisit if a
future feature requires multiple admin tiers (e.g. read-only ops vs
full admin), at which point the Reflector key would graduate from
`AdminAuth` to a roles-based `RequireRole(...)` decorator.

---

## Q-016 — Per-plugin `getCircuitBreakerPolicy()` discovery: where does the bootstrap live, when does it run, what about hot-swap (Spec 005 / T08)

**Context:** T08's acceptance is just "Plugin-defined policy wins over
default at registration." The interface (`ICircuitBreakerPolicyProvider`),
the type guard (`hasCircuitBreakerPolicy`), and the breaker setter
(`CircuitBreakerService.setPolicy(site, policy)`) are all already in
place from T01/T02 — T08 is purely the wiring. Three latent design
choices weren't called out in `tasks.md`:

1. **Where does the bootstrap live?** Spec 005 / `tasks.md` planned the
   work inside `packages/plugin/src/circuit-breaker/circuit-breaker.service.ts`
   — but `CircuitBreakerService` doesn't (and shouldn't) know about
   `PluginRegistry`. Teaching the breaker to scan plugins would create
   a back-edge that breaks AGENTS.md §0.2's "every plugin replaceable"
   invariant: a custom breaker plugged in via `CIRCUIT_BREAKER_TOKEN`
   would silently lose policy overrides.
2. **When does the bootstrap run?** `PluginDiscoveryService.onModuleInit`
   populates the registry. Running override-discovery in another
   `OnModuleInit` would be a race; running in
   `OnApplicationBootstrap` (which fires after every module's
   `OnModuleInit`) is race-free but means the override only applies
   to plugins registered *during* discovery — not to community
   plugins registered later via
   `PluginRegistry.registerExternal(...)`.
3. **What about hot-swap?** Should `PluginRegistry.register` itself be
   updated to call `breaker.setPolicy` when the new scraper implements
   `getCircuitBreakerPolicy()`? That couples the registry to the
   breaker (against AGENTS.md §0.2 again).

**Options:**

- **Option A — Separate provider in `JobsModule`,
  `OnApplicationBootstrap`, `applyPluginPolicies()` exposed as a public
  re-trigger.** Mirrors the T06 `MetricsCircuitBreakerBridge` pattern.
  The bootstrapper owns *both* dependencies (`PluginRegistry` is
  global; `CIRCUIT_BREAKER_TOKEN` is bound by `CircuitBreakerModule`
  imported from `JobsModule`) and so violates neither §5 (no peer
  imports) nor §0.2 (every component pluggable). Late-registered
  plugins can re-trigger discovery via the public method without
  writing a new bootstrapper. A throw inside
  `getCircuitBreakerPolicy()` is caught — the affected `Site` keeps
  `DEFAULT_CIRCUIT_POLICY` — so a buggy plugin can't take down the
  pass.
- **Option B — Teach `CircuitBreakerService` about `PluginRegistry` directly.**
  Inject `PluginRegistry` into `CircuitBreakerService` in
  `packages/plugin/src/circuit-breaker/`. Simplest dependency graph
  but breaks AGENTS.md §0.2: any custom breaker plugged in through
  `CIRCUIT_BREAKER_TOKEN` would have to re-implement the override
  scan or silently lose it.
- **Option C — Wrap `PluginRegistry.register` to push policy synchronously.**
  Override-discovery runs at the moment of registration, with no
  bootstrap step. Tightens coupling between the registry and the
  breaker, and means `register` is now async-effectful rather than
  pure. Doesn't help `registerExternal` callers any more than Option A
  + the documented re-trigger does.

**Default — proceeding with Option A (run #15).**
Option A keeps the breaker pluggable, keeps the registry pure, and
matches the T06 bridge pattern — operators only have to learn one
"per-feature wiring provider in `JobsModule`" idiom. The public
`applyPluginPolicies()` method is the documented hot-swap escape
hatch, exercised by the integration suite. A future task could lift
the bootstrapper into a generic `BootstrapHooks` mechanism if a third
"discovery + token-based wiring" feature appears, but that abstraction
is premature with two cases.

**Resolution:** _pending_ — proceeding with Option A. Revisit if a
future plugin needs synchronous policy application at registration
(e.g. to override the policy *before* the very first call) — the
current bootstrap order is "first call may briefly use the default
policy if it lands before `OnApplicationBootstrap`," which is
acceptable for steady-state operation but could matter for a startup
self-test.

---

## Q-015 — Prometheus exposition of `source_circuit_state`: bridge wiring, state encoding, label set (Spec 005 / T06)

**Context:** T06's acceptance is just "`curl /metrics` includes
`source_circuit_state{site=...}`." Three latent design choices weren't
called out in `tasks.md`:

1. **Where does the breaker connect to the Gauge?** `MetricsModule` is
   `@Global()`; `CircuitBreakerModule` is **not** — it's imported by
   `JobsModule`. So `MetricsService` cannot inject `CIRCUIT_BREAKER_TOKEN`
   directly without either (a) making `CircuitBreakerModule` global (wide
   blast radius — every test bootstrap that pulls `MetricsModule` would
   suddenly see a breaker), (b) reaching across modules at runtime
   (forbidden by AGENTS.md §5 plugin rule), or (c) introducing a small
   bridge provider that owns *both* dependencies and writes the breaker
   into the Gauge's `collect()` callback.
2. **State encoding.** Prometheus Gauges are numeric. The natural
   encodings are: `closed=0, half-open=1, open=2` (degradation severity
   ascending), or `closed=0, open=1, half-open=2` (open-vs-rest binary
   first), or three separate Gauges (`source_circuit_state_closed`,
   …_open, …_half_open) each at 0/1. The first matches Spec 005's
   FR-1/FR-2 mental model (graduating severity) and lets a single
   `max_over_time(source_circuit_state[5m]) >= 2` alert trigger on any
   open episode.
3. **Label set.** `{site}` is the only label `tasks.md` mandates. Should
   we also expose `{state}` as a second label so PromQL can sum by
   state without remembering the encoding? That would mean *three* time
   series per site (one per state, value 0 or 1) — for ~190 sites
   that's ~570 series. Acceptable but >2× the cardinality.

**Options:**

- **Option A — Bridge provider, single-Gauge severity encoding, `{site}`-only label.**
  Add `CircuitBreakerMetricsBridge` in `apps/api/src/jobs/`
  (a Nest provider with `OnApplicationBootstrap`) that injects both
  `MetricsService` and `CIRCUIT_BREAKER_TOKEN` and calls
  `metricsService.bindCircuitBreakerSource(() => breaker.list())`.
  The Gauge `ever_jobs_source_circuit_state{site}` reports
  `closed=0, half-open=1, open=2`. `MetricsService` exposes a
  `bindCircuitBreakerSource(fn)` setter that wires the source into the
  Gauge's `collect()` callback — when no source is bound, `collect()`
  is a no-op and the metric is simply absent (back-compat with test
  bootstraps that don't import `JobsModule`). HELP text records the
  encoding.
- **Option B — Make `CircuitBreakerModule` `@Global()` and inject `CIRCUIT_BREAKER_TOKEN` directly into `MetricsService`.**
  Wires straight from breaker to Gauge with no bridge. Simpler dependency
  graph but inverts the Spec 005 / FR-3 plugin model — the breaker is
  meant to be a swappable plugin imported once at the application
  boundary, not an ambient global. Also forces every consumer of
  `MetricsService` (cache, future analytics dashboards) to pull the
  breaker into their bootstrap.
- **Option C — Three Gauges (`…_closed`, `…_open`, `…_half_open`) with `{site}` label.**
  Each Gauge reports 0 or 1. PromQL becomes `source_circuit_state_open == 1`.
  No encoding to remember; double the series count; mismatches the
  spec's "`source_circuit_state{site}`" wording (the spec names a
  *single* metric).

**Default — proceeding with Option A (run #14).**
Option A keeps the breaker pluggable (no global), keeps cardinality at
~190 series (one per site), matches the spec's metric naming exactly,
and degrades cleanly when the bridge isn't wired (the Gauge is simply
absent from `/metrics`). The encoding is documented in the Gauge's
HELP text so PromQL authors don't need to read code.

**Resolution:** _pending_ — proceeding with Option A. Revisit if
operators surface friction with the numeric encoding.

---

## Q-014 — `/api/sources/health` shape, registry-overlay default, and auth posture (Spec 005 / T05)

**Context:** T05's acceptance is just "Returns array of `SourceHealth`;
cache-control 1 s." Three sub-questions emerged while authoring the
controller:

1. **Response shape.** `{ count, sources }` envelope vs raw array
   `SourceHealth[]`?
2. **Registry overlay.** `breaker.list()` only returns sites the breaker
   has actually observed (lazy init). Should the endpoint also list every
   *registered* source plugin so a fresh process surface a "no data yet,
   closed" row for the ~190 sites?
3. **Auth posture.** FR-7 explicitly says "auth-required" for the
   `POST /circuit/{open|reset}` admin paths. By implication FR-5 (this
   read endpoint) is **not** auth-required. Should T05 still gate it
   behind `ApiKeyGuard`?

**Options:**

- **Option A — Envelope shape, opt-in overlay, no extra auth.**
  Response is `{ count, sources: SourceHealth[] }`. Default returns only
  sites the breaker has observed; `?include=all` overlays the rest.
  Endpoint is subject to the existing global `ApiKeyGuard` (which is
  no-op when `auth.enabled=false`, the deployed default). Memory-safe
  by design — the overlay never calls `breaker.health(site)` for unseen
  sites (which would create real entries and balloon the ~190 × 1 KB
  ceiling per Spec 005 / NFR-3).
- **Option B — Raw array, always overlay, public.**
  Response is `SourceHealth[]`. Always returns every registered plugin.
  Endpoint exempt from `ApiKeyGuard`. Simpler client-side but forces
  every dashboard to render ~190 rows even when only 1 site has been
  called; eager overlay also sacrifices the lazy-init memory property.
- **Option C — Envelope shape, always overlay, no extra auth.**
  Hybrid of A's envelope and B's eagerness. Same memory regression as
  B; less surprising than B for clients (envelope is more idiomatic
  REST).

**Default — proceeding with Option A (run #13).**
The envelope is friendlier to monitoring scripts that want
`count`-style alerting; the opt-in overlay keeps the default response
small (only "interesting" sites) while still being reachable for
operators who want a complete picture (`?include=all`); leaving the
endpoint subject to the global guard preserves the deploy-time choice
in `auth.enabled` (operators who want it private just enable the guard).

**Resolution:** Option A (run #13). Documented in
`apps/api/src/jobs/health.controller.ts` and exercised by 5 e2e cases
in `apps/api/__tests__/e2e/sources-health.e2e-spec.ts`. Revisit if a
real client surfaces friction with the envelope shape — the controller
already returns `sources` as a stable array so a future un-wrapping
would be a 1-line change.

---

## Q-013 — Circuit-breaker wiring point: `JobsAggregator` vs `JobsService` (Spec 005 / T04)

**Context:** Spec 005 plan.md §1 says the breaker is "applied to the
aggregator's per-source dispatch — *not* to the controller, because the
breaker is a per-source concern, not a per-request one." Tasks.md /
T04 names `apps/api/src/jobs/jobs.aggregator.ts` as the file to patch
and `Acceptance: 1-of-3 always-fail fake plugins → aggregator returns
2 results.` While inspecting the dispatch path during run #12 we found
that the per-source `scraper.scrape()` fan-out actually lives in
`JobsService.searchJobs` (which `JobsAggregator.aggregate` delegates
to). `JobsAggregator` itself runs **after** fan-out — its job is the
dedup pass; it never sees individual sources.

**Options:**

- **A. Refactor `JobsAggregator` to own the per-source dispatch.**
  Move the `selectedScrapers.map(...)` loop out of `JobsService`, wire
  the breaker there. Pro: matches T04's named file. Con: ~150 LOC of
  refactor cuts across `JobsService` (routing + retries + metrics +
  salary post-processing), needs to keep `JobsAggregator.aggregate`
  vs `aggregateRaw` working without a regression in the existing
  Spec 003 / Phase 5 dedup flow. High blast radius for a Phase 2 wire.
- **B. Wire the breaker into `JobsService` (the actual dispatch
  site).** `@Optional()` inject `CircuitBreakerInterceptor` and wrap
  `scraper.scrape(scraperInput)` with `interceptor.wrap(site, …)`. Pro:
  lands FR-1 ("wraps every `IScraper.scrape()` call") exactly where
  the call happens; back-compat for tests that don't import
  `CircuitBreakerModule` is automatic via `@Optional()`. Tasks.md /
  T04's *acceptance* — "1-of-3 always-fail fake plugins → aggregator
  returns 2 results" — still holds end-to-end through the aggregator
  because the aggregator delegates to the service.
- **C. Wire it in *both* layers.** Belt-and-suspenders. Pro: makes the
  task description literally true. Con: introduces a meaningless
  second wrap (the aggregator's dispatch IS the service's dispatch),
  doubles the `wrap` overhead, fragments where the breaker's
  observability lives.

**Default (proceeding):** **B. Wire into `JobsService`** — the
acceptance criterion is the contract; the file name in T04 was a
proxy for "the dispatch site". Wiring at the actual dispatch point
keeps the change minimal (~15 LOC) and honours FR-1 literally.
Tasks.md was annotated with "Files (planned) / Files (actual)" so the
deviation is visible.

**Resolution:** **2026-04-27 (run #12) — Option B.** Implementation
landed in `apps/api/src/jobs/jobs.service.ts` +
`apps/api/src/jobs/jobs.module.ts`; integration suite at
`apps/api/__tests__/integration/circuit-breaker.spec.ts` (4 cases,
all green) demonstrates the T04 acceptance.

---

## Q-012 — Circuit-breaker engine: `opossum` vs hand-rolled state machine (Spec 005 Phase 1)

**Context:** Spec 005 plan.md §1 suggested wrapping the
[`opossum`](https://www.npmjs.com/package/opossum) Node circuit-breaker
library inside a NestJS service to "avoid hand-rolling state transitions
(would otherwise be a primary risk)". Spec 005 §FR-2 then specifies the
default policy as **"5 consecutive failures → open"** with a 30 s
cooldown. While inspecting `opossum`'s API for T02 we found that the
library models failures as an `errorThresholdPercentage` over a rolling
count window (`rollingCountTimeout` × `rollingCountBuckets`). It does
**not** ship a "N consecutive failures" trigger; emulating consecutive-
failure semantics requires post-event monkey-patching of the breaker's
internals, which would itself be a fragility risk.

**Options:**

- **A. Wrap `opossum`.** Configure `volumeThreshold: 5` +
  `errorThresholdPercentage: 100` so 5 errors in the rolling window
  open the breaker. Approximates the contract but is not strictly
  consecutive — a single mid-window success does not reset the count
  the way Spec 005 / FR-2 expects. Downside: behavioural drift
  surfaces only under load, where it's hardest to debug.
- **B. Wrap `opossum` + custom counter overlay.** Use `opossum` for
  cooldown/half-open mechanics, add a side-channel counter that
  resets on `success` and triggers `breaker.open()` on the threshold.
  Touches `opossum`'s public events but doesn't subclass it.
  ~80 LOC of glue plus the dep.
- **C. Hand-rolled state machine in
  `packages/plugin/src/circuit-breaker/circuit-breaker.service.ts`.**
  ~250 LOC including doc comments. Implements the exact FR-2
  contract: counter increments on failure, resets on success, opens
  at threshold, half-open after `cooldownMs`, reopens with a fresh
  cooldown on probe failure. Fully unit-testable via an injectable
  clock seam (`setClock`). No new dependencies.

**Default (proceeding):** **C. Hand-rolled state machine** — Spec 005's
contract is firmer than its plan; consecutive-failure semantics is
explicit (`§5 / FR-2`) and matches operator intuition ("the source
broke five times in a row, kill it"). The `opossum` wrap path's
behavioural drift would only show up at production scale. Hand-rolling
also lets us:
  - inject a deterministic clock for unit tests (no `jest.useFakeTimers`
    timing-flake risk),
  - cap memory at `MAX_SAMPLES = 600` per site explicitly, satisfying
    Spec 005 / NFR-3,
  - publish exactly the `ICircuitBreakerService` shape declared in
    `@ever-jobs/models` without leaking `opossum`'s event-emitter API.

**Resolution:** Adopted **C. Hand-rolled state machine** in run #10
(2026-04-26). Implementation in
`packages/plugin/src/circuit-breaker/circuit-breaker.service.ts`. 14
unit tests in
`__tests__/circuit-breaker.service.spec.ts` cover the full state-machine
matrix. Will revisit option A only if a future requirement (e.g.
half-open back-pressure, distributed breaker) makes a battle-tested
library a better fit. The `setClock` test seam plus the strict
`ICircuitBreakerService` interface keeps that swap a 1-day commit if
ever needed.

---

## Q-011 — Doc-lint markdown parser choice (Spec 002 Phase 3, T11)

**Context:** Spec 002 plan.md §4 listed `remark-parse` + `unified` as the
suggested deps for `scripts/docs-lint.ts`. Both are popular and battle-tested,
but they pull a 30+ transitive-dep graph into the build for what is a small
build-time tool. The five lint checks (broken internal links, unindexed docs,
duplicate log entries, newest-at-top ordering, spec-file frontmatter
presence) all operate on a small surface of the markdown grammar — inline
`[text](href)` links plus `## YYYY-MM-DD — Scheduled run #N` headers.

**Options:**

- **A. `remark-parse` + `unified` (the plan's suggestion).** Full markdown AST.
  Future-proof if we later want to lint heading levels, table integrity,
  list nesting, footnotes, etc. ~30 transitive deps; ~2 MB install footprint;
  startup cost ~150 ms.
- **B. `remark-parse` only, no `unified`.** Same AST without the streaming
  pipeline. Saves ~5 deps. Still a heavy install for a build-time tool.
- **C. Zero-dep regex parser in-tree.** ~150 LOC; no install footprint;
  startup cost negligible. Requires us to handle code fences (` ``` ` and
  `~~~`), inline-code spans, link-text escapes, and `:line` / `#frag` /
  `?query` URL suffixes manually. Falls down on reference-style links
  (`[text][ref]` + `[ref]: url`), nested brackets, and HTML inside markdown
  — none of which appear in our docs today.

**Default (proceeding):** **C. Zero-dep regex parser** — keeps the doc-lint
job lightweight (CI step <10 s end to end including `npm ci`), avoids the
risk of a future remark major bump breaking the lint, and matches the
shape of the markdown we actually write. If we ever need full-AST checks
(table-divider validation, list-nesting consistency, frontmatter YAML), we
can swap to option A behind the same `lintDocs(repoRoot)` interface
without touching CI wiring.

**Resolution:** Adopted **C. Zero-dep regex parser** in run #9 (2026-04-26).
Implementation in `scripts/docs-lint.ts`. Will revisit option A only if a
real lint check requires AST traversal that the regex parser can't
deliver cleanly.

---

## Q-010 — Should the GraphQL `searchJobs` query also dedup by default?

**Context:** Spec 003 Phase 5 (run #7) wired the dedup engine into the REST
endpoint `/api/jobs/search` and added the opt-out `?dedup=false` query param.
The GraphQL resolver in `apps/api/src/jobs/jobs.resolver.ts` still calls
`JobsService.searchJobs()` directly and bypasses `JobsAggregator`, so it
returns raw fan-out. Spec 003 didn't itemise GraphQL parity.

**Options:**

- **A. Mirror REST.** Inject `JobsAggregator` into `JobsResolver` and add a
  `dedup: Boolean = true` arg to the `searchJobs` GraphQL input. Maximum
  consistency; one extra optional arg in the schema.
- **B. Leave GraphQL as raw-only.** Document the divergence and add a
  follow-up spec for GraphQL `canonicalJobs` that returns `CanonicalJob[]`
  with full provenance. Keeps the current schema stable; clients with
  bespoke ranking logic don't pay the dedup tax.
- **C. Dedup by default with no opt-out.** Smallest schema change; matches
  the "default true" REST migration. But denies GraphQL clients a way to
  inspect raw fan-out for debugging.

**Default (proceeding):** **A. Mirror REST** — keeps the public surface
coherent and avoids a class of "why is REST count != GraphQL count" support
tickets. Ship in a future run as a tiny follow-up (T15 candidate); not a
Spec 003 blocker.

**Resolution:** Adopted **A. Mirror REST** in run #8 (2026-04-26). Implementation
in `apps/api/src/jobs/jobs.resolver.ts` — `JobsResolver` now injects
`JobsAggregator` and runs the same `cache → fan-out → cache write
(raw) → dedup` pipeline as the REST controller. `SearchJobsInput.dedup`
defaults to `true` (opt-out via `dedup: false`). `SearchJobsResult`
gains additive fields (`deduped`, `rawCount`, `dedupMetrics`) for
parity with the REST envelope. Cache key is bumped to
`endpoint=graphql-search-v2` to invalidate v1 entries cleanly. 14
resolver unit tests cover the parity matrix.

---

## Q-009 — MinHash library choice for Spec 003 Phase 3 stage 2 (T08)

**Context:** Spec 003 plan.md §4 Dependencies suggests `datasketch-js`. Run #4
verified that crate's npm presence is patchy (only one published version, last
push 2017, no TypeScript types). The next stage of the dedup pipeline needs
MinHash + LSH for near-duplicate detection of long descriptions; we have to
choose between a third-party library and a small in-tree implementation.

**Options:**

- **A. `minhash` npm package** (~12 KB, MIT, ~150 K weekly downloads,
  TypeScript types via `@types/minhash`) — battle-tested, but does not ship
  LSH bucketing; we would still write the LSH banding wrapper in-tree.
- **B. `datasketch-js`** — the spec's original suggestion. Stale and untyped;
  mostly a port of Python's `datasketch`. Risk: pulls in extra deps, no
  recent maintainer.
- **C. In-tree implementation** under `packages/plugins/dedup-hybrid/src/strategies/minhash.ts`
  using `crypto.createHash('sha1')` for permutation hashing plus a small LSH
  banding helper. ~150 LOC; no extra deps; full control over signature
  width, band count, and the hot loop.

**Default (proceeding):** **C. In-tree** — keeps the Phase 3 commit zero-dep,
gives us a deterministic baseline for the perf gate (NFR-1 / NFR-2), and
matches AGENTS.md §6 ("Reuse existing libs **when popular & well-maintained**"
— `minhash` qualifies on popularity but we still need to write the LSH layer
ourselves either way, so the dep buys us very little). If perf or correctness
falls short we'll revisit option A in T08 follow-up.

**Resolution:** Adopted **C. In-tree** in run #5 (2026-04-26). Implementation
in `packages/plugins/dedup-hybrid/src/minhash.ts` — 128-permutation MinHash,
LSH banding (B=16, R=8), seeded affine permutations, FNV-1a shingle hashing.
Zero dependencies; deterministic given seed. Will revisit option A only if
the perf benchmark or golden-set precision regresses.

---

## Q-008 — Scrubbing legacy "ported from <competitor>" comments in source files

**Context:** The scheduled-task brief forbids competitor mentions inside this
repo. Run #3 found ~7 pre-existing files with `Ported from <repo>/...` doc
comments (`packages/common/src/utils/experience-extractor.ts`, several
`packages/plugins/source-ats-*/src/*.types.ts`, README acknowledgements,
plus a "StapplyMap" UA string in
`packages/plugins/source-company-cursor/src/cursor.service.ts`).

The brief also says "do NOT remove anything (move or improve is OK)", so a
silent purge isn't appropriate.

**Options:**

- **A. Spec it.** Open a small "Spec 006 — Scrub external-project mentions"
  with a deterministic find-and-rewrite list. Each comment becomes a neutral
  "Reference implementation in upstream Python project" with no name. README
  acknowledgements move to an external file (`/competitor-watch.md`).
- **B. Drop the comments wholesale.** Safe for code; loses provenance breadcrumb.
- **C. Leave as-is** — accept the brief's rule is about *new* mentions, not
  pre-existing breadcrumbs.

**Default (proceeding):** **A. Spec it** — keeps history navigable, satisfies
the rule, and gives the cleanup a reviewable diff. Spec will be authored
next run; this run does not touch the legacy comments to keep the
Spec-003-Phase-1+2 commit focused.

**Resolution:** _pending review._

---

## Q-007 — One spec per new source plugin, or one bulk spec for multiple adoptions?

**Context:** Run #2 identified 6 new platforms to adopt
(`source-ats-avature`, `source-ats-gem`, `source-ats-joincom`, `source-ats-oracle`,
`source-mercor`, `source-company-tesla`). Each is similar in shape (URL-pattern
discovery, list endpoint, detail endpoint), so per-plugin specs would be
repetitive.

**Options:**

- **A. One spec per plugin** — six specs (006–011). Cleaner status tracking; each
  plugin can ship independently.
- **B. One bulk "Source-plugin batch — Apr 2026" spec** — single spec with six
  Phase blocks. Less duplication; cohesive review.
- **C. One per category:** an "ATS batch" spec (Avature, Gem, Join.com, Oracle),
  a "Niche / Marketplace" spec (Mercor), a "Company-direct batch" spec (Tesla).

**Default (proceeding):** **A. One spec per plugin** — gives the scheduling
loop a finer granularity and matches the 1-spec-1-package convention used for
the existing 160 plugins. Future runs can opt into bulk specs if review fatigue
shows up.

**Resolution:** _pending review._

---

## Q-006 — Should we adopt **NestJS BullMQ** or **NestJS Bull** for background jobs?

**Context:** Many planned features (scheduled scrapes, dedup, alerts) need queues.

**Options:**

- **A. BullMQ + `@nestjs/bullmq`** — modern, TypeScript-first, supports flows, latest.
- **B. Bull + `@nestjs/bull`** — older, more legacy examples online.
- **C. PostgreSQL-based pg-boss** — no Redis dep, single store.

**Default (proceeding):** **A. BullMQ + `@nestjs/bullmq`** — newest stable, fits perf goals.

**Resolution:** _pending review._

---

## Q-005 — Default persistence backend for jobs?

**Context:** Spec 004 introduces a pluggable persistence layer.

**Options:**

- **A. PostgreSQL (Prisma)** — relational, mature, ecosystem-friendly.
- **B. MongoDB (Mongoose)** — flexible schema for varying source payloads.
- **C. SQLite (Drizzle)** — zero-ops local dev; not for prod.

**Default (proceeding):** **A. PostgreSQL via Prisma** for prod, plus a SQLite Drizzle
adaptor for dev. Both behind the `IJobStore` plugin contract.

**Resolution:** _pending review._

---

## Q-004 — Dedup hashing strategy?

**Context:** Spec 003 needs to identify "the same job" across sources.

**Options:**

- **A. SHA-256 of `(canonicalCompanyName, canonicalJobTitle, canonicalLocation)`** —
  simple, deterministic, collisions on edge cases.
- **B. MinHash / Locality-Sensitive Hashing on description** — handles minor wording
  changes, more compute.
- **C. Hybrid:** A for fast path, fall back to B when score below threshold.

**Default (proceeding):** **C. Hybrid** with B reserved for pairs with same hash prefix.

**Resolution:** _pending review._

---

## Q-003 — How aggressive should the circuit breaker default be?

**Context:** Spec 005.

**Options:**

- **A. Open after 5 consecutive failures, half-open at 30 s.**
- **B. Open after 3 consecutive failures, half-open at 60 s.**
- **C. Failure-rate window (50% over last 30 calls).**

**Default (proceeding):** **A** (matches constitution Article 6 §2).

**Resolution:** _pending review._

---

## Q-002 — Should specs live under `.specify/specs/` *or* `docs/specs/` *or both*?

**Context:** GitHub Spec Kit canonical location is `.specify/specs/`. The task brief
also asks for everything to be discoverable in `docs/`.

**Options:**

- **A. Canonical `.specify/specs/` + auto-generated `docs/specs/` mirrors.**
- **B. Single location: `.specify/specs/`; `docs/index.md` links to them.**
- **C. Single location: `docs/specs/`; abandon `.specify/`.**

**Default (proceeding):** **B. Canonical `.specify/specs/`**, indexed from `docs/index.md`.
Avoids duplication; preserves Spec-Kit conventions.

**Resolution:** _pending review._

---
