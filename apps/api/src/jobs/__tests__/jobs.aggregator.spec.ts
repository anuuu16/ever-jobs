import 'reflect-metadata';
import {
  DedupResult,
  IDedupEngine,
  JobPostDto,
  ScraperInputDto,
  Site,
} from '@ever-jobs/models';
import { JobsAggregator } from '../jobs.aggregator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(id: string, overrides: Partial<JobPostDto> = {}): JobPostDto {
  return new JobPostDto({
    id,
    title: overrides.title ?? `Job ${id}`,
    companyName: overrides.companyName ?? 'Acme Corp',
    jobUrl: overrides.jobUrl ?? `https://example.com/job/${id}`,
    site: overrides.site ?? Site.LINKEDIN,
    isRemote: overrides.isRemote ?? false,
    description: overrides.description,
    datePosted: overrides.datePosted,
  });
}

function makeJobsService(jobs: JobPostDto[] = []) {
  return { searchJobs: jest.fn().mockResolvedValue(jobs) } as any;
}

/**
 * Stub IDedupEngine that maps each input job to one of the supplied
 * cluster ids. `clusterAssignments` length must equal the input length.
 */
function makeStubEngine(clusterAssignments: (string | null)[]): IDedupEngine {
  return {
    dedup: jest.fn(async (jobs: ReadonlyArray<JobPostDto>) => {
      if (clusterAssignments.length !== jobs.length) {
        throw new Error('test stub: cluster assignments length mismatch');
      }
      const seen = new Set<string>();
      const canonical: any[] = [];
      for (const id of clusterAssignments) {
        if (id && !seen.has(id)) {
          seen.add(id);
          canonical.push({ canonicalJobId: id });
        }
      }
      const result: DedupResult = {
        canonical,
        assignments: clusterAssignments,
        errors: [],
        metrics: {
          inputCount: jobs.length,
          outputCount: canonical.length,
          mergedPairs: jobs.length - canonical.length,
          elapsedMs: 1,
        },
      };
      return result;
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('JobsAggregator', () => {
  describe('aggregateRaw — pass-through paths', () => {
    it('returns raw jobs unchanged when no engine is bound', async () => {
      const jobs = [makeJob('1'), makeJob('2')];
      const aggregator = new JobsAggregator(makeJobsService());

      const out = await aggregator.aggregateRaw(jobs);

      expect(out.jobs).toBe(jobs);
      expect(out.rawCount).toBe(2);
      expect(out.outputCount).toBe(2);
      expect(out.deduped).toBe(false);
      expect(out.dedupMetrics).toBeUndefined();
    });

    it('returns raw jobs unchanged when dedup=false even if engine is bound', async () => {
      const jobs = [makeJob('1'), makeJob('2')];
      const engine = makeStubEngine(['c1', 'c1']); // would merge if invoked
      const aggregator = new JobsAggregator(makeJobsService(), engine);

      const out = await aggregator.aggregateRaw(jobs, { dedup: false });

      expect(engine.dedup).not.toHaveBeenCalled();
      expect(out.jobs).toBe(jobs);
      expect(out.deduped).toBe(false);
    });

    it('handles empty raw lists without invoking the engine', async () => {
      const engine = makeStubEngine([]);
      const aggregator = new JobsAggregator(makeJobsService(), engine);

      const out = await aggregator.aggregateRaw([], { dedup: true });

      expect(engine.dedup).not.toHaveBeenCalled();
      expect(out.jobs).toEqual([]);
      expect(out.rawCount).toBe(0);
      expect(out.outputCount).toBe(0);
      expect(out.deduped).toBe(true);
      expect(out.dedupMetrics).toEqual({
        inputCount: 0,
        outputCount: 0,
        mergedPairs: 0,
        elapsedMs: 0,
      });
    });
  });

  describe('aggregateRaw — dedup paths', () => {
    it('collapses raw jobs into one representative per canonical cluster', async () => {
      // 3 jobs, all in the same cluster
      const jobs = [makeJob('1'), makeJob('2'), makeJob('3')];
      const engine = makeStubEngine(['c1', 'c1', 'c1']);
      const aggregator = new JobsAggregator(makeJobsService(), engine);

      const out = await aggregator.aggregateRaw(jobs, { dedup: true });

      expect(out.jobs).toHaveLength(1);
      expect(out.jobs[0].id).toBe('1'); // first input is the representative
      expect(out.rawCount).toBe(3);
      expect(out.outputCount).toBe(1);
      expect(out.deduped).toBe(true);
      expect(out.dedupMetrics).toMatchObject({ inputCount: 3, outputCount: 1, mergedPairs: 2 });
    });

    it('keeps insertion order of canonical clusters', async () => {
      // 4 jobs; clusters: a, b, a, b  → output should be [j0, j1] in that order
      const jobs = [
        makeJob('j0'),
        makeJob('j1'),
        makeJob('j2'),
        makeJob('j3'),
      ];
      const engine = makeStubEngine(['a', 'b', 'a', 'b']);
      const aggregator = new JobsAggregator(makeJobsService(), engine);

      const out = await aggregator.aggregateRaw(jobs, { dedup: true });

      expect(out.jobs.map((j) => j.id)).toEqual(['j0', 'j1']);
    });

    it('drops engine-rejected entries (assignments[i] === null)', async () => {
      const jobs = [makeJob('1'), makeJob('2'), makeJob('3')];
      const engine = makeStubEngine([null, 'c1', 'c2']);
      const aggregator = new JobsAggregator(makeJobsService(), engine);

      const out = await aggregator.aggregateRaw(jobs, { dedup: true });

      expect(out.jobs.map((j) => j.id)).toEqual(['2', '3']);
      expect(out.outputCount).toBe(2);
      expect(out.rawCount).toBe(3);
    });

    it('default dedup option is true when an engine is bound', async () => {
      const jobs = [makeJob('1'), makeJob('2')];
      const engine = makeStubEngine(['c1', 'c1']);
      const aggregator = new JobsAggregator(makeJobsService(), engine);

      const out = await aggregator.aggregateRaw(jobs);

      expect(engine.dedup).toHaveBeenCalled();
      expect(out.deduped).toBe(true);
      expect(out.outputCount).toBe(1);
    });
  });

  describe('aggregate (full pipeline)', () => {
    it('delegates fan-out to JobsService and then runs dedup', async () => {
      const fanned = [makeJob('1'), makeJob('2')];
      const jobsService = makeJobsService(fanned);
      const engine = makeStubEngine(['c1', 'c1']);
      const aggregator = new JobsAggregator(jobsService, engine);

      const out = await aggregator.aggregate(new ScraperInputDto({ searchTerm: 'node' }));

      expect(jobsService.searchJobs).toHaveBeenCalledTimes(1);
      expect(engine.dedup).toHaveBeenCalledWith(fanned);
      expect(out.outputCount).toBe(1);
      expect(out.deduped).toBe(true);
    });

    it('skips dedup when {dedup:false} even via aggregate()', async () => {
      const fanned = [makeJob('1'), makeJob('2')];
      const jobsService = makeJobsService(fanned);
      const engine = makeStubEngine(['c1', 'c1']);
      const aggregator = new JobsAggregator(jobsService, engine);

      const out = await aggregator.aggregate(
        new ScraperInputDto({ searchTerm: 'node' }),
        { dedup: false },
      );

      expect(engine.dedup).not.toHaveBeenCalled();
      expect(out.deduped).toBe(false);
      expect(out.jobs).toBe(fanned);
    });
  });
});
