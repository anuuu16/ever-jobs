/**
 * Unit tests — `JobsService.searchJobsIncremental`.
 *
 * A clean, minimal-fake test file (deliberately separate from
 * `jobs.service.spec.ts`, which mocks ~150 real source packages via
 * `jest.mock()` and has pre-existing, unrelated registry-stub failures).
 * `JobsService` only depends on `PluginRegistry` / `ConfigService` /
 * `MetricsService` via DI — none of those require mocking real scraper
 * packages, so a hand-built fake registry is enough.
 *
 *  1. `onSiteResult` fires once per site that scrapes successfully, with
 *     that site's own (tagged) jobs.
 *  2. A site whose scrape rejects does NOT trigger the callback for it,
 *     but doesn't stop other sites from reporting in.
 *  3. A fast site's callback fires before a slower site's scrape has
 *     even resolved — the actual point of this method (no waiting for
 *     the whole batch).
 *  4. `searchJobs()` (the pre-existing method) is untouched behaviourally
 *     by the refactor into shared helpers — still aggregates + sorts
 *     across all sites into one array.
 */
import 'reflect-metadata';
import { JobPostDto, JobResponseDto, Site } from '@ever-jobs/models';
import { JobsService } from '../jobs.service';

function makeMetrics() {
  return {
    scraperDuration: { startTimer: jest.fn().mockReturnValue(jest.fn()) },
    scraperRequestsTotal: { inc: jest.fn() },
  };
}

function makeConfigService() {
  return {
    get: jest.fn().mockReturnValue({
      perSource: {},
      defaultRetries: 3,
      defaultDelayMs: 1000,
      defaultBackoff: 'linear',
    }),
  };
}

function makeRegistry(scrapers: Record<string, { scrape: jest.Mock }>) {
  const siteKeys = Object.keys(scrapers) as Site[];
  return {
    listAtsSites: jest.fn().mockReturnValue([]),
    listSiteKeys: jest.fn().mockReturnValue(siteKeys),
    getScraper: jest.fn((site: Site) => scrapers[site]),
    listSources: jest.fn().mockReturnValue([]),
    size: siteKeys.length,
  };
}

function makeJob(title: string): JobPostDto {
  return new JobPostDto({ title, jobUrl: `https://example.com/${title}` });
}

function makeScraper(jobs: JobPostDto[]) {
  return { scrape: jest.fn().mockResolvedValue(new JobResponseDto(jobs)) };
}

function makeFailingScraper(message = 'scrape failed') {
  return { scrape: jest.fn().mockRejectedValue(new Error(message)) };
}

function makeService(scrapers: Record<string, { scrape: jest.Mock }>) {
  return new JobsService(makeRegistry(scrapers) as any, makeConfigService() as any, makeMetrics() as any);
}

describe('JobsService.searchJobsIncremental', () => {
  it('invokes onSiteResult once per successful site, tagged with that site', async () => {
    const service = makeService({
      [Site.INDEED]: makeScraper([makeJob('a')]),
      [Site.LINKEDIN]: makeScraper([makeJob('b'), makeJob('c')]),
    });

    const calls: Array<{ site: Site; jobs: JobPostDto[] }> = [];
    await service.searchJobsIncremental(
      { siteType: [Site.INDEED, Site.LINKEDIN] } as any,
      (site, jobs) => {
        calls.push({ site, jobs });
      },
    );

    expect(calls).toHaveLength(2);
    const bySite = Object.fromEntries(calls.map((c) => [c.site, c.jobs]));
    expect(bySite[Site.INDEED]).toHaveLength(1);
    expect(bySite[Site.INDEED][0].site).toBe(Site.INDEED);
    expect(bySite[Site.LINKEDIN]).toHaveLength(2);
  });

  it('skips the callback for a site whose scrape rejects, without affecting other sites', async () => {
    const service = makeService({
      [Site.INDEED]: makeScraper([makeJob('a')]),
      [Site.LINKEDIN]: makeFailingScraper('linkedin is down'),
    });

    const calls: Site[] = [];
    await service.searchJobsIncremental(
      { siteType: [Site.INDEED, Site.LINKEDIN] } as any,
      (site) => {
        calls.push(site);
      },
    );

    expect(calls).toEqual([Site.INDEED]);
  });

  it('reports a fast site before a slow site has even resolved (the whole point of "incremental")', async () => {
    let slowResolve!: () => void;
    const slowScraper = {
      scrape: jest.fn().mockImplementation(
        () => new Promise((resolve) => {
          slowResolve = () => resolve(new JobResponseDto([makeJob('slow')]));
        }),
      ),
    };
    const service = makeService({
      [Site.INDEED]: makeScraper([makeJob('fast')]),
      [Site.LINKEDIN]: slowScraper,
    });

    const order: Site[] = [];
    const done = service.searchJobsIncremental(
      { siteType: [Site.INDEED, Site.LINKEDIN] } as any,
      (site) => {
        order.push(site);
      },
    );

    // Let the fast site's promise chain flush without resolving the slow one.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([Site.INDEED]); // slow site hasn't reported yet

    slowResolve();
    await done;
    expect(order).toEqual([Site.INDEED, Site.LINKEDIN]);
  });

  it('does not call onSiteResult at all when no scrapers are selected', async () => {
    const service = makeService({});
    const onSiteResult = jest.fn();
    await service.searchJobsIncremental({ siteType: [] } as any, onSiteResult);
    expect(onSiteResult).not.toHaveBeenCalled();
  });
});

describe('JobsService.searchJobs (unchanged behaviour after the helper refactor)', () => {
  it('aggregates all sites into one array, tagged and sorted by site then date', async () => {
    const service = makeService({
      [Site.LINKEDIN]: makeScraper([
        new JobPostDto({ title: 'x', jobUrl: 'u1', datePosted: '2026-01-01' }),
      ]),
      [Site.INDEED]: makeScraper([
        new JobPostDto({ title: 'y', jobUrl: 'u2', datePosted: '2026-02-01' }),
      ]),
    });

    const jobs = await service.searchJobs({ siteType: [Site.INDEED, Site.LINKEDIN] } as any);

    expect(jobs).toHaveLength(2);
    // Sorted by site name ascending ('indeed' < 'linkedin').
    expect(jobs[0].site).toBe(Site.INDEED);
    expect(jobs[1].site).toBe(Site.LINKEDIN);
  });

  it('excludes a site whose scrape rejects from the aggregated result', async () => {
    const service = makeService({
      [Site.INDEED]: makeScraper([makeJob('a')]),
      [Site.LINKEDIN]: makeFailingScraper(),
    });

    const jobs = await service.searchJobs({ siteType: [Site.INDEED, Site.LINKEDIN] } as any);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].site).toBe(Site.INDEED);
  });
});
