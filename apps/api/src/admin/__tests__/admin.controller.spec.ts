/**
 * Unit tests — `AdminController`.
 *
 * Drives the controller directly against stubbed stores (no Nest
 * bootstrap), matching this codebase's controller-test convention.
 *
 *  1. `adminUi.enabled=false` → every route (`page`, `list`, `detail`)
 *     throws `NotFoundException`.
 *  2. `list()` returns `IJobStore.listByQuery` items augmented with
 *     `exported` from `IExportedJobStore.filterUnseen`.
 *  3. `list()` maps `search` onto the `title` filter and passes
 *     company/location/since/cursor/limit through untouched.
 *  4. `list()` with no `IExportedJobStore` bound → `exported: null`
 *     on every item (status unknown, not "no").
 *  5. `list()` with no `IJobStore` bound → `{ items: [] }`.
 *  6. `detail()` 404s when the job store returns `null`.
 *  7. `detail()` returns job + observations + exported status.
 *  8. `page()` returns the HTML constant when enabled.
 */
import 'reflect-metadata';

jest.mock('axios');
import axios from 'axios';
import { NotFoundException } from '@nestjs/common';
import { CanonicalJob, ScraperInputDto, Site, SourceObservation } from '@ever-jobs/models';
import { AdminBackgroundJobsService } from '../admin-background-jobs.service';
import { AdminController } from '../admin.controller';
import { ADMIN_UI_HTML } from '../admin-ui.html';
import { ATS_COMPANY_DIRECTORY } from '../ats-company-directory';

const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Flushes pending microtasks — `clearAll()`/`extractAll()` fire their work without awaiting it. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeJob(overrides: Partial<CanonicalJob> = {}): CanonicalJob {
  return {
    canonicalJobId: 'abc',
    title: 'Engineer',
    company: 'Acme',
    location: 'Remote',
    url: 'https://example.com/1',
    mergedAt: '2026-01-01T00:00:00.000Z',
    fields: {},
    sources: [],
    ...overrides,
  } as CanonicalJob;
}

function makeConfigService(enabled: boolean, defaultSiteNames: string[] = []) {
  return {
    get: jest.fn((key: string) => (key === 'defaults' ? { siteNames: defaultSiteNames } : enabled)),
  };
}

function makeAggregator(result: Partial<{ rawCount: number; outputCount: number }> = {}) {
  return {
    aggregate: jest.fn().mockResolvedValue({
      jobs: [],
      rawCount: result.rawCount ?? 0,
      outputCount: result.outputCount ?? 0,
      deduped: false,
    }),
    aggregateIncremental: jest.fn().mockResolvedValue({
      jobs: [],
      rawCount: result.rawCount ?? 0,
      outputCount: result.outputCount ?? 0,
      deduped: false,
      perSite: [],
    }),
  };
}

function makeJobStore(jobs: CanonicalJob[] = []) {
  return {
    listByQuery: jest.fn().mockResolvedValue({ items: jobs }),
    countByQuery: jest.fn().mockResolvedValue(jobs.length),
    getById: jest.fn().mockImplementation(async (id: string) => jobs.find((j) => j.canonicalJobId === id) ?? null),
    deleteAll: jest.fn().mockResolvedValue(jobs.length),
  };
}

function makeObservationStore(observations: SourceObservation[] = []) {
  return { listByCanonicalId: jest.fn().mockResolvedValue(observations) };
}

function makeRegistry(sources: Array<{ site: string; name: string; category: string }>) {
  return {
    listSources: jest.fn().mockReturnValue(sources),
    size: sources.length,
  };
}

/** Aggregator stub whose `aggregate()` result/rejection varies by `companySlug`. */
function makeCompanyAggregator(
  bySlug: Record<string, { rawCount: number; outputCount: number } | Error>,
) {
  return {
    aggregate: jest.fn().mockImplementation(async (input: ScraperInputDto) => {
      const outcome = bySlug[input.companySlug!];
      if (outcome instanceof Error) throw outcome;
      return { jobs: [], rawCount: outcome.rawCount, outputCount: outcome.outputCount, deduped: false };
    }),
  };
}

function makeExportedJobStore(exportedUrls: string[] = []) {
  return {
    filterUnseen: jest.fn().mockImplementation(async (urls: string[]) =>
      urls.filter((u) => !exportedUrls.includes(u)),
    ),
    markExported: jest.fn(),
    prune: jest.fn(),
    count: jest.fn().mockResolvedValue(exportedUrls.length),
    clearAll: jest.fn().mockResolvedValue(exportedUrls.length),
  };
}

function makeRunStateStore() {
  return {
    getLastRunAt: jest.fn().mockResolvedValue(null),
    setLastRunAt: jest.fn(),
    resetAll: jest.fn().mockResolvedValue(undefined),
  };
}

function makeBreaker(healths: Array<Record<string, unknown>> = []) {
  return { list: jest.fn().mockReturnValue(healths) };
}

/** `ConfigService` stub that additionally serves a `dailyExport` target for `exportAll()` tests. */
function makeExportConfigService(targetUrl: string | undefined) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'dailyExport') {
        return targetUrl ? { targetUrl, targetMethod: 'POST', targetTimeoutMs: 5000 } : undefined;
      }
      if (key === 'defaults') return { siteNames: [] };
      return true; // adminUi.enabled
    }),
  };
}

describe('AdminController', () => {
  describe('when adminUi.enabled is false', () => {
    it('page() throws NotFoundException', () => {
      const controller = new AdminController(makeConfigService(false) as any);
      expect(() => controller.page()).toThrow(NotFoundException);
    });

    it('list() throws NotFoundException', async () => {
      const controller = new AdminController(makeConfigService(false) as any);
      await expect(controller.list()).rejects.toThrow(NotFoundException);
    });

    it('detail() throws NotFoundException', async () => {
      const controller = new AdminController(makeConfigService(false) as any);
      await expect(controller.detail('x')).rejects.toThrow(NotFoundException);
    });

    it('run() throws NotFoundException', async () => {
      const controller = new AdminController(makeConfigService(false) as any);
      await expect(controller.run()).rejects.toThrow(NotFoundException);
    });

    it('sites() throws NotFoundException', () => {
      const controller = new AdminController(makeConfigService(false) as any);
      expect(() => controller.sites()).toThrow(NotFoundException);
    });

    it('atsCompanies() throws NotFoundException', () => {
      const controller = new AdminController(makeConfigService(false) as any);
      expect(() => controller.atsCompanies()).toThrow(NotFoundException);
    });

    it('runCompanies() throws NotFoundException', async () => {
      const controller = new AdminController(makeConfigService(false) as any);
      await expect(controller.runCompanies()).rejects.toThrow(NotFoundException);
    });

    it('clearAll() throws NotFoundException', () => {
      const controller = new AdminController(makeConfigService(false) as any);
      expect(() => controller.clearAll()).toThrow(NotFoundException);
    });

    it('extractAll() throws NotFoundException', () => {
      const controller = new AdminController(makeConfigService(false) as any);
      expect(() => controller.extractAll()).toThrow(NotFoundException);
    });

    it('backgroundStatus() throws NotFoundException', () => {
      const controller = new AdminController(makeConfigService(false) as any);
      expect(() => controller.backgroundStatus()).toThrow(NotFoundException);
    });

    it('resetExported() throws NotFoundException', () => {
      const controller = new AdminController(makeConfigService(false) as any);
      expect(() => controller.resetExported()).toThrow(NotFoundException);
    });
  });

  describe('when adminUi.enabled is true', () => {
    it('page() returns the HTML constant', () => {
      const controller = new AdminController(makeConfigService(true) as any);
      expect(controller.page()).toBe(ADMIN_UI_HTML);
    });

    it('list() augments items with exported status from IExportedJobStore', async () => {
      const exported = makeJob({ canonicalJobId: 'a', url: 'https://example.com/a' });
      const fresh = makeJob({ canonicalJobId: 'b', url: 'https://example.com/b' });
      const jobStore = makeJobStore([exported, fresh]);
      const exportedJobStore = makeExportedJobStore(['https://example.com/a']);

      const controller = new AdminController(
        makeConfigService(true) as any,
        jobStore as any,
        undefined,
        exportedJobStore as any,
      );

      const result = await controller.list();
      expect(result.items).toEqual([
        { ...exported, exported: true },
        { ...fresh, exported: false },
      ]);
      expect(exportedJobStore.filterUnseen).toHaveBeenCalledWith([
        'https://example.com/a',
        'https://example.com/b',
      ]);
    });

    it('maps search onto the title filter and passes other params through', async () => {
      const jobStore = makeJobStore([]);
      const controller = new AdminController(
        makeConfigService(true) as any,
        jobStore as any,
      );

      await controller.list('senior', 'Acme', 'Remote', '2026-01-01', 'cursor123', '25');

      expect(jobStore.listByQuery).toHaveBeenCalledWith({
        title: 'senior',
        company: 'Acme',
        location: 'Remote',
        since: new Date('2026-01-01'),
        cursor: 'cursor123',
        limit: 25,
      });
    });

    it('list() sets exported: null on every item when no IExportedJobStore is bound', async () => {
      const jobStore = makeJobStore([makeJob()]);
      const controller = new AdminController(makeConfigService(true) as any, jobStore as any);

      const result = await controller.list();
      expect(result.items[0].exported).toBeNull();
    });

    it('list() returns an empty page when no IJobStore is bound', async () => {
      const controller = new AdminController(makeConfigService(true) as any);
      const result = await controller.list();
      expect(result).toEqual({ items: [], total: 0, totalExported: null });
    });

    it('list() returns total (filtered count) and totalExported (global count)', async () => {
      const jobs = [makeJob({ canonicalJobId: 'a', url: 'https://example.com/a' })];
      const jobStore = makeJobStore(jobs);
      const exportedJobStore = makeExportedJobStore(['https://example.com/a', 'https://example.com/b']);

      const controller = new AdminController(
        makeConfigService(true) as any,
        jobStore as any,
        undefined,
        exportedJobStore as any,
      );

      const result = await controller.list(undefined, 'Acme');
      expect(result.total).toBe(1);
      expect(result.totalExported).toBe(2);
      expect(jobStore.countByQuery).toHaveBeenCalledWith({
        title: undefined,
        company: 'Acme',
        location: undefined,
        since: undefined,
        cursor: undefined,
        limit: undefined,
      });
    });

    it('list() reports totalExported as null when no IExportedJobStore is bound', async () => {
      const jobStore = makeJobStore([makeJob()]);
      const controller = new AdminController(makeConfigService(true) as any, jobStore as any);

      const result = await controller.list();
      expect(result.totalExported).toBeNull();
    });

    it('detail() 404s when the job store has no matching id', async () => {
      const jobStore = makeJobStore([]);
      const controller = new AdminController(makeConfigService(true) as any, jobStore as any);
      await expect(controller.detail('missing')).rejects.toThrow(NotFoundException);
    });

    it('detail() returns job + observations + exported status', async () => {
      const job = makeJob();
      const observation: SourceObservation = {
        site: 'linkedin' as any,
        sourceJobId: 'src-1',
        url: 'https://example.com/1',
        observedAt: '2026-01-01T00:00:00.000Z',
      };
      const jobStore = makeJobStore([job]);
      const observationStore = makeObservationStore([observation]);
      const exportedJobStore = makeExportedJobStore([job.url]);

      const controller = new AdminController(
        makeConfigService(true) as any,
        jobStore as any,
        observationStore as any,
        exportedJobStore as any,
      );

      const result = await controller.detail('abc');
      expect(result).toEqual({ job, sources: [observation], exported: true });
    });

    it('run() throws NotFoundException when no JobsAggregator is bound', async () => {
      const controller = new AdminController(makeConfigService(true) as any);
      await expect(controller.run()).rejects.toThrow(NotFoundException);
    });

    it('run() uses explicit valid sites, dropping unrecognised ones', async () => {
      const aggregator = makeAggregator();
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
      );

      await controller.run({ sites: ['indeed', 'not-a-real-site'], searchTerm: 'engineer' });

      expect(aggregator.aggregateIncremental).toHaveBeenCalledWith(
        new ScraperInputDto({
          siteType: ['indeed'] as any,
          searchTerm: 'engineer',
          location: undefined,
          isRemote: false,
          resultsWanted: 20,
        }),
      );
    });

    it('run() falls back to defaults.siteNames when no sites are given', async () => {
      const aggregator = makeAggregator();
      const controller = new AdminController(
        makeConfigService(true, ['indeed', 'linkedin']) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
      );

      await controller.run({});

      expect(aggregator.aggregateIncremental).toHaveBeenCalledWith(
        new ScraperInputDto({
          siteType: ['indeed', 'linkedin'] as any,
          searchTerm: undefined,
          location: undefined,
          isRemote: false,
          resultsWanted: 20,
        }),
      );
    });

    it('run() clamps resultsWanted to 100 and returns rawCount/outputCount/sites', async () => {
      const aggregator = makeAggregator({ rawCount: 12, outputCount: 9 });
      const controller = new AdminController(
        makeConfigService(true, ['indeed']) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
      );

      const result = await controller.run({ resultsWanted: 5000 });

      expect(aggregator.aggregateIncremental).toHaveBeenCalledWith(
        expect.objectContaining({ resultsWanted: 100 }),
      );
      expect(result).toEqual({ rawCount: 12, outputCount: 9, sites: ['indeed'], perSite: [] });
    });

    it('run() forwards captureRawResponse to the built ScraperInputDto', async () => {
      const aggregator = makeAggregator();
      const controller = new AdminController(
        makeConfigService(true, ['indeed']) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
      );

      await controller.run({ captureRawResponse: true });

      expect(aggregator.aggregateIncremental).toHaveBeenCalledWith(
        expect.objectContaining({ captureRawResponse: true }),
      );
    });

    it('run() passes the perSite breakdown through from aggregateIncremental', async () => {
      const perSite = [
        { site: 'indeed', rawCount: 5, outputCount: 5, persisted: true },
        { site: 'linkedin', rawCount: 3, outputCount: 2, persisted: true },
      ];
      const aggregator = {
        aggregateIncremental: jest.fn().mockResolvedValue({
          jobs: [],
          rawCount: 8,
          outputCount: 7,
          deduped: true,
          perSite,
        }),
      };
      const controller = new AdminController(
        makeConfigService(true, ['indeed', 'linkedin']) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
      );

      const result = await controller.run({});
      expect(result.perSite).toEqual(perSite);
    });

    it('sites() returns an empty catalog when no PluginRegistry is bound', () => {
      const controller = new AdminController(makeConfigService(true) as any);
      expect(controller.sites()).toEqual({ categories: [], total: 0 });
    });

    it('sites() groups by category (in fixed display order) and sorts alphabetically within each', () => {
      const registry = makeRegistry([
        { site: 'zoom', name: 'Zoom', category: 'company' },
        { site: 'nvidia', name: 'NVIDIA', category: 'company' },
        { site: 'indeed', name: 'Indeed', category: 'job-board' },
        { site: 'linkedin', name: 'LinkedIn', category: 'job-board' },
        { site: 'greenhouse', name: 'Greenhouse', category: 'ats' },
      ]);
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        undefined,
        registry as any,
      );

      const result = controller.sites();

      expect(result.total).toBe(5);
      // job-board is earlier in CATEGORY_ORDER than ats/company, regardless of input order.
      expect(result.categories.map((c) => c.category)).toEqual(['job-board', 'ats', 'company']);
      expect(result.categories[0].sites).toEqual([
        { id: 'indeed', name: 'Indeed' },
        { id: 'linkedin', name: 'LinkedIn' },
      ]);
      // Sorted alphabetically by name within the category (NVIDIA before Zoom).
      expect(result.categories[2].sites.map((s) => s.id)).toEqual(['nvidia', 'zoom']);
    });

    it('sites() places unrecognised categories after the known ones', () => {
      const registry = makeRegistry([
        { site: 'weird', name: 'Weird', category: 'mystery-category' },
        { site: 'indeed', name: 'Indeed', category: 'job-board' },
      ]);
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        undefined,
        registry as any,
      );

      const result = controller.sites();
      expect(result.categories.map((c) => c.category)).toEqual(['job-board', 'mystery-category']);
    });

    it('sourcesOverview() combines per-site job counts with circuit-breaker health, sorted job-count desc', async () => {
      const registry = makeRegistry([
        { site: 'greenhouse', name: 'Greenhouse', category: 'ats' },
        { site: 'linkedin', name: 'LinkedIn', category: 'job-board' },
        { site: 'indeed', name: 'Indeed', category: 'job-board' },
      ]);
      const jobStore = makeJobStore([
        makeJob({ canonicalJobId: 'a', sources: [{ site: Site.GREENHOUSE, sourceJobId: '1', url: 'u1', observedAt: 't' }] }),
        makeJob({ canonicalJobId: 'b', sources: [{ site: Site.GREENHOUSE, sourceJobId: '2', url: 'u2', observedAt: 't' }] }),
        makeJob({ canonicalJobId: 'c', sources: [{ site: Site.LINKEDIN, sourceJobId: '3', url: 'u3', observedAt: 't' }] }),
      ]);
      const breaker = makeBreaker([
        { site: 'greenhouse', state: 'closed', successRate: 1, p95LatencyMs: 120 },
        { site: 'linkedin', state: 'open', successRate: 0, p95LatencyMs: 900, lastError: { code: 'ERR_X', message: 'boom', at: 't' } },
      ]);
      const controller = new AdminController(
        makeConfigService(true) as any,
        jobStore as any,
        undefined,
        undefined,
        undefined,
        registry as any,
        undefined,
        undefined,
        breaker as any,
      );

      const result = await controller.sourcesOverview();

      expect(result.totalSources).toBe(3);
      expect(result.totalJobs).toBe(3);
      // Greenhouse (2 jobs) ranks above LinkedIn (1 job) above Indeed (0 jobs).
      expect(result.sources.map((s) => s.site)).toEqual(['greenhouse', 'linkedin', 'indeed']);

      const greenhouse = result.sources[0];
      expect(greenhouse).toMatchObject({ jobCount: 2, state: 'closed', successRate: 1, p95LatencyMs: 120 });

      const linkedin = result.sources[1];
      expect(linkedin).toMatchObject({ jobCount: 1, state: 'open', successRate: 0 });
      expect(linkedin.lastError).toEqual({ code: 'ERR_X', message: 'boom', at: 't' });

      // Indeed was never scraped this process — 'untested', not a false "down".
      const indeed = result.sources[2];
      expect(indeed).toMatchObject({ jobCount: 0, state: 'untested', successRate: null, p95LatencyMs: null });
    });

    it('sourcesOverview() returns zero-job, untested sources when no jobStore/breaker is bound', async () => {
      const registry = makeRegistry([{ site: 'greenhouse', name: 'Greenhouse', category: 'ats' }]);
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        undefined,
        registry as any,
      );

      const result = await controller.sourcesOverview();

      expect(result).toEqual({
        totalSources: 1,
        totalJobs: 0,
        sources: [
          { site: 'greenhouse', name: 'Greenhouse', category: 'ats', jobCount: 0, state: 'untested', successRate: null, p95LatencyMs: null, lastError: undefined },
        ],
      });
    });

    it('atsCompanies() with no site query returns entries sorted descending by count', () => {
      const controller = new AdminController(makeConfigService(true) as any);
      const result = controller.atsCompanies() as Array<{ site: string; count: number }>;
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].count).toBeGreaterThanOrEqual(result[i + 1].count);
      }
    });

    it('atsCompanies() with an unknown site returns an empty companies array', () => {
      const controller = new AdminController(makeConfigService(true) as any);
      const result = controller.atsCompanies('totally-made-up-site-xyz');
      expect(result).toEqual({ site: 'totally-made-up-site-xyz', companies: [] });
    });

    it('runCompanies() throws NotFoundException when no aggregator is bound', async () => {
      const controller = new AdminController(makeConfigService(true) as any);
      await expect(controller.runCompanies({ site: 'greenhouse', companySlugs: ['stripe'] }))
        .rejects.toThrow(NotFoundException);
    });

    it('runCompanies() throws NotFoundException for an invalid site', async () => {
      const aggregator = makeAggregator();
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
      );
      await expect(controller.runCompanies({ site: 'not-a-real-site', companySlugs: ['stripe'] }))
        .rejects.toThrow(NotFoundException);
    });

    it('runCompanies() dedupes slugs, fans out concurrently, and sums results across successes', async () => {
      const aggregator = makeCompanyAggregator({
        stripe: { rawCount: 5, outputCount: 4 },
        airbnb: { rawCount: 3, outputCount: 3 },
      });
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
      );

      const result = await controller.runCompanies({
        site: 'greenhouse',
        companySlugs: ['stripe', 'airbnb', 'stripe'],
      });

      expect(aggregator.aggregate).toHaveBeenCalledTimes(2); // deduped
      expect(result).toEqual({
        site: 'greenhouse',
        companiesRequested: 2,
        companiesSucceeded: 2,
        companiesFailed: 0,
        rawCount: 8,
        outputCount: 7,
      });
    });

    it('runCompanies() counts a rejected company as failed without aborting the batch', async () => {
      const aggregator = makeCompanyAggregator({
        stripe: { rawCount: 5, outputCount: 4 },
        deadco: new Error('site unreachable'),
      });
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
      );

      const result = await controller.runCompanies({
        site: 'greenhouse',
        companySlugs: ['stripe', 'deadco'],
      });

      expect(result).toEqual({
        site: 'greenhouse',
        companiesRequested: 2,
        companiesSucceeded: 1,
        companiesFailed: 1,
        rawCount: 5,
        outputCount: 4,
      });
    });

    it('runCompanies() applies resultsWanted per company, not split across the batch', async () => {
      const aggregator = makeCompanyAggregator({
        stripe: { rawCount: 1, outputCount: 1 },
        airbnb: { rawCount: 1, outputCount: 1 },
      });
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
      );

      await controller.runCompanies({
        site: 'greenhouse',
        companySlugs: ['stripe', 'airbnb'],
        resultsWanted: 10,
      });

      const calls = aggregator.aggregate.mock.calls.map((c: [ScraperInputDto]) => c[0]);
      expect(calls).toHaveLength(2);
      for (const input of calls) {
        expect(input.resultsWanted).toBe(10);
      }
    });

    it('clearAll() throws NotFoundException when no IJobStore is bound', () => {
      const controller = new AdminController(makeConfigService(true) as any);
      expect(() => controller.clearAll()).toThrow(NotFoundException);
    });

    it('clearAll() throws NotFoundException when no AdminBackgroundJobsService is bound', () => {
      const jobStore = makeJobStore([makeJob()]);
      const controller = new AdminController(makeConfigService(true) as any, jobStore as any);
      expect(() => controller.clearAll()).toThrow(NotFoundException);
    });

    it('clearAll() runs in the background — returns "running" immediately, then "done" with counts', async () => {
      const jobStore = makeJobStore([makeJob(), makeJob({ canonicalJobId: 'b' })]);
      const exportedJobStore = makeExportedJobStore(['https://example.com/1', 'https://example.com/2']);
      const runStateStore = makeRunStateStore();
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeConfigService(true) as any,
        jobStore as any,
        undefined,
        exportedJobStore as any,
        undefined,
        undefined,
        runStateStore as any,
        backgroundJobs,
      );

      const started = controller.clearAll();
      expect(started.state).toBe('running');
      expect(jobStore.deleteAll).toHaveBeenCalled(); // work fires synchronously, just not awaited

      await flushMicrotasks();

      const finished = backgroundJobs.getAll()['clear-all'];
      expect(finished.state).toBe('done');
      expect(exportedJobStore.clearAll).toHaveBeenCalled();
      expect(runStateStore.resetAll).toHaveBeenCalled();
      expect(finished.result).toEqual({
        deletedJobs: 2,
        deletedExportedMarks: 2,
        resetRunState: true,
      });
    });

    it('clearAll() reports null/false for capabilities that are not bound', async () => {
      const jobStore = makeJobStore([makeJob()]);
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeConfigService(true) as any,
        jobStore as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );

      controller.clearAll();
      await flushMicrotasks();

      expect(backgroundJobs.getAll()['clear-all'].result).toEqual({
        deletedJobs: 1,
        deletedExportedMarks: null,
        resetRunState: false,
      });
    });

    it('clearAll() called again while running is a no-op (does not re-trigger the wipe)', async () => {
      const jobStore = makeJobStore([makeJob()]);
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeConfigService(true) as any,
        jobStore as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );

      controller.clearAll();
      controller.clearAll();
      await flushMicrotasks();

      expect(jobStore.deleteAll).toHaveBeenCalledTimes(1);
    });

    it('backgroundStatus() reflects both jobs — idle before anything runs', () => {
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );

      expect(controller.backgroundStatus()).toEqual({
        'extract-all': { name: 'extract-all', state: 'idle' },
        'clear-all': { name: 'clear-all', state: 'idle' },
        'export-all': { name: 'export-all', state: 'idle' },
        'reset-exported': { name: 'reset-exported', state: 'idle' },
      });
    });

    it('resetExported() throws NotFoundException when no IExportedJobStore is bound', () => {
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );
      expect(() => controller.resetExported()).toThrow(NotFoundException);
    });

    it('resetExported() throws NotFoundException when no AdminBackgroundJobsService is bound', () => {
      const exportedJobStore = makeExportedJobStore(['https://example.com/1']);
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        exportedJobStore as any,
      );
      expect(() => controller.resetExported()).toThrow(NotFoundException);
    });

    it('resetExported() clears every exported mark WITHOUT touching job data', async () => {
      const jobStore = makeJobStore([makeJob(), makeJob({ canonicalJobId: 'b' })]);
      const exportedJobStore = makeExportedJobStore(['https://example.com/1', 'https://example.com/2']);
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeConfigService(true) as any,
        jobStore as any,
        undefined,
        exportedJobStore as any,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );

      const started = controller.resetExported();
      expect(started.state).toBe('running');
      expect(jobStore.deleteAll).not.toHaveBeenCalled();

      await flushMicrotasks();

      const finished = backgroundJobs.getAll()['reset-exported'];
      expect(finished.state).toBe('done');
      expect(exportedJobStore.clearAll).toHaveBeenCalled();
      expect(jobStore.deleteAll).not.toHaveBeenCalled();
      expect(finished.result).toEqual({ clearedMarks: 2 });
    });

    it('resetExported() called again while running is a no-op', async () => {
      const exportedJobStore = makeExportedJobStore(['https://example.com/1']);
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        exportedJobStore as any,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );

      controller.resetExported();
      controller.resetExported();
      await flushMicrotasks();

      expect(exportedJobStore.clearAll).toHaveBeenCalledTimes(1);
    });

    it('exportAll() throws NotFoundException when no export target is configured', () => {
      const jobStore = makeJobStore([makeJob()]);
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeExportConfigService(undefined) as any,
        jobStore as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );
      expect(() => controller.exportAll()).toThrow(NotFoundException);
    });

    it('exportAll() pushes only NOT-yet-exported jobs, skipping ones already marked exported', async () => {
      mockedAxios.request.mockResolvedValue({ status: 200, data: {} });

      const jobs = [
        makeJob({ canonicalJobId: 'a', url: 'https://example.com/1' }),
        makeJob({ canonicalJobId: 'b', url: 'https://example.com/2' }),
        makeJob({ canonicalJobId: 'c', url: 'https://example.com/3' }),
      ];
      const jobStore = makeJobStore(jobs);
      // "https://example.com/2" is already exported — it must be skipped.
      const exportedJobStore = makeExportedJobStore(['https://example.com/2']);
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeExportConfigService('https://sink.example.com/ingest') as any,
        jobStore as any,
        undefined,
        exportedJobStore as any,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );

      const started = controller.exportAll();
      expect(started.state).toBe('running');

      await flushMicrotasks();

      const finished = backgroundJobs.getAll()['export-all'];
      expect(finished.state).toBe('done');
      expect(finished.result).toEqual({
        total: 3,
        scanned: 3,
        pushed: 2,
        skipped: 1,
        batches: 1,
        destination: 'https://sink.example.com/ingest',
      });

      // Only the two unexported jobs were actually sent downstream.
      expect(mockedAxios.request).toHaveBeenCalledTimes(1);
      const sentJobs = (mockedAxios.request.mock.calls[0][0] as { data: { jobs: Array<{ jobUrl: string }> } })
        .data.jobs;
      expect(sentJobs.map((j) => j.jobUrl).sort()).toEqual([
        'https://example.com/1',
        'https://example.com/3',
      ]);
      expect(exportedJobStore.markExported).toHaveBeenCalledWith(
        expect.arrayContaining(['https://example.com/1', 'https://example.com/3']),
        expect.any(Date),
      );
    });

    it('exportAll() with no IExportedJobStore bound falls back to pushing everything (unknowable otherwise)', async () => {
      mockedAxios.request.mockResolvedValue({ status: 200, data: {} });

      const jobs = [makeJob({ canonicalJobId: 'a', url: 'https://example.com/1' })];
      const jobStore = makeJobStore(jobs);
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeExportConfigService('https://sink.example.com/ingest') as any,
        jobStore as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );

      controller.exportAll();
      await flushMicrotasks();

      const finished = backgroundJobs.getAll()['export-all'];
      expect(finished.result).toMatchObject({ total: 1, scanned: 1, pushed: 1, skipped: 0 });
    });

    it('extractAll() throws NotFoundException when no JobsAggregator is bound', () => {
      const backgroundJobs = new AdminBackgroundJobsService();
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        backgroundJobs,
      );
      expect(() => controller.extractAll()).toThrow(NotFoundException);
    });

    it('extractAll() throws NotFoundException when no PluginRegistry is bound', () => {
      const backgroundJobs = new AdminBackgroundJobsService();
      const aggregator = makeAggregator();
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
        undefined,
        undefined,
        backgroundJobs,
      );
      expect(() => controller.extractAll()).toThrow(NotFoundException);
    });

    it('extractAll() runs every registered site AND every known ATS company, reporting progress and a final summary', async () => {
      const registry = makeRegistry([
        { site: 'indeed', name: 'Indeed', category: 'job-board' },
        { site: 'linkedin', name: 'LinkedIn', category: 'job-board' },
      ]);
      const backgroundJobs = new AdminBackgroundJobsService();
      const aggregateIncremental = jest.fn().mockResolvedValue({
        jobs: [], rawCount: 10, outputCount: 8, deduped: true, perSite: [],
      });
      const aggregate = jest.fn().mockResolvedValue({ jobs: [], rawCount: 1, outputCount: 1, deduped: false });
      const aggregator = { aggregate, aggregateIncremental };
      const controller = new AdminController(
        makeConfigService(true) as any,
        undefined,
        undefined,
        undefined,
        aggregator as any,
        registry as any,
        undefined,
        backgroundJobs,
      );

      const started = controller.extractAll();
      expect(started.state).toBe('running');

      await flushMicrotasks();
      // The ATS phase is a sequential per-platform loop over the full real
      // directory (~170 platforms / ~530 companies) — give it a few more
      // microtask turns to fully settle rather than assuming one flush.
      for (let i = 0; i < 20; i++) await flushMicrotasks();

      const finished = backgroundJobs.getAll()['extract-all'];
      expect(finished.state).toBe('done');
      expect(aggregateIncremental).toHaveBeenCalledWith(
        expect.objectContaining({ siteType: ['indeed', 'linkedin'] }),
      );

      const validSites = new Set(Object.values(Site) as string[]);
      const expectedPlatforms = Object.keys(ATS_COMPANY_DIRECTORY).filter((s) => validSites.has(s));
      const expectedCompanyCalls = expectedPlatforms.reduce(
        (sum, s) => sum + ATS_COMPANY_DIRECTORY[s].length,
        0,
      );
      expect(aggregate).toHaveBeenCalledTimes(expectedCompanyCalls);
      expect(finished.result).toMatchObject({
        sites: { rawCount: 10, outputCount: 8 },
        atsCompanies: { platforms: expectedPlatforms.length },
      });
    }, 30_000);
  });
});
