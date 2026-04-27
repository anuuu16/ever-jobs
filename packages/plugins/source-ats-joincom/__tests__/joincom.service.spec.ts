import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';
import { JoinComModule, JoinComService } from '../src';

/**
 * Spec 006 / T02 — `JoinComService` stub tests.
 *
 * Behavioural tests (≥ 5 cases — happy path / empty board / HTTP 500
 * / slug-not-found regex miss / mid-page `resultsWanted` cap) land
 * alongside the implementation in Spec 006 / T08. This file pins
 * the registration scaffolding only.
 */
describe('JoinComService (Spec 006 / T02 — stub)', () => {
  it('resolves through JoinComModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JoinComModule],
    }).compile();

    const service = moduleRef.get(JoinComService);
    expect(service).toBeInstanceOf(JoinComService);
    await moduleRef.close();
  });

  it('scrape() returns an empty JobResponseDto until T07 lands', async () => {
    const service = new JoinComService();
    const input: ScraperInputDto = {
      site: [Site.JOIN_COM],
      companySlug: 'demo',
    } as ScraperInputDto;
    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('exports the Site.JOIN_COM = "join_com" enum value', () => {
    expect(Site.JOIN_COM).toBe('join_com');
  });
});
