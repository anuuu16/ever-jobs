/**
 * verify-ats-directory-slugs.ts
 *
 * Live-probes `ATS_COMPANY_DIRECTORY` entries (apps/api/src/admin/ats-company-directory.ts)
 * against their platform's real public API, so a slug never gets trusted (or committed)
 * purely on the strength of a web search / LLM guess. This is the standing verification
 * step for "add more sources": whenever new candidate entries are proposed for any ATS
 * platform, run them through here before they land in the directory file.
 *
 * Extensible per platform via the `PLATFORM_PROBES` map below — add a new key to verify
 * another ATS's directory entries. Only `workday` is implemented today (it's the one with
 * a compound, easy-to-get-wrong slug format: `{company}:{wdNumber}:{site}`); the plain-slug
 * platforms (lever, ashby, smartrecruiters, ...) are lower-risk to hand-verify and can get
 * an adapter added here the same way if they start seeing bulk additions.
 *
 * Never mutates the repo — reads the directory, hits each platform's live endpoint, and
 * writes a JSON report + prints a pass/fail summary to stdout.
 *
 * Usage (via ts-node):
 *   ts-node --project tsconfig.base.json -r tsconfig-paths/register \
 *     scripts/verify-ats-directory-slugs.ts --platform workday [--concurrency 3] [--out report.json]
 *
 * Verdicts per entry:
 *   - ok           — endpoint returned real jobPostings (count > 0). Trustworthy.
 *   - empty        — endpoint responded with the expected shape but zero jobs. The
 *                    company/wdNumber/tenant is real, but `site` may still be wrong
 *                    (or the board is genuinely empty right now) — needs a human glance.
 *   - bad-slug     — endpoint returned a real, parseable error response (e.g. Workday's
 *                    `errorCode: HTTP_422`). The slug is confirmed wrong.
 *   - not-found    — HTTP 404. Tenant/site combination doesn't exist.
 *   - blocked      — got an HTML/challenge page instead of JSON (Cloudflare bot-management
 *                    or similar). INCONCLUSIVE, not a confirmed failure — some Workday
 *                    tenants (e.g. Tesla) front their CXS endpoint with stricter bot
 *                    protection that blocks non-browser probes even for a fully valid slug.
 *   - network-error — timeout / DNS / connection failure.
 */
import * as fs from 'fs';
import * as https from 'https';
import { ATS_COMPANY_DIRECTORY, AtsCompanyEntry } from '../apps/api/src/admin/ats-company-directory';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36';

export type Verdict = 'ok' | 'empty' | 'bad-slug' | 'not-found' | 'blocked' | 'network-error';

export interface ProbeReportRow {
  readonly name: string;
  readonly slug: string;
  readonly verdict: Verdict;
  readonly detail: string;
}

interface HttpOutcome {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

interface PlatformProbe {
  /** Build the live request for a directory `slug` string. */
  request(slug: string): { url: string; method: 'GET' | 'POST'; body?: string };
  /** Classify a completed HTTP exchange into a verdict + human-readable detail. */
  classify(outcome: HttpOutcome): { verdict: Verdict; detail: string };
}

// ── Workday adapter ──────────────────────────────────────────

/**
 * Mirrors `parseWorkdaySlug` / `buildWorkdayUrl` in
 * packages/plugins/source-ats-workday/src/workday.constants.ts exactly, so this probes
 * the SAME endpoint the real scraper plugin calls — not a hand-rolled approximation.
 */
function workdayRequest(slug: string): { url: string; method: 'POST'; body: string } {
  const parts = slug.split(':');
  const company = parts[0];
  const wdNumber = parts[1] ?? '5';
  const site = parts[2] ?? 'External';
  return {
    url: `https://${company}.wd${wdNumber}.myworkdayjobs.com/wday/cxs/${company}/${site}/jobs`,
    method: 'POST',
    body: JSON.stringify({ appliedFacets: {}, limit: 5, offset: 0, searchText: '' }),
  };
}

function workdayClassify(outcome: HttpOutcome): { verdict: Verdict; detail: string } {
  const isJson = outcome.contentType.includes('application/json');
  if (!isJson) {
    // Cloudflare (and similar) challenge/block pages are served as text/html.
    return { verdict: 'blocked', detail: `non-JSON response (HTTP ${outcome.status}) — likely bot-protection, not a confirmed bad slug` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outcome.body);
  } catch {
    return { verdict: 'blocked', detail: `JSON content-type but unparseable body (HTTP ${outcome.status})` };
  }

  if (outcome.status === 404) {
    return { verdict: 'not-found', detail: 'HTTP 404 — tenant/site does not exist' };
  }

  const asRecord = parsed as Record<string, unknown>;
  if (typeof asRecord.errorCode === 'string') {
    return { verdict: 'bad-slug', detail: `Workday error: ${asRecord.errorCode}` };
  }

  if (outcome.status !== 200) {
    return { verdict: 'bad-slug', detail: `HTTP ${outcome.status}: ${outcome.body.slice(0, 200)}` };
  }

  const jobPostings = asRecord.jobPostings;
  if (!Array.isArray(jobPostings)) {
    return { verdict: 'bad-slug', detail: 'HTTP 200 but no jobPostings array — unexpected shape' };
  }
  if (jobPostings.length === 0) {
    const total = typeof asRecord.total === 'number' ? asRecord.total : 0;
    if (total > 0) return { verdict: 'ok', detail: `total=${total} (page came back empty, but board is real and non-empty)` };
    return { verdict: 'empty', detail: 'HTTP 200, jobPostings=[] and total=0 — real tenant/site, but no open roles right now' };
  }
  return { verdict: 'ok', detail: `${jobPostings.length} job(s) returned (total=${asRecord.total ?? 'n/a'})` };
}

const PLATFORM_PROBES: Record<string, PlatformProbe> = {
  workday: { request: workdayRequest, classify: workdayClassify },
};

// ── HTTP plumbing ────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpRequest(
  req: { url: string; method: 'GET' | 'POST'; body?: string },
  timeoutMs: number,
): Promise<HttpOutcome | { error: string }> {
  return new Promise((resolve) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': UA,
    };
    if (req.body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(req.body));
    }

    const request = https.request(req.url, { method: req.method, headers, timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c as Buffer));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          contentType: String(res.headers['content-type'] ?? ''),
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    request.on('error', (e) => resolve({ error: e.message }));
    request.on('timeout', () => {
      request.destroy();
      resolve({ error: 'timeout' });
    });
    if (req.body) request.write(req.body);
    request.end();
  });
}

async function probeEntry(
  entry: AtsCompanyEntry,
  probe: PlatformProbe,
  timeoutMs: number,
): Promise<ProbeReportRow> {
  const reqSpec = probe.request(entry.slug);
  const outcome = await httpRequest(reqSpec, timeoutMs);
  if ('error' in outcome) {
    return { name: entry.name, slug: entry.slug, verdict: 'network-error', detail: outcome.error };
  }
  const { verdict, detail } = probe.classify(outcome);
  return { name: entry.name, slug: entry.slug, verdict, detail };
}

async function probeAll(
  entries: ReadonlyArray<AtsCompanyEntry>,
  probe: PlatformProbe,
  concurrency: number,
  delayMs: number,
  timeoutMs: number,
): Promise<ProbeReportRow[]> {
  const results: ProbeReportRow[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < entries.length) {
      const idx = cursor++;
      const entry = entries[idx];
      if (delayMs > 0) await sleep(delayMs);
      const row = await probeEntry(entry, probe, timeoutMs);
      results.push(row);
      const icon = row.verdict === 'ok' ? '✓' : row.verdict === 'blocked' ? '?' : '✗';
      // eslint-disable-next-line no-console
      console.log(`  ${icon} [${row.verdict}] ${row.name} (${row.slug}) — ${row.detail}`);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function parseArgs(argv: string[]): {
  platform: string;
  concurrency: number;
  timeoutMs: number;
  delayMs: number;
  out: string;
  only: Set<string> | null;
} {
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const onlyRaw = get('--only', '');
  return {
    platform: get('--platform', 'workday'),
    concurrency: Number(get('--concurrency', '3')),
    timeoutMs: Number(get('--timeout', '15000')),
    delayMs: Number(get('--delay', '400')),
    out: get('--out', `.${get('--platform', 'workday')}-verify-report.json`),
    // Restrict the run to specific slugs — used to cheaply retry a prior
    // run's `blocked`/inconclusive rows with a slower pace, without
    // re-hitting entries already confirmed `ok`/`bad-slug`/`not-found`.
    only: onlyRaw ? new Set(onlyRaw.split(',').map((s) => s.trim()).filter(Boolean)) : null,
  };
}

async function main(): Promise<void> {
  const { platform, concurrency, timeoutMs, delayMs, out, only } = parseArgs(process.argv.slice(2));

  const probe = PLATFORM_PROBES[platform];
  if (!probe) {
    console.error(
      `No probe adapter for platform "${platform}". Known: ${Object.keys(PLATFORM_PROBES).join(', ')}`,
    );
    process.exitCode = 1;
    return;
  }

  const allEntries = ATS_COMPANY_DIRECTORY[platform] ?? [];
  const entries = only ? allEntries.filter((e) => only.has(e.slug)) : allEntries;
  console.log(`Verifying ${entries.length} "${platform}" director${entries.length === 1 ? 'y' : 'y'} entries @ concurrency ${concurrency}…\n`);

  const results = await probeAll(entries, probe, concurrency, delayMs, timeoutMs);

  const byVerdict: Record<Verdict, ProbeReportRow[]> = {
    ok: [],
    empty: [],
    'bad-slug': [],
    'not-found': [],
    blocked: [],
    'network-error': [],
  };
  for (const r of results) byVerdict[r.verdict].push(r);

  console.log(`\n── Summary (${results.length} total) ──`);
  (Object.keys(byVerdict) as Verdict[]).forEach((v) => {
    if (byVerdict[v].length) console.log(`  ${v}: ${byVerdict[v].length}`);
  });

  const needsAttention = [...byVerdict['bad-slug'], ...byVerdict['not-found']];
  if (needsAttention.length) {
    console.log(`\nCONFIRMED BAD (fix or remove):`);
    needsAttention.forEach((r) => console.log(`  - ${r.name} (${r.slug}) — ${r.detail}`));
  }
  if (byVerdict.blocked.length) {
    console.log(`\nINCONCLUSIVE (bot-protection blocked the probe, not a confirmed failure):`);
    byVerdict.blocked.forEach((r) => console.log(`  - ${r.name} (${r.slug})`));
  }

  fs.writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
  console.log(`\nFull report written to ${out}`);
}

if (require.main === module) {
  void main();
}
