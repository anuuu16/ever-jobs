import { Injectable, Logger } from '@nestjs/common';
import { SourcePlugin } from '@ever-jobs/plugin';
import {
  IScraper,
  JobResponseDto,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';

/**
 * Spec 006 / T02 — Avature scraper stub.
 *
 * Decorated with `@SourcePlugin({ site: Site.AVATURE })` so
 * `PluginDiscoveryService` registers it under the `avature` key at
 * `OnApplicationBootstrap`. The behavioural logic (HTML scrape with
 * `cheerio`, custom-domain support via `companyUrl`, Apply-link decoy
 * filtering) lands in Spec 006 / T03.
 *
 * Until T03 ships, `scrape(input)` returns an empty `JobResponseDto`
 * unconditionally. This keeps the plugin registered for end-to-end
 * tests AND keeps the circuit-breaker / dedup / persistence pipelines
 * exercised against the new `Site.AVATURE` enum value, but adds zero
 * source behaviour. CI must remain fully green at the end of T02 — a
 * regression here would mean the four-place registration scaffolding
 * (Site enum / tsconfig paths / jest mapper / `ALL_SOURCE_MODULES`) is
 * itself broken, which is the load-bearing thing T01+T02 sets up.
 */
@SourcePlugin({
  site: Site.AVATURE,
  name: 'Avature',
  category: 'ats',
  isAts: true,
})
@Injectable()
export class AvatureService implements IScraper {
  private readonly logger = new Logger(AvatureService.name);

  async scrape(_input: ScraperInputDto): Promise<JobResponseDto> {
    this.logger.debug('AvatureService.scrape() — stub (Spec 006 / T03 pending)');
    return new JobResponseDto([]);
  }
}
