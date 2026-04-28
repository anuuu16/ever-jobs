import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';

/**
 * Mock the `@ever-jobs/common.createHttpClient` factory so the service
 * hits a controlled test pipeline instead of the live Tesla host. Same
 * pattern as Oracle T04 / Mercor T05.
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
  TESLA_BASE_URL,
  TESLA_BOARD_PATH,
  TESLA_DEFAULT_DESCRIPTION_DEPTH,
  TESLA_DESCRIPTION_BUDGET,
  TESLA_HEADERS,
  TeslaModule,
  TeslaService,
} from '../src';

/**
 * Spec 013 / T07 — `TeslaService` registration + Akamai-guard smoke
 * tests.
 *
 * The full behavioural sweep (≥ 6 cases — happy path with detail
 * fetches / empty `listings[]` / HTTP 500 / Akamai 403 / Akamai 503 /
 * resultsWanted cap pre-detail-fetch) lands in Spec 013 / T08
 * alongside `__tests__/fixtures/tesla-board.json` and
 * `tesla-job-{id}.json`. This file pins:
 *   - Four-place registration (DI resolves `TeslaService` via
 *     `TeslaModule`).
 *   - The board endpoint URL and headers passed to `client.get()`.
 *   - Akamai-403 sentinel returns empty.
 *   - HTML body (typical Akamai challenge surface) returns empty.
 *   - Description-budget map exposes the documented three keys.
 */
describe('TeslaService (Spec 013 / T07 — pure-HTTP board + detail)', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSetHeaders.mockReset();
  });

  it('resolves through TeslaModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TeslaModule],
    }).compile();

    const service = moduleRef.get(TeslaService);
    expect(service).toBeInstanceOf(TeslaService);
    await moduleRef.close();
  });

  it('exports the Site.TESLA = "tesla" enum value', () => {
    expect(Site.TESLA).toBe('tesla');
  });

  it('exports the documented descriptionDepth budget map (board=0, detail-25=25, detail-all=Infinity)', () => {
    expect(TESLA_DEFAULT_DESCRIPTION_DEPTH).toBe('detail-25');
    expect(TESLA_DESCRIPTION_BUDGET.board).toBe(0);
    expect(TESLA_DESCRIPTION_BUDGET['detail-25']).toBe(25);
    expect(TESLA_DESCRIPTION_BUDGET['detail-all']).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('issues a board GET to `${TESLA_BASE_URL}${TESLA_BOARD_PATH}` with the documented headers', async () => {
    mockGet.mockResolvedValueOnce({
      data: { listings: [], lookup: {} },
    });

    const service = new TeslaService();
    const input: ScraperInputDto = {
      siteType: [Site.TESLA],
    } as ScraperInputDto;

    await service.scrape(input);

    expect(mockGet).toHaveBeenCalledWith(`${TESLA_BASE_URL}${TESLA_BOARD_PATH}`);
    expect(mockSetHeaders).toHaveBeenCalledWith(TESLA_HEADERS);
  });

  it('returns empty JobResponseDto when board responds with HTTP 403 (ERR_TESLA_AKAMAI_CHALLENGE)', async () => {
    mockGet.mockRejectedValueOnce({
      message: 'Request failed with status 403',
      response: { status: 403 },
    });

    const service = new TeslaService();
    const input: ScraperInputDto = {
      siteType: [Site.TESLA],
    } as ScraperInputDto;

    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('returns empty JobResponseDto when board responds with HTML body (Akamai challenge surface)', async () => {
    mockGet.mockResolvedValueOnce({
      data: '<!DOCTYPE html><html><body>Pardon Our Interruption</body></html>',
    });

    const service = new TeslaService();
    const input: ScraperInputDto = {
      siteType: [Site.TESLA],
    } as ScraperInputDto;

    const result = await service.scrape(input);
    expect(result.jobs).toEqual([]);
  });

  it('returns empty JobResponseDto on non-Akamai HTTP failure (ERR_TESLA_FETCH_FAILED)', async () => {
    mockGet.mockRejectedValueOnce({
      message: 'Request failed with status 500',
      response: { status: 500 },
    });

    const service = new TeslaService();
    const input: ScraperInputDto = {
      siteType: [Site.TESLA],
    } as ScraperInputDto;

    const result = await service.scrape(input);
    expect(result.jobs).toEqual([]);
  });
});
