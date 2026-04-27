import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';
import { AvatureModule, AvatureService } from '../src';

/**
 * Spec 006 / T02 — `AvatureService` stub tests.
 *
 * Behavioural tests (≥ 5 cases — happy path / empty page / HTTP 500
 * / `resultsWanted` cap / custom-domain override) land alongside the
 * implementation in Spec 006 / T04. Until T03+T04 ship, this file
 * pins the registration scaffolding only:
 *
 *   1. The class is constructible via NestJS DI.
 *   2. The stub `scrape()` returns an empty `JobResponseDto`.
 *   3. `@SourcePlugin({ site: Site.AVATURE })` metadata round-trips.
 *
 * The intent is to prove the four-place registration (Site enum +
 * tsconfig paths + jest moduleNameMapper + `ALL_SOURCE_MODULES`) is
 * fully wired before any source behaviour exists. CI must remain
 * green at the end of T02; a regression here means the scaffolding
 * is itself broken.
 */
describe('AvatureService (Spec 006 / T02 — stub)', () => {
  it('resolves through AvatureModule via NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AvatureModule],
    }).compile();

    const service = moduleRef.get(AvatureService);
    expect(service).toBeInstanceOf(AvatureService);
    await moduleRef.close();
  });

  it('scrape() returns an empty JobResponseDto until T03 lands', async () => {
    const service = new AvatureService();
    const input: ScraperInputDto = {
      site: [Site.AVATURE],
      companySlug: 'demo',
    } as ScraperInputDto;
    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });

  it('exports the Site.AVATURE = "avature" enum value', () => {
    expect(Site.AVATURE).toBe('avature');
  });
});
