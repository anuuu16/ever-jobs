import { Injectable, Logger } from '@nestjs/common';
import { SourcePlugin } from '@ever-jobs/plugin';
import {
  IScraper,
  JobResponseDto,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';

/**
 * Spec 013 / T02 — Mercor scraper stub.
 *
 * Decorated with `@SourcePlugin({ site: Site.MERCOR })` so
 * `PluginDiscoveryService` registers it under the `mercor` key at
 * `OnApplicationBootstrap`. The behavioural logic (single GET to
 * `https://aws.api.mercor.com/work/listings-explore-page` with the
 * literal `Authorization: Bearer` header mirroring the upstream
 * Python client; post-filter on `companyName` lower-case substring
 * match against `input.companySlug`; `resultsWanted` cap applied
 * AFTER the post-filter) lands in Spec 013 / T05.
 *
 * Mercor is **catalogue-wide** by design (Spec 013 / Q-029 / FR-5..FR-8):
 * the explore-page endpoint returns the entire public listing set in
 * a single call, with no per-company URL segmentation. Empty
 * `companySlug` ⇒ full catalogue (capped by `resultsWanted`); populated
 * slug ⇒ post-filter narrows the result without changing the request
 * shape. Do NOT add per-slug URL construction — it has no upstream
 * basis.
 *
 * Until T05 ships, `scrape(input)` returns an empty `JobResponseDto`
 * unconditionally.
 */
@SourcePlugin({
  site: Site.MERCOR,
  name: 'Mercor',
  category: 'ats',
  isAts: true,
})
@Injectable()
export class MercorService implements IScraper {
  private readonly logger = new Logger(MercorService.name);

  async scrape(_input: ScraperInputDto): Promise<JobResponseDto> {
    this.logger.debug('MercorService.scrape() — stub (Spec 013 / T05 pending)');
    return new JobResponseDto([]);
  }
}
