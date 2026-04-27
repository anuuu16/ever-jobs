import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';
import {
  ORACLE_DEFAULT_FACETS,
  ORACLE_DEFAULT_SITE_NUMBER,
  OracleModule,
  OracleService,
} from '../src';

/**
 * Spec 013 / T03 — `OracleService` registration + bad-tenant smoke
 * tests.
 *
 * The full behavioural sweep (≥ 6 cases — happy path / empty
 * `requisitionList[]` / HTTP 500 / `resultsWanted` cap / `companyUrl`
 * override / custom `siteNumber`) lands in Spec 013 / T04 alongside a
 * `__tests__/fixtures/oracle-page-1.json` corpus and the canonical
 * `axios`-mocked helper. This file pins:
 *   - Four-place registration (DI resolves `OracleService` via
 *     `OracleModule` / `Site.ORACLE` / tsconfig path / jest mapper).
 *   - The bad-tenant guard returns an empty `JobResponseDto`
 *     synchronously without making any HTTP call (no `companyUrl`,
 *     no `companySlug`).
 *   - Constants exported from the package barrel match the values
 *     the next-phase plugin authors will import.
 */
describe('OracleService (Spec 013 / T03 — REST + finder-string)', () => {
  it('resolves through OracleModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OracleModule],
    }).compile();

    const service = moduleRef.get(OracleService);
    expect(service).toBeInstanceOf(OracleService);
    await moduleRef.close();
  });

  it('returns an empty JobResponseDto when neither companyUrl nor companySlug supplied (ERR_ORACLE_BAD_TENANT)', async () => {
    const service = new OracleService();
    const input: ScraperInputDto = {
      site: [Site.ORACLE],
    } as ScraperInputDto;
    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('exports the Site.ORACLE = "oracle" enum value', () => {
    expect(Site.ORACLE).toBe('oracle');
  });

  it('exports the documented eight-facet list and the CX_45001 default', () => {
    expect(ORACLE_DEFAULT_SITE_NUMBER).toBe('CX_45001');
    expect([...ORACLE_DEFAULT_FACETS]).toEqual([
      'LOCATIONS',
      'WORK_LOCATIONS',
      'WORKPLACE_TYPES',
      'TITLES',
      'CATEGORIES',
      'ORGANIZATIONS',
      'POSTING_DATES',
      'FLEX_FIELDS',
    ]);
  });
});
