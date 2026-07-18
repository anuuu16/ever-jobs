/**
 * backfill-mylivecv-prod-isremote-from-location.ts
 *
 * Repairs `isRemote` directly in the REAL production mylivecv database —
 * distinct from the local `mylivecv` schema `backfill-isremote-from-location.ts`
 * also touches (that one is a local dev/backup copy: 15,691 rows vs.
 * production's ~108k).
 *
 * Root cause (see `AdminController.toExportPayload` and
 * `DedupHybridService.resolveIsRemote` in this same repo): the export
 * payload never included `isRemote` until today's fix, so
 * `mylivecv."AggregatedJob".isRemote` (NOT NULL DEFAULT false) defaulted
 * to false for every ingested row — confirmed via direct query: 0 of
 * 108,644 production rows are `isRemote = true`. This script repairs the
 * subset whose canonical location text unambiguously says "Remote" (word-
 * boundary match, so "Remoteville" does NOT match) — it does not attempt
 * to re-derive isRemote for every other row, since that needs the actual
 * per-source signal the dedup engine has, not just location text.
 *
 * This DB has no `everjobs` schema (confirmed via `\dn`), so only
 * `mylivecv."AggregatedJob"` is touched here.
 *
 * Connects via `MYLIVECV_PROD_DATABASE_URL` (falls back to
 * `postgresql://postgres:postgres@localhost:5433/postgres`, i.e. an SSH
 * tunnel opened with something like:
 *   ssh -N -L 5433:localhost:5432 root@<prod-host>
 * — this script never opens the tunnel itself, only connects through it).
 *
 * Only ever flips false -> true; never touches a row already true, never
 * touches any other column, never deletes anything.
 *
 * Defaults to a dry run: prints counts + a sample and writes a JSON
 * report, touching no data. Pass --apply to execute.
 *
 * Usage (via ts-node):
 *   ts-node --project tsconfig.base.json -r tsconfig-paths/register \
 *     scripts/backfill-mylivecv-prod-isremote-from-location.ts [--apply] [--out report.json]
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';

const WORD_BOUNDARY_REMOTE = `~* '\\mremote\\M'`;

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

interface Counts {
  readonly toFix: number;
  readonly sample: Array<{ title: string; location: string }>;
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

function count(): Counts {
  const toFix = Number(
    runPsql(
      `SELECT count(*) FROM mylivecv."AggregatedJob" WHERE location ${WORD_BOUNDARY_REMOTE} AND "isRemote" = false;`,
    ).trim(),
  );
  const sampleRaw = runPsql(
    `SELECT title || '|' || location FROM mylivecv."AggregatedJob" WHERE location ${WORD_BOUNDARY_REMOTE} AND "isRemote" = false LIMIT 10;`,
  );
  return { toFix, sample: parseSample(sampleRaw) };
}

function buildApplySql(): string {
  return `
BEGIN;

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
    out: get('--out', '.mylivecv-prod-isremote-backfill-report.json'),
  };
}

async function main(): Promise<void> {
  const { apply, out } = parseArgs(process.argv.slice(2));

  console.log(`Connecting to ${connectionUrl().replace(/:[^:@]+@/, ':****@')}\n`);
  console.log('Counting rows whose location says "Remote" but isRemote is false…\n');
  const result = count();

  console.log(`── Plan ──`);
  console.log(`  mylivecv."AggregatedJob": ${result.toFix} row(s) to fix`);
  console.log(`\n  Sample:`);
  for (const s of result.sample) console.log(`    "${s.title}" — ${s.location}`);

  const reportPath = path.resolve(process.cwd(), out);
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`\nFull plan written to ${reportPath}`);

  if (!apply) {
    console.log(`\nDry run only — no data changed. Re-run with --apply to execute.`);
    return;
  }

  if (result.toFix === 0) {
    console.log(`\nNothing to apply.`);
    return;
  }

  console.log(`\nApplying fix to PRODUCTION...`);
  const sql = buildApplySql();
  const sqlPath = path.resolve(process.cwd(), '.mylivecv-prod-isremote-backfill.sql');
  fs.writeFileSync(sqlPath, sql);
  runPsqlFile(sqlPath);
  console.log(`Done. Applied SQL saved to ${sqlPath} for audit.`);
}

if (require.main === module) {
  void main();
}
