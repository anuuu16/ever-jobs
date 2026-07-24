/**
 * TypeScript interfaces for the Phenom People careers "widgets" API.
 *
 * Phenom career sites (e.g. careers.southwestair.com, careers.united.com)
 * expose a public search endpoint at `POST https://{host}/widgets` with a
 * `ddoKey: "refineSearch"` body. The response nests the job list under
 * `refineSearch.data.jobs`. Field shapes below were captured from live
 * responses across several tenants (Southwest, United, Cencora, Cigna, …).
 */

/** One job record as returned inside `refineSearch.data.jobs`. */
export interface PhenomJob {
  /** Requisition id, e.g. "R-2026-69180". */
  jobId?: string | null;
  /** Alternate requisition id — usually identical to `jobId`. */
  reqId?: string | null;
  /**
   * Stable per-posting sequence id used in the canonical listing URL
   * (`/{locale}/job/{jobSeqNo}/...`), e.g. "SOUTUSR202669180ENUSEXTERNAL".
   */
  jobSeqNo?: string | null;
  title?: string | null;
  /** Short teaser blurb — the only description the search response carries. */
  descriptionTeaser?: string | null;
  category?: string | null;
  department?: string | null;
  /** Employment type, e.g. "Full time Regular". */
  type?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  /** Display location, e.g. "Dallas, Texas, United States of America". */
  location?: string | null;
  cityState?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** ISO-8601 posted date. */
  postedDate?: string | null;
  /** ISO-8601 creation date (fallback for `postedDate`). */
  dateCreated?: string | null;
  /** The external apply link (often a Workday/Taleo URL). */
  applyUrl?: string | null;
  /** Whether apply happens on an external system rather than in Phenom. */
  externalApply?: boolean | null;
  /** BCP-ish locale of the posting, e.g. "en_US". */
  locale?: string | null;
  /** ML-extracted skill tags. */
  ml_skills?: string[] | null;
}

/** The `refineSearch` slice of a widgets response. */
export interface PhenomRefineSearch {
  status?: number;
  hits?: number;
  totalHits?: number;
  data?: {
    jobs?: PhenomJob[];
  } | null;
}

/** Top-level widgets response for a `refineSearch` request. */
export interface PhenomWidgetsResponse {
  refineSearch?: PhenomRefineSearch | null;
}
