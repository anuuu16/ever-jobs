/**
 * Run `fn` over `items` with at most `concurrency` calls in flight at once,
 * settling every call the way `Promise.allSettled` would (one item's
 * rejection never aborts the rest). Results are returned in the same order
 * as `items`, regardless of completion order.
 *
 * Use this instead of `Promise.allSettled(items.map(fn))` whenever `items`
 * can be large and `fn` hits a rate-limited upstream (e.g. one HTTP call per
 * ATS company tenant) — unbounded fan-out there turns into a self-inflicted
 * 429 storm once the list grows past a handful of entries.
 */
export async function mapWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  const limit = Math.max(1, concurrency);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { status: 'fulfilled', value: await fn(items[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
