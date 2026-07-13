import { SourcePlugin } from '@ever-jobs/plugin';

import { Injectable, Logger } from '@nestjs/common';
import {
  IScraper,
  ScraperInputDto,
  JobResponseDto,
  JobPostDto,
  LocationDto,
  CompensationDto,
  CompensationInterval,
  DescriptionFormat,
  Site,
} from '@ever-jobs/models';
import {
  createHttpClient,
  htmlToPlainText,
  markdownConverter,
  extractEmails,
} from '@ever-jobs/common';
import {
  REED_API_URL,
  REED_HEADERS,
  REED_MAX_RESULTS_PER_PAGE,
  REED_DEFAULT_RESULTS,
} from './reed.constants';
import { ReedSearchResponse, ReedJob } from './reed.types';

@SourcePlugin({
  site: Site.REED,
  name: 'Reed',
  category: 'job-board',
})
@Injectable()
export class ReedService implements IScraper {
  private readonly logger = new Logger(ReedService.name);
  private readonly defaultApiKey: string | null;

  constructor() {
    this.defaultApiKey = process.env.REED_API_KEY ?? null;
    if (!this.defaultApiKey) {
      this.logger.warn(
        'REED_API_KEY is not set. Reed searches will return empty results ' +
          'unless per-request auth is provided via input.auth.reed. ' +
          'Get your key at https://www.reed.co.uk/developers',
      );
    }
  }

  async scrape(input: ScraperInputDto): Promise<JobResponseDto> {
    const apiKey = input.auth?.reed?.apiKey ?? this.defaultApiKey;

    if (!apiKey) {
      this.logger.warn('Skipping Reed search — API key not configured');
      return new JobResponseDto([]);
    }

    const resultsWanted = input.resultsWanted ?? REED_DEFAULT_RESULTS;
    const authHeader = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;

    const client = createHttpClient({
      proxies: input.proxies,
      caCert: input.caCert,
      timeout: input.requestTimeout,
    });
    client.setHeaders({
      ...REED_HEADERS,
      Authorization: authHeader,
    });

    const jobs: JobPostDto[] = [];
    const seenIds = new Set<string>();
    let offset = input.offset ?? 0;

    while (jobs.length < resultsWanted) {
      const take = Math.min(REED_MAX_RESULTS_PER_PAGE, resultsWanted - jobs.length);

      this.logger.log(`Fetching Reed jobs (offset=${offset}, take=${take})`);

      try {
        const params: Record<string, string | number> = {
          resultsToTake: take,
          resultsToSkip: offset,
        };

        if (input.searchTerm) {
          params.keywords = input.searchTerm;
        }
        if (input.location) {
          params.locationName = input.location;
        }
        if (input.distance) {
          params.distanceFromLocation = input.distance;
        }

        const response = await client.get<ReedSearchResponse>(REED_API_URL, { params });

        const rawJobs = response.data?.results ?? [];
        if (rawJobs.length === 0) {
          this.logger.log('No more Reed jobs available');
          break;
        }

        this.logger.log(
          `Reed returned ${rawJobs.length} jobs (total available: ${response.data?.totalResults ?? 'unknown'})`,
        );

        for (const raw of rawJobs) {
          if (jobs.length >= resultsWanted) break;

          const jobId = `reed-${raw.jobId}`;
          if (seenIds.has(jobId)) continue;
          seenIds.add(jobId);

          try {
            const job = this.mapJob(raw, input.descriptionFormat);
            if (job) jobs.push(job);
          } catch (err: any) {
            this.logger.warn(`Error mapping Reed job ${raw.jobId}: ${err.message}`);
          }
        }

        offset += rawJobs.length;

        // Stop if we got fewer results than requested (last page)
        if (rawJobs.length < take) break;
      } catch (err: any) {
        this.logger.error(`Reed scrape error: ${err.message}`);
        break;
      }
    }

    return new JobResponseDto(jobs);
  }

  private mapJob(raw: ReedJob, descriptionFormat?: DescriptionFormat): JobPostDto | null {
    if (!raw.jobUrl) return null;

    // Process description (Reed may return HTML fragments)
    let description: string | null = raw.jobDescription ?? null;
    if (description) {
      if (descriptionFormat === DescriptionFormat.PLAIN) {
        description = htmlToPlainText(description);
      } else if (descriptionFormat === DescriptionFormat.MARKDOWN) {
        description = markdownConverter(description) ?? description;
      }
      // HTML format: pass through as-is
    }

    // Build compensation
    let compensation: CompensationDto | null = null;
    const hasMin = raw.minimumSalary != null && raw.minimumSalary !== 0;
    const hasMax = raw.maximumSalary != null && raw.maximumSalary !== 0;
    if (hasMin || hasMax) {
      compensation = new CompensationDto({
        interval: CompensationInterval.YEARLY,
        minAmount: raw.minimumSalary ?? null,
        maxAmount: raw.maximumSalary ?? null,
        currency: raw.currency ?? 'GBP',
      });
    }

    // Build location
    const location = new LocationDto({
      city: raw.locationName ?? null,
    });

    const datePosted = parseReedDate(raw.date, this.logger);

    // Detect remote from title or description
    const textToScan = `${raw.jobTitle} ${raw.jobDescription ?? ''}`.toLowerCase();
    const isRemote =
      textToScan.includes('remote') ||
      textToScan.includes('work from home') ||
      textToScan.includes('wfh');

    return new JobPostDto({
      id: `reed-${raw.jobId}`,
      title: raw.jobTitle,
      companyName: raw.employerName ?? null,
      companyUrl: null,
      jobUrl: raw.jobUrl,
      location,
      description,
      compensation,
      datePosted,
      jobType: null,
      isRemote,
      emails: extractEmails(description),
      site: Site.REED,
    });
  }
}

/**
 * Parse Reed's `date` field. The public Jobseeker API returns this as UK
 * `dd/mm/yyyy` (e.g. `"22/11/2013"`) — this previously went straight into
 * `new Date(raw.date)`, whose non-ISO slash-format parsing follows the US
 * `mm/dd/yyyy` convention. For any date where both day and month are ≤ 12
 * that silently swaps them into a *different but still valid* date instead
 * of failing — e.g. Reed's "12/06/2026" (12 June 2026) was misread as
 * month=12/day=06 → 6 December 2026, months in the future. The bug went
 * unnoticed because a swapped date is rarely itself invalid.
 *
 * Returns `null` — rather than propagating a corrupted value — when the
 * input doesn't match the expected `dd/mm/yyyy` shape, or when the
 * day/month/year combination isn't a real calendar date (caught via
 * round-tripping through `Date.UTC`, since `Date.UTC` itself silently
 * rolls over out-of-range components rather than failing).
 *
 * A date that parses fine but lands more than a day in the future is a
 * different case: Reed doesn't post as-yet-unposted jobs, so this is a
 * parsing/scraping artifact (most likely the exact day/month swap this
 * function exists to prevent), not a genuinely future-dated posting — it
 * gets **clamped to today's date** rather than dropped, so the job still
 * carries a plausible `datePosted` instead of losing the field entirely.
 *
 * Exported (not just a local closure) so it can be unit-tested without
 * spinning up the whole scraper.
 */
export function parseReedDate(raw: string | undefined, logger: Logger): string | null {
  if (!raw) return null;

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!match) {
    logger.warn(`Unrecognised Reed date format "${raw}" — expected dd/mm/yyyy, dropping`);
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  const utcMs = Date.UTC(year, month - 1, day);
  const roundTrip = new Date(utcMs);
  if (
    roundTrip.getUTCFullYear() !== year ||
    roundTrip.getUTCMonth() !== month - 1 ||
    roundTrip.getUTCDate() !== day
  ) {
    logger.warn(`Reed date "${raw}" is not a real calendar date — dropping`);
    return null;
  }

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (utcMs > Date.now() + ONE_DAY_MS) {
    const today = new Date().toISOString().split('T')[0];
    logger.warn(
      `Reed date "${raw}" parsed to an implausible future date — clamping to today (${today})`,
    );
    return today;
  }

  return roundTrip.toISOString().split('T')[0];
}
