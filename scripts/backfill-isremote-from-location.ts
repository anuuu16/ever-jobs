/**
 * backfill-isremote-from-location.ts
 *
 * Repairs `isRemote` on rows whose canonical location text unambiguously
 * says "Remote" but whose `isRemote` flag was never set to `true` — a gap
 * predating two fixes:
 *
 *   1. The dedup merge (`DedupHybridService`) only looked at each source's
 *      raw `isRemote` boolean; it didn't fall back to the canonical
 *      location text, so a source whose remote-detector under-fired left
 *      `isRemote` false/null even when its own location string said
 *      "Remote" in plain text.
 *   2. `AdminController.toExportPayload` never included `isRemote` in the
 *      downstream sync payload at all, so `mylivecv."AggregatedJob"` never
 *      received a real value and its `isRemote` column (NOT NULL DEFAULT
 *      false) defaulted to false for every ingested row.
 *
 * Both are fixed going forward in code; this script repairs the data
 * already sitting in Postgres for both tables:
 *
 *   - everjobs.canonical_job     (is_remote — nullable boolean)
 *   - mylivecv."AggregatedJob"   (isRemote  — NOT NULL, the live table
 *                                  backing platform.mylivecv.com directly)
 *
 * Word-boundary match (`~* '\mremote\M'`, Postgres's word-boundary regex
 * anchors) so "Remote", "Fully Remote", "Remote (US)" match but
 * "Remoteville" does not — mirrors the `\bremote\b` guard added to
 * `DedupHybridService`.
 *
 * Only ever flips false/null -> true; never touches a row already `true`,
 * never touches any other column, never deletes anything.
 *
 * Defaults to a dry run: prints counts + a sample from both tables and
 * writes a JSON report, touching no data. Pass --apply to execute.
 *
 * Usage (via ts-node):
 *   ts-node --project tsconfig.base.json -r tsconfig-paths/register \
 *     scripts/backfill-isremote-from-location.ts [--apply] [--out report.json]
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const WORD_BOUNDARY_REMOTE = `~* '\\mremote\\M'`;

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

function runPsqlFile(filePath: string): string {
  return execFileSync('psql', [libpqUrl(), '-v', 'ON_ERROR_STOP=1', '-f', filePath], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
  });
}

interface TableCounts {
  readonly toFix: number;
  readonly sample: Array<{ title: string; location: string }>;
}

function countEverjobs(): TableCounts {
  const toFix = Number(
    runPsql(
      `SELECT count(*) FROM everjobs.canonical_job WHERE location ${WORD_BOUNDARY_REMOTE} AND (is_remote IS NULL OR is_remote = false);`,
    ).trim(),
  );
  const sampleRaw = runPsql(
    `SELECT title || '|' || location FROM everjobs.canonical_job WHERE location ${WORD_BOUNDARY_REMOTE} AND (is_remote IS NULL OR is_remote = false) LIMIT 10;`,
  );
  const sample = parseSample(sampleRaw);
  return { toFix, sample };
}

function countMylivecv(): TableCounts {
  const toFix = Number(
    runPsql(
      `SELECT count(*) FROM mylivecv."AggregatedJob" WHERE location ${WORD_BOUNDARY_REMOTE} AND "isRemote" = false;`,
    ).trim(),
  );
  const sampleRaw = runPsql(
    `SELECT title || '|' || location FROM mylivecv."AggregatedJob" WHERE location ${WORD_BOUNDARY_REMOTE} AND "isRemote" = false LIMIT 10;`,
  );
  const sample = parseSample(sampleRaw);
  return { toFix, sample };
}

function parseSample(out: string): Array<{ title: string; location: string }> {
  const rows: Array<{ title: string; location: string }> = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const sep = line.indexOf('|');
    if (sep < 0) continue;
    rows.push({ title: line.slice(0, sep), location: line.slice(sep + 1) });
  }
  return rows;
}

function buildApplySql(): string {
  return `
BEGIN;

-- everjobs.canonical_job: nullable is_remote, flip null/false -> true only
-- for rows whose location text unambiguously says "Remote".
UPDATE everjobs.canonical_job
SET is_remote = true
WHERE location ${WORD_BOUNDARY_REMOTE} AND (is_remote IS NULL OR is_remote = false);

-- mylivecv.AggregatedJob: NOT NULL isRemote (defaulted to false on ingest
-- because toExportPayload never sent the field) — same flip, plus
-- updatedAt so the live site's cache-busting/sort-by-updated logic (if any)
-- sees the change.
UPDATE mylivecv."AggregatedJob"
SET "isRemote" = true, "updatedAt" = now()
WHERE location ${WORD_BOUNDARY_REMOTE} AND "isRemote" = false;

COMMIT;
`;
}

function parseArgs(argv: string[]): { apply: boolean; out: string } {
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : fallback;
  };
  return {
    apply: argv.includes('--apply'),
    out: get('--out', '.isremote-location-backfill-report.json'),
  };
}

async function main(): Promise<void> {
  const { apply, out } = parseArgs(process.argv.slice(2));

  console.log('Counting rows whose location says "Remote" but isRemote is not true…\n');
  const everjobs = countEverjobs();
  const mylivecv = countMylivecv();

  console.log(`── Plan ──`);
  console.log(`  everjobs.canonical_job:    ${everjobs.toFix} row(s) to fix`);
  console.log(`  mylivecv."AggregatedJob":  ${mylivecv.toFix} row(s) to fix`);

  console.log(`\n  Sample (everjobs.canonical_job):`);
  for (const s of everjobs.sample) console.log(`    "${s.title}" — ${s.location}`);
  console.log(`\n  Sample (mylivecv."AggregatedJob"):`);
  for (const s of mylivecv.sample) console.log(`    "${s.title}" — ${s.location}`);

  const reportPath = path.resolve(process.cwd(), out);
  fs.writeFileSync(reportPath, JSON.stringify({ everjobs, mylivecv }, null, 2) + '\n');
  console.log(`\nFull plan written to ${reportPath}`);

  if (!apply) {
    console.log(`\nDry run only — no data changed. Re-run with --apply to execute.`);
    return;
  }

  if (everjobs.toFix === 0 && mylivecv.toFix === 0) {
    console.log(`\nNothing to apply.`);
    return;
  }

  console.log(`\nApplying fixes…`);
  const sql = buildApplySql();
  const sqlPath = path.resolve(process.cwd(), '.isremote-location-backfill.sql');
  fs.writeFileSync(sqlPath, sql);
  runPsqlFile(sqlPath);
  console.log(`Done. Applied SQL saved to ${sqlPath} for audit.`);
}

if (require.main === module) {
  void main();
}
