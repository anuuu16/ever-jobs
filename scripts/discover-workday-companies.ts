/**
 * discover-workday-companies.ts
 *
 * Bulk Workday-tenant discovery: given a plain list of company DISPLAY NAMES
 * (one per line — e.g. pulled from a public S&P 500 / Fortune 500 list), this
 * guesses each company's likely Workday tenant slug and probes the real
 * public CXS API directly, rather than requiring one web search per company.
 *
 * Why brute-force guessing works reasonably well for Workday specifically:
 * empirically (see apps/api/src/admin/ats-company-directory.ts's `workday`
 * array) a large fraction of tenants use a simplified/lowercased version of
 * the company name as the subdomain (walmart, allstate, comcast, verizon,
 * cigna, aig, humana, ...), and site IDs cluster around a small set of
 * repeated patterns (External, Careers, ExternalCareerSite, ...). This
 * script tries every {tenant guess} x {site pattern} x {wd number} combo
 * (capped — see CANDIDATE CAP below) and keeps the FIRST one that returns
 * real, non-empty job postings from the live API.
 *
 * This intentionally mirrors scripts/verify-ats-directory-slugs.ts's request
 * shape (same POST body, same UA) so a slug that survives here is guaranteed
 * to also pass that verifier — this script IS effectively "verify at
 * candidate-generation time" rather than a separate unverified step.
 *
 * Never mutates apps/api/src/admin/ats-company-directory.ts — writes a JSON
 * survivors report; a human (or the calling agent) reviews and appends.
 *
 * Usage (via ts-node):
 *   ts-node --project tsconfig.base.json -r tsconfig-paths/register \
 *     scripts/discover-workday-companies.ts <candidates.txt> [--out survivors.json] \
 *     [--concurrency 5] [--delay 300] [--skip-tenants existing-tenants.txt]
 */
import * as fs from 'fs';
import * as https from 'https';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36';

/**
 * Site-ID patterns to try per tenant guess, ordered by empirical frequency
 * in the existing directory (most common first, so a survivor is usually
 * found within the first 2-3 attempts rather than exhausting the list).
 */
const SITE_PATTERNS = [
  'External',
  'Careers',
  'External_Career_Site',
  'ExternalCareerSite',
  'careers',
  'CareerSite',
  'EXT',
  'External_Careers',
  'Search',
];

/** wd instance numbers to try per (tenant, site) pair, most-common first. */
const WD_NUMBERS = ['1', '5', '3', '12'];

/** Minimum job postings for a candidate to count as a real, live board. */
const MIN_JOBS = 1;

export interface Survivor {
  readonly companyName: string;
  readonly tenant: string;
  readonly wdNumber: string;
  readonly site: string;
  readonly slug: string;
  readonly jobCount: number;
}

/**
 * Turn a display name like "Arthur J. Gallagher & Co." into a short list of
 * plausible Workday tenant-subdomain guesses, most-likely first:
 *   1. Full name, lowercased, alnum-only (no spaces/punctuation) — the most
 *      common real-world pattern (e.g. "American International Group" -> "aig"
 *      is the EXCEPTION, not the rule; "allstate", "comcast" etc. are the rule).
 *   2. Just the first word, lowercased, alnum-only — catches "Marsh McLennan"
 *      -> "marsh"-style tenants (though MMC itself is "mmc"; this is a guess,
 *      not a guarantee).
 *   3. Acronym of capitalized words (e.g. "General Dynamics IT" -> "gdi").
 */
function tenantGuesses(displayName: string): string[] {
  const stripped = displayName
    .replace(/\([^)]*\)/g, '')
    .replace(/[.,'']/g, '')
    .replace(/&/g, 'and')
    .trim();

  const words = stripped.split(/\s+/).filter(Boolean);
  const suffixes = new Set(['inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'group', 'plc', 'ltd', 'llc', 'holdings', 'worldwide', 'international']);
  const coreWords = words.filter((w) => !suffixes.has(w.toLowerCase()));

  const full = (coreWords.length ? coreWords : words).join('').toLowerCase().replace(/[^a-z0-9]/g, '');
  const firstWord = (words[0] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const acronym = words
    .filter((w) => /^[A-Z]/.test(w))
    .map((w) => w[0])
    .join('')
    .toLowerCase();

  const guesses = [full];
  if (firstWord && firstWord !== full) guesses.push(firstWord);
  if (acronym.length >= 2 && acronym.length <= 6 && acronym !== full) guesses.push(acronym);
  return [...new Set(guesses)].filter((g) => g.length >= 2);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface HttpOutcome {
  readonly status: number;
  readonly contentType: string;
  readonly body: string;
}

function httpPost(url: string, body: string, timeoutMs: number): Promise<HttpOutcome | { error: string }> {
  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': UA,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers['content-type'] ?? ''),
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'timeout' });
    });
    req.write(body);
    req.end();
  });
}

/** Probe one (tenant, wdNumber, site) combo; returns job count if it's a real, non-empty board, else null. */
async function probeCombo(
  tenant: string,
  wdNumber: string,
  site: string,
  timeoutMs: number,
): Promise<number | null> {
  const url = `https://${tenant}.wd${wdNumber}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`;
  const body = JSON.stringify({ appliedFacets: {}, limit: 1, offset: 0, searchText: '' });
  const outcome = await httpPost(url, body, timeoutMs);
  if ('error' in outcome) return null;
  if (!outcome.contentType.includes('application/json')) return null; // bot-protection page, not a confirmed miss

  let parsed: unknown;
  try {
    parsed = JSON.parse(outcome.body);
  } catch {
    return null;
  }
  const rec = parsed as Record<string, unknown>;
  if (typeof rec.errorCode === 'string') return null;
  const jobPostings = rec.jobPostings;
  if (!Array.isArray(jobPostings) || jobPostings.length < MIN_JOBS) return null;
  const total = typeof rec.total === 'number' ? rec.total : jobPostings.length;
  return total;
}

/** Try every (tenant guess x site pattern x wd number) combo for one company; stop at first survivor. */
async function discoverOne(
  companyName: string,
  timeoutMs: number,
  delayMs: number,
  skipTenants: Set<string>,
): Promise<Survivor | null> {
  const tenants = tenantGuesses(companyName).filter((t) => !skipTenants.has(t));
  for (const tenant of tenants) {
    for (const wdNumber of WD_NUMBERS) {
      for (const site of SITE_PATTERNS) {
        if (delayMs > 0) await sleep(delayMs);
        const jobCount = await probeCombo(tenant, wdNumber, site, timeoutMs);
        if (jobCount !== null) {
          return {
            companyName,
            tenant,
            wdNumber,
            site,
            slug: `${tenant}:${wdNumber}:${site}`,
            jobCount,
          };
        }
      }
    }
  }
  return null;
}

async function discoverAll(
  companyNames: ReadonlyArray<string>,
  concurrency: number,
  timeoutMs: number,
  delayMs: number,
  skipTenants: Set<string>,
  onSurvivor: (s: Survivor) => void,
): Promise<Survivor[]> {
  const survivors: Survivor[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < companyNames.length) {
      const idx = cursor++;
      const name = companyNames[idx];
      const result = await discoverOne(name, timeoutMs, delayMs, skipTenants);
      if (result) {
        survivors.push(result);
        onSurvivor(result);
      } else {
        // eslint-disable-next-line no-console
        console.log(`  ✗ ${name} — no live combo found`);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, companyNames.length) }, () => worker());
  await Promise.all(workers);
  return survivors;
}

function parseArgs(argv: string[]): {
  candidatesPath: string;
  out: string;
  concurrency: number;
  timeoutMs: number;
  delayMs: number;
  skipTenantsPath: string | null;
} {
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    candidatesPath: argv[0] ?? '.candidates.txt',
    out: get('--out', '.workday-discovery-survivors.json'),
    concurrency: Number(get('--concurrency', '5')),
    timeoutMs: Number(get('--timeout', '10000')),
    delayMs: Number(get('--delay', '300')),
    skipTenantsPath: argv.includes('--skip-tenants') ? get('--skip-tenants', '') || null : null,
  };
}

async function main(): Promise<void> {
  const { candidatesPath, out, concurrency, timeoutMs, delayMs, skipTenantsPath } = parseArgs(
    process.argv.slice(2),
  );

  const companyNames = fs
    .readFileSync(candidatesPath, 'utf8')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith('#'));

  const skipTenants = new Set<string>();
  if (skipTenantsPath) {
    fs.readFileSync(skipTenantsPath, 'utf8')
      .split(/\r?\n/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => skipTenants.add(t));
  }

  console.log(
    `Discovering Workday tenants for ${companyNames.length} companies @ concurrency ${concurrency} (skipping ${skipTenants.size} known tenants)…\n`,
  );

  const survivors: Survivor[] = [];
  await discoverAll(companyNames, concurrency, timeoutMs, delayMs, skipTenants, (s) => {
    survivors.push(s);
    console.log(`  ✓ ${s.companyName} -> ${s.slug} (${s.jobCount} jobs)`);
    // Write incrementally so a long run's progress isn't lost if interrupted.
    fs.writeFileSync(out, JSON.stringify(survivors, null, 2) + '\n');
  });

  console.log(`\nDone. ${survivors.length}/${companyNames.length} companies matched a live Workday board.`);
  console.log(`Survivors written to ${out}`);
}

if (require.main === module) {
  void main();
}
