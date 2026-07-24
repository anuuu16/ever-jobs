/**
 * Unit tests for PhenomService against the real "widgets" API contract.
 *
 * Regression guard for the old `https://jobs.{slug}.com/api/jobs` template
 * (301/404 on every tenant): the scraper must POST to `https://{host}/widgets`
 * with a `refineSearch` body and read jobs from `refineSearch.data.jobs`.
 *
 * The HTTP layer is mocked so these run offline (unlike the network-gated
 * e2e spec); we capture the requested URL + payload and a canned response.
 */
import { ScraperInputDto, Site } from '@ever-jobs/models';

interface Captured {
  url: string;
  body: any;
}
const captured: Captured[] = [];

jest.mock('@ever-jobs/common', () => {
  const actual = jest.requireActual('@ever-jobs/common');
  return {
    ...actual,
    // No real delay between pages.
    randomSleep: () => Promise.resolve(),
    createHttpClient: () => ({
      setHeaders: () => undefined,
      post: (url: string, body: any) => {
        captured.push({ url, body });
        // First page returns one job; subsequent pages empty (stops paging).
        const jobs =
          captured.length === 1
            ? [
                {
                  jobId: 'R-2026-69180',
                  jobSeqNo: 'SOUTUSR202669180ENUSEXTERNAL',
                  title: 'Flight Ops Flight Instructor',
                  descriptionTeaser: 'Train pilots for safe air travel.',
                  city: 'Dallas',
                  state: 'Texas',
                  country: 'United States of America',
                  type: 'Full time Regular',
                  department: 'Flight Operations',
                  postedDate: '2026-06-24T00:00:00.000+0000',
                  applyUrl: 'https://swa.wd1.myworkdayjobs.com/external/job/x',
                  locale: 'en_US',
                  ml_skills: ['flight instruction'],
                },
              ]
            : [];
        return Promise.resolve({
          data: { refineSearch: { totalHits: 1, data: { jobs } } },
        });
      },
    }),
  };
});

import { PhenomService } from '../src/phenom.service';

describe('PhenomService (widgets API)', () => {
  let service: PhenomService;

  beforeEach(() => {
    captured.length = 0;
    service = new PhenomService();
  });

  it('POSTs to https://{host}/widgets with a refineSearch body when the slug is a careers host', async () => {
    const res = await service.scrape(
      new ScraperInputDto({ companySlug: 'careers.southwestair.com', resultsWanted: 5 }),
    );

    expect(captured[0].url).toBe('https://careers.southwestair.com/widgets');
    expect(captured[0].body.ddoKey).toBe('refineSearch');
    expect(captured[0].body.from).toBe(0);

    const jobs = res.jobs;
    expect(jobs).toHaveLength(1);
    const job = jobs[0];
    expect(job.site).toBe(Site.PHENOM);
    expect(job.atsId).toBe('R-2026-69180');
    expect(job.title).toBe('Flight Ops Flight Instructor');
    // Canonical Phenom listing URL built from jobSeqNo + locale (en_US → us/en).
    expect(job.jobUrl).toBe(
      'https://careers.southwestair.com/us/en/job/SOUTUSR202669180ENUSEXTERNAL',
    );
    expect(job.jobUrlDirect).toBe('https://swa.wd1.myworkdayjobs.com/external/job/x');
    expect(job.location?.city).toBe('Dallas');
  });

  it('accepts a full companyUrl and derives the host from it', async () => {
    await service.scrape(
      new ScraperInputDto({ companyUrl: 'https://careers.united.com/us/en', resultsWanted: 5 }),
    );
    expect(captured[0].url).toBe('https://careers.united.com/widgets');
  });

  it('returns empty (no request) for a bare non-host slug like "boeing"', async () => {
    const res = await service.scrape(
      new ScraperInputDto({ companySlug: 'boeing', resultsWanted: 5 }),
    );
    expect(captured).toHaveLength(0);
    expect(res.jobs).toHaveLength(0);
  });
});
