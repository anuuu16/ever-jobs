/**
 * resolve-ambiguous-workday-urls.ts
 *
 * Follow-up to `backfill-mylivecv-prod-workday-urls.ts` / `backfill-workday-job-urls.ts`.
 * Those two skip any broken Workday URL whose company subdomain maps to MORE
 * THAN ONE registered career site in `ATS_COMPANY_DIRECTORY.workday` (e.g.
 * "roche" -> both "ROG-A2O-GENE" and "roche-ext") — picking one blind would
 * silently send some fraction of jobs to a 404.
 *
 * A first version of this script tried live-GETting the public page under
 * each candidate site and keeping whichever one 200'd — that turned out
 * unreliable: for tenants running multiple *currently active* site aliases
 * (roche, wisconsin, maersk, astrazeneca, snc, ...) BOTH aliases 200 for
 * ANY job path under that tenant, because the site segment doesn't gate
 * the public SPA shell at all. Confirmed live: querying roche's CXS detail
 * endpoint through EITHER "ROG-A2O-GENE" or "roche-ext" for the same job
 * returns identical `jobPostingInfo`, and — crucially — its `externalUrl`
 * field names the one TRUE site ("roche-ext") regardless of which alias
 * was queried. So instead of guessing among candidates, this fetches the
 * CXS detail JSON (same endpoint `workday.service.ts`'s `fetchDetails`
 * calls) through any one candidate and trusts `externalUrl`'s own site
 * segment as authoritative.
 *
 *   - `externalUrl` resolves      -> resolved, added to the fix plan
 *   - CXS detail fetch fails/lacks externalUrl -> still unresolved;
 *     reported for manual review/removal, never guessed
 *
 * Reads broken rows from a `company|id|url` (pipe-separated) input file —
 * generate one with e.g.:
 *   psql "$MYLIVECV_PROD_DATABASE_URL" -t -A -c "
 *     select id || '|' || \"jobUrl\" from mylivecv.\"AggregatedJob\"
 *     where \"jobUrl\" ~ 'myworkdayjobs.com'
 *       and \"jobUrl\" !~ 'myworkdayjobs\.com/[a-z]{2}(-[A-Za-z]{2,3})?/';" > rows.txt
 *
 * Defaults to a dry run: prints the resolution + writes a report. Pass
 * --apply to actually UPDATE `mylivecv."AggregatedJob"` through the same
 * connection as `backfill-mylivecv-prod-workday-urls.ts`
 * (`MYLIVECV_PROD_DATABASE_URL`, default the local SSH-tunnel port).
 *
 * Usage (via ts-node):
 *   ts-node --project tsconfig.base.json -r tsconfig-paths/register \
 *     scripts/resolve-ambiguous-workday-urls.ts --in rows.txt [--apply] [--concurrency 3] [--out report.json]
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { execFileSync } from 'child_process';

import { buildDirectoryIndex, chunk, sqlLiteral } from './lib/workday-url-fix';
import { withWorkdayLocale } from '../packages/plugins/source-ats-workday/src/workday.constants';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36';

const HOST_RE = /^https:\/\/([^./]+)\.wd(\d+)\.myworkdayjobs\.com(\/.*)$/i;

interface InputRow {
  readonly id: string;
  readonly url: string;
}

interface Resolution {
  readonly id: string;
  readonly oldUrl: string;
  readonly newUrl: string;
  readonly matchedSite: string;
}

interface Unresolved {
  readonly id: string;
  readonly url: string;
  readonly reason: string;
  readonly candidateResults: Array<{ site: string; url: string; status: number | string }>;
}

function connectionUrl(): string {
  return process.env.MYLIVECV_PROD_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
}

function runPsqlFile(filePath: string): string {
  return execFileSync('psql', [connectionUrl(), '-v', 'ON_ERROR_STOP=1', '-f', filePath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CxsDetailOutcome {
  readonly status: number;
  readonly externalUrl: string | null;
}

/** GETs the CXS detail endpoint (same one `workday.service.ts`'s `fetchDetails`
 * calls) and pulls `jobPostingInfo.externalUrl` out of the JSON, if present. */
function fetchCxsExternalUrl(url: string, timeoutMs: number): Promise<CxsDetailOutcome | 'network-error'> {
  return new Promise((resolve) => {
    const req = https.request(
      url,
      { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': UA }, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          const status = res.statusCode ?? 0;
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const externalUrl = body?.jobPostingInfo?.externalUrl;
            resolve({ status, externalUrl: typeof externalUrl === 'string' ? externalUrl : null });
          } catch {
            resolve({ status, externalUrl: null });
          }
        });
      },
    );
    req.on('error', () => resolve('network-error'));
    req.on('timeout', () => {
      req.destroy();
      resolve('network-error');
    });
    req.end();
  });
}

function readInputRows(inPath: string): InputRow[] {
  const text = fs.readFileSync(inPath, 'utf8');
  const rows: InputRow[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const sep = line.indexOf('|');
    if (sep < 0) continue;
    rows.push({ id: line.slice(0, sep), url: line.slice(sep + 1) });
  }
  return rows;
}

/** Pulls the site segment back out of a Workday externalUrl/rawPath (the
 * first path component after any locale segment already stripped by the
 * caller, or straight after the leading slash when there's no locale). */
function extractSiteFromPath(rawPath: string): string | null {
  const withoutLeadingSlash = rawPath.replace(/^\//, '');
  const firstSegment = withoutLeadingSlash.split('/')[0];
  return firstSegment || null;
}

async function resolveOne(
  row: InputRow,
  directory: ReturnType<typeof buildDirectoryIndex>,
  timeoutMs: number,
): Promise<Resolution | Unresolved> {
  const match = row.url.match(HOST_RE);
  if (!match) {
    return { id: row.id, url: row.url, reason: 'does not match the expected Workday host pattern', candidateResults: [] };
  }
  const [, company, wdNumber, rawPath] = match;
  const host = `https://${company}.wd${wdNumber}.myworkdayjobs.com`;
  const candidates = directory.get(company.toLowerCase()) ?? [];

  // Workday's CXS detail endpoint doesn't actually gate on which site alias
  // you query through (confirmed live: roche's "ROG-A2O-GENE" and
  // "roche-ext" both return the SAME job JSON for the same path) — so any
  // one candidate works as the query vehicle. What matters is
  // `jobPostingInfo.externalUrl`, which names the one TRUE site regardless.
  const probeSite = candidates[0]?.site;
  if (!probeSite) {
    return { id: row.id, url: row.url, reason: `no ATS directory entry for company "${company}"`, candidateResults: [] };
  }
  const detailUrl = `${host}/wday/cxs/${company}/${probeSite}${rawPath}`;
  const outcome = await fetchCxsExternalUrl(detailUrl, timeoutMs);

  if (outcome === 'network-error') {
    return {
      id: row.id,
      url: row.url,
      reason: 'network error fetching CXS detail',
      candidateResults: [{ site: probeSite, url: detailUrl, status: 'network-error' }],
    };
  }
  if (outcome.status !== 200 || !outcome.externalUrl) {
    return {
      id: row.id,
      url: row.url,
      reason: `CXS detail returned status=${outcome.status}, externalUrl=${outcome.externalUrl}`,
      candidateResults: [{ site: probeSite, url: detailUrl, status: outcome.status }],
    };
  }

  const externalMatch = outcome.externalUrl.match(HOST_RE);
  const trueSite = externalMatch ? extractSiteFromPath(externalMatch[3]) : null;
  if (!trueSite) {
    return {
      id: row.id,
      url: row.url,
      reason: `could not parse a site segment out of externalUrl "${outcome.externalUrl}"`,
      candidateResults: [{ site: probeSite, url: detailUrl, status: outcome.status }],
    };
  }

  const matchingEntry = candidates.find((c) => c.site.toLowerCase() === trueSite.toLowerCase());
  const locale = matchingEntry?.locale ?? 'en-US';
  const newUrl = `${host}${withWorkdayLocale(rawPath, trueSite, locale)}`;
  return { id: row.id, oldUrl: row.url, newUrl, matchedSite: trueSite };
}

async function resolveAll(
  rows: InputRow[],
  directory: ReturnType<typeof buildDirectoryIndex>,
  concurrency: number,
  delayMs: number,
  timeoutMs: number,
): Promise<{ resolved: Resolution[]; unresolved: Unresolved[] }> {
  const resolved: Resolution[] = [];
  const unresolved: Unresolved[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < rows.length) {
      const idx = cursor++;
      const row = rows[idx];
      if (delayMs > 0) await sleep(delayMs);
      const result = await resolveOne(row, directory, timeoutMs);
      if ('newUrl' in result) {
        resolved.push(result);
        console.log(`  ✓ ${row.url} -> [${result.matchedSite}] ${result.newUrl}`);
      } else {
        unresolved.push(result);
        console.log(`  ✗ ${row.url} — ${result.reason}`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, rows.length) }, () => worker());
  await Promise.all(workers);
  return { resolved, unresolved };
}

function buildApplySql(resolutions: Resolution[]): string {
  const values = resolutions
    .map((r) => `(${sqlLiteral(r.id)}, ${sqlLiteral(r.oldUrl)}, ${sqlLiteral(r.newUrl)})`)
    .join(',\n    ');
  return `
BEGIN;
UPDATE mylivecv."AggregatedJob" AS a
SET "jobUrl" = v.new_url, "updatedAt" = now()
FROM (VALUES
    ${values}
) AS v(id, old_url, new_url)
WHERE a.id = v.id AND a."jobUrl" = v.old_url;
COMMIT;
`;
}

function parseArgs(argv: string[]): {
  inPath: string;
  apply: boolean;
  concurrency: number;
  delayMs: number;
  timeoutMs: number;
  out: string;
} {
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    inPath: get('--in', ''),
    apply: argv.includes('--apply'),
    concurrency: Number(get('--concurrency', '3')),
    delayMs: Number(get('--delay', '400')),
    timeoutMs: Number(get('--timeout', '15000')),
    out: get('--out', '.workday-ambiguous-resolution-report.json'),
  };
}

async function main(): Promise<void> {
  const { inPath, apply, concurrency, delayMs, timeoutMs, out } = parseArgs(process.argv.slice(2));
  if (!inPath) throw new Error('--in <file> is required (pipe-separated id|url lines)');

  const rows = readInputRows(inPath);
  console.log(`Resolving ${rows.length} ambiguous Workday url(s) @ concurrency ${concurrency}…\n`);

  const directory = buildDirectoryIndex();
  const { resolved, unresolved } = await resolveAll(rows, directory, concurrency, delayMs, timeoutMs);

  console.log(`\n── Summary ──`);
  console.log(`  resolved:   ${resolved.length}`);
  console.log(`  unresolved: ${unresolved.length}`);

  const reportPath = path.resolve(process.cwd(), out);
  fs.writeFileSync(reportPath, JSON.stringify({ resolved, unresolved }, null, 2) + '\n');
  console.log(`\nFull report written to ${reportPath}`);

  if (!apply) {
    console.log(`\nDry run only — no data changed. Re-run with --apply to execute.`);
    return;
  }

  if (resolved.length === 0) {
    console.log(`\nNothing resolved — nothing to apply.`);
    return;
  }

  const sql = buildApplySql(resolved);
  const sqlPath = path.resolve(process.cwd(), '.workday-ambiguous-resolution.sql');
  fs.writeFileSync(sqlPath, sql);
  runPsqlFile(sqlPath);
  console.log(`\nApplied ${resolved.length} resolved fixes. SQL saved to ${sqlPath} for audit.`);
}

if (require.main === module) {
  void main();
}
