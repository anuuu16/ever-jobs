/**
 * Unit tests — LinkedIn raw-response capture + apply-link extraction.
 *
 * Drives the private `extractJobFromCard` / `fetchDescription` helpers
 * directly against small HTML fixtures (no live network access, no
 * mocked HTTP layer needed for `extractJobFromCard` since it operates on
 * an already-loaded cheerio document).
 *
 *  1. `extractJobFromCard` captures the list-card's own HTML onto
 *     `job.rawResponse` only when `captureRawResponse` is true.
 *  2. `fetchDescription` returns the detail-page HTML verbatim as
 *     `rawResponse` (caller decides whether to use it).
 *  3. `fetchDescription` extracts `jobUrlDirect` from the hidden
 *     `<code id="applyUrl">` element; returns `undefined` when absent
 *     (Easy Apply postings have no off-platform redirect).
 */
import * as cheerio from 'cheerio';
import { ScraperInputDto, Site } from '@ever-jobs/models';
import { LinkedInService } from '../src/linkedin.service';

const CARD_HTML = `
  <li>
    <div class="base-search-card">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/12345?refId=abc">Job</a>
      <h3 class="base-search-card__title">Senior Software Engineer</h3>
      <h4 class="base-search-card__subtitle"><a href="https://linkedin.com/company/acme">Acme</a></h4>
      <span class="job-search-card__location">Remote</span>
    </div>
  </li>
`;

function makeService(): LinkedInService {
  return new LinkedInService();
}

describe('LinkedIn raw-response capture', () => {
  describe('extractJobFromCard', () => {
    it('captures the card HTML onto rawResponse when captureRawResponse is true', () => {
      const service = makeService();
      const $ = cheerio.load(CARD_HTML);
      const card = $('li').has('.base-search-card').eq(0);
      const input = new ScraperInputDto({ captureRawResponse: true });

      const job = (service as any).extractJobFromCard($, card, input);

      expect(job).not.toBeNull();
      expect(job.rawResponse).toEqual(expect.stringContaining('Senior Software Engineer'));
    });

    it('leaves rawResponse null when captureRawResponse is false (default)', () => {
      const service = makeService();
      const $ = cheerio.load(CARD_HTML);
      const card = $('li').has('.base-search-card').eq(0);
      const input = new ScraperInputDto({});

      const job = (service as any).extractJobFromCard($, card, input);

      expect(job.rawResponse).toBeNull();
    });
  });

  describe('fetchDescription', () => {
    function makeFakeClient(html: string) {
      return { get: jest.fn().mockResolvedValue({ data: html }) };
    }

    it('extracts jobUrlDirect from the hidden code#applyUrl element and returns the raw HTML', async () => {
      const html = `
        <div class="description__job-criteria-list"></div>
        <div class="show-more-less-html__markup">Job description text.</div>
        <code id="applyUrl">"https://company.example.com/careers/apply/12345"</code>
      `;
      const service = makeService();
      const client = makeFakeClient(html);

      const result = await (service as any).fetchDescription(
        client,
        'https://www.linkedin.com/jobs/view/12345',
      );

      expect(result.jobUrlDirect).toBe('https://company.example.com/careers/apply/12345');
      expect(result.rawResponse).toBe(html);
    });

    it('returns jobUrlDirect undefined when the posting is Easy Apply (no applyUrl element)', async () => {
      const html = `
        <div class="description__job-criteria-list"></div>
        <div class="show-more-less-html__markup">Job description text.</div>
      `;
      const service = makeService();
      const client = makeFakeClient(html);

      const result = await (service as any).fetchDescription(
        client,
        'https://www.linkedin.com/jobs/view/12345',
      );

      expect(result.jobUrlDirect).toBeUndefined();
    });
  });
});
