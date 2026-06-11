import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ScraperInputDto, Site } from '@ever-jobs/models';

const mockPost = jest.fn();
jest.mock('@ever-jobs/common', () => {
  const actual = jest.requireActual('@ever-jobs/common');
  return {
    ...actual,
    createHttpClient: jest.fn(() => ({
      post: mockPost,
      setHeaders: jest.fn(),
    })),
  };
});

import { WorkdayModule } from '../src/workday.module';
import { WorkdayService } from '../src/workday.service';

/** A single short page (< WORKDAY_PAGE_SIZE) so scrape() does one request. */
const JOBS_PAGE = {
  total: 4,
  jobPostings: [
    {
      title: 'Software Engineer',
      externalPath: '/job/Austin-TX/Software-Engineer_R-101/12345',
      locationsText: 'Austin, TX',
      postedOn: 'Posted Today',
      subtitles: [{ instances: [{ text: 'Engineering' }] }],
    },
    {
      title: 'Data Engineer',
      externalPath: '/job/Palo-Alto-CA/Data-Engineer_R-202/23456',
      locationsText: 'Palo Alto, CA',
      postedOn: 'Posted Yesterday',
    },
    {
      title: 'Product Manager',
      externalPath: '/job/Remote/Product-Manager_R-303/34567',
      locationsText: 'Remote - US',
      postedOn: 'Posted 3 Days Ago',
    },
    {
      title: 'Staff Engineer',
      externalPath: '/job/Fremont-CA/Staff-Engineer_R-404/45678',
      locationsText: 'Fremont, CA',
      postedOn: 'Posted 30+ Days Ago',
    },
  ],
};

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function isoDateOf(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Spec 720 / T05 — `WorkdayService` datePosted regression tests.
 *
 * Workday's list endpoint emits relative `postedOn` labels; emitted
 * `JobPostDto.datePosted` must be an ISO calendar date or null — never
 * the raw label.
 */
describe('WorkdayService — Spec 720 / T05', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  describe('registration scaffolding', () => {
    it('resolves through WorkdayModule via NestJS DI', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [WorkdayModule],
      }).compile();
      const service = moduleRef.get(WorkdayService);
      expect(service).toBeInstanceOf(WorkdayService);
      await moduleRef.close();
    });
  });

  describe('datePosted mapping', () => {
    it('maps relative postedOn labels to ISO dates (or null), never the raw label', async () => {
      mockPost.mockResolvedValueOnce({ data: clone(JOBS_PAGE) });

      const before = isoDateOf(new Date());
      const service = new WorkdayService();
      const result = await service.scrape({
        siteType: [Site.WORKDAY],
        companySlug: 'tesla:5:Tesla',
        resultsWanted: 100,
      } as ScraperInputDto);
      const after = isoDateOf(new Date());

      expect(result.jobs).toHaveLength(4);
      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost.mock.calls[0][0]).toBe(
        'https://tesla.wd5.myworkdayjobs.com/wday/cxs/tesla/Tesla/jobs',
      );

      const byId = new Map(result.jobs.map((j) => [j.id, j]));

      // "Posted Today" -> today's ISO date (tolerate a midnight rollover mid-test).
      const today = byId.get('wd-tesla-12345');
      expect(today).toBeDefined();
      expect([before, after]).toContain(today?.datePosted);

      // "Posted Yesterday" / "Posted 3 Days Ago" -> real ISO dates.
      expect(byId.get('wd-tesla-23456')?.datePosted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(byId.get('wd-tesla-34567')?.datePosted).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // "Posted 30+ Days Ago" -> null (lower bound only).
      expect(byId.get('wd-tesla-45678')?.datePosted).toBeNull();

      // Regression: the raw relative label must never leak through.
      for (const job of result.jobs) {
        if (job.datePosted !== null) {
          expect(job.datePosted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
        expect(String(job.datePosted)).not.toMatch(/posted/i);
      }
    });

    it('keeps the other listing fields intact', async () => {
      mockPost.mockResolvedValueOnce({ data: clone(JOBS_PAGE) });
      const service = new WorkdayService();
      const result = await service.scrape({
        siteType: [Site.WORKDAY],
        companySlug: 'tesla:5:Tesla',
      } as ScraperInputDto);

      const job = result.jobs.find((j) => j.id === 'wd-tesla-12345');
      expect(job?.title).toBe('Software Engineer');
      expect(job?.companyName).toBe('tesla');
      expect(job?.site).toBe(Site.WORKDAY);
      expect(job?.jobUrl).toBe(
        'https://tesla.wd5.myworkdayjobs.com/job/Austin-TX/Software-Engineer_R-101/12345',
      );
      expect(job?.location?.city).toBe('Austin, TX');
      expect(job?.department).toBe('Engineering');

      const remote = result.jobs.find((j) => j.id === 'wd-tesla-34567');
      expect(remote?.isRemote).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns an empty JobResponseDto when no companySlug is provided', async () => {
      const service = new WorkdayService();
      const result = await service.scrape({
        siteType: [Site.WORKDAY],
      } as ScraperInputDto);
      expect(result.jobs).toEqual([]);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('catches HTTP errors — empty result, never throws', async () => {
      mockPost.mockRejectedValueOnce(new Error('Request failed with status 500'));
      const service = new WorkdayService();
      const result = await service.scrape({
        siteType: [Site.WORKDAY],
        companySlug: 'tesla:5:Tesla',
      } as ScraperInputDto);
      expect(result.jobs).toEqual([]);
    });

    it('returns empty when the payload has no jobPostings', async () => {
      mockPost.mockResolvedValueOnce({ data: { total: 0, jobPostings: [] } });
      const service = new WorkdayService();
      const result = await service.scrape({
        siteType: [Site.WORKDAY],
        companySlug: 'tesla:5:Tesla',
      } as ScraperInputDto);
      expect(result.jobs).toEqual([]);
    });
  });
});
