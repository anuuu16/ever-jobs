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
  markdownConverter,
  extractEmails,
  randomSleep,
} from '@ever-jobs/common';
import {
  PHENOM_DEFAULT_LOCALE_PATH,
  PHENOM_HEADERS,
  PHENOM_PAGE_SIZE,
  PHENOM_REQUEST_DELAY_MS,
  PHENOM_WIDGETS_PATH,
} from './phenom.constants';
import { PhenomJob, PhenomWidgetsResponse } from './phenom.types';

@SourcePlugin({
  site: Site.PHENOM,
  name: 'Phenom',
  category: 'ats',
  isAts: true,
})
@Injectable()
export class PhenomService implements IScraper {
  private readonly logger = new Logger(PhenomService.name);

  async scrape(input: ScraperInputDto): Promise<JobResponseDto> {
    // The tenant's careers host is the identity here (Phenom sites live on
    // varied hostnames), carried as `companySlug`/`companyUrl` rather than a
    // template. Accept either a full URL or a bare host.
    const host = this.resolveHost(input.companySlug, input.companyUrl);
    if (!host) {
      this.logger.warn(
        'No usable Phenom host — provide companySlug (careers host, e.g. "careers.southwestair.com") or companyUrl',
      );
      return new JobResponseDto([]);
    }

    const client = createHttpClient({
      proxies: input.proxies,
      caCert: input.caCert,
      timeout: input.requestTimeout,
    });
    client.setHeaders(PHENOM_HEADERS);

    const widgetsUrl = `https://${host}${PHENOM_WIDGETS_PATH}`;
    const resultsWanted = input.resultsWanted ?? 100;
    const jobPosts: JobPostDto[] = [];
    const seen = new Set<string>();
    let from = 0;
    let totalHits = Infinity;

    try {
      this.logger.log(`Fetching Phenom jobs for host: ${host}`);

      while (jobPosts.length < resultsWanted && from < totalHits) {
        const size = Math.min(
          PHENOM_PAGE_SIZE,
          resultsWanted - jobPosts.length,
        );
        const response = await client.post<PhenomWidgetsResponse>(
          widgetsUrl,
          this.buildSearchPayload(from, size, input),
        );

        const refine = response.data?.refineSearch;
        const jobs = refine?.data?.jobs ?? [];
        if (typeof refine?.totalHits === 'number') totalHits = refine.totalHits;

        if (jobs.length === 0) break;

        this.logger.log(
          `Phenom: fetched ${jobs.length} jobs at from=${from} for ${host}`,
        );

        for (const job of jobs) {
          if (jobPosts.length >= resultsWanted) break;
          try {
            const post = this.processJob(job, host, input.descriptionFormat);
            if (!post) continue;
            const key = post.atsId as string;
            if (seen.has(key)) continue;
            seen.add(key);
            jobPosts.push(post);
          } catch (err: any) {
            this.logger.warn(
              `Error processing Phenom job ${job.jobId ?? job.reqId}: ${err.message}`,
            );
          }
        }

        from += jobs.length;

        // Widget pages are exactly PHENOM_PAGE_SIZE until the last one.
        if (jobs.length < size) break;

        await randomSleep(
          PHENOM_REQUEST_DELAY_MS,
          PHENOM_REQUEST_DELAY_MS * 3,
        );
      }

      this.logger.log(`Phenom total: ${jobPosts.length} jobs for ${host}`);
      return new JobResponseDto(jobPosts);
    } catch (err: any) {
      this.logger.error(`Phenom scrape error for ${host}: ${err.message}`);
      return new JobResponseDto(jobPosts); // Return what we have so far
    }
  }

  /**
   * The `refineSearch` request body the widgets API expects. `from`/`size`
   * drive pagination; an empty keyword/location returns all published jobs.
   */
  private buildSearchPayload(
    from: number,
    size: number,
    input: ScraperInputDto,
  ): Record<string, unknown> {
    return {
      lang: 'en_us',
      deviceType: 'desktop',
      country: 'us',
      pageName: 'search-results',
      ddoKey: 'refineSearch',
      stateInfo: {
        sitekey: '',
        pageIndex: Math.floor(from / Math.max(size, 1)),
        pageSize: size,
      },
      searchType: 'allJobs',
      from,
      size,
      keywords: input.searchTerm ?? '',
      location: input.location ?? '',
      jobs: true,
      global: true,
    };
  }

  /**
   * Resolve the tenant careers host from an explicit URL or the slug. The slug
   * is expected to be the careers hostname itself (e.g.
   * "careers.southwestair.com"); a bare token with no dot can't form a host,
   * so it's rejected (returns null) rather than guessed into a dead URL.
   */
  private resolveHost(
    companySlug: string | undefined,
    companyUrl: string | undefined,
  ): string | null {
    if (companyUrl) {
      try {
        return new URL(companyUrl).host;
      } catch {
        // fall through to slug handling
      }
    }
    if (!companySlug) return null;
    const trimmed = companySlug.trim();
    if (!trimmed) return null;
    // Accept a full URL passed as the slug, too.
    if (trimmed.includes('://')) {
      try {
        return new URL(trimmed).host;
      } catch {
        return null;
      }
    }
    // Must look like a hostname — a bare "boeing" can't be templated safely.
    return trimmed.includes('.') ? trimmed.replace(/\/+$/, '') : null;
  }

  /** Map a raw Phenom widgets job to a standardized JobPostDto. */
  private processJob(
    job: PhenomJob,
    host: string,
    format?: DescriptionFormat,
  ): JobPostDto | null {
    const title = job.title;
    if (!title) return null;

    const atsId = String(job.jobId ?? job.reqId ?? job.jobSeqNo ?? '');
    if (!atsId) return null;

    const description = this.formatDescription(job.descriptionTeaser, format);
    const location = this.extractLocation(job);
    const isRemote = this.detectRemote(job);
    const datePosted = this.parseDate(job.postedDate ?? job.dateCreated);
    const jobUrl = this.buildJobUrl(job, host);

    return new JobPostDto({
      id: `phenom-${atsId}`,
      title,
      companyName: this.deriveCompanyName(host),
      jobUrl,
      jobUrlDirect: job.applyUrl ?? null,
      location,
      description,
      datePosted,
      isRemote,
      skills: job.ml_skills ?? null,
      emails: extractEmails(description),
      site: Site.PHENOM,
      // ATS-specific fields
      atsId,
      atsType: 'phenom',
      department: job.department ?? job.category ?? null,
      employmentType: job.type ?? null,
      applyUrl: job.applyUrl ?? null,
    });
  }

  /**
   * Canonical Phenom listing URL: `https://{host}/{locale}/job/{jobSeqNo}`.
   * Falls back to the job's own applyUrl when no sequence id is present.
   */
  private buildJobUrl(job: PhenomJob, host: string): string {
    if (job.jobSeqNo) {
      const localePath = this.localePath(job.locale);
      return `https://${host}/${localePath}/job/${encodeURIComponent(job.jobSeqNo)}`;
    }
    return job.applyUrl ?? `https://${host}`;
  }

  /** Turn a posting locale like "en_US" into the URL path segment "us/en". */
  private localePath(locale?: string | null): string {
    if (!locale) return PHENOM_DEFAULT_LOCALE_PATH;
    const [lang, region] = locale.split(/[_-]/);
    if (lang && region) return `${region.toLowerCase()}/${lang.toLowerCase()}`;
    return PHENOM_DEFAULT_LOCALE_PATH;
  }

  /** Best-effort display name from the careers host (e.g. careers.southwestair.com → "Southwestair"). */
  private deriveCompanyName(host: string): string {
    const parts = host.split('.').filter((p) => p && p !== 'www');
    // Drop a leading "careers"/"jobs" label and the TLD; keep the brand label.
    const meaningful = parts.filter(
      (p) => !['careers', 'jobs', 'com', 'net', 'org', 'edu', 'co'].includes(p),
    );
    const base = meaningful[0] ?? parts[0] ?? host;
    return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Render the teaser blurb to the requested description format. */
  private formatDescription(
    teaser: string | null | undefined,
    format?: DescriptionFormat,
  ): string | null {
    if (!teaser) return null;
    if (format === DescriptionFormat.HTML) return teaser;
    if (format === DescriptionFormat.MARKDOWN) {
      return markdownConverter(teaser) ?? teaser;
    }
    return htmlToPlainText(teaser);
  }

  /** Extract a structured LocationDto from the flat Phenom job fields. */
  private extractLocation(job: PhenomJob): LocationDto | null {
    if (job.city || job.state || job.country) {
      return new LocationDto({
        city: job.city ?? null,
        state: job.state ?? null,
        country: job.country ?? null,
      });
    }
    if (job.location) {
      const parts = job.location.split(',').map((p) => p.trim());
      return new LocationDto({
        city: parts[0] ?? null,
        state: parts[1] ?? null,
        country: parts[2] ?? null,
      });
    }
    return null;
  }

  /** Detect whether a job is remote from its text fields. */
  private detectRemote(job: PhenomJob): boolean {
    const remoteKeywords = ['remote', 'work from home', 'wfh', 'telecommute'];
    const fieldsToCheck = [job.location, job.type, job.title, job.city];
    for (const field of fieldsToCheck) {
      if (
        field &&
        remoteKeywords.some((kw) => field.toLowerCase().includes(kw))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Parse a date value that may be an ISO string, epoch ms, or epoch seconds.
   * Returns an ISO date string (YYYY-MM-DD) or null.
   */
  private parseDate(value: string | number | null | undefined): string | null {
    if (value == null) return null;
    try {
      if (typeof value === 'number') {
        const ms = value > 1e12 ? value : value * 1000;
        return new Date(ms).toISOString().split('T')[0];
      }
      if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().split('T')[0];
        }
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }
}
