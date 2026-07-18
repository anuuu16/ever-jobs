import { FieldWithProvenance } from './field-with-provenance.interface';
import { SourceObservation } from './source-observation.interface';

/**
 * A deduplicated, source-merged job posting.
 *
 * Produced by the dedup engine (Spec 003). One `CanonicalJob` represents one
 * logical role even if N different sources surfaced it. The flat top-level
 * fields (`title`, `company`, `location`, ...) hold the resolver-elected
 * "best" values; `fields` carries every field with provenance for callers
 * that need to inspect how the merge happened.
 */
export interface CanonicalJob {
  /** sha-256(normCompany | normTitle | normLocation). Stable across runs. */
  readonly canonicalJobId: string;

  // Flat shortcuts — duplicated from `fields` for ergonomic access.
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly description?: string;
  /** The "primary" URL — picked by the merge resolver from `sources[].url`. */
  readonly url: string;
  /**
   * Whether this role is remote. Elected as `true` if ANY contributing
   * source reported it as remote (a boolean OR across the cluster), not
   * just whichever observation happened to become the merge "head" — a
   * single source under-detecting remote status (e.g. a bare location
   * string with no "remote" mention) must not override another source's
   * confident signal (an ATS's structured remote-type field). `undefined`
   * when no source reported a value either way.
   */
  readonly isRemote?: boolean;

  /** Every observation that contributed to this canonical record. */
  readonly sources: ReadonlyArray<SourceObservation>;

  /**
   * Per-field winning value with full provenance. Includes at least
   * `title`, `company`, `location`, `url`, plus any plugin-specific fields
   * the resolver decided to surface (e.g. `compensation`, `jobType`).
   */
  readonly fields: Readonly<Record<string, FieldWithProvenance<unknown>>>;

  /** ISO-8601 timestamp of the dedup pass that produced this record. */
  readonly mergedAt: string;
}
