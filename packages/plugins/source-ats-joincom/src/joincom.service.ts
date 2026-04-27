import { Injectable, Logger } from '@nestjs/common';
import { SourcePlugin } from '@ever-jobs/plugin';
import {
  IScraper,
  JobResponseDto,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';

/**
 * Spec 006 / T02 — Join.com scraper stub.
 *
 * Decorated with `@SourcePlugin({ site: Site.JOIN_COM })` so
 * `PluginDiscoveryService` registers it under the `join_com` key at
 * `OnApplicationBootstrap`. The behavioural logic (HTML scrape for
 * company id, then paginated `/api/public/companies/<id>/jobs` REST
 * call with `>= 0.5 s` polite-pacing between pages) lands in Spec
 * 006 / T07.
 *
 * Site-enum value is `join_com` (underscore) — matches the upstream
 * Python directory name `join_com/` and the `Site` enum convention
 * for compound vendor names (`ZIP_RECRUITER = 'zip_recruiter'`). The
 * folder name is `source-ats-joincom` (no underscore) per the
 * existing `source-ats-greenhouse` / `source-ats-lever` hyphen
 * convention.
 *
 * Until T07 ships, `scrape(input)` returns an empty `JobResponseDto`
 * unconditionally.
 */
@SourcePlugin({
  site: Site.JOIN_COM,
  name: 'Join.com',
  category: 'ats',
  isAts: true,
})
@Injectable()
export class JoinComService implements IScraper {
  private readonly logger = new Logger(JoinComService.name);

  async scrape(_input: ScraperInputDto): Promise<JobResponseDto> {
    this.logger.debug('JoinComService.scrape() — stub (Spec 006 / T07 pending)');
    return new JobResponseDto([]);
  }
}
