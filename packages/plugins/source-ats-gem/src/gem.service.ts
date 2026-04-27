import { Injectable, Logger } from '@nestjs/common';
import { SourcePlugin } from '@ever-jobs/plugin';
import {
  IScraper,
  JobResponseDto,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';

/**
 * Spec 006 / T02 — Gem scraper stub.
 *
 * Decorated with `@SourcePlugin({ site: Site.GEM })` so
 * `PluginDiscoveryService` registers it under the `gem` key at
 * `OnApplicationBootstrap`. The behavioural logic (single POST to
 * `https://jobs.gem.com/api/public/graphql/batch` with both
 * `JobBoardTheme` and `JobBoardList` operations, mapping
 * `oatsExternalJobPostings` to `JobPostDto`) lands in Spec 006 / T05.
 *
 * Until T05 ships, `scrape(input)` returns an empty `JobResponseDto`
 * unconditionally. This keeps the plugin registered for end-to-end
 * tests AND keeps the circuit-breaker / dedup / persistence pipelines
 * exercised against the new `Site.GEM` enum value, but adds zero
 * source behaviour.
 */
@SourcePlugin({
  site: Site.GEM,
  name: 'Gem',
  category: 'ats',
  isAts: true,
})
@Injectable()
export class GemService implements IScraper {
  private readonly logger = new Logger(GemService.name);

  async scrape(_input: ScraperInputDto): Promise<JobResponseDto> {
    this.logger.debug('GemService.scrape() — stub (Spec 006 / T05 pending)');
    return new JobResponseDto([]);
  }
}
