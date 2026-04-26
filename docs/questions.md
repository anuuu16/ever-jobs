# Open Questions

> Each question records:
> - **Context** — why the question came up.
> - **Options** — A/B/C with trade-offs.
> - **Default** — option proceeded with so the schedule isn't blocked.
> - **Resolution** — set when the human owner decides; note the date and the chosen option.
>
> Add new questions at the **top**. Resolved questions stay here for traceability.

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
