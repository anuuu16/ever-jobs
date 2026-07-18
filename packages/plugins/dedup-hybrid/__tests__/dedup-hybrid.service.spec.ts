import { JobPostDto, LocationDto, Site } from '@ever-jobs/models';
import { DedupHybridService } from '../src/dedup-hybrid.service';

function job(partial: Partial<JobPostDto>): JobPostDto {
  return new JobPostDto({
    title: 'Senior Software Engineer',
    companyName: 'Acme, Inc.',
    jobUrl: 'https://acme.example.com/jobs/1',
    site: Site.GREENHOUSE,
    location: new LocationDto({ city: 'San Francisco', state: 'CA', country: 'USA' }),
    ...partial,
  });
}

describe('DedupHybridService', () => {
  let service: DedupHybridService;

  beforeEach(() => {
    service = new DedupHybridService();
  });

  it('returns one canonical record for identical inputs', async () => {
    const a = job({ id: '1', site: Site.GREENHOUSE });
    const b = job({ id: '2', site: Site.LINKEDIN });
    const out = await service.dedup([a, b]);

    expect(out.canonical).toHaveLength(1);
    expect(out.metrics.inputCount).toBe(2);
    expect(out.metrics.outputCount).toBe(1);
    expect(out.metrics.mergedPairs).toBe(1);
    expect(out.errors).toHaveLength(0);
    expect(out.assignments).toHaveLength(2);
    expect(out.assignments[0]).toEqual(out.assignments[1]);
    expect(out.canonical[0].sources).toHaveLength(2);
  });

  it('falls back to an empty string url when a scraper produces a job with none', async () => {
    // `jobUrl` is typed `!: string` on JobPostDto but that's a compile-time
    // assertion only — a scraper bug can still leave it undefined at
    // runtime. Postgres/sqlite both declare `url` NOT NULL, so canonical
    // records MUST NOT carry `url: undefined` through to the store layer
    // (that crashed persistence for an entire batch — see
    // apps/api/src/jobs/jobs.aggregator.ts's persistError handling).
    const broken = job({ id: '1', jobUrl: undefined as unknown as string });
    const out = await service.dedup([broken]);

    expect(out.errors).toHaveLength(0);
    expect(out.canonical[0].url).toBe('');
    expect(out.canonical[0].fields['url'].value).toBe('');
  });

  it('carries rawResponse through into the source observation when present', async () => {
    const a = job({ id: '1', site: Site.GREENHOUSE, rawResponse: '<html>raw a</html>' });
    const b = job({ id: '2', site: Site.LINKEDIN });
    const out = await service.dedup([a, b]);

    const bySite = Object.fromEntries(out.canonical[0].sources.map((s) => [s.site, s]));
    expect(bySite[Site.GREENHOUSE].rawResponse).toBe('<html>raw a</html>');
    expect(bySite[Site.LINKEDIN].rawResponse).toBeUndefined();
  });

  it('collapses cosmetic-only company differences into one record', async () => {
    const a = job({ id: '1', companyName: 'Acme, Inc.', site: Site.GREENHOUSE });
    const b = job({ id: '2', companyName: 'ACME Inc', site: Site.LINKEDIN });
    const c = job({ id: '3', companyName: 'Acme', site: Site.LEVER });
    const out = await service.dedup([a, b, c]);
    expect(out.canonical).toHaveLength(1);
    expect(out.canonical[0].sources).toHaveLength(3);
    expect(out.canonical[0].company).toBe('acme');
  });

  it('keeps different titles separate', async () => {
    const a = job({ id: '1', title: 'Senior Software Engineer', site: Site.GREENHOUSE });
    const b = job({ id: '2', title: 'Product Manager', site: Site.LINKEDIN });
    const out = await service.dedup([a, b]);
    expect(out.canonical).toHaveLength(2);
    expect(out.metrics.mergedPairs).toBe(0);
    expect(out.assignments[0]).not.toEqual(out.assignments[1]);
  });

  it('rejects entries missing required identity fields', async () => {
    const good = job({ id: '1' });
    const badNoTitle = new JobPostDto({
      title: '',
      companyName: 'Acme',
      jobUrl: 'https://x.test',
      site: Site.LEVER,
    });
    const out = await service.dedup([good, badNoTitle]);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0].inputIndex).toBe(1);
    expect(out.errors[0].code).toBe('ERR_DEDUP_INVALID_INPUT');
    expect(out.assignments[1]).toBeNull();
    expect(out.canonical).toHaveLength(1);
  });

  it('emits a sha-256 hex canonicalJobId of the right shape', async () => {
    const a = job({ id: '1' });
    const out = await service.dedup([a]);
    expect(out.canonical[0].canonicalJobId).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces deterministic output for the same input', async () => {
    const inputs = [
      job({ id: '1', site: Site.GREENHOUSE }),
      job({ id: '2', site: Site.LINKEDIN }),
      job({ id: '3', title: 'Designer', site: Site.LEVER }),
    ];
    const a = await service.dedup(inputs);
    const b = await service.dedup(inputs);

    expect(a.canonical.map((j) => j.canonicalJobId).sort()).toEqual(
      b.canonical.map((j) => j.canonicalJobId).sort(),
    );
    expect(a.assignments).toEqual(b.assignments);
  });

  it('returns an empty result for empty input', async () => {
    const out = await service.dedup([]);
    expect(out.canonical).toHaveLength(0);
    expect(out.assignments).toHaveLength(0);
    expect(out.metrics.inputCount).toBe(0);
    expect(out.metrics.outputCount).toBe(0);
    expect(out.metrics.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('attaches provenance to every materialised field', async () => {
    const a = job({ id: '1', site: Site.GREENHOUSE });
    const out = await service.dedup([a]);
    const fields = out.canonical[0].fields;
    for (const fieldName of ['title', 'company', 'location', 'url']) {
      expect(fields[fieldName]).toBeDefined();
      expect(fields[fieldName]._source).toBe(Site.GREENHOUSE);
      expect(typeof fields[fieldName]._observedAt).toBe('string');
    }
  });

  it('carries every other populated raw field through into fields, but excludes rawResponse', async () => {
    const a = job({
      id: '1',
      site: Site.GREENHOUSE,
      rawResponse: '<html>raw a</html>',
      compensation: { minAmount: 120_000, maxAmount: 160_000, currency: 'USD' } as any,
      jobType: ['fulltime'] as any,
      datePosted: '2026-01-01T00:00:00.000Z',
      skills: ['TypeScript', 'React'],
      department: 'Engineering',
      companyIndustry: null,
    });
    const out = await service.dedup([a]);
    const fields = out.canonical[0].fields;

    expect(fields['compensation'].value).toEqual({ minAmount: 120_000, maxAmount: 160_000, currency: 'USD' });
    expect(fields['jobType'].value).toEqual(['fulltime']);
    expect(fields['datePosted'].value).toBe('2026-01-01T00:00:00.000Z');
    expect(fields['skills'].value).toEqual(['TypeScript', 'React']);
    expect(fields['department'].value).toBe('Engineering');
    // null-valued raw fields are skipped, not carried through as null.
    expect(fields['companyIndustry']).toBeUndefined();
    // rawResponse stays on the SourceObservation only — never duplicated
    // into `fields` (it can be a large HTML/JSON blob).
    expect(fields['rawResponse']).toBeUndefined();
    // Already-handled identity fields aren't clobbered by the generic loop
    // — `title` stays the normalized value, not the raw one.
    expect(fields['title'].value).not.toBe('Senior Software Engineer');
  });

  describe('isRemote merge', () => {
    it('elects true when ANY source in the cluster reports remote, even if the merge head does not', async () => {
      // Head (id '1', first in the array) has no remote signal; a second
      // source for the same role confidently reports remote (e.g. an ATS's
      // structured remoteType field). The naive "head wins" default would
      // have silently dropped the positive signal.
      const head = job({ id: '1', site: Site.GREENHOUSE, isRemote: false });
      const secondary = job({ id: '2', site: Site.LINKEDIN, isRemote: true });
      const out = await service.dedup([head, secondary]);

      expect(out.canonical).toHaveLength(1);
      expect(out.canonical[0].isRemote).toBe(true);
      expect(out.canonical[0].fields['isRemote'].value).toBe(true);
      expect(out.canonical[0].fields['isRemote']._source).toBe(Site.LINKEDIN);
    });

    it('elects false when every source explicitly reports non-remote', async () => {
      const a = job({ id: '1', site: Site.GREENHOUSE, isRemote: false });
      const b = job({ id: '2', site: Site.LINKEDIN, isRemote: false });
      const out = await service.dedup([a, b]);

      expect(out.canonical[0].isRemote).toBe(false);
      expect(out.canonical[0].fields['isRemote'].value).toBe(false);
    });

    it('leaves isRemote unset when no source expresses an opinion', async () => {
      const a = job({ id: '1', site: Site.GREENHOUSE });
      const out = await service.dedup([a]);

      expect(out.canonical[0].isRemote).toBeUndefined();
      expect(out.canonical[0].fields['isRemote']).toBeUndefined();
    });

    it('elects true when the canonical location text says "Remote", even with no isRemote signal from any source', async () => {
      const a = job({
        id: '1',
        site: Site.GREENHOUSE,
        location: new LocationDto({ city: 'Remote' }),
      });
      const out = await service.dedup([a]);

      expect(out.canonical[0].isRemote).toBe(true);
      expect(out.canonical[0].fields['isRemote'].value).toBe(true);
    });

    it('location text saying "Remote" overrides an explicit false from every source', async () => {
      // A scraper's isRemote detector under-fired (bug/gap), but the
      // location string itself is unambiguous — location wins.
      const a = job({
        id: '1',
        site: Site.GREENHOUSE,
        isRemote: false,
        location: new LocationDto({ city: 'Remote', state: 'CA' }),
      });
      const out = await service.dedup([a]);

      expect(out.canonical[0].isRemote).toBe(true);
    });

    it('does not false-positive on a location that merely contains "remote" as a substring, not a word', async () => {
      const a = job({
        id: '1',
        site: Site.GREENHOUSE,
        location: new LocationDto({ city: 'Remoteville' }),
      });
      const out = await service.dedup([a]);

      expect(out.canonical[0].isRemote).toBeUndefined();
    });
  });

  describe('observedAt / implausible-future-date guard', () => {
    const FIXED_NOW = new Date('2026-06-15T00:00:00.000Z').getTime();

    beforeEach(() => {
      // `jobToObservation`'s `observedAt` uses `new Date().toISOString()`
      // (the constructor, no args) — `jest.spyOn(Date, 'now')` alone does
      // NOT intercept that, only real fake timers do.
      jest.useFakeTimers({ now: FIXED_NOW });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('sets SourceObservation.observedAt to scrape time, never the source-reported datePosted', async () => {
      // A source reporting a datePosted far from "now" (in either
      // direction) must NOT leak into observedAt — observedAt means "when
      // THIS PROCESS scraped it", per the SourceObservation contract.
      const a = job({
        id: '1',
        site: Site.GREENHOUSE,
        datePosted: '2020-01-01T00:00:00.000Z',
      });
      const out = await service.dedup([a]);
      const observedAt = out.canonical[0].sources[0].observedAt;
      expect(observedAt).toBe(new Date(FIXED_NOW).toISOString());
      expect(observedAt).not.toBe('2020-01-01T00:00:00.000Z');
    });

    it('clamps an implausible future datePosted to today instead of dropping it', async () => {
      // e.g. a source-side dd/mm vs mm/dd date-parsing bug that silently
      // swapped month and day, landing months in the future. Not a
      // genuinely future-dated posting, so it's corrected to today's
      // date rather than losing the field entirely.
      const a = job({
        id: '1',
        site: Site.GREENHOUSE,
        datePosted: '2026-12-06T00:00:00.000Z',
        department: 'Engineering',
      });
      const out = await service.dedup([a]);
      const fields = out.canonical[0].fields;
      expect(fields['datePosted'].value).toBe(new Date(FIXED_NOW).toISOString().slice(0, 10));
      // Sibling raw fields on the same job are unaffected by the guard.
      expect(fields['department'].value).toBe('Engineering');
    });

    it('accepts a datePosted within the 1-day forward-tolerance window', async () => {
      const a = job({
        id: '1',
        site: Site.GREENHOUSE,
        datePosted: '2026-06-15T12:00:00.000Z', // 12h ahead of fixed "now"
      });
      const out = await service.dedup([a]);
      expect(out.canonical[0].fields['datePosted'].value).toBe('2026-06-15T12:00:00.000Z');
    });

    it('still carries a plausible past datePosted through unchanged', async () => {
      const a = job({
        id: '1',
        site: Site.GREENHOUSE,
        datePosted: '2026-01-01T00:00:00.000Z',
      });
      const out = await service.dedup([a]);
      expect(out.canonical[0].fields['datePosted'].value).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  it('merges near-duplicate descriptions across sources via MinHash', async () => {
    const desc =
      'We are hiring a Staff Backend Engineer to lead our distributed-systems team. ' +
      'You will design and operate Kubernetes-based platforms in production. ' +
      'Strong TypeScript / Go experience required, plus 7+ years of work on high-scale ' +
      'distributed services. We offer equity, a remote-friendly culture, and an ' +
      'engineering team that values mentorship and craft.';
    const tweaked = desc + ' Visa sponsorship available. Generous PTO.';

    // Different titles → Stage 1 (hash) cannot merge; Stage 2 (MinHash) must.
    const a = job({
      id: '1',
      title: 'Staff Backend Engineer',
      description: desc,
      site: Site.GREENHOUSE,
    });
    const b = job({
      id: '2',
      title: 'Senior Backend Engineer',
      description: tweaked,
      site: Site.LINKEDIN,
    });

    const out = await service.dedup([a, b]);
    expect(out.canonical).toHaveLength(1);
    expect(out.metrics.mergedPairs).toBe(1);
    expect(out.assignments[0]).toEqual(out.assignments[1]);
  });

  it('keeps unrelated long descriptions separate', async () => {
    const a = job({
      id: '1',
      title: 'Staff Backend Engineer',
      description:
        'Hiring a backend engineer experienced with distributed databases, ' +
        'event sourcing, and large-scale data pipelines.',
      site: Site.GREENHOUSE,
    });
    const b = job({
      id: '2',
      title: 'Lead UX Designer',
      description:
        'Hiring a UX lead to drive end-to-end design of mobile and web products. ' +
        'Strong Figma fluency, design-system stewardship, and user research required.',
      site: Site.LINKEDIN,
    });
    const out = await service.dedup([a, b]);
    expect(out.canonical).toHaveLength(2);
    expect(out.metrics.mergedPairs).toBe(0);
  });

  it('meets NFR-1 — 1 000 mostly-unique jobs dedup in under 250 ms', async () => {
    const inputs: JobPostDto[] = [];
    for (let i = 0; i < 1000; i++) {
      // Force a 5x duplication factor — 200 distinct logical jobs.
      const k = i % 200;
      inputs.push(
        job({
          id: String(i),
          title: `Engineer ${k}`,
          companyName: `Company ${k}`,
          jobUrl: `https://e.test/${i}`,
          site: i % 2 === 0 ? Site.GREENHOUSE : Site.LINKEDIN,
        }),
      );
    }
    const start = Date.now();
    const out = await service.dedup(inputs);
    const elapsed = Date.now() - start;

    expect(out.metrics.outputCount).toBe(200);
    expect(out.metrics.mergedPairs).toBe(800);
    expect(elapsed).toBeLessThan(250);
  });
});
