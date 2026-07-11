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
import {
  CanonicalJob,
  EXPORTED_JOB_STORE_TOKEN,
  IExportedJobStore,
  IJobObservationStore,
  IJobStore,
  JOB_OBSERVATION_STORE_TOKEN,
  JOB_STORE_TOKEN,
  JobStoreQuery,
  ScraperInputDto,
  Site,
  SourceObservation,
} from '@ever-jobs/models';
import { PluginRegistry } from '@ever-jobs/plugin';
import { JobsAggregator } from '../jobs/jobs.aggregator';
import { ADMIN_UI_HTML } from './admin-ui.html';

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
 * Read-only: it re-uses the existing `IJobStore.listByQuery` /
 * `getById` / `IJobObservationStore.listByCanonicalId` / the
 * `IExportedJobStore` capability added for `DailyExportCron` — no new
 * persistence surface.
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
  ): Promise<{ items: AdminJobListItem[]; nextCursor?: string }> {
    this.assertEnabled();
    if (!this.jobStore) {
      return { items: [] };
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

    const page = await this.jobStore.listByQuery(query);
    const items = await this.withExportedStatus(page.items);
    return { items, nextCursor: page.nextCursor };
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

    // persist defaults to true — results become immediately browsable
    // in the table above.
    const result = await this.aggregator.aggregate(input);
    return { rawCount: result.rawCount, outputCount: result.outputCount, sites };
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
