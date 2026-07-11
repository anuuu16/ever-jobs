/**
 * Unit tests — `DailyExportCron`.
 *
 * Drives the provider directly (no Nest bootstrap). Cross-run dedup is
 * exercised against a fake `IExportedJobStore` (a real backend's Map
 * without the DI/DB plumbing); the webhook push path mocks `axios`;
 * the local-file fallback writes to a real temp directory.
 *
 *  1. Disabled by default → onApplicationBootstrap schedules no timer.
 *  2. Enabled → timer scheduled at the requested interval, unref()'d.
 *  3. runExport() with disabled config → `{ ran: false, reason: 'disabled' }`.
 *  4. Webhook configured → axios.request called with the fresh jobs;
 *     success marks them exported via the store.
 *  5. Second run with the same jobs → all skipped as duplicates (store
 *     dedup), nothing pushed.
 *  6. A run mixing a repeat with a new posting → only the new job is
 *     pushed.
 *  7. axios rejecting → runExport resolves `{ ran: false, reason:
 *     'push-failed' }`, never throws, and does NOT mark the batch
 *     exported (so the next tick retries).
 *  8. No target URL configured → falls back to writing a local file.
 *  9. No IExportedJobStore bound → every tick re-exports with no
 *     cross-run dedup (documented degraded-mode behaviour).
 * 10. onApplicationShutdown clears the interval; idempotent.
 */
import 'reflect-metadata';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IExportedJobStore, JobPostDto } from '@ever-jobs/models';
import {
  DailyExportConfig,
  DailyExportCron,
  DEFAULT_DAILY_EXPORT_INTERVAL_MS,
} from '../daily-export.cron';

jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeJob(overrides: Partial<JobPostDto> = {}): JobPostDto {
  return {
    title: 'Software Engineer',
    companyName: 'Acme',
    jobUrl: 'https://example.com/jobs/1',
    ...overrides,
  } as JobPostDto;
}

interface AggregatorStub {
  readonly aggregate: jest.Mock;
}

function makeAggregator(jobs: JobPostDto[]): AggregatorStub {
  return { aggregate: jest.fn().mockResolvedValue({ jobs }) };
}

/** Map-backed fake mirroring InMemoryJobStore's IExportedJobStore slice. */
function makeExportedJobStore(): IExportedJobStore & {
  readonly filterUnseen: jest.Mock;
  readonly markExported: jest.Mock;
  readonly prune: jest.Mock;
} {
  const seen = new Map<string, Date>();
  return {
    filterUnseen: jest.fn(async (urls: readonly string[]) =>
      urls.filter((u) => !seen.has(u)),
    ),
    markExported: jest.fn(async (urls: readonly string[], at: Date) => {
      for (const u of urls) seen.set(u, at);
    }),
    prune: jest.fn(async () => 0),
  };
}

function makeConfigService(overrides: Partial<DailyExportConfig>) {
  const config: DailyExportConfig = {
    enabled: false,
    intervalMs: DEFAULT_DAILY_EXPORT_INTERVAL_MS,
    siteNames: [],
    isRemote: false,
    resultsWanted: 100,
    retentionDays: 30,
    targetMethod: 'POST',
    targetHeaders: {},
    targetTimeoutMs: 30_000,
    dir: '',
    format: 'json',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) =>
      key === 'defaults' ? { siteNames: [] } : config,
    ),
  };
}

describe('DailyExportCron', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('does not schedule a timer when disabled', () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(global, 'setInterval');
    const cron = new DailyExportCron(
      makeAggregator([]) as any,
      makeConfigService({ enabled: false }) as any,
      makeExportedJobStore(),
    );
    cron.onApplicationBootstrap();
    expect(spy).not.toHaveBeenCalled();
  });

  it('schedules an unref()d timer at the configured interval when enabled', () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(global, 'setInterval');
    const cron = new DailyExportCron(
      makeAggregator([]) as any,
      makeConfigService({ enabled: true, intervalMs: 12_345 }) as any,
      makeExportedJobStore(),
    );
    cron.onApplicationBootstrap();
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 12_345);
    cron.onApplicationShutdown();
  });

  it('runExport() is a no-op when disabled', async () => {
    const cron = new DailyExportCron(
      makeAggregator([makeJob()]) as any,
      makeConfigService({ enabled: false }) as any,
      makeExportedJobStore(),
    );
    const result = await cron.runExport();
    expect(result).toEqual({ ran: false, reason: 'disabled' });
  });

  it('pushes fresh jobs to the configured webhook and marks them exported', async () => {
    mockedAxios.request.mockResolvedValue({ status: 200 });
    const job = makeJob();
    const store = makeExportedJobStore();
    const cron = new DailyExportCron(
      makeAggregator([job]) as any,
      makeConfigService({ enabled: true, targetUrl: 'https://platform.example/ingest' }) as any,
      store,
    );

    const result = await cron.runExport();
    expect(result).toEqual({
      ran: true,
      exported: 1,
      skippedDuplicates: 0,
      destination: 'webhook https://platform.example/ingest',
    });

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://platform.example/ingest',
        method: 'POST',
        data: { jobs: [job] },
      }),
    );
    expect(store.markExported).toHaveBeenCalledWith([job.jobUrl], expect.any(Date));
  });

  it('skips already-exported jobs on a subsequent run', async () => {
    mockedAxios.request.mockResolvedValue({ status: 200 });
    const job = makeJob();
    const aggregator = makeAggregator([job]);
    const store = makeExportedJobStore();
    const cron = new DailyExportCron(
      aggregator as any,
      makeConfigService({ enabled: true, targetUrl: 'https://platform.example/ingest' }) as any,
      store,
    );

    await cron.runExport();
    const second = await cron.runExport();
    expect(second).toEqual({ ran: false, reason: 'no-jobs' });
    expect(mockedAxios.request).toHaveBeenCalledTimes(1);
  });

  it('only pushes the new job when a run mixes a repeat with a new posting', async () => {
    mockedAxios.request.mockResolvedValue({ status: 200 });
    const seenJob = makeJob({ jobUrl: 'https://example.com/jobs/1' });
    const newJob = makeJob({ jobUrl: 'https://example.com/jobs/2', title: 'Staff Engineer' });

    const aggregator = makeAggregator([seenJob]);
    const store = makeExportedJobStore();
    const cron = new DailyExportCron(
      aggregator as any,
      makeConfigService({ enabled: true, targetUrl: 'https://platform.example/ingest' }) as any,
      store,
    );
    await cron.runExport();

    aggregator.aggregate.mockResolvedValue({ jobs: [seenJob, newJob] });
    const second = await cron.runExport();
    expect(second).toEqual({
      ran: true,
      exported: 1,
      skippedDuplicates: 1,
      destination: 'webhook https://platform.example/ingest',
    });
    expect(mockedAxios.request).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { jobs: [newJob] } }),
    );
  });

  it('does not mark jobs exported when the webhook push fails, so the next tick retries', async () => {
    mockedAxios.request.mockRejectedValue(new Error('ECONNREFUSED'));
    const job = makeJob();
    const store = makeExportedJobStore();
    const cron = new DailyExportCron(
      makeAggregator([job]) as any,
      makeConfigService({ enabled: true, targetUrl: 'https://platform.example/ingest' }) as any,
      store,
    );

    const result = await cron.runExport();
    expect(result).toEqual({ ran: false, reason: 'push-failed' });
    expect(store.markExported).not.toHaveBeenCalled();
  });

  describe('local-file fallback (no targetUrl configured)', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'daily-export-test-'));
    });

    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('writes fresh jobs to a dated JSON file', async () => {
      const job = makeJob();
      const cron = new DailyExportCron(
        makeAggregator([job]) as any,
        makeConfigService({ enabled: true, dir }) as any,
        makeExportedJobStore(),
      );

      const result = await cron.runExport();
      expect(result.ran).toBe(true);
      if (!result.ran) throw new Error('expected ran=true');
      expect(result.destination).toMatch(/^file:.*jobs-\d{4}-\d{2}-\d{2}\.json$/);

      const filePath = result.destination.replace(/^file:/, '');
      const written = JSON.parse(await readFile(filePath, 'utf-8'));
      expect(written).toHaveLength(1);
      expect(written[0].jobUrl).toBe(job.jobUrl);
      expect(mockedAxios.request).not.toHaveBeenCalled();
    });

    it('writes CSV when format is csv', async () => {
      const job = makeJob();
      const cron = new DailyExportCron(
        makeAggregator([job]) as any,
        makeConfigService({ enabled: true, dir, format: 'csv' }) as any,
        makeExportedJobStore(),
      );
      const result = await cron.runExport();
      expect(result.ran).toBe(true);
      if (!result.ran) throw new Error('expected ran=true');
      expect(result.destination).toMatch(/\.csv$/);
      const filePath = result.destination.replace(/^file:/, '');
      const contents = await readFile(filePath, 'utf-8');
      expect(contents).toContain('jobUrl');
      expect(contents).toContain(job.jobUrl);
    });
  });

  it('exports without cross-run dedup when no IExportedJobStore is bound', async () => {
    mockedAxios.request.mockResolvedValue({ status: 200 });
    const job = makeJob();
    const cron = new DailyExportCron(
      makeAggregator([job]) as any,
      makeConfigService({ enabled: true, targetUrl: 'https://platform.example/ingest' }) as any,
      undefined,
    );

    const first = await cron.runExport();
    const second = await cron.runExport();
    expect(first.ran).toBe(true);
    expect(second.ran).toBe(true);
    if (!second.ran) throw new Error('expected ran=true');
    expect(second.exported).toBe(1);
  });

  it('never throws when the aggregator rejects', async () => {
    const cron = new DailyExportCron(
      { aggregate: jest.fn().mockRejectedValue(new Error('boom')) } as any,
      makeConfigService({ enabled: true }) as any,
      makeExportedJobStore(),
    );
    await expect(cron.runExport()).resolves.toEqual(
      expect.objectContaining({ ran: false }),
    );
  });

  it('onApplicationShutdown clears the timer and is idempotent', () => {
    jest.useFakeTimers();
    const clearSpy = jest.spyOn(global, 'clearInterval');
    const cron = new DailyExportCron(
      makeAggregator([]) as any,
      makeConfigService({ enabled: true }) as any,
      makeExportedJobStore(),
    );
    cron.onApplicationBootstrap();
    cron.onApplicationShutdown();
    cron.onApplicationShutdown();
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});
