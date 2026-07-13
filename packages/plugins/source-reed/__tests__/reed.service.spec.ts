/**
 * Unit tests — `ReedService` / `parseReedDate`.
 *
 * Root cause under test: Reed's public Jobseeker API returns `date` as UK
 * `dd/mm/yyyy` (e.g. `"22/11/2013"`). The old code fed this straight into
 * `new Date(raw.date)`, whose non-ISO slash-format parsing follows the US
 * `mm/dd/yyyy` convention — for any date where both day and month are ≤ 12
 * this silently swaps them into a *different but still-valid* date (e.g.
 * Reed's "12/06/2026" = 12 June 2026 got misread as 6 December 2026).
 * `parseReedDate` replaces that with an explicit `dd/mm/yyyy` parser plus a
 * "clamp implausible future dates to today" guard (it's a parsing artifact,
 * not a genuinely future-dated posting, so the field is corrected rather
 * than dropped).
 *
 *  1. `parseReedDate` parses a valid `dd/mm/yyyy` date correctly (the
 *     specific case that used to get silently swapped).
 *  2. Non-`dd/mm/yyyy` input (e.g. already-ISO) is rejected, not
 *     misinterpreted.
 *  3. An impossible calendar date (day 31 in a 30-day month) is rejected.
 *  4. A date genuinely far in the future is clamped to today.
 *  5. A date just inside the 1-day forward-tolerance window is accepted
 *     as-is (not clamped).
 *  6. Empty/undefined input → `null`, no warning.
 *  7. `scrape()` end-to-end: a fixture job with a bad future-looking date
 *     comes through with `datePosted` clamped to today while every other
 *     field still maps normally — one bad date never drops the whole job.
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ScraperInputDto, Site } from '@ever-jobs/models';

const mockGet = jest.fn();
jest.mock('@ever-jobs/common', () => {
  const actual = jest.requireActual('@ever-jobs/common');
  return {
    ...actual,
    createHttpClient: jest.fn(() => ({
      get: mockGet,
      setHeaders: jest.fn(),
    })),
  };
});

import { parseReedDate, ReedService } from '../src/reed.service';
import { ReedJob } from '../src/reed.types';

function silentLogger(): Logger {
  const logger = new Logger('test');
  jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  return logger;
}

function makeReedJob(overrides: Partial<ReedJob> = {}): ReedJob {
  return {
    jobId: 1,
    employerId: 1,
    employerName: 'Acme Ltd',
    employerProfileId: null,
    employerProfileName: null,
    jobTitle: 'Software Engineer',
    locationName: 'London',
    minimumSalary: null,
    maximumSalary: null,
    currency: null,
    expirationDate: '01/01/2027',
    date: '01/06/2026',
    jobDescription: 'Join our team.',
    applications: 0,
    jobUrl: 'https://www.reed.co.uk/jobs/software-engineer/1',
    ...overrides,
  };
}

describe('parseReedDate', () => {
  const FIXED_NOW = new Date('2026-06-15T00:00:00.000Z').getTime();

  beforeEach(() => {
    // The clamp-to-today branch uses `new Date()` (constructor, no args) —
    // `jest.spyOn(Date, 'now')` alone does NOT intercept that, only real
    // fake timers do.
    jest.useFakeTimers({ now: FIXED_NOW });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('parses dd/mm/yyyy correctly — the exact swap that used to corrupt the date', () => {
    // Under the old `new Date("12/06/2026")` parse this became 6 Dec 2026
    // (US mm/dd/yyyy reading). It must now resolve to 12 June 2026.
    const result = parseReedDate('12/06/2026', silentLogger());
    expect(result).toBe('2026-06-12');
  });

  it('rejects non-dd/mm/yyyy input instead of misinterpreting it', () => {
    const logger = silentLogger();
    const result = parseReedDate('2026-06-01', logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Unrecognised Reed date format'));
  });

  it('rejects an impossible calendar date (31 Feb) rather than rolling it over', () => {
    const logger = silentLogger();
    const result = parseReedDate('31/02/2026', logger);
    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not a real calendar date'));
  });

  it('clamps a date genuinely far in the future to today, rather than dropping it', () => {
    const logger = silentLogger();
    // "now" is fixed at 2026-06-15; 1 Sept 2026 is well beyond the 1-day
    // tolerance — treated as a parsing artifact, not a real future post.
    const result = parseReedDate('01/09/2026', logger);
    expect(result).toBe('2026-06-15');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('clamping to today'));
  });

  it('accepts a date within the 1-day forward-tolerance window', () => {
    // "now" is fixed at 2026-06-15T00:00:00Z; 16 June is < 24h ahead.
    const result = parseReedDate('16/06/2026', silentLogger());
    expect(result).toBe('2026-06-16');
  });

  it('returns null for empty/undefined input without warning', () => {
    const logger = silentLogger();
    expect(parseReedDate(undefined, logger)).toBeNull();
    expect(parseReedDate('', logger)).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe('ReedService', () => {
  const FIXED_NOW = new Date('2026-06-15T00:00:00.000Z').getTime();

  beforeEach(() => {
    mockGet.mockReset();
    process.env.REED_API_KEY = 'test-key';
    jest.useFakeTimers({ now: FIXED_NOW });
  });

  afterEach(() => {
    delete process.env.REED_API_KEY;
    jest.useRealTimers();
  });

  it('maps a well-formed job, including a correctly-parsed datePosted', async () => {
    mockGet.mockResolvedValueOnce({
      data: { results: [makeReedJob({ date: '01/06/2026' })], totalResults: 1 },
    });

    const service = new ReedService();
    const result = await service.scrape({
      siteType: [Site.REED],
      resultsWanted: 10,
    } as ScraperInputDto);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].datePosted).toBe('2026-06-01');
    expect(result.jobs[0].site).toBe(Site.REED);
    expect(result.jobs[0].companyName).toBe('Acme Ltd');
  });

  it('clamps a corrupted future date to today — the job still carries a plausible datePosted', async () => {
    mockGet.mockResolvedValueOnce({
      data: { results: [makeReedJob({ date: '01/09/2026' })], totalResults: 1 },
    });

    const service = new ReedService();
    const result = await service.scrape({
      siteType: [Site.REED],
      resultsWanted: 10,
    } as ScraperInputDto);

    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].datePosted).toBe('2026-06-15');
    expect(result.jobs[0].title).toBe('Software Engineer');
  });
});
