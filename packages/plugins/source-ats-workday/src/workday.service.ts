import { SourcePlugin } from '@ever-jobs/plugin';

import { Injectable, Logger } from '@nestjs/common';
import {
  IScraper,
  ScraperInputDto,
  JobResponseDto,
  JobPostDto,
  LocationDto,
  Site,
  DescriptionFormat,
} from '@ever-jobs/models';
import {
  createHttpClient,
  htmlToPlainText,
  extractEmails,
  randomSleep,
} from '@ever-jobs/common';
import {
  WORKDAY_HEADERS,
  WORKDAY_PAGE_SIZE,
  parseWorkdaySlug,
  buildWorkdayUrl,
  parseWorkdayPostedOn,
} from './workday.constants';
import { WorkdayJobListItem, WorkdaySearchResponse } from './workday.types';

@SourcePlugin({
  site: Site.WORKDAY,
  name: 'Workday',
  category: 'ats',
  isAts: true,
})
@Injectable()
export class WorkdayService implements IScraper {
  private readonly logger = new Logger(WorkdayService.name);

  async scrape(input: ScraperInputDto): Promise<JobResponseDto> {
    const companySlug = input.companySlug;
    if (!companySlug) {
      this.logger.warn('No companySlug provided for Workday scraper');
      return new JobResponseDto([]);
    }

    const { company, wdNumber, site } = parseWorkdaySlug(companySlug);
    const apiUrl = buildWorkdayUrl(company, wdNumber, site);

    const client = createHttpClient({
      proxies: input.proxies,
      caCert: input.caCert,
      timeout: input.requestTimeout,
    });
    client.setHeaders(WORKDAY_HEADERS);

    const resultsWanted = input.resultsWanted ?? 100;
    const jobPosts: JobPostDto[] = [];
    let offset = 0;

    try {
      this.logger.log(`Fetching Workday jobs for ${company} (wd${wdNumber}/${site})`);

      while (jobPosts.length < resultsWanted) {
        const payload = {
          appliedFacets: {},
          limit: WORKDAY_PAGE_SIZE,
          offset,
          searchText: '',
        };

        const response = await client.post(apiUrl, payload);
        const data: WorkdaySearchResponse = response.data ?? {};
        const listings = data.jobPostings ?? [];

        if (listings.length === 0) break;

        this.logger.log(
          `Workday: fetched ${listings.length} jobs at offset ${offset} for ${company}` +
          `${data.total ? ` (total: ${data.total})` : ''}`,
        );

        for (const listing of listings) {
          if (jobPosts.length >= resultsWanted) break;

          try {
            const post = this.processListing(listing, company, wdNumber, site, input.descriptionFormat);
            if (post) {
              jobPosts.push(post);
            }
          } catch (err: any) {
            this.logger.warn(`Error processing Workday listing: ${err.message}`);
          }
        }

        offset += listings.length;

        // If we got less than page size, no more results
        if (listings.length < WORKDAY_PAGE_SIZE) break;

        // Respect rate limiting
        await randomSleep(1000, 2000);
      }

      this.logger.log(`Workday total: ${jobPosts.length} jobs for ${company}`);
      return new JobResponseDto(jobPosts);
    } catch (err: any) {
      this.logger.error(`Workday scrape error for ${company}: ${err.message}`);
      return new JobResponseDto(jobPosts);
    }
  }

  private processListing(
    listing: WorkdayJobListItem,
    company: string,
    wdNumber: string,
    site: string,
    _format?: DescriptionFormat,
  ): JobPostDto | null {
    const title = listing.title;
    if (!title) return null;

    // Extract job path for URL construction. Workday's CXS `externalPath` is
    // site-relative (e.g. "/job/Austin-TX/Software-Engineer_R-101/12345"); the
    // public careers page lives under "/en-US/{site}" — without that prefix
    // Workday answers 404. Guard against double-prefixing for tenants whose
    // externalPath already carries a locale/site segment.
    const externalPath = listing.externalPath ?? '';
    const host = `https://${company}.wd${wdNumber}.myworkdayjobs.com`;
    const sitePrefix = `/en-US/${site}`;
    let jobUrl: string;
    if (externalPath) {
      const path = externalPath.startsWith('/') ? externalPath : `/${externalPath}`;
      jobUrl =
        path.startsWith(sitePrefix) || path.startsWith('/en-US/')
          ? `${host}${path}`
          : `${host}${sitePrefix}${path}`;
    } else {
      jobUrl = `${host}${sitePrefix}/details/${encodeURIComponent(title)}`;
    }

    // Location
    const locationStr = listing.locationsText ?? null;
    const location = locationStr
      ? new LocationDto({ city: locationStr })
      : null;

    // Remote detection
    const isRemote = locationStr?.toLowerCase().includes('remote') ?? false;

    // Date from postedOn (relative labels like "Posted 3 Days Ago" -> ISO date or null)
    const datePosted = parseWorkdayPostedOn(listing.postedOn);

    // Extract subtitle info (often contains category/department)
    const subtitleTexts = listing.subtitles
      ?.flatMap((sub) => sub.instances?.map((i) => i.text) ?? [])
      .filter(Boolean) ?? [];

    // Extract job ID from externalPath (e.g., "/job/123456")
    const jobIdMatch = externalPath.match(/\/(\d+)(?:\/|$)/);
    const atsId = jobIdMatch?.[1] ?? (externalPath || null);

    return new JobPostDto({
      id: `wd-${company}-${atsId ?? title.replace(/\s+/g, '-').toLowerCase()}`,
      title,
      companyName: company,
      jobUrl,
      location,
      datePosted,
      isRemote,
      site: Site.WORKDAY,
      // ATS-specific fields
      atsId,
      atsType: 'workday',
      department: subtitleTexts[0] ?? null,
    });
  }
}
