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
import { NotFoundException } from '@nestjs/common';
import { CanonicalJob, ScraperInputDto, SourceObservation } from '@ever-jobs/models';
import { AdminController } from '../admin.controller';
import { ADMIN_UI_HTML } from '../admin-ui.html';

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
  };
}

function makeJobStore(jobs: CanonicalJob[] = []) {
  return {
    listByQuery: jest.fn().mockResolvedValue({ items: jobs }),
    getById: jest.fn().mockImplementation(async (id: string) => jobs.find((j) => j.canonicalJobId === id) ?? null),
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

function makeExportedJobStore(exportedUrls: string[] = []) {
  return {
    filterUnseen: jest.fn().mockImplementation(async (urls: string[]) =>
      urls.filter((u) => !exportedUrls.includes(u)),
    ),
    markExported: jest.fn(),
    prune: jest.fn(),
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
      expect(result).toEqual({ items: [] });
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

      expect(aggregator.aggregate).toHaveBeenCalledWith(
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

      expect(aggregator.aggregate).toHaveBeenCalledWith(
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

      expect(aggregator.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ resultsWanted: 100 }),
      );
      expect(result).toEqual({ rawCount: 12, outputCount: 9, sites: ['indeed'] });
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

      expect(aggregator.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ captureRawResponse: true }),
      );
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
  });
});
