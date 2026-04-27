import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';
import { GemModule, GemService } from '../src';

/**
 * Spec 006 / T02 — `GemService` stub tests.
 *
 * Behavioural tests (≥ 4 cases — happy path / empty `jobPostings` /
 * HTTP 500 / response-order tolerance) land alongside the
 * implementation in Spec 006 / T06. This file pins the registration
 * scaffolding only.
 */
describe('GemService (Spec 006 / T02 — stub)', () => {
  it('resolves through GemModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GemModule],
    }).compile();

    const service = moduleRef.get(GemService);
    expect(service).toBeInstanceOf(GemService);
    await moduleRef.close();
  });

  it('scrape() returns an empty JobResponseDto until T05 lands', async () => {
    const service = new GemService();
    const input: ScraperInputDto = {
      site: [Site.GEM],
      companySlug: 'demo',
    } as ScraperInputDto;
    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('exports the Site.GEM = "gem" enum value', () => {
    expect(Site.GEM).toBe('gem');
  });
});
