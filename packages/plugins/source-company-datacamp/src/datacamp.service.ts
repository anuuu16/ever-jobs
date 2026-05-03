import { SourcePlugin } from '@ever-jobs/plugin';

import { Injectable, Logger } from '@nestjs/common';
import {
  IScraper, ScraperInputDto, JobResponseDto, JobPostDto, Site, LocationDto,
} from '@ever-jobs/models';
import { createHttpClient, decodeHtmlEntities, stripHtmlTags } from '@ever-jobs/common';

/**
 * DataCamp — operator of the dominant interactive online
 * data-and-AI-skills learning platform pioneered around the
 * in-browser code-execution-and-immediate-feedback data
 * model (founded by Jonathan Cornelissen, Dieter De Mesmaeker,
 * and Martijn Theuwissen in 2014 in Leuven, Belgium; raised
 * $30M+ across rounds led by Accomplice and Spectrum Equity at
 * a peak valuation in the high-9-figures range; ships a
 * freemium B2C self-serve course catalogue + a B2B DataCamp-
 * for-Business enterprise-data-skills-training platform across
 * the corporate-training segment — alongside competitors
 * Coursera, Udemy, Pluralsight, Codecademy, and Udacity — with
 * a hybrid distributed workforce concentrated in Leuven
 * (Belgium), London, and Remote across Europe and North
 * America) — publishes its consolidated careers board through
 * Greenhouse at the bare slug `datacamp` (the lowercase brand
 * name; slug/wire-asymmetric — wire `company_name === 'DataCamp'`
 * carries an internal capital `C` that the lowercase slug does
 * not; see Spec 081 § 10 D-05). The wire `company_name` is the
 * literal single-token bare-brand string `'DataCamp'` byte-for-
 * byte (8 bytes; same byte count as the lowercase slug `datacamp`
 * but with a single internal-capital byte difference at offset
 * 4 — the `C` of `Camp`).
 *
 * **One structural deviation from the Calendly (Spec 080)
 * template** — D-09 omitted with **slug/wire-asymmetric**
 * internal-capital wire form (DataCamp's wire `'DataCamp'` is
 * slug/wire-asymmetric vs Calendly's case-symmetric wire
 * `'Calendly'`). **One additional structural deviation** —
 * D-11 **applied with a leading-space pad form** (the **third**
 * cohort plugin to apply D-11, the **first** to apply D-11
 * with a leading-pad form — distinct from Lattice's Spec-074
 * trailing-pad and Stitch Fix's Spec-077 trailing-pad). All
 * other axes share with Calendly: D-04 wire-shape variant 2
 * (canonical Greenhouse host), D-08 entity-decode-then-tag-
 * strip description pipeline, D-10 omitted (DataCamp's wire
 * titles are 0/41 padded — fully clean — distinct from
 * Calendly's 1/20 padded ~5.0 % rate; the title pass-through
 * still applies a defensive `.trim()` only because we share the
 * implementation pattern, but on DataCamp's wire it is a no-op).
 *
 *   1. **D-04 — wire-shape variant 2 (canonical Greenhouse
 *      host).** DataCamp's tenant publishes its `absolute_url`
 *      on the canonical Greenhouse variant-2 shape
 *      `https://job-boards.greenhouse.io/datacamp/jobs/<id>` —
 *      the baseline shape used by the majority of cohort
 *      plugins from Klaviyo onwards. **Twenty-first cohort
 *      plugin** to use canonical variant 2 (extending the
 *      baseline streak after Calendly's Spec 080 return-to-
 *      baseline observation following Bitwarden's variant-18
 *      first-cohort observation in Spec 079).
 *
 *      The plugin emits `listing.absolute_url` byte-for-byte;
 *      the **fallback** `jobUrl` constructor (when Greenhouse
 *      omits `absolute_url`) reconstructs the same canonical
 *      variant-2 form `https://job-boards.greenhouse.io/datacamp/jobs/<id>`
 *      (deterministic given the listing ID — no defence-in-
 *      depth divergence between wire and fallback).
 *
 *   2. **D-08 — entity-decode-then-tag-strip description
 *      pipeline.** Like every plugin from Klaviyo onwards,
 *      DataCamp's `content` is HTML-entity-encoded
 *      (`&lt;p&gt;&lt;strong&gt;About DataCamp&lt;/strong&gt;
 *      &lt;/p&gt;`), so the plugin decodes entities BEFORE
 *      stripping tags. **Thirty-seventh** plugin in the cohort
 *      to apply D-08.
 *
 *   3. **D-09 — brand-name trim omitted (slug/wire-
 *      asymmetric, internal-capital wire form).** Wire
 *      `company_name === 'DataCamp'` byte-for-byte (the single-
 *      token PascalCase brand name; slug/wire-asymmetric — the
 *      wire's internal capital `C` at offset 4 is missing from
 *      the lowercase slug `datacamp`); no legal-entity suffix
 *      on the wire — the wire is the bare PascalCase brand.
 *      The plugin reads `listing.company_name` directly with
 *      `'DataCamp'` as a defensive fallback. **Eighth slug/
 *      wire-asymmetry case** in the cohort (after Ramp Network,
 *      Scale AI, fuboTV, Honeycomb, MasterClass, Maven Clinic,
 *      and Stitch Fix). Distinct from the prior seven cases:
 *      DataCamp's wire and slug have the SAME byte count
 *      (8 bytes each) — the asymmetry is a pure case-fold
 *      diff at one internal byte offset, NOT an extra TLD
 *      suffix (Honeycomb), an extra space (Stitch Fix / Maven
 *      Clinic / Scale AI / Ramp Network), or an extra TV
 *      acronym (fuboTV). DataCamp is the **first** slug/wire-
 *      asymmetric case where the wire and slug share byte
 *      length and differ only by a single case-fold inversion.
 *
 *   4. **D-10 — wire-title `.trim()` omitted (no observed
 *      pad).** DataCamp's wire titles are 0 of 41 padded
 *      (~0 % pad rate — fully clean) in the run-291 probe.
 *      Distinct from Calendly's 1/20 padded ~5.0 % rate. The
 *      plugin's title pass-through still calls `.trim()` for
 *      defence-in-depth (matching the cohort implementation
 *      template), but the pass-through is a no-op on the
 *      clean wire data. If DataCamp adds title padding upstream
 *      in the future, the trim catches it without surprising
 *      the consumer.
 *
 *   5. **D-11 — wire-department `.trim()` applied (leading-
 *      pad form — first cohort observation).** DataCamp's wire
 *      department names are 1 of 41 padded with **leading**
 *      ASCII space (`' IT'` — the `' IT'` 3-byte form trims to
 *      the 2-byte `'IT'`; ~2.4 % overall pad rate). The plugin
 *      applies `.trim()` to the wire `departments[0].name`
 *      before downstream filters and emit. **Third cohort
 *      plugin to apply D-11** (after Lattice in Spec 074 with
 *      a trailing-pad form, and Stitch Fix in Spec 077 with
 *      a trailing-pad form); **first** cohort plugin to apply
 *      D-11 with a **leading-pad** form — opening the leading-
 *      pad sub-axis under D-11. The plugin therefore emits
 *      the trimmed `'IT'` (2 bytes) for the affected listing,
 *      byte-distinct from the wire `' IT'` (3 bytes).
 */
const API_URL = 'https://api.greenhouse.io/v1/boards/datacamp/jobs';

@SourcePlugin({
  site: Site.DATACAMP,
  name: 'DataCamp',
  category: 'company',
})
@Injectable()
export class DataCampService implements IScraper {
  private readonly logger = new Logger(DataCampService.name);

  async scrape(input: ScraperInputDto): Promise<JobResponseDto> {
    const jobs: JobPostDto[] = [];
    const resultsWanted = input.resultsWanted ?? 50;

    try {
      const client = createHttpClient({
        proxies: input.proxies,
        timeout: input.requestTimeout ?? 30,
      });

      const url = `${API_URL}?content=true`;
      this.logger.log(`DataCamp: fetching ${url}`);

      const { data } = await client.get<any>(url);
      const listings = data?.jobs ?? [];

      for (const listing of listings) {
        if (jobs.length >= resultsWanted) break;

        // D-10 omitted (no pad observed) — but defensive `.trim()`
        // applied to follow the cohort implementation pattern; on
        // DataCamp's run-291 wire data this is a no-op (0/41 padded).
        const title = (listing.title ?? '').trim();
        if (!title) continue;

        // D-11 applied (leading-pad form — first cohort observation):
        // 1 of 41 wire departments in run #291 carries a single-
        // leading ASCII space (`' IT'` → `'IT'`). The plugin trims
        // BEFORE the searchTerm guard so case-insensitive department
        // matches honour the trimmed form (e.g. searching `'it'`
        // matches the trimmed `'IT'`).
        const department = (listing.departments?.[0]?.name ?? '').trim() || null;

        if (input.searchTerm) {
          const term = input.searchTerm.toLowerCase();
          const titleMatch = title.toLowerCase().includes(term);
          const deptMatch = (department ?? '').toLowerCase().includes(term);
          if (!titleMatch && !deptMatch) continue;
        }

        const jobId = listing.id ?? '';
        const id = `datacamp-${jobId}`;

        const locationStr = listing.location?.name ?? null;
        const location = locationStr
          ? new LocationDto({ city: locationStr })
          : null;

        if (input.location && locationStr) {
          if (!locationStr.toLowerCase().includes(input.location.toLowerCase())) continue;
        }

        jobs.push(
          new JobPostDto({
            id,
            site: Site.DATACAMP,
            title,
            // D-09 omitted: slug/wire-asymmetric internal-capital
            // wire form `company_name === 'DataCamp'` byte-for-byte
            // (8 bytes; PascalCase with internal capital `C` at
            // offset 4 — slug/wire-asymmetric vs the lowercase
            // 8-byte slug `datacamp`); pass-through with a
            // defensive `'DataCamp'` fallback.
            companyName: listing.company_name ?? 'DataCamp',
            // D-04: wire `absolute_url` flows through to `jobUrl`
            // byte-for-byte (preserving the canonical variant-2
            // shape `job-boards.greenhouse.io/datacamp/jobs/<id>`).
            // Fallback reconstructs the same canonical variant-2
            // form (deterministic given the listing ID).
            jobUrl:
              listing.absolute_url ??
              `https://job-boards.greenhouse.io/datacamp/jobs/${listing.id}`,
            location,
            description: listing.content
              ? stripHtmlTags(decodeHtmlEntities(listing.content))
              : null,
            datePosted: listing.updated_at ?? null,
            isRemote: locationStr?.toLowerCase().includes('remote') ?? false,
            // D-11 applied (leading-pad form): trimmed wire
            // department; the wire pad bytes (1 of 41 listings have
            // a leading-space pad — `' IT'`) are stripped before
            // emit.
            department,
          }),
        );
      }

      this.logger.log(`DataCamp: scraped ${jobs.length} jobs`);
    } catch (err: any) {
      this.logger.error(`DataCamp scrape failed: ${err.message}`);
    }

    return { jobs };
  }
}
