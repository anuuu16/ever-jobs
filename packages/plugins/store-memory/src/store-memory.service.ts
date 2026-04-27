import { Injectable } from '@nestjs/common';
import {
  CanonicalJob,
  ERR_STORE_INVALID_CURSOR,
  IJobObservationStore,
  IJobStore,
  JOB_STORE_QUERY_DEFAULT_LIMIT,
  JOB_STORE_QUERY_MAX_LIMIT,
  JobStorePage,
  JobStoreQuery,
  SourceObservation,
} from '@ever-jobs/models';
import { StorePlugin } from '@ever-jobs/plugin';

/**
 * Canonical id under which this backend registers with `StoreRegistry`.
 * Operators select it via `EVER_JOBS_STORE=memory`. Exported so consumers
 * (`apps/api`'s root module, integration tests) can import the constant
 * instead of hard-coding the string literal.
 */
export const STORE_MEMORY_ID = 'memory';

/**
 * One-line description shown by `GET /api/storage` and the CLI's
 * `stores list` subcommand for operator triage.
 */
export const STORE_MEMORY_DESCRIPTION =
  'In-memory reference store (Spec 004 — dev / tests, no persistence)';

/**
 * Stable opaque-cursor envelope (base64-encoded JSON).
 *
 * In-memory backend uses a logical row offset because the dataset is
 * already sorted deterministically (mergedAt DESC, canonicalJobId ASC).
 * The `v` discriminator lets a future change to cursor shape detect
 * and reject older clients with a structured `ERR_STORE_INVALID_CURSOR`
 * rather than silently desync them.
 */
interface MemoryCursor {
  readonly v: 1;
  readonly offset: number;
}

const MEMORY_CURSOR_VERSION = 1;

/**
 * Error type thrown for malformed pagination cursors. Carries the
 * Spec 004 §7.3 wire code so callers and the conformance suite can
 * `expect(...).toMatchObject({ code: ERR_STORE_INVALID_CURSOR })`
 * without coupling to a specific class.
 */
class MemoryStoreCursorError extends Error {
  readonly code: string = ERR_STORE_INVALID_CURSOR;

  constructor(detail: string) {
    super(`Malformed JobStoreQuery cursor (${detail})`);
    this.name = 'MemoryStoreCursorError';
  }
}

/**
 * Encode an opaque cursor for the next page. Base64 keeps the cursor
 * URL-safe-enough for a JSON wire payload; callers MUST treat it as
 * a black box per the contract.
 */
function encodeCursor(cursor: MemoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');
}

/**
 * Decode and validate the opaque cursor. Surface `ERR_STORE_INVALID_CURSOR`
 * for every reject path: not-base64, not-json, missing fields, wrong
 * version, non-integer / negative offset. Silent fallback to "page 1"
 * is the failure mode this code path was created to prevent — operators
 * watching the dataset shrink will spot a thrown error in logs; a
 * silently-reset cursor will go unnoticed for hours.
 */
function decodeCursor(raw: string): MemoryCursor {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, 'base64').toString('utf8');
  } catch {
    throw new MemoryStoreCursorError('not base64');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new MemoryStoreCursorError('not JSON');
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new MemoryStoreCursorError('not an object');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== MEMORY_CURSOR_VERSION) {
    throw new MemoryStoreCursorError(`unsupported version ${String(obj.v)}`);
  }
  const offset = obj.offset;
  if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
    throw new MemoryStoreCursorError('offset is not a non-negative integer');
  }
  return { v: MEMORY_CURSOR_VERSION, offset };
}

/**
 * Resolve the effective `limit` for a query. The contract docs say
 * "default to {@link JOB_STORE_QUERY_DEFAULT_LIMIT} when omitted" and
 * "clamp to {@link JOB_STORE_QUERY_MAX_LIMIT}". A non-finite or
 * non-positive caller value falls back to the default rather than
 * throwing — caller hostility is the dedup engine's responsibility,
 * not the store's.
 */
function resolveLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
    return JOB_STORE_QUERY_DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(limit), JOB_STORE_QUERY_MAX_LIMIT);
}

/**
 * Ordering used by `listByQuery`: most-recent-first by `mergedAt`,
 * tie-broken by `canonicalJobId` ASC for total determinism (so cursor
 * pagination can resume by offset without surprising callers when two
 * jobs share an identical `mergedAt`).
 */
function compareForListing(a: CanonicalJob, b: CanonicalJob): number {
  if (a.mergedAt > b.mergedAt) return -1;
  if (a.mergedAt < b.mergedAt) return 1;
  if (a.canonicalJobId < b.canonicalJobId) return -1;
  if (a.canonicalJobId > b.canonicalJobId) return 1;
  return 0;
}

/**
 * In-memory reference implementation of `IJobStore` + `IJobObservationStore`
 * (Spec 004 / Phase 2 / T05–T06).
 *
 * Backing data structures:
 *   - `Map<canonicalJobId, CanonicalJob>` — primary keyed lookup.
 *   - `Map<canonicalJobId, SourceObservation[]>` — observations.
 *
 * Cursor pagination uses a base64-encoded `{ v: 1, offset }` envelope
 * over a deterministic ordering (mergedAt DESC, canonicalJobId ASC).
 * Filters honour Spec 004 §7.1 / FR-7: case-insensitive substring on
 * `company` / `title` / `location`, plus an inclusive lower bound on
 * `mergedAt` (`since`).
 *
 * Memory characteristics (Spec 004 / NFR-3 — ≤ 2 KB / job):
 *   The implementation stores each `CanonicalJob` reference verbatim;
 *   no copies, no indexes. Memory overhead is exactly the JSON shape
 *   the dedup engine produced. Observations are stored as a flat array
 *   keyed by canonical id — `putAll` discards the old array reference
 *   so GC can reclaim it immediately.
 *
 * Concurrency: single-threaded JS makes mutations atomic at the method
 * granularity. Concurrent `upsert` for distinct ids is safe; concurrent
 * `upsertMany` batches with overlapping ids race in caller order
 * (later writer wins), matching the contract's "concurrent upsert calls
 * for different canonicalJobIds may complete in any order" caveat.
 *
 * Decorated with `@StorePlugin({ id: 'memory' })` so
 * `StoreModule.forActive('memory', { backends: [InMemoryJobStore] })`
 * picks it up at bootstrap. The decorator is `SetMetadata` under the
 * hood — it does not introduce a NestJS-DI runtime dependency, so
 * the conformance suite can still `new InMemoryJobStore()` directly
 * without spinning up a `TestingModule`.
 */
@StorePlugin({ id: STORE_MEMORY_ID, description: STORE_MEMORY_DESCRIPTION })
@Injectable()
export class InMemoryJobStore implements IJobStore, IJobObservationStore {
  private readonly canonicals = new Map<string, CanonicalJob>();
  private readonly observations = new Map<string, SourceObservation[]>();

  // ----------------------------------------------------------------------
  // IJobStore
  // ----------------------------------------------------------------------

  async upsert(job: CanonicalJob): Promise<CanonicalJob> {
    this.canonicals.set(job.canonicalJobId, job);
    return job;
  }

  async upsertMany(
    jobs: ReadonlyArray<CanonicalJob>,
  ): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;
    for (const job of jobs) {
      if (this.canonicals.has(job.canonicalJobId)) {
        updated++;
      } else {
        inserted++;
      }
      this.canonicals.set(job.canonicalJobId, job);
    }
    return { inserted, updated };
  }

  async getById(id: string): Promise<CanonicalJob | null> {
    return this.canonicals.get(id) ?? null;
  }

  async findByCanonicalId(canonicalJobId: string): Promise<CanonicalJob | null> {
    // Aliased intentionally per Spec 004 §7.1 — the two ids are the
    // same field; the second method name exists for caller clarity
    // when the value flowed in from the dedup engine's typed `canonicalJobId`.
    return this.getById(canonicalJobId);
  }

  async listByQuery(query: JobStoreQuery): Promise<JobStorePage<CanonicalJob>> {
    const limit = resolveLimit(query.limit);
    // `typeof === 'string'` (NOT truthy) so an explicit empty-string
    // cursor doesn't silently fall through to "page 1" — a caller that
    // sent `cursor: ''` deserves the structured `ERR_STORE_INVALID_CURSOR`
    // signal, same as any other malformed cursor.
    const offset =
      typeof query.cursor === 'string' ? decodeCursor(query.cursor).offset : 0;

    const lcCompany = query.company?.toLowerCase();
    const lcTitle = query.title?.toLowerCase();
    const lcLocation = query.location?.toLowerCase();
    const sinceIso = query.since instanceof Date ? query.since.toISOString() : undefined;

    // Single-pass filter — avoids materialising the unfiltered set
    // when the cohort is large and the filter is selective.
    const filtered: CanonicalJob[] = [];
    for (const job of this.canonicals.values()) {
      if (lcCompany && !job.company.toLowerCase().includes(lcCompany)) continue;
      if (lcTitle && !job.title.toLowerCase().includes(lcTitle)) continue;
      if (lcLocation && !job.location.toLowerCase().includes(lcLocation)) continue;
      if (sinceIso && job.mergedAt < sinceIso) continue;
      filtered.push(job);
    }

    filtered.sort(compareForListing);

    const items = filtered.slice(offset, offset + limit);
    // `items` is the slice we'll return; build a `JobStorePage` whose
    // `nextCursor` is OMITTED (key absent, not `nextCursor: undefined`)
    // when we've reached the end so JSON callers see a clean payload.
    const hasMore = offset + items.length < filtered.length;
    if (hasMore) {
      return {
        items,
        nextCursor: encodeCursor({ v: MEMORY_CURSOR_VERSION, offset: offset + items.length }),
      };
    }
    return { items };
  }

  async delete(id: string): Promise<boolean> {
    const existed = this.canonicals.delete(id);
    if (existed) {
      // Cascade per Spec 004 §7.1 — a re-scrape MUST NOT resurrect
      // stale observations attached to a soft-deleted canonical row.
      this.observations.delete(id);
    }
    return existed;
  }

  // ----------------------------------------------------------------------
  // IJobObservationStore
  // ----------------------------------------------------------------------

  async putAll(
    canonicalJobId: string,
    observations: ReadonlyArray<SourceObservation>,
  ): Promise<void> {
    // Replace-not-merge per FR-2: we copy the input array so future
    // mutations on the caller's reference don't bleed into the store
    // (and vice-versa). The dedup engine is the single writer per
    // Spec 003 / FR-1, but defensive copy is cheap (~N pointers).
    this.observations.set(canonicalJobId, observations.slice());
  }

  async listByCanonicalId(
    canonicalJobId: string,
  ): Promise<ReadonlyArray<SourceObservation>> {
    const found = this.observations.get(canonicalJobId);
    if (!found) return [];
    // Return a frozen view so callers cannot mutate the store's
    // internal array. The slice is intentional — `Object.freeze`
    // alone would not stop a sneaky `[].push` if we returned the
    // live array.
    return found.slice();
  }

  async deleteByCanonicalId(canonicalJobId: string): Promise<number> {
    const existing = this.observations.get(canonicalJobId);
    if (!existing) return 0;
    this.observations.delete(canonicalJobId);
    return existing.length;
  }

  // ----------------------------------------------------------------------
  // Test / debug surface (not part of either interface contract).
  // ----------------------------------------------------------------------

  /**
   * Total canonical rows currently stored. Intended for diagnostics and
   * tests; production callers SHOULD use `listByQuery` for any business
   * logic.
   */
  get size(): number {
    return this.canonicals.size;
  }

  /**
   * Drop every row + observation. Tests use this between cases when
   * the same instance is shared across `it()` blocks; `factory()` in
   * the conformance suite returns a fresh instance per case so prod
   * code SHOULD not call this.
   */
  clear(): void {
    this.canonicals.clear();
    this.observations.clear();
  }
}

