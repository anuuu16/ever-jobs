/**
 * backfill-workday-job-urls.ts
 *
 * Repairs Workday job URLs already persisted before the `withWorkdayLocale`
 * fix (packages/plugins/source-ats-workday/src/workday.constants.ts) landed.
 * Two distinct broken shapes exist in the data (confirmed via live probes,
 * see the fix's regression history):
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
 *
 * Touches three tables, all keyed off the OLD url string so nothing is
 * double-applied on a re-run:
 *   - everjobs.canonical_job   (url column;                    PK canonical_job_id)
 *   - everjobs.exported_job    (job_url is the PK — delete+reinsert to dodge
 *                                PK collisions when two broken urls normalize
 *                                to the same corrected url)
 *   - mylivecv."AggregatedJob" (jobUrl column — the live downstream job board;
 *                                this is what "sync with mylivecv" means here,
 *                                see docs/log.md)
 *
 * Defaults to a dry run: prints counts + a sample, writes the full plan to
 * a JSON report, and touches no data. Pass --apply to execute.
 *
 * Usage (via ts-node):
 *   ts-node --project tsconfig.base.json -r tsconfig-paths/register \
 *     scripts/backfill-workday-job-urls.ts [--apply] [--batch-size 2000] [--out report.json]
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

import {
  buildDirectoryIndex,
  chunk,
  computeWorkdayUrlFix,
  sqlLiteral,
  SkipReason,
} from './lib/workday-url-fix';

interface Row {
  readonly canonicalJobId: string;
  readonly url: string;
}

interface Plan {
  readonly canonicalJobId: string;
  readonly oldUrl: string;
  readonly newUrl: string;
}

/** Prisma's DATABASE_URL carries a `?schema=` query param that plain libpq
 * (and therefore `psql`) doesn't understand — every statement here already
 * schema-qualifies its tables, so it's safe to just strip it. */
function libpqUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set (expected in .env)');
  const url = new URL(databaseUrl);
  url.searchParams.delete('schema');
  return url.toString();
}

function runPsql(sql: string): string {
  return execFileSync('psql', [libpqUrl(), '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
  });
}

/** Like `runPsql`, but reads the statements from a file (`-f`) instead of an
 * argv string — the apply SQL can run into the tens of MB across 38k+ rows,
 * well past what's safe to pass as a single command-line argument. */
function runPsqlFile(filePath: string): string {
  return execFileSync('psql', [libpqUrl(), '-v', 'ON_ERROR_STOP=1', '-f', filePath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
  });
}

/** Parses `psql -t -A` CSV-ish tuple output ("a|b" per line) for the 2-column fetch query. */
function fetchWorkdayRows(): Row[] {
  const out = runPsql(
    `SELECT canonical_job_id || '|' || url FROM everjobs.canonical_job WHERE url ~ 'myworkdayjobs\\.com';`,
  );
  const rows: Row[] = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const sep = line.indexOf('|');
    if (sep < 0) continue;
    rows.push({ canonicalJobId: line.slice(0, sep), url: line.slice(sep + 1) });
  }
  return rows;
}

function buildApplySql(plans: Plan[], batchSize: number): string {
  const statements: string[] = ['BEGIN;'];

  for (const batch of chunk(plans, batchSize)) {
    const values = batch
      .map((p) => `(${sqlLiteral(p.canonicalJobId)}, ${sqlLiteral(p.oldUrl)}, ${sqlLiteral(p.newUrl)})`)
      .join(',\n    ');

    statements.push(`
-- canonical_job: repair url in place (PK canonical_job_id is untouched)
UPDATE everjobs.canonical_job AS c
SET url = v.new_url
FROM (VALUES
    ${values}
) AS v(canonical_job_id, old_url, new_url)
WHERE c.canonical_job_id = v.canonical_job_id AND c.url = v.old_url;
`);

    statements.push(`
-- exported_job: job_url is the PK, so delete+reinsert instead of UPDATE to
-- dodge a PK collision when two broken urls normalize to the same corrected
-- one (ON CONFLICT DO NOTHING keeps the first-seen exported_at).
WITH moved AS (
  DELETE FROM everjobs.exported_job AS e
  USING (VALUES
    ${values}
  ) AS v(canonical_job_id, old_url, new_url)
  WHERE e.job_url = v.old_url
  RETURNING v.new_url, e.exported_at
)
INSERT INTO everjobs.exported_job (job_url, exported_at)
SELECT new_url, exported_at FROM moved
ON CONFLICT (job_url) DO NOTHING;
`);

    statements.push(`
-- mylivecv.AggregatedJob: the live downstream job board this repo exports
-- to. No-op for rows mylivecv never ingested (WHERE simply matches zero).
UPDATE mylivecv."AggregatedJob" AS a
SET "jobUrl" = v.new_url, "updatedAt" = now()
FROM (VALUES
    ${values}
) AS v(canonical_job_id, old_url, new_url)
WHERE a."jobUrl" = v.old_url;
`);
  }

  statements.push('COMMIT;');
  return statements.join('\n');
}

function parseArgs(argv: string[]): { apply: boolean; batchSize: number; out: string } {
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    apply: argv.includes('--apply'),
    batchSize: Number(get('--batch-size', '2000')),
    out: get('--out', '.workday-url-backfill-report.json'),
  };
}

async function main(): Promise<void> {
  const { apply, batchSize, out } = parseArgs(process.argv.slice(2));

  console.log('Fetching Workday-sourced canonical_job rows…');
  const rows = fetchWorkdayRows();
  console.log(`  ${rows.length} rows carry a myworkdayjobs.com url\n`);

  const directory = buildDirectoryIndex();
  const plans: Plan[] = [];
  const skipped: SkipReason[] = [];
  let alreadyOk = 0;

  for (const row of rows) {
    const result = computeWorkdayUrlFix(row.url, directory);
    if ('skip' in result) {
      skipped.push(result.skip);
      continue;
    }
    if (result.newUrl === row.url) {
      alreadyOk++;
      continue;
    }
    plans.push({ canonicalJobId: row.canonicalJobId, oldUrl: row.url, newUrl: result.newUrl });
  }

  console.log(`── Plan ──`);
  console.log(`  already correct:      ${alreadyOk}`);
  console.log(`  fixable:              ${plans.length}`);
  console.log(`  skipped (see report): ${skipped.length}`);

  const skipReasonCounts = new Map<string, number>();
  for (const s of skipped) {
    const key = s.reason.replace(/"[^"]+"/, '"<company>"');
    skipReasonCounts.set(key, (skipReasonCounts.get(key) ?? 0) + 1);
  }
  if (skipReasonCounts.size) {
    console.log(`\n  Skip reasons:`);
    for (const [reason, count] of skipReasonCounts) console.log(`    ${count}x ${reason}`);
  }

  console.log(`\n  Sample fixes:`);
  for (const p of plans.slice(0, 10)) {
    console.log(`    ${p.oldUrl}\n      -> ${p.newUrl}`);
  }

  const reportPath = path.resolve(process.cwd(), out);
  fs.writeFileSync(reportPath, JSON.stringify({ plans, skipped }, null, 2) + '\n');
  console.log(`\nFull plan (${plans.length} fixes, ${skipped.length} skips) written to ${reportPath}`);

  if (!apply) {
    console.log(`\nDry run only — no data changed. Re-run with --apply to execute.`);
    return;
  }

  if (plans.length === 0) {
    console.log(`\nNothing to apply.`);
    return;
  }

  console.log(`\nApplying ${plans.length} fixes in batches of ${batchSize}…`);
  const sql = buildApplySql(plans, batchSize);
  const sqlPath = path.resolve(process.cwd(), '.workday-url-backfill.sql');
  fs.writeFileSync(sqlPath, sql);
  runPsqlFile(sqlPath);
  console.log(`Done. Applied SQL saved to ${sqlPath} for audit.`);
}

if (require.main === module) {
  void main();
}
