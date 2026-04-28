import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { JobResponseDto, ScraperInputDto, Site } from '@ever-jobs/models';
import {
  TESLA_PLAYWRIGHT_DEFAULT_DESCRIPTION_DEPTH,
  TESLA_PLAYWRIGHT_DESCRIPTION_BUDGET,
  TESLA_PLAYWRIGHT_LAUNCH_ARGS,
  TeslaPlaywrightModule,
  TeslaPlaywrightService,
} from '../src';

/**
 * Spec 013 / T09 — `TeslaPlaywrightService` registration + missing-
 * dependency smoke tests.
 *
 * The full behavioural sweep (≥ 4 cases — happy path with stubbed
 * `playwright` module / missing-dep sentinel
 * `ERR_TESLA_PLAYWRIGHT_UNAVAILABLE` / Akamai bypass succeeds / page
 * navigation timeout returns empty) lands in Spec 013 / T10 alongside
 * a stubbed-Playwright fixture that simulates the headless browser
 * boundary. This file pins:
 *   - Registration (DI resolves `TeslaPlaywrightService` via
 *     `TeslaPlaywrightModule` — opt-in import path; the module is NOT
 *     in `ALL_SOURCE_MODULES`).
 *   - `Site.TESLA_PLAYWRIGHT` literal-string assertion.
 *   - Missing-dependency smoke: `playwright` is genuinely absent in
 *     the workspace (declared as `peerDependenciesMeta.optional`),
 *     so a real `await import('playwright')` from inside `scrape()`
 *     fails with `ERR_MODULE_NOT_FOUND`. The service catches that
 *     and returns an empty `JobResponseDto` with the
 *     `ERR_TESLA_PLAYWRIGHT_UNAVAILABLE` sentinel logged via
 *     `Logger.warn`. This test exercises the genuine failure path
 *     end-to-end without mocking — the most load-bearing branch in
 *     the whole package, since 99 % of operators will run without
 *     the dep installed.
 *   - Description-budget map / launch-args constant exports remain
 *     consistent with the default `source-tesla` plugin's analogous
 *     constants.
 */
describe('TeslaPlaywrightService (Spec 013 / T09 — opt-in lazy-Playwright)', () => {
  it('resolves through TeslaPlaywrightModule via NestJS DI (opt-in import path)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TeslaPlaywrightModule],
    }).compile();

    const service = moduleRef.get(TeslaPlaywrightService);
    expect(service).toBeInstanceOf(TeslaPlaywrightService);
    await moduleRef.close();
  });

  it('exports the Site.TESLA_PLAYWRIGHT = "tesla_playwright" enum value', () => {
    expect(Site.TESLA_PLAYWRIGHT).toBe('tesla_playwright');
  });

  it('exports the descriptionDepth budget map matching the default source-tesla plugin', () => {
    expect(TESLA_PLAYWRIGHT_DEFAULT_DESCRIPTION_DEPTH).toBe('detail-25');
    expect(TESLA_PLAYWRIGHT_DESCRIPTION_BUDGET.board).toBe(0);
    expect(TESLA_PLAYWRIGHT_DESCRIPTION_BUDGET['detail-25']).toBe(25);
    expect(TESLA_PLAYWRIGHT_DESCRIPTION_BUDGET['detail-all']).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('exports the documented anti-automation Chromium flag', () => {
    expect(TESLA_PLAYWRIGHT_LAUNCH_ARGS).toContain(
      '--disable-blink-features=AutomationControlled',
    );
  });

  it('returns an empty JobResponseDto when `playwright` is not installed (ERR_TESLA_PLAYWRIGHT_UNAVAILABLE)', async () => {
    // The workspace's root package.json does NOT depend on `playwright`,
    // and this package declares it as peerDependenciesMeta.optional —
    // so `await import('playwright')` inside `scrape()` will fail with
    // ERR_MODULE_NOT_FOUND. We exercise that real failure path here.
    const service = new TeslaPlaywrightService();
    const input: ScraperInputDto = {
      siteType: [Site.TESLA_PLAYWRIGHT],
    } as ScraperInputDto;

    const result = await service.scrape(input);
    expect(result).toBeInstanceOf(JobResponseDto);
    expect(result.jobs).toEqual([]);
  });
});
