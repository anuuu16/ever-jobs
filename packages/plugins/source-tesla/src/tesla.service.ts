import { Injectable, Logger } from '@nestjs/common';
import { SourcePlugin } from '@ever-jobs/plugin';
import {
  IScraper,
  JobResponseDto,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';

/**
 * Spec 013 / T02 — Tesla scraper stub (default, pure-HTTP).
 *
 * Decorated with `@SourcePlugin({ site: Site.TESLA })` so
 * `PluginDiscoveryService` registers it under the `tesla` key at
 * `OnApplicationBootstrap`. The behavioural logic (board GET to
 * `/cua-api/apps/careers/state` with rotated UA + `Accept:
 * application/json`; mapping `data.lookup.listings[]` → `JobPostDto[]`;
 * detail-fetch fan-out to `/cua-api/careers/job/{id}` budgeted by
 * `input.descriptionDepth` per Spec 013 / Q-031 / FR-11; Akamai
 * sentinel `ERR_TESLA_AKAMAI_CHALLENGE` on 403/503/HTML response per
 * Spec 013 / FR-12) lands in Spec 013 / T07.
 *
 * Tesla is **single-tenant**: `companyUrl` / `companySlug` inputs are
 * ignored — the scraper always targets `www.tesla.com`. The
 * `descriptionDepth` budget defaults to `'detail-25'` (cap of 25
 * follow-up GETs) when `input.descriptionDepth` is undefined; honour
 * `'board'` (0 follow-ups) and `'detail-all'` (∞) too.
 *
 * **HTTP-only by design.** Playwright support lives in the OPTIONAL
 * companion package `@ever-jobs/source-tesla-playwright`. Do NOT
 * import `playwright` here.
 *
 * Until T07 ships, `scrape(input)` returns an empty `JobResponseDto`
 * unconditionally.
 */
@SourcePlugin({
  site: Site.TESLA,
  name: 'Tesla',
  category: 'company',
  isAts: false,
})
@Injectable()
export class TeslaService implements IScraper {
  private readonly logger = new Logger(TeslaService.name);

  async scrape(_input: ScraperInputDto): Promise<JobResponseDto> {
    this.logger.debug('TeslaService.scrape() — stub (Spec 013 / T07 pending)');
    return new JobResponseDto([]);
  }
}
