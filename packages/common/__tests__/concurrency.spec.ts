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
});
