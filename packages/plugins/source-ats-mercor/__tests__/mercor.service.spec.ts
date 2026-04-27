import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';
import { MercorModule, MercorService } from '../src';

/**
 * Spec 013 / T02 — `MercorService` stub tests.
 *
 * Behavioural tests (≥ 5 cases — happy path with full catalogue / slug
 * post-filter narrowing / empty `listings[]` / HTTP 500 / `resultsWanted`
 * cap mid-catalogue) land alongside the implementation in Spec 013 /
 * T06. This file pins the registration scaffolding only.
 */
describe('MercorService (Spec 013 / T02 — stub)', () => {
  it('resolves through MercorModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MercorModule],
    }).compile();

    const service = moduleRef.get(MercorService);
    expect(service).toBeInstanceOf(MercorService);
    await moduleRef.close();
  });

  it('scrape() returns an empty JobResponseDto until T05 lands', async () => {
    const service = new MercorService();
    const input: ScraperInputDto = {
      site: [Site.MERCOR],
      companySlug: 'stripe',
    } as ScraperInputDto;
    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('exports the Site.MERCOR = "mercor" enum value', () => {
    expect(Site.MERCOR).toBe('mercor');
  });
});
