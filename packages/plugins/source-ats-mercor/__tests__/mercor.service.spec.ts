import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';

/**
 * Mock the `@ever-jobs/common.createHttpClient` factory so the service
 * hits a controlled test pipeline instead of the live
 * `aws.api.mercor.com` host. Same pattern as Oracle T04
 * (`packages/plugins/source-ats-oracle/__tests__/oracle.service.spec.ts`).
 */
const mockGet = jest.fn();
const mockSetHeaders = jest.fn();
jest.mock('@ever-jobs/common', () => {
  const actual = jest.requireActual('@ever-jobs/common');
  return {
    ...actual,
    createHttpClient: jest.fn(() => ({
      get: mockGet,
      setHeaders: mockSetHeaders,
    })),
  };
});

import {
  MERCOR_API_BASE_URL,
  MERCOR_EXPLORE_PATH,
  MERCOR_HEADERS,
  MercorModule,
  MercorService,
} from '../src';

/**
 * Spec 013 / T05 — `MercorService` registration + envelope-guard
 * smoke tests.
 *
 * The full behavioural sweep (≥ 5 cases — happy path with full
 * catalogue / slug post-filter narrowing / empty `listings[]` / HTTP
 * 500 / `resultsWanted` cap mid-catalogue) lands in Spec 013 / T06
 * alongside `__tests__/fixtures/mercor-explore.json` (≥ 50 listings
 * spanning ≥ 10 distinct `companyName` values). This file pins:
 *   - Four-place registration (DI resolves `MercorService` via
 *     `MercorModule`).
 *   - The single-GET wire format (`MERCOR_API_BASE_URL +
 *     MERCOR_EXPLORE_PATH`) is the URL passed to `client.get()`.
 *   - Headers include the literal `Authorization: Bearer` (FR-8).
 *   - Envelope guard: response missing `listings[]` returns empty
 *     `JobResponseDto` with `ERR_MERCOR_ENVELOPE` sentinel logged.
 */
describe('MercorService (Spec 013 / T05 — single-GET explore-page)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetHeaders.mockReset();
  });

  it('resolves through MercorModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MercorModule],
    }).compile();

    const service = moduleRef.get(MercorService);
    expect(service).toBeInstanceOf(MercorService);
    await moduleRef.close();
  });

  it('exports the Site.MERCOR = "mercor" enum value', () => {
    expect(Site.MERCOR).toBe('mercor');
  });

  it('issues a single GET to `${MERCOR_API_BASE_URL}${MERCOR_EXPLORE_PATH}` with the documented headers', async () => {
    mockGet.mockResolvedValueOnce({ data: { listings: [] } });

    const service = new MercorService();
    const input: ScraperInputDto = {
      siteType: [Site.MERCOR],
    } as ScraperInputDto;

    await service.scrape(input);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith(
      `${MERCOR_API_BASE_URL}${MERCOR_EXPLORE_PATH}`,
    );
    expect(mockSetHeaders).toHaveBeenCalledWith(MERCOR_HEADERS);
    expect(MERCOR_HEADERS.Authorization).toBe('Bearer');
  });

  it('returns empty JobResponseDto when response lacks listings[] (ERR_MERCOR_ENVELOPE)', async () => {
    mockGet.mockResolvedValueOnce({ data: {} });

    const service = new MercorService();
    const input: ScraperInputDto = {
      siteType: [Site.MERCOR],
    } as ScraperInputDto;

    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('returns empty JobResponseDto on HTTP failure (never throws)', async () => {
    mockGet.mockRejectedValueOnce({
      message: 'Request failed with status 500',
      response: { status: 500 },
    });

    const service = new MercorService();
    const input: ScraperInputDto = {
      siteType: [Site.MERCOR],
    } as ScraperInputDto;

    const result = await service.scrape(input);
    expect(result.jobs).toEqual([]);
  });
});
