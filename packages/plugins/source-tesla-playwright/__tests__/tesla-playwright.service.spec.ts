import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';
import {
  TeslaPlaywrightModule,
  TeslaPlaywrightService,
} from '../src';

/**
 * Spec 013 / T02 — `TeslaPlaywrightService` stub tests.
 *
 * Behavioural tests (≥ 4 cases — happy path with stubbed `playwright`
 * module / missing-dep sentinel `ERR_TESLA_PLAYWRIGHT_UNAVAILABLE` /
 * Akamai bypass succeeds / page navigation timeout returns empty)
 * land alongside the implementation in Spec 013 / T10. This file
 * pins the registration scaffolding only.
 *
 * Note: this module is OPT-IN — `ALL_SOURCE_MODULES` does NOT import
 * it. The DI test below imports `TeslaPlaywrightModule` directly to
 * exercise the manual-import path operators use when enabling the
 * companion plugin.
 */
describe('TeslaPlaywrightService (Spec 013 / T02 — stub)', () => {
  it('resolves through TeslaPlaywrightModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TeslaPlaywrightModule],
    }).compile();

    const service = moduleRef.get(TeslaPlaywrightService);
    expect(service).toBeInstanceOf(TeslaPlaywrightService);
    await moduleRef.close();
  });

  it('scrape() returns an empty JobResponseDto until T09 lands', async () => {
    const service = new TeslaPlaywrightService();
    const input: ScraperInputDto = {
      site: [Site.TESLA_PLAYWRIGHT],
    } as ScraperInputDto;
    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('exports the Site.TESLA_PLAYWRIGHT = "tesla_playwright" enum value', () => {
    expect(Site.TESLA_PLAYWRIGHT).toBe('tesla_playwright');
  });
});
