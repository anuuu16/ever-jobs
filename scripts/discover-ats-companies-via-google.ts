/**
 * discover-ats-companies-via-google.ts
 *
 * Google-dork discovery for ATS company-directory candidates: for each
 * configured platform (Workday, Greenhouse, Lever, Ashby, Workable,
 * SmartRecruiters, Recruitee), runs a `site:<platform-domain> <term>` search
 * across several free-text query variants — Google caps results at roughly
 * a few hundred per identical query, so varying the term surfaces different
 * companies — and pages through each variant's results, extracting and
 * de-duplicating company slugs against the existing
 * `apps/api/src/admin/ats-company-directory.ts`.
 *
 * Uses Playwright + this repo's existing `BrowserPool` (stealth mode), NOT
 * Puppeteer — the codebase already depends on Playwright for the
 * Monster/SimplyHired/CareerBuilder browser-fallback paths (see
 * `packages/common/src/browser/browser-pool.ts`), so this reuses that
 * dependency, its already-downloaded Chromium build, and its stealth
 * init-script instead of adding a second, redundant browser-automation
 * library. Result HTML is parsed with cheerio (`page.content()`), matching
 * the same pattern those services use — not `page.evaluate()` — so this
 * file needs no DOM lib types.
 *
 * SAFETY / ETIQUETTE — read before running:
 *   - This NEVER attempts to solve or bypass a CAPTCHA / "unusual traffic"
 *     wall. It detects one and stops the ENTIRE run immediately (not just
 *     the current platform — a challenge usually means the current IP is
 *     now suspect for every subsequent query too), writing out whatever was
 *     collected so far.
 *   - Deliberately conservative, not throughput-optimised: headed by
 *     default (`--headless` opts in), randomized multi-second delays
 *     between requests, and a modest default page budget. Automated Google
 *     querying is fragile and against Google's ToS in volume — this is
 *     meant for occasional, human-supervised directory-growing runs, not a
 *     scheduled job.
 *   - Never mutates ats-company-directory.ts. Writes a JSON candidates
 *     report, same convention as `scripts/discover-workday-companies.ts`.
 *     A slug parsed out of a SERP URL is a GUESS, not a verified live
 *     board — run candidates through `scripts/verify-ats-directory-slugs.ts`
 *     (or the platform-specific probe scripts) before appending anything.
 *
 * Usage (via ts-node):
 *   ts-node --project tsconfig.base.json -r tsconfig-paths/register \
 *     scripts/discover-ats-companies-via-google.ts \
 *     [--platforms workday,greenhouse,lever,ashby,workable,smartrecruiters,recruitee] \
 *     [--pages 10] [--out .ats-google-discovery.json] \
 *     [--delay-min 4000] [--delay-max 9000] [--headless]
 *
 * Remote browser (optional): set CHROME_URL (e.g. a local `browserless`
 * container's CDP endpoint, `ws://localhost:8080`) and CHROME_TOKEN to
 * connect over CDP instead of launching a local Chromium via `BrowserPool`.
 * Useful when the machine running this script has a flagged/datacenter IP
 * and `browserless` egresses through a different, cleaner network path.
 */
import * as fs from 'fs';
import * as cheerio from 'cheerio';
import { chromium, type Browser, type Page } from 'playwright';
import { BrowserPool } from '@ever-jobs/common';
import { ATS_COMPANY_DIRECTORY } from '../apps/api/src/admin/ats-company-directory';

interface PlatformConfig {
  readonly key: string;
  readonly label: string;
  /** Domain matched via `hostname === siteOperator || hostname.endsWith('.' + siteOperator)`. */
  readonly siteOperator: string;
  readonly queryVariants: readonly string[];
  /** Parse a matched result URL into a directory-ready slug, or null to skip it. */
  readonly extractSlug: (url: URL) => string | null;
}

interface Candidate {
  readonly platform: string;
  readonly slug: string;
  readonly name: string;
  readonly sourceUrl: string;
  readonly query: string;
}

/** Path segments that show up under ATS domains but are never a real company board. */
const PATH_STOPLIST = new Set([
  'sitemap.xml', 'robots.txt', 'legal', 'privacy', 'privacy-policy', 'terms',
  'login', 'signup', 'sign-up', 'oauth', 'api', 'assets', 'static', 'about',
  'help', 'support', 'blog', 'pricing', 'security', 'status', 'docs',
]);

function firstPathSegment(url: URL): string | null {
  const seg = url.pathname.split('/').filter(Boolean)[0];
  if (!seg) return null;
  return PATH_STOPLIST.has(seg.toLowerCase()) ? null : seg;
}

/** Matches a Workday locale segment, e.g. "en-US" — mirrors LOCALE_SEGMENT_RE in workday.constants.ts. */
const LOCALE_RE = /^[a-z]{2}(-[a-zA-Z]{2,3})?$/;

function extractWorkdaySlug(url: URL): string | null {
  const hostMatch = url.hostname.match(/^([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com$/i);
  if (!hostMatch) return null;
  const [, company, wdNumber] = hostMatch;
  const segments = url.pathname.split('/').filter(Boolean);
  const site = LOCALE_RE.test(segments[0] ?? '') ? segments[1] : segments[0];
  if (!site) return null;
  return `${company.toLowerCase()}:${wdNumber}:${site}`;
}

function extractRecruiteeSlug(url: URL): string | null {
  const m = url.hostname.match(/^([a-z0-9-]+)\.recruitee\.com$/i);
  return m ? m[1] : null;
}

const PLATFORMS: readonly PlatformConfig[] = [
  {
    key: 'workday',
    label: 'Workday',
    siteOperator: 'myworkdayjobs.com',
    queryVariants: ['career', 'careers', 'jobs', 'hiring', 'apply now', 'engineer', 'remote', 'internship'],
    extractSlug: extractWorkdaySlug,
  },
  {
    key: 'greenhouse',
    label: 'Greenhouse',
    siteOperator: 'boards.greenhouse.io',
    queryVariants: ['careers', 'jobs', 'hiring', 'engineer', 'remote'],
    extractSlug: firstPathSegment,
  },
  {
    key: 'lever',
    label: 'Lever',
    siteOperator: 'jobs.lever.co',
    queryVariants: ['careers', 'jobs', 'hiring', 'engineer', 'remote'],
    extractSlug: firstPathSegment,
  },
  {
    key: 'ashby',
    label: 'Ashby',
    siteOperator: 'jobs.ashbyhq.com',
    queryVariants: ['careers', 'jobs', 'hiring', 'engineer'],
    extractSlug: firstPathSegment,
  },
  {
    key: 'workable',
    label: 'Workable',
    siteOperator: 'apply.workable.com',
    queryVariants: ['careers', 'jobs', 'hiring', 'engineer'],
    extractSlug: firstPathSegment,
  },
  {
    key: 'smartrecruiters',
    label: 'SmartRecruiters',
    siteOperator: 'careers.smartrecruiters.com',
    queryVariants: ['careers', 'jobs', 'hiring'],
    extractSlug: firstPathSegment,
  },
  {
    key: 'recruitee',
    label: 'Recruitee',
    siteOperator: 'recruitee.com',
    queryVariants: ['careers', 'jobs', 'hiring'],
    extractSlug: extractRecruiteeSlug,
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  return sleep(minMs + Math.random() * Math.max(0, maxMs - minMs));
}

/** Best-effort display name from a Google result title — strips common ATS/careers suffixes. */
function cleanTitle(rawTitle: string, fallback: string): string {
  const cleaned = rawTitle
    .replace(/\s*[-|·]\s*(Workday|Greenhouse|Lever|Ashby|Workable|SmartRecruiters|Recruitee).*$/i, '')
    .replace(/\s*[-|·]\s*Careers?.*$/i, '')
    .trim();
  return cleaned || fallback;
}

async function pageText(page: Page): Promise<string> {
  const html = await page.content();
  return cheerio.load(html).text();
}

async function isBlockedPage(page: Page): Promise<boolean> {
  const text = await pageText(page);
  return /unusual traffic|verify you.?re a human|recaptcha|our systems have detected/i.test(text);
}

async function hasNoResults(page: Page): Promise<boolean> {
  const text = await pageText(page);
  return /did not match any documents|no results found/i.test(text);
}

/** Extract {href, title} pairs for organic results on the current SERP via cheerio. */
async function extractResults(page: Page): Promise<Array<{ href: string; title: string }>> {
  const html = await page.content();
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: Array<{ href: string; title: string }> = [];
  $('#search a[href^="http"], #rso a[href^="http"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href || seen.has(href)) return;
    seen.add(href);
    out.push({ href, title: $(el).find('h3').first().text() });
  });
  return out;
}

/** Runs every query variant for one platform; returns 'blocked' if Google shows a CAPTCHA wall. */
async function runPlatform(
  page: Page,
  platform: PlatformConfig,
  pagesPerQuery: number,
  delayMin: number,
  delayMax: number,
  existingSlugs: Set<string>,
  seenThisRun: Set<string>,
  onCandidate: (c: Candidate) => void,
): Promise<'ok' | 'blocked'> {
  for (const term of platform.queryVariants) {
    const query = `site:${platform.siteOperator} ${term}`;
    console.log(`\n[${platform.label}] query: "${query}"`);

    for (let pageIdx = 0; pageIdx < pagesPerQuery; pageIdx++) {
      const start = pageIdx * 10;
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&start=${start}&hl=en`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await randomDelay(800, 1800); // let the SERP settle before reading it

      if (await isBlockedPage(page)) {
        console.warn('  ⚠ Google is showing a CAPTCHA / "unusual traffic" wall — stopping the run here.');
        return 'blocked';
      }
      if (await hasNoResults(page)) {
        console.log(`  (no more results at page ${pageIdx + 1})`);
        break;
      }

      const results = await extractResults(page);
      let newOnPage = 0;
      for (const { href, title } of results) {
        let parsed: URL;
        try {
          parsed = new URL(href);
        } catch {
          continue;
        }
        const matchesDomain =
          parsed.hostname === platform.siteOperator || parsed.hostname.endsWith(`.${platform.siteOperator}`);
        if (!matchesDomain) continue;

        const slug = platform.extractSlug(parsed);
        if (!slug) continue;
        const key = `${platform.key}:${slug.toLowerCase()}`;
        if (existingSlugs.has(key) || seenThisRun.has(key)) continue;
        seenThisRun.add(key);
        newOnPage++;
        onCandidate({ platform: platform.key, slug, name: cleanTitle(title, slug), sourceUrl: href, query });
      }
      console.log(`  page ${pageIdx + 1}/${pagesPerQuery}: ${results.length} result(s), ${newOnPage} new candidate(s)`);

      await randomDelay(delayMin, delayMax);
    }
  }
  return 'ok';
}

function parseArgs(argv: string[]): {
  platforms: string[];
  pages: number;
  out: string;
  delayMin: number;
  delayMax: number;
  headless: boolean;
} {
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  const platformsArg = get('--platforms', '');
  return {
    platforms: platformsArg ? platformsArg.split(',').map((s) => s.trim().toLowerCase()) : PLATFORMS.map((p) => p.key),
    pages: Number(get('--pages', '10')),
    out: get('--out', '.ats-google-discovery.json'),
    delayMin: Number(get('--delay-min', '4000')),
    delayMax: Number(get('--delay-max', '9000')),
    headless: argv.includes('--headless'),
  };
}

function buildExistingSlugSet(): Set<string> {
  const set = new Set<string>();
  for (const [platform, entries] of Object.entries(ATS_COMPANY_DIRECTORY)) {
    for (const entry of entries) {
      set.add(`${platform}:${entry.slug.toLowerCase()}`);
    }
  }
  return set;
}

interface AcquiredPage {
  readonly page: Page;
  readonly close: () => Promise<void>;
}

/**
 * Acquire a page from CHROME_URL (a remote CDP endpoint, e.g. a local
 * `browserless` container) when set, else fall back to this repo's local
 * `BrowserPool` (stealth mode). See the file header for why/when to use a
 * remote browser.
 */
async function acquirePage(): Promise<AcquiredPage> {
  const wsUrl = process.env.CHROME_URL;
  if (wsUrl) {
    const token = process.env.CHROME_TOKEN;
    const endpoint = token ? `${wsUrl}${wsUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : wsUrl;
    console.log(`Connecting to remote browser at ${wsUrl}…`);
    const browser: Browser = await chromium.connectOverCDP(endpoint);
    const context =
      browser.contexts()[0] ??
      (await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36',
        viewport: { width: 1440, height: 900 },
        locale: 'en-US',
      }));
    const page = await context.newPage();
    return {
      page,
      close: async () => {
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
      },
    };
  }

  const page = await BrowserPool.getPage({ stealth: true });
  return {
    page,
    close: async () => {
      await page.close().catch(() => {});
      await BrowserPool.close();
    },
  };
}

async function main(): Promise<void> {
  const { platforms, pages, out, delayMin, delayMax, headless } = parseArgs(process.argv.slice(2));
  const selected = PLATFORMS.filter((p) => platforms.includes(p.key));
  if (selected.length === 0) {
    console.error(`No matching platform(s) in --platforms. Known: ${PLATFORMS.map((p) => p.key).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (headless) process.env.PLAYWRIGHT_HEADLESS = 'true';
  else process.env.PLAYWRIGHT_HEADLESS = 'false';

  const existingSlugs = buildExistingSlugSet();
  const seenThisRun = new Set<string>();
  const candidates: Candidate[] = [];

  console.log(
    `Discovering ATS candidates for [${selected.map((p) => p.label).join(', ')}] — ` +
      `${pages} page(s)/query, ${existingSlugs.size} known slug(s) to skip.\n`,
  );

  const { page, close } = await acquirePage();
  try {
    for (const platform of selected) {
      const outcome = await runPlatform(
        page,
        platform,
        pages,
        delayMin,
        delayMax,
        existingSlugs,
        seenThisRun,
        (c) => {
          candidates.push(c);
          console.log(`  ✓ ${c.name} -> ${c.slug} (${c.sourceUrl})`);
          // Incremental write so a long, interrupted run isn't lost.
          fs.writeFileSync(out, JSON.stringify(candidates, null, 2) + '\n');
        },
      );
      if (outcome === 'blocked') break;
      await randomDelay(delayMin, delayMax);
    }
  } finally {
    await close();
  }

  const byPlatform = new Map<string, number>();
  for (const c of candidates) byPlatform.set(c.platform, (byPlatform.get(c.platform) ?? 0) + 1);

  console.log(`\nDone. ${candidates.length} new candidate(s) written to ${out}:`);
  for (const [platform, count] of byPlatform) console.log(`  ${platform}: ${count}`);
  console.log(
    '\nThese are UNVERIFIED — slugs are parsed from SERP URLs, not confirmed live. ' +
      'Run scripts/verify-ats-directory-slugs.ts (or the platform-specific probe script) ' +
      'before appending anything to ats-company-directory.ts.',
  );
}

if (require.main === module) {
  void main();
}
