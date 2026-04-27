import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';
import { TeslaModule, TeslaService } from '../src';

/**
 * Spec 013 / T02 — `TeslaService` stub tests.
 *
 * Behavioural tests (≥ 6 cases — happy path with detail fetches /
 * empty `lookup.listings[]` / HTTP 500 / Akamai 403 sentinel /
 * Akamai 503 sentinel / `resultsWanted` cap pre-detail-fetch) land
 * alongside the implementation in Spec 013 / T08. This file pins the
 * registration scaffolding only.
 */
describe('TeslaService (Spec 013 / T02 — stub)', () => {
  it('resolves through TeslaModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TeslaModule],
    }).compile();

    const service = moduleRef.get(TeslaService);
    expect(service).toBeInstanceOf(TeslaService);
    await moduleRef.close();
  });

  it('scrape() returns an empty JobResponseDto until T07 lands', async () => {
    const service = new TeslaService();
    const input: ScraperInputDto = {
      site: [Site.TESLA],
    } as ScraperInputDto;
    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('exports the Site.TESLA = "tesla" enum value', () => {
    expect(Site.TESLA).toBe('tesla');
  });
});
