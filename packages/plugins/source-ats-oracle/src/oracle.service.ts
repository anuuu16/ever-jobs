import { Injectable, Logger } from '@nestjs/common';
import { SourcePlugin } from '@ever-jobs/plugin';
import {
  IScraper,
  JobResponseDto,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';

/**
 * Spec 013 / T02 — Oracle HCM Cloud scraper stub.
 *
 * Decorated with `@SourcePlugin({ site: Site.ORACLE })` so
 * `PluginDiscoveryService` registers it under the `oracle` key at
 * `OnApplicationBootstrap`. The behavioural logic (REST GET against
 * `/hcmRestApi/resources/latest/recruitingCEJobRequisitions` with the
 * documented finder-string and `limit=100;offset=N` pagination) lands
 * in Spec 013 / T03.
 *
 * URL resolution rules (Spec 013 / FR-1 / FR-2 / FR-3):
 * - `input.companyUrl` (full URL override) is canonical when supplied.
 * - `input.companySlug` (e.g. `eeho-us2`) is composed to
 *   `https://<subdomain>.fa.<region>.oraclecloud.com` only when
 *   `companyUrl` is absent.
 * - `input.siteNumber` (Spec 013 / Q-030 / FR-4) defaults to
 *   `'CX_45001'` inside this service when undefined; the literal-string
 *   default mirrors the upstream Python client and is documented on
 *   the constants module landing in T03.
 *
 * Until T03 ships, `scrape(input)` returns an empty `JobResponseDto`
 * unconditionally so the four-place registration scaffolding is
 * exercisable without committing to upstream API shape decisions.
 */
@SourcePlugin({
  site: Site.ORACLE,
  name: 'Oracle HCM Cloud',
  category: 'ats',
  isAts: true,
})
@Injectable()
export class OracleService implements IScraper {
  private readonly logger = new Logger(OracleService.name);

  async scrape(_input: ScraperInputDto): Promise<JobResponseDto> {
    this.logger.debug('OracleService.scrape() — stub (Spec 013 / T03 pending)');
    return new JobResponseDto([]);
  }
}
