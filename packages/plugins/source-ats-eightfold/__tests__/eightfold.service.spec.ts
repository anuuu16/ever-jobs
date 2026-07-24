/**
 * Unit tests for EightfoldService tenant-URL construction.
 *
 * Regression guard for the `qualcomm.com` → `https://qualcomm.com.eightfold.ai`
 * (NXDOMAIN) / `domain=qualcomm.com.com` bug: directory slugs come in two
 * forms — a bare tenant label (`cbmglobal`) or a full company domain
 * (`qualcomm.com`) — and both must resolve to `https://<label>.eightfold.ai`
 * with the real domain in the `domain` query param.
 *
 * The HTTP layer is mocked so these run offline (unlike the network-gated
 * e2e spec), and we capture the URL the service actually requests.
 */
import { ScraperInputDto } from '@ever-jobs/models';

const capturedUrls: string[] = [];

// Mock the shared HTTP client factory so no real request goes out; every
// `get()` records its URL and returns an empty-but-valid Eightfold payload.
jest.mock('@ever-jobs/common', () => {
  const actual = jest.requireActual('@ever-jobs/common');
  return {
    ...actual,
    createHttpClient: () => ({
      setHeaders: () => undefined,
      get: (url: string) => {
        capturedUrls.push(url);
        return Promise.resolve({ data: { positions: [], count: 0 } });
      },
    }),
  };
});

// Import AFTER the mock is registered so the service picks up the stub.
import { EightfoldService } from '../src/eightfold.service';

describe('EightfoldService URL construction', () => {
  let service: EightfoldService;

  beforeEach(() => {
    capturedUrls.length = 0;
    service = new EightfoldService();
  });

  it('builds the host from the first slug label and appends .com for the domain param (bare slug)', async () => {
    await service.scrape(new ScraperInputDto({ companySlug: 'cbmglobal' }));

    expect(capturedUrls).toHaveLength(1);
    const url = new URL(capturedUrls[0]);
    expect(url.host).toBe('cbmglobal.eightfold.ai');
    expect(url.searchParams.get('domain')).toBe('cbmglobal.com');
  });

  it('strips the TLD from a domain-form slug for the host, using it verbatim for the domain param', async () => {
    await service.scrape(new ScraperInputDto({ companySlug: 'qualcomm.com' }));

    expect(capturedUrls).toHaveLength(1);
    const url = new URL(capturedUrls[0]);
    // Not qualcomm.com.eightfold.ai (which NXDOMAINs).
    expect(url.host).toBe('qualcomm.eightfold.ai');
    // Not qualcomm.com.com.
    expect(url.searchParams.get('domain')).toBe('qualcomm.com');
  });
});
