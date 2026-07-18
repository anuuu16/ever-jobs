/**
 * Shared "repair a broken Workday job URL" logic, used by both
 * `scripts/backfill-workday-job-urls.ts` (local everjobs store) and
 * `scripts/backfill-mylivecv-prod-workday-urls.ts` (production mylivecv DB).
 *
 * Two distinct broken shapes exist in persisted data (both predate the
 * `withWorkdayLocale` fix in
 * packages/plugins/source-ats-workday/src/workday.constants.ts):
 *
 *   1. `https://{co}.wd{n}.myworkdayjobs.com/{site}/job/...`   — missing locale only
 *   2. `https://{co}.wd{n}.myworkdayjobs.com/job/...`          — missing BOTH site and
 *                                                                 locale (a real 404
 *                                                                 on Workday's public site)
 *
 * Shape 2 can only be repaired by recovering `site` from
 * `ATS_COMPANY_DIRECTORY.workday` (keyed by the host's company subdomain).
 * A handful of companies run multiple Workday tenants under the same
 * subdomain (e.g. "roche", "baxter") — those are AMBIGUOUS and reported,
 * never guessed.
 */
import { ATS_COMPANY_DIRECTORY } from '../../apps/api/src/admin/ats-company-directory';
import { withWorkdayLocale } from '../../packages/plugins/source-ats-workday/src/workday.constants';

const HOST_RE = /^https:\/\/([^./]+)\.wd(\d+)\.myworkdayjobs\.com(\/.*)$/i;
const NO_SITE_SEGMENT_RE = /^\/(job|details)(\/|$)/i;
const LOCALE_SEGMENT_RE = /^\/[a-z]{2}(-[a-zA-Z]{2,3})?(?=\/)/;

export interface DirectoryEntry {
  readonly site: string;
  readonly locale: string;
}

export interface SkipReason {
  readonly url: string;
  readonly reason: string;
}

/** company subdomain (lowercased) -> every Workday tenant registered under it. */
export function buildDirectoryIndex(): Map<string, DirectoryEntry[]> {
  const index = new Map<string, DirectoryEntry[]>();
  for (const entry of ATS_COMPANY_DIRECTORY.workday ?? []) {
    const parts = entry.slug.split(':');
    const company = parts[0]?.toLowerCase();
    if (!company) continue;
    const site = parts[2] ?? 'External';
    const locale = parts[3] ?? 'en-US';
    const list = index.get(company) ?? [];
    list.push({ site, locale });
    index.set(company, list);
  }
  return index;
}

export function computeWorkdayUrlFix(
  url: string,
  directory: Map<string, DirectoryEntry[]>,
): { newUrl: string } | { skip: SkipReason } {
  const match = url.match(HOST_RE);
  if (!match) return { skip: { url, reason: 'does not match the expected Workday host pattern' } };

  const [, company, wdNumber, rawPath] = match;
  const host = `https://${company}.wd${wdNumber}.myworkdayjobs.com`;

  if (LOCALE_SEGMENT_RE.test(rawPath)) {
    return { newUrl: url }; // already correct — no-op, filtered out by caller
  }

  const candidates = directory.get(company.toLowerCase()) ?? [];

  if (NO_SITE_SEGMENT_RE.test(rawPath)) {
    // Shape 2: site segment missing entirely — only the directory can recover it.
    if (candidates.length === 0) {
      return { skip: { url, reason: `no ATS directory entry for company "${company}" — site unrecoverable` } };
    }
    if (candidates.length > 1) {
      return {
        skip: {
          url,
          reason: `ambiguous — ${candidates.length} Workday tenants registered for "${company}" (${candidates.map((c) => c.site).join(', ')})`,
        },
      };
    }
    const { site, locale } = candidates[0];
    return { newUrl: `${host}${withWorkdayLocale(rawPath, site, locale)}` };
  }

  // Shape 1: a site segment is already present in the path — keep it, just
  // add the locale. Prefer the directory's locale when this exact site is
  // registered (handles per-tenant overrides like IQVIA's en-GB); default
  // to en-US otherwise.
  const siteSegment = rawPath.slice(1, rawPath.indexOf('/', 1) === -1 ? undefined : rawPath.indexOf('/', 1));
  const matchingEntry = candidates.find((c) => c.site.toLowerCase() === siteSegment.toLowerCase());
  const locale = matchingEntry?.locale ?? 'en-US';
  return { newUrl: `${host}${withWorkdayLocale(rawPath, siteSegment, locale)}` };
}

export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
