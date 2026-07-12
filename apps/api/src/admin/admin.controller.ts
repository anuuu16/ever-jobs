import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  CanonicalJob,
  CIRCUIT_BREAKER_TOKEN,
  EXPORTED_JOB_STORE_TOKEN,
  ICircuitBreakerService,
  IExportedJobStore,
  IJobObservationStore,
  IJobStore,
  IRunStateStore,
  JOB_OBSERVATION_STORE_TOKEN,
  JOB_STORE_TOKEN,
  JobStoreQuery,
  RUN_STATE_STORE_TOKEN,
  ScraperInputDto,
  Site,
  SourceHealth,
  SourceObservation,
} from '@ever-jobs/models';
import { PluginRegistry } from '@ever-jobs/plugin';
import { DailyExportConfig } from '../jobs/daily-export.cron';
import { JobsAggregator, PerSiteAggregateResult } from '../jobs/jobs.aggregator';
import {
  AdminBackgroundJobsService,
  BackgroundJobName,
  BackgroundJobProgress,
  BackgroundJobStatus,
} from './admin-background-jobs.service';
import { ADMIN_UI_HTML } from './admin-ui.html';
import { ATS_COMPANY_DIRECTORY, AtsCompanyEntry } from './ats-company-directory';

interface RunExtractionBody {
  readonly sites?: string[];
  readonly searchTerm?: string;
  readonly location?: string;
  readonly resultsWanted?: number;
  readonly isRemote?: boolean;
  readonly captureRawResponse?: boolean;
}

interface RunExtractionResult {
  readonly rawCount: number;
  readonly outputCount: number;
  readonly sites: string[];
  /**
   * Per-site breakdown, in settle order (not alphabetical) — each site's
   * results are dedup'd against itself only and persisted as soon as
   * that site finishes scraping (see `JobsAggregator.aggregateIncremental`),
   * rather than waiting for every selected site before persisting anything.
   */
  readonly perSite: ReadonlyArray<PerSiteAggregateResult>;
}

interface AdminJobListItem extends CanonicalJob {
  /** `null` when no `IExportedJobStore` is bound — status is unknown, not "no". */
  readonly exported: boolean | null;
}

interface AdminJobDetail {
  readonly job: CanonicalJob;
  readonly sources: ReadonlyArray<SourceObservation>;
  readonly exported: boolean | null;
}

interface SiteCatalogEntry {
  readonly id: string;
  readonly name: string;
}

interface SiteCatalogCategory {
  readonly category: string;
  readonly sites: SiteCatalogEntry[];
}

interface SiteCatalogResult {
  readonly categories: SiteCatalogCategory[];
  readonly total: number;
}

interface AtsSummaryEntry {
  readonly site: string;
  readonly count: number;
}

interface SourceOverviewEntry {
  readonly site: string;
  readonly name: string;
  readonly category: string;
  /** Persisted canonical-job count carrying an observation from this site. */
  readonly jobCount: number;
  /**
   * Circuit-breaker state for this process. `untested` means the breaker
   * has no entry for this site (never invoked since the last restart) —
   * NOT the same as "broken".
   */
  readonly state: 'closed' | 'half-open' | 'open' | 'untested';
  /** `null` when `state` is `untested` (no rolling-window data yet). */
  readonly successRate: number | null;
  readonly p95LatencyMs: number | null;
  readonly lastError?: { readonly code: string; readonly message: string; readonly at: string };
}

interface SourcesOverviewResult {
  readonly sources: SourceOverviewEntry[];
  readonly totalJobs: number;
  readonly totalSources: number;
}

interface RunCompaniesBody {
  readonly site?: string;
  readonly companySlugs?: string[];
  readonly searchTerm?: string;
  readonly location?: string;
  readonly resultsWanted?: number;
  readonly isRemote?: boolean;
  readonly captureRawResponse?: boolean;
}

interface RunCompaniesResult {
  readonly site: string;
  readonly companiesRequested: number;
  readonly companiesSucceeded: number;
  readonly companiesFailed: number;
  readonly rawCount: number;
  readonly outputCount: number;
}

/** Display order for categories — most generally-useful first. */
const CATEGORY_ORDER = [
  'job-board',
  'remote',
  'regional',
  'freelance',
  'government',
  'niche',
  'ats',
  'company',
];

/**
 * Local-only admin surface: a plain server-rendered table over the
 * persisted job store (search/filter/paginate + full-detail view +
 * export status), for eyeballing what the daily-export pipeline is
 * actually seeing without querying the DB by hand.
 *
 * Gated by `adminUi.enabled` (defaults ON outside `production`, OFF in
 * `production` unless explicitly re-enabled) — this is a debugging tool,
 * not a hardened surface, and it is excluded from the Swagger/Scalar
 * docs (`@ApiExcludeController`) so it doesn't show up as a "real" API.
 * Mostly read-only: it re-uses the existing `IJobStore.listByQuery` /
 * `getById` / `IJobObservationStore.listByCanonicalId` / the
 * `IExportedJobStore` capability added for `DailyExportCron` — no new
 * read-side persistence surface. The one write-capable escape hatch is
 * `clearAll()` (a destructive full reset for local testing), which
 * reuses `IJobStore.deleteAll` / `IExportedJobStore.clearAll` /
 * `IRunStateStore.resetAll` rather than introducing a bespoke wipe path.
 */
@ApiExcludeController()
@Controller()
export class AdminController {
  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(JOB_STORE_TOKEN)
    private readonly jobStore?: IJobStore,
    @Optional()
    @Inject(JOB_OBSERVATION_STORE_TOKEN)
    private readonly observationStore?: IJobObservationStore,
    @Optional()
    @Inject(EXPORTED_JOB_STORE_TOKEN)
    private readonly exportedJobStore?: IExportedJobStore | null,
    @Optional()
    private readonly aggregator?: JobsAggregator,
    @Optional()
    private readonly registry?: PluginRegistry,
    @Optional()
    @Inject(RUN_STATE_STORE_TOKEN)
    private readonly runStateStore?: IRunStateStore | null,
    @Optional()
    private readonly backgroundJobs?: AdminBackgroundJobsService,
    @Optional()
    @Inject(CIRCUIT_BREAKER_TOKEN)
    private readonly breaker?: ICircuitBreakerService,
  ) {}

  @Get('admin')
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(): string {
    this.assertEnabled();
    return ADMIN_UI_HTML;
  }

  @Get('api/admin/jobs')
  async list(
    @Query('search') search?: string,
    @Query('company') company?: string,
    @Query('location') location?: string,
    @Query('since') since?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
  ): Promise<{
    items: AdminJobListItem[];
    nextCursor?: string;
    /** Total rows matching the current filters (all pages, not just this one). */
    total: number;
    /** Total URLs ever marked exported, unfiltered — `null` when no `IExportedJobStore` is bound. */
    totalExported: number | null;
  }> {
    this.assertEnabled();
    if (!this.jobStore) {
      return { items: [], total: 0, totalExported: null };
    }

    const query: JobStoreQuery = {
      // `search` is a free-text convenience filter mapped onto `title` —
      // the store contract only defines substring filters on
      // title/company/location individually.
      title: search || undefined,
      company: company || undefined,
      location: location || undefined,
      since: since ? new Date(since) : undefined,
      cursor: cursor || undefined,
      limit: limitRaw ? Number(limitRaw) || undefined : undefined,
    };

    // Fanned out concurrently — `total` (filtered count) and
    // `totalExported` (global exported-mark count) are independent reads
    // that don't need the page of items to resolve first.
    const [page, total, totalExported] = await Promise.all([
      this.jobStore.listByQuery(query),
      this.jobStore.countByQuery({ ...query, cursor: undefined, limit: undefined }),
      this.exportedJobStore ? this.exportedJobStore.count() : Promise.resolve(null),
    ]);
    const items = await this.withExportedStatus(page.items);
    return { items, nextCursor: page.nextCursor, total, totalExported };
  }

  /**
   * Kick off a full reset — every canonical job (+ observations,
   * cascaded), every exported-job mark, and every `IRunStateStore`
   * watermark — so the next scrape behaves like a brand-new deployment.
   * Destructive and irreversible; the admin UI gates this behind a
   * type-to-confirm prompt before calling it.
   *
   * Runs via `AdminBackgroundJobsService` like `extractAll()` — in
   * practice this finishes in milliseconds, but it shares the same
   * start/poll contract so the UI has one status-polling mechanism for
   * both destructive/long-running actions instead of two.
   */
  @Post('api/admin/jobs/clear-all')
  clearAll(): BackgroundJobStatus {
    this.assertEnabled();
    if (!this.jobStore) {
      throw new NotFoundException('No job store bound');
    }
    if (!this.backgroundJobs) {
      throw new NotFoundException('No AdminBackgroundJobsService bound');
    }

    return this.backgroundJobs.start('clear-all', async () => this.runClearAll());
  }

  @Get('api/admin/jobs/background-status')
  backgroundStatus(): Record<BackgroundJobName, BackgroundJobStatus> {
    this.assertEnabled();
    if (!this.backgroundJobs) {
      return {
        'extract-all': { name: 'extract-all', state: 'idle' },
        'clear-all': { name: 'clear-all', state: 'idle' },
        'export-all': { name: 'export-all', state: 'idle' },
        'reset-exported': { name: 'reset-exported', state: 'idle' },
      };
    }
    return this.backgroundJobs.getAll();
  }

  /**
   * Kick off a background job that runs BOTH: (1) an extraction across
   * every registered site (mirrors `run()` with no site filter), and
   * (2) the ATS company batch across every platform × every known
   * company in `ATS_COMPANY_DIRECTORY` (mirrors `runCompanies()`, run
   * one platform at a time so it doesn't fan out across all ~530
   * companies simultaneously). No manual selection — this is the "just
   * get everything" button.
   */
  @Post('api/admin/jobs/extract-all')
  extractAll(): BackgroundJobStatus {
    this.assertEnabled();
    if (!this.aggregator) {
      throw new NotFoundException('No JobsAggregator bound');
    }
    if (!this.registry) {
      throw new NotFoundException('No PluginRegistry bound');
    }
    if (!this.backgroundJobs) {
      throw new NotFoundException('No AdminBackgroundJobsService bound');
    }

    return this.backgroundJobs.start('extract-all', (update) => this.runExtractAll(update));
  }

  /**
   * Push EVERY persisted canonical job to the configured downstream target
   * (the `dailyExport` webhook — e.g. the platform's job-board ingest
   * endpoint) and mark them all exported, so the next daily-export tick
   * treats them as already-seen.
   *
   * Unlike `DailyExportCron`, which only pushes *fresh* (unseen) jobs from a
   * live scrape, this operator action re-pushes the WHOLE store on demand —
   * the "sync everything I've already collected to the platform" button.
   * Idempotent downstream (the platform upserts by canonical id / URL).
   */
  @Post('api/admin/jobs/export-all')
  exportAll(): BackgroundJobStatus {
    this.assertEnabled();
    if (!this.jobStore) {
      throw new NotFoundException('No job store bound');
    }
    if (!this.backgroundJobs) {
      throw new NotFoundException('No AdminBackgroundJobsService bound');
    }
    const config = this.configService.get<DailyExportConfig>('dailyExport');
    if (!config?.targetUrl) {
      throw new NotFoundException(
        'No export target configured — set DAILY_EXPORT_TARGET_URL (and DAILY_EXPORT_TARGET_HEADERS) to sync.',
      );
    }

    return this.backgroundJobs.start('export-all', (update) => this.runExportAll(update));
  }

  /**
   * Clear every "already exported" mark WITHOUT touching job data — the
   * opposite of `exportAll()`'s side effect. Job rows / observations /
   * run-state watermark are untouched; only `IExportedJobStore` is wiped,
   * so every job shows `exported: false` again and the next sync/cron
   * tick treats the whole store as fresh.
   */
  @Post('api/admin/jobs/reset-exported')
  resetExported(): BackgroundJobStatus {
    this.assertEnabled();
    if (!this.exportedJobStore) {
      throw new NotFoundException('No IExportedJobStore bound');
    }
    if (!this.backgroundJobs) {
      throw new NotFoundException('No AdminBackgroundJobsService bound');
    }

    return this.backgroundJobs.start('reset-exported', async () => {
      const clearedMarks = await this.exportedJobStore!.clearAll();
      return { clearedMarks };
    });
  }

  // ── clearAll() / extractAll() / exportAll() background-job bodies ─────

  /**
   * Body of the `export-all` background job. Pages the whole job store,
   * converts each `CanonicalJob` to the ingest payload the downstream
   * target expects, POSTs it in batches, and marks every pushed URL
   * exported. A failed batch aborts the run (so we don't mark unsent jobs
   * as exported) and surfaces as `state: 'failed'`.
   */
  private async runExportAll(update: (progress: BackgroundJobProgress) => void): Promise<{
    total: number;
    pushed: number;
    batches: number;
    destination: string;
  }> {
    const config = this.configService.get<DailyExportConfig>('dailyExport')!;
    // Push in modest chunks — a single huge POST risks the target's body-size
    // limit / timeouts with thousands of postings. Each chunk is its own
    // request, marked exported only after it lands.
    const BATCH = 100;

    const total = await this.jobStore!.countByQuery({});
    update({ done: 0, total, label: `Syncing ${total} job(s)…` });

    let pushed = 0;
    let batches = 0;
    let cursor: string | undefined;

    do {
      const page = await this.jobStore!.listByQuery({ limit: BATCH, cursor });
      cursor = page.nextCursor;
      if (page.items.length === 0) break;

      const jobs = page.items.map((job) => this.toExportPayload(job));
      await this.pushBatch(config, jobs);

      if (this.exportedJobStore) {
        await this.exportedJobStore.markExported(
          jobs.map((j) => String(j.jobUrl)),
          new Date(),
        );
      }

      pushed += jobs.length;
      batches++;
      update({ done: pushed, total, label: `Synced ${pushed} / ${total} job(s)` });
    } while (cursor);

    return { total, pushed, batches, destination: config.targetUrl! };
  }

  /** POST one `{ jobs }` batch to the configured target; throws on failure. */
  private async pushBatch(
    config: DailyExportConfig,
    jobs: ReadonlyArray<Record<string, unknown>>,
  ): Promise<void> {
    await axios.request({
      url: config.targetUrl,
      method: (config.targetMethod || 'POST') as 'POST' | 'PUT' | 'PATCH',
      timeout: config.targetTimeoutMs,
      headers: { 'Content-Type': 'application/json', ...config.targetHeaders },
      data: { jobs },
    });
  }

  /**
   * Flatten a `CanonicalJob` into the loose JobPost-shaped payload the
   * downstream ingest accepts. Flat fields come straight off the canonical
   * record; compensation / jobType / skills / datePosted are pulled from
   * the provenance `fields` map when the merge resolver surfaced them.
   */
  private toExportPayload(job: CanonicalJob): Record<string, unknown> {
    const fieldValue = <T>(key: string): T | undefined =>
      (job.fields?.[key]?.value as T | undefined) ?? undefined;

    // Coerce loose provenance values into the exact shapes the downstream
    // ingest schema accepts, so one odd field never 400s a whole batch.
    const asStringArray = (v: unknown): string[] | null =>
      Array.isArray(v) ? v.map(String).filter(Boolean) : v ? [String(v)] : null;

    const compensation = (() => {
      const c = fieldValue<Record<string, unknown>>('compensation');
      if (!c || typeof c !== 'object') return null;
      const num = (x: unknown) => (typeof x === 'number' ? x : null);
      return {
        interval: typeof c.interval === 'string' ? c.interval : null,
        minAmount: num(c.minAmount),
        maxAmount: num(c.maxAmount),
        currency: typeof c.currency === 'string' ? c.currency : null,
      };
    })();

    const firstSource = job.sources?.[0];
    const datePosted = fieldValue<unknown>('datePosted') ?? firstSource?.observedAt ?? null;

    return {
      jobUrl: job.url,
      title: job.title,
      companyName: job.company || null,
      description: job.description || null,
      location: job.location || null,
      site: firstSource?.site ?? null,
      datePosted: datePosted == null ? null : String(datePosted),
      compensation,
      jobType: asStringArray(fieldValue('jobType')),
      skills: asStringArray(fieldValue('skills')),
    };
  }

  // ── clearAll() / extractAll() background-job bodies ──────────────────

  private async runClearAll(): Promise<{
    deletedJobs: number;
    deletedExportedMarks: number | null;
    resetRunState: boolean;
  }> {
    const [deletedJobs, deletedExportedMarks] = await Promise.all([
      this.jobStore!.deleteAll(),
      this.exportedJobStore ? this.exportedJobStore.clearAll() : Promise.resolve(null),
    ]);
    if (this.runStateStore) {
      await this.runStateStore.resetAll();
    }

    return {
      deletedJobs,
      deletedExportedMarks,
      resetRunState: Boolean(this.runStateStore),
    };
  }

  @Get('api/admin/sites')
  sites(): SiteCatalogResult {
    this.assertEnabled();
    if (!this.registry) {
      return { categories: [], total: 0 };
    }

    const byCategory = new Map<string, SiteCatalogEntry[]>();
    for (const meta of this.registry.listSources()) {
      const list = byCategory.get(meta.category) ?? [];
      list.push({ id: meta.site, name: meta.name });
      byCategory.set(meta.category, list);
    }

    const orderedKeys = [
      ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
      ...Array.from(byCategory.keys()).filter((c) => !CATEGORY_ORDER.includes(c)),
    ];

    const categories = orderedKeys.map((category) => ({
      category,
      sites: (byCategory.get(category) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));

    return { categories, total: this.registry.size };
  }

  /**
   * Per-source snapshot for the admin "Sources" tab: how many persisted
   * jobs carry an observation from each site, plus that site's
   * circuit-breaker health (working / degraded / down / untested) for
   * this process. Loaded lazily by the UI (only when the Sources tab is
   * opened) since the job-count side is a full store scan.
   */
  @Get('api/admin/sources-overview')
  async sourcesOverview(): Promise<SourcesOverviewResult> {
    this.assertEnabled();

    const jobCounts = await this.countJobsBySite();
    let totalJobs = 0;
    for (const n of jobCounts.values()) totalJobs += n;

    const healthBySite = new Map<string, SourceHealth>();
    if (this.breaker) {
      for (const health of this.breaker.list()) healthBySite.set(health.site, health);
    }

    const catalog = this.registry ? this.registry.listSources() : [];
    const sources: SourceOverviewEntry[] = catalog.map((meta) => {
      const health = healthBySite.get(meta.site);
      return {
        site: meta.site,
        name: meta.name,
        category: meta.category,
        jobCount: jobCounts.get(meta.site) ?? 0,
        state: health?.state ?? 'untested',
        successRate: health?.successRate ?? null,
        p95LatencyMs: health?.p95LatencyMs ?? null,
        lastError: health?.lastError,
      };
    });

    // Most-active sources first — the operator question this tab answers
    // ("what's actually producing jobs?") is best served job-count-desc,
    // not alphabetically.
    sources.sort((a, b) => b.jobCount - a.jobCount || a.name.localeCompare(b.name));

    return { sources, totalJobs, totalSources: sources.length };
  }

  /**
   * Full-scan tally of persisted canonical jobs per site (via each job's
   * embedded `sources[].site`). `IJobStore` has no groupBy in its
   * contract, so this pages through the whole store once — acceptable
   * for a local admin tool that loads it lazily and on explicit refresh,
   * not on every request.
   */
  private async countJobsBySite(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!this.jobStore) return counts;

    const PAGE_SIZE = 500;
    let cursor: string | undefined;
    do {
      const page = await this.jobStore.listByQuery({ limit: PAGE_SIZE, cursor });
      cursor = page.nextCursor;
      for (const job of page.items) {
        for (const source of job.sources ?? []) {
          counts.set(source.site, (counts.get(source.site) ?? 0) + 1);
        }
      }
    } while (cursor);

    return counts;
  }

  @Get('api/admin/ats-companies')
  atsCompanies(@Query('site') site?: string): AtsSummaryEntry[] | { site: string; companies: AtsCompanyEntry[] } {
    this.assertEnabled();
    if (site) {
      return { site, companies: ATS_COMPANY_DIRECTORY[site] ?? [] };
    }
    return Object.entries(ATS_COMPANY_DIRECTORY)
      .map(([s, companies]) => ({ site: s, count: companies.length }))
      .sort((a, b) => b.count - a.count || a.site.localeCompare(b.site));
  }

  @Post('api/admin/jobs/run-companies')
  async runCompanies(@Body() body: RunCompaniesBody = {}): Promise<RunCompaniesResult> {
    this.assertEnabled();
    if (!this.aggregator) {
      throw new NotFoundException('No JobsAggregator bound');
    }

    const validSites = new Set(Object.values(Site) as string[]);
    const site = body.site && validSites.has(body.site) ? (body.site as Site) : undefined;
    if (!site) {
      throw new NotFoundException(`Unknown or missing "site" (must be a Site enum id)`);
    }

    // De-dupe — the caller may combine directory picks with manually-typed
    // slugs that happen to overlap.
    const companySlugs = Array.from(new Set((body.companySlugs ?? []).map((s) => s.trim()).filter(Boolean)));

    const resultsWanted = body.resultsWanted && body.resultsWanted > 0
      ? Math.min(body.resultsWanted, 100)
      : 20;

    const batch = await this.runCompanyBatch(site, companySlugs, {
      searchTerm: body.searchTerm || undefined,
      location: body.location || undefined,
      isRemote: body.isRemote ?? false,
      resultsWanted,
      captureRawResponse: body.captureRawResponse ?? false,
    });

    return {
      site,
      companiesRequested: companySlugs.length,
      ...batch,
    };
  }

  /**
   * One `aggregate()` call per company slug, fanned out concurrently —
   * mirrors `JobsService`'s own `Promise.allSettled` convention so one
   * company's failure (dead slug, site down) never aborts the rest of
   * the batch. `resultsWanted` applies PER company, not split across the
   * batch. Shared by `runCompanies()` (one platform, operator-picked
   * companies) and `extractAll()`'s ATS phase (every platform, every
   * known company) so the fan-out-and-tally logic isn't duplicated.
   */
  private async runCompanyBatch(
    site: Site,
    companySlugs: ReadonlyArray<string>,
    options: {
      readonly searchTerm?: string;
      readonly location?: string;
      readonly isRemote?: boolean;
      readonly resultsWanted: number;
      readonly captureRawResponse?: boolean;
    },
  ): Promise<{
    rawCount: number;
    outputCount: number;
    companiesSucceeded: number;
    companiesFailed: number;
  }> {
    const settled = await Promise.allSettled(
      companySlugs.map((slug) =>
        this.aggregator!.aggregate(
          new ScraperInputDto({
            siteType: [site],
            companySlug: slug,
            searchTerm: options.searchTerm,
            location: options.location,
            isRemote: options.isRemote ?? false,
            resultsWanted: options.resultsWanted,
            captureRawResponse: options.captureRawResponse ?? false,
          }),
        ),
      ),
    );

    let rawCount = 0;
    let outputCount = 0;
    let companiesSucceeded = 0;
    let companiesFailed = 0;
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        companiesSucceeded++;
        rawCount += result.value.rawCount;
        outputCount += result.value.outputCount;
      } else {
        companiesFailed++;
      }
    }
    return { rawCount, outputCount, companiesSucceeded, companiesFailed };
  }

  /**
   * Body of the `extract-all` background job — see `extractAll()`'s doc
   * comment for the two-phase shape. Platforms run sequentially (one
   * `runCompanyBatch` at a time) so the whole operation never fans out
   * across all ~530 known companies simultaneously; companies within a
   * single platform still run concurrently via `runCompanyBatch`.
   */
  private async runExtractAll(
    update: (progress: BackgroundJobProgress) => void,
  ): Promise<{
    sites: { rawCount: number; outputCount: number };
    atsCompanies: {
      platforms: number;
      companiesSucceeded: number;
      companiesFailed: number;
      rawCount: number;
      outputCount: number;
    };
  }> {
    const validSites = new Set(Object.values(Site) as string[]);
    const platforms = Object.entries(ATS_COMPANY_DIRECTORY).filter(([s]) =>
      validSites.has(s),
    ) as Array<[Site, AtsCompanyEntry[]]>;
    const totalUnits = 1 + platforms.length;

    update({ done: 0, total: totalUnits, label: 'Phase 1/2: full-site extraction (running)' });
    const allSiteIds = this.registry!.listSources().map((s) => s.site);
    const siteResult = await this.aggregator!.aggregateIncremental(
      new ScraperInputDto({ siteType: allSiteIds.length ? allSiteIds : undefined }),
    );

    update({
      done: 1,
      total: totalUnits,
      label: `Phase 2/2: ATS companies (0/${platforms.length} platforms)`,
    });

    let atsRawCount = 0;
    let atsOutputCount = 0;
    let companiesSucceeded = 0;
    let companiesFailed = 0;
    for (let i = 0; i < platforms.length; i++) {
      const [site, companies] = platforms[i];
      const batch = await this.runCompanyBatch(
        site,
        companies.map((c) => c.slug),
        { resultsWanted: 20, isRemote: false, captureRawResponse: false },
      );
      atsRawCount += batch.rawCount;
      atsOutputCount += batch.outputCount;
      companiesSucceeded += batch.companiesSucceeded;
      companiesFailed += batch.companiesFailed;
      update({
        done: 1 + i + 1,
        total: totalUnits,
        label: `Phase 2/2: ATS companies (${i + 1}/${platforms.length} platforms)`,
      });
    }

    return {
      sites: { rawCount: siteResult.rawCount, outputCount: siteResult.outputCount },
      atsCompanies: {
        platforms: platforms.length,
        companiesSucceeded,
        companiesFailed,
        rawCount: atsRawCount,
        outputCount: atsOutputCount,
      },
    };
  }

  @Post('api/admin/jobs/run')
  async run(@Body() body: RunExtractionBody = {}): Promise<RunExtractionResult> {
    this.assertEnabled();
    if (!this.aggregator) {
      throw new NotFoundException('No JobsAggregator bound');
    }

    const validSites = new Set(Object.values(Site) as string[]);
    const requestedSites = (body.sites ?? []).filter((s) => validSites.has(s));
    // Empty/unrecognised input falls back to the curated job-board list
    // (same default `DailyExportCron` uses) rather than the full
    // 1,800+-source fan-out — a stray click shouldn't kick off an
    // hours-long scrape.
    const sites = requestedSites.length
      ? requestedSites
      : (this.configService.get<{ siteNames: string[] }>('defaults')?.siteNames ?? []);

    const input = new ScraperInputDto({
      siteType: sites.length ? (sites as Site[]) : undefined,
      searchTerm: body.searchTerm || undefined,
      location: body.location || undefined,
      isRemote: body.isRemote ?? false,
      resultsWanted: body.resultsWanted && body.resultsWanted > 0
        ? Math.min(body.resultsWanted, 100)
        : 20,
      captureRawResponse: body.captureRawResponse ?? false,
    });

    // Incremental, not `aggregate()` — for a broad multi-site run, each
    // site's results are dedup'd (against itself only) and persisted as
    // soon as that site finishes, rather than making the caller wait for
    // the single slowest site before anything lands in the store. See
    // JobsAggregator.aggregateIncremental's doc comment for the
    // cross-site-dedup trade-off this makes.
    const result = await this.aggregator.aggregateIncremental(input);
    return {
      rawCount: result.rawCount,
      outputCount: result.outputCount,
      sites,
      perSite: result.perSite,
    };
  }

  @Get('api/admin/jobs/:id')
  async detail(@Param('id') id: string): Promise<AdminJobDetail> {
    this.assertEnabled();
    if (!this.jobStore) {
      throw new NotFoundException('No job store bound');
    }

    const job = await this.jobStore.getById(id);
    if (!job) {
      throw new NotFoundException(`No job found for id "${id}"`);
    }

    const sources = (await this.observationStore?.listByCanonicalId(id)) ?? [];
    const exported = await this.exportedStatus(job.url);

    return { job, sources, exported };
  }

  // ── helpers ──────────────────────────────

  private assertEnabled(): void {
    if (!this.configService.get<boolean>('adminUi.enabled', true)) {
      throw new NotFoundException();
    }
  }

  private async withExportedStatus(
    jobs: ReadonlyArray<CanonicalJob>,
  ): Promise<AdminJobListItem[]> {
    if (!this.exportedJobStore) {
      return jobs.map((job) => ({ ...job, exported: null }));
    }
    if (jobs.length === 0) return [];
    const urls = jobs.map((j) => j.url);
    const unseen = new Set(await this.exportedJobStore.filterUnseen(urls));
    return jobs.map((job) => ({ ...job, exported: !unseen.has(job.url) }));
  }

  private async exportedStatus(url: string): Promise<boolean | null> {
    if (!this.exportedJobStore) return null;
    const unseen = await this.exportedJobStore.filterUnseen([url]);
    return unseen.length === 0;
  }
}
