import { Injectable, Logger } from '@nestjs/common';
import { SourcePlugin } from '@ever-jobs/plugin';
import {
  IScraper,
  JobResponseDto,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';

/**
 * Spec 013 / T02 — Tesla-Playwright scraper stub (OPTIONAL companion).
 *
 * Decorated with `@SourcePlugin({ site: Site.TESLA_PLAYWRIGHT })` so
 * `PluginDiscoveryService` registers it under the `tesla_playwright`
 * key when the operator has explicitly imported `TeslaPlaywrightModule`
 * into their `JobsModule` (NOT auto-registered via
 * `ALL_SOURCE_MODULES` — see `tesla-playwright.module.ts` for the
 * opt-in rationale).
 *
 * Behavioural logic (Spec 013 / Q-028 / FR-13):
 *
 * 1. Lazy `import('playwright')` inside `scrape()`. Catch the
 *    ERR_MODULE_NOT_FOUND case and return an empty `JobResponseDto`
 *    annotated with the sentinel `ERR_TESLA_PLAYWRIGHT_UNAVAILABLE` so
 *    operators see why nothing emitted.
 * 2. Launch headless Chromium with anti-automation flags
 *    (`--disable-blink-features=AutomationControlled`,
 *    `--disable-dev-shm-usage`, etc. — mirrors the upstream Python).
 * 3. Navigate to `https://www.tesla.com/careers/search/`; settle for
 *    ≥ 5 seconds to let Akamai's challenge JS resolve.
 * 4. In-page `fetch()` through the established session for both the
 *    board endpoint and the per-job detail endpoints.
 * 5. Map results into `JobPostDto[]` using the same shape as
 *    `TeslaService` (so cross-plugin dedup via `(site, externalId)`
 *    can collapse rows when both plugins are enabled — see Spec 013
 *    / Q-032 default in `docs/questions.md`).
 *
 * Lands in Spec 013 / T09. Until then, `scrape(input)` returns an
 * empty `JobResponseDto` unconditionally.
 */
@SourcePlugin({
  site: Site.TESLA_PLAYWRIGHT,
  name: 'Tesla (Playwright)',
  category: 'company',
  isAts: false,
})
@Injectable()
export class TeslaPlaywrightService implements IScraper {
  private readonly logger = new Logger(TeslaPlaywrightService.name);

  async scrape(_input: ScraperInputDto): Promise<JobResponseDto> {
    this.logger.debug(
      'TeslaPlaywrightService.scrape() — stub (Spec 013 / T09 pending)',
    );
    return new JobResponseDto([]);
  }
}
