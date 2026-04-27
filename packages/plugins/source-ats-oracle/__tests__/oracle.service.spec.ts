import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';
import { OracleModule, OracleService } from '../src';

/**
 * Spec 013 / T02 — `OracleService` stub tests.
 *
 * Behavioural tests (≥ 6 cases — happy path / empty `requisitionList[]` /
 * HTTP 500 / `resultsWanted` cap / `companyUrl` override / custom
 * `siteNumber`) land alongside the implementation in Spec 013 / T04.
 * This file pins the registration scaffolding only.
 */
describe('OracleService (Spec 013 / T02 — stub)', () => {
  it('resolves through OracleModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OracleModule],
    }).compile();

    const service = moduleRef.get(OracleService);
    expect(service).toBeInstanceOf(OracleService);
    await moduleRef.close();
  });

  it('scrape() returns an empty JobResponseDto until T03 lands', async () => {
    const service = new OracleService();
    const input: ScraperInputDto = {
      site: [Site.ORACLE],
      companySlug: 'eeho-us2',
    } as ScraperInputDto;
    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('exports the Site.ORACLE = "oracle" enum value', () => {
    expect(Site.ORACLE).toBe('oracle');
  });
});
