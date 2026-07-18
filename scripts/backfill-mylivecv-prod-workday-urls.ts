/**
 * backfill-mylivecv-prod-workday-urls.ts
 *
 * Repairs Workday job URLs directly in the REAL production mylivecv
 * database — confirmed distinct from the local `mylivecv` schema
 * `backfill-workday-job-urls.ts` also touches (that one turned out to be a
 * local dev/backup copy: only 56 Workday rows, vs. production's ~39k).
 *
 * Reuses the exact same fix logic as `backfill-workday-job-urls.ts`
 * (see scripts/lib/workday-url-fix.ts) against `mylivecv."AggregatedJob"`
 * directly — this DB has no `everjobs` schema, so only that one table is
 * touched here (no canonical_job / exported_job to keep in sync).
 *
 * Connects via `MYLIVECV_PROD_DATABASE_URL` (falls back to
 * `postgresql://postgres:postgres@localhost:5433/postgres`, i.e. an SSH
 * tunnel opened with something like:
 *   ssh -N -L 5433:localhost:5432 root@<prod-host>
 * — this script never opens the tunnel itself, only connects through it).
 *
 * Defaults to a dry run: prints counts + a sample, writes the full plan to
 * a JSON report, and touches no data. Pass --apply to execute.
 *
 * Usage (via ts-node):
 *   ts-node --project tsconfig.base.json -r tsconfig-paths/register \
 *     scripts/backfill-mylivecv-prod-workday-urls.ts [--apply] [--batch-size 2000] [--out report.json]
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
  readonly id: string;
  readonly url: string;
}

interface Plan {
  readonly id: string;
  readonly oldUrl: string;
  readonly newUrl: string;
}

function connectionUrl(): string {
  return process.env.MYLIVECV_PROD_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
}

function runPsql(sql: string): string {
  return execFileSync('psql', [connectionUrl(), '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
  });
}

function runPsqlFile(filePath: string): string {
  return execFileSync('psql', [connectionUrl(), '-v', 'ON_ERROR_STOP=1', '-f', filePath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
  });
}

function fetchWorkdayRows(): Row[] {
  const out = runPsql(
    `SELECT id || '|' || "jobUrl" FROM mylivecv."AggregatedJob" WHERE "jobUrl" ~ 'myworkdayjobs\\.com';`,
  );
  const rows: Row[] = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const sep = line.indexOf('|');
    if (sep < 0) continue;
    rows.push({ id: line.slice(0, sep), url: line.slice(sep + 1) });
  }
  return rows;
}

function buildApplySql(plans: Plan[], batchSize: number): string {
  const statements: string[] = ['BEGIN;'];

  for (const batch of chunk(plans, batchSize)) {
    const values = batch
      .map((p) => `(${sqlLiteral(p.id)}, ${sqlLiteral(p.oldUrl)}, ${sqlLiteral(p.newUrl)})`)
      .join(',\n    ');

    statements.push(`
UPDATE mylivecv."AggregatedJob" AS a
SET "jobUrl" = v.new_url, "updatedAt" = now()
FROM (VALUES
    ${values}
) AS v(id, old_url, new_url)
WHERE a.id = v.id AND a."jobUrl" = v.old_url;
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
    out: get('--out', '.mylivecv-prod-workday-url-backfill-report.json'),
  };
}

async function main(): Promise<void> {
  const { apply, batchSize, out } = parseArgs(process.argv.slice(2));

  console.log(`Connecting to ${connectionUrl().replace(/:[^:@]+@/, ':****@')}`);
  console.log('Fetching Workday-sourced mylivecv.AggregatedJob rows…');
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
    plans.push({ id: row.id, oldUrl: row.url, newUrl: result.newUrl });
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
  const sqlPath = path.resolve(process.cwd(), '.mylivecv-prod-workday-url-backfill.sql');
  fs.writeFileSync(sqlPath, sql);
  runPsqlFile(sqlPath);
  console.log(`Done. Applied SQL saved to ${sqlPath} for audit.`);
}

if (require.main === module) {
  void main();
}
