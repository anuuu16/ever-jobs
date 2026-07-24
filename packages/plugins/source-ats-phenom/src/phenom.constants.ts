/**
 * Phenom People careers "widgets" API constants.
 *
 * The public search endpoint is `POST https://{host}/widgets` with a
 * `ddoKey: "refineSearch"` body — NOT the old (incorrect)
 * `https://jobs.{slug}.com/api/jobs`, which 301/404'd on every real tenant.
 * The `{host}` is the tenant's actual careers hostname (varies per company:
 * careers.southwestair.com, careers.united.com, jobs.thecignagroup.com, …),
 * so it's carried as the `companySlug` / `companyUrl` rather than templated.
 */

/** Path appended to a tenant's careers host to reach the search API. */
export const PHENOM_WIDGETS_PATH = "/widgets";

/**
 * Default locale segment for the canonical job-listing URL
 * (`https://{host}/{locale}/job/{jobSeqNo}`). Most Phenom sites serve their
 * US/English listings under `us/en`; a job's own `locale` overrides this.
 */
export const PHENOM_DEFAULT_LOCALE_PATH = "us/en";

/** Default headers for Phenom widgets requests. */
export const PHENOM_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Page size per search request (the widgets API pages via `from`/`size`). */
export const PHENOM_PAGE_SIZE = 25;

/** Delay (ms) between pagination requests, to stay gentle on the tenant host. */
export const PHENOM_REQUEST_DELAY_MS = 500;
