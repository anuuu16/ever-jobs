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
 *
 * `delayMs` (default 0 — off) adds a pause after each call before a worker
 * picks its next item, on top of the `concurrency` cap. Concurrency alone
 * only bounds how many calls are in flight at once; many ATS tenants of the
 * same platform share upstream infra (CDN/WAF) that rate-limits across
 * tenants, so pacing consecutive calls per worker cuts 429s further than
 * lowering concurrency alone without serializing the whole batch. Not
 * applied after the last item overall (no more calls left to pace).
 */
export async function mapWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  delayMs = 0,
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
      if (delayMs > 0 && cursor < items.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
