import { mapWithConcurrency } from '../src';

describe('mapWithConcurrency', () => {
  it('resolves every item in input order and reports the peak concurrency observed', async () => {
    const items = [1, 2, 3, 4, 5, 6];
    let inFlight = 0;
    let peak = 0;

    const results = await mapWithConcurrency(items, 2, async (item) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight--;
      return item * 10;
    });

    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([
      10, 20, 30, 40, 50, 60,
    ]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('settles a rejection without aborting the rest of the batch', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (item) => {
      if (item === 2) throw new Error(`boom ${item}`);
      return item;
    });

    expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
    expect(results[1].status).toBe('rejected');
    expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
  });

  it('paces consecutive calls per worker by delayMs, but not after the last item', async () => {
    const timestamps: number[] = [];

    await mapWithConcurrency(
      [1, 2, 3],
      1, // single worker — delays are easy to assert in strict sequence
      async (item) => {
        timestamps.push(Date.now());
        return item;
      },
      30,
    );

    expect(timestamps).toHaveLength(3);
    expect(timestamps[1] - timestamps[0]).toBeGreaterThanOrEqual(25);
    expect(timestamps[2] - timestamps[1]).toBeGreaterThanOrEqual(25);
  });

  it('defaults delayMs to 0 (no pacing) when omitted', async () => {
    const start = Date.now();
    await mapWithConcurrency([1, 2, 3], 1, async (item) => item);
    expect(Date.now() - start).toBeLessThan(25);
  });

  it('does not delay after the last item is claimed, even mid-batch for a fast worker', async () => {
    // Two workers, delayMs set high enough that a trailing delay would blow
    // well past this test's own timeout if the "skip after last item" guard
    // were broken.
    const start = Date.now();
    await mapWithConcurrency([1, 2], 2, async (item) => item, 5000);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
