# Performance Tuning

## Caching

- Enable caching to avoid redundant searches: `ENABLE_CACHE=true`
- Tune `CACHE_EXPIRY` based on freshness requirements (default: 3600s)
- Cache is in-memory — restarts clear it. Consider Redis for persistence.

## Concurrency

- Sources run concurrently via `Promise.allSettled` — all sources are queried in parallel
- Reduce `DEFAULT_RESULTS_WANTED` to lower per-source load
- Limit `DEFAULT_SITE_NAMES` to only the boards you need

## Logging

- Use `LOG_LEVEL=warn` or `LOG_LEVEL=error` in production to reduce I/O
- Use `LOG_LEVEL=debug` only for troubleshooting

## Rate Limiting

- Set `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_TIMEFRAME` based on traffic patterns
- Rate limiting adds minimal overhead (in-memory tracking)

## Node.js Tuning

- Increase `--max-old-space-size` for large result sets:
  ```bash
  NODE_OPTIONS="--max-old-space-size=4096" node dist/apps/api/main.js
  ```
- Use Node.js cluster mode or deploy multiple replicas behind a load balancer

## Docker

- Use multi-stage builds (already configured) to minimize image size
- Set appropriate resource limits in `docker-compose.yml`:
  ```yaml
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: "1.0"
  ```

## Monitoring

- Poll `/health` to track uptime and memory usage
- Use `X-Process-Time` response header to identify slow requests
- Use `X-Request-Id` to trace requests across logs

## Salary Parser

The `extractSalary()` helper in `@ever-jobs/common` (Spec 012)
recognises eight ISO 4217 currencies — `USD / EUR / GBP / CHF /
SEK / NOK / DKK / PLN` — with locale-aware decimal-separator
handling. Plugin authors normalise their `salaryString` text
through this helper to populate `JobPostDto.compensation`
fields the dedup engine (Spec 003) can partition on.

### Detection precedence (Spec 012 / § 7.2)

`parseSalaryCurrency(text, opts?)` walks five tiers, returning
the first hit. The `confidence` field on the result names which
tier fired — useful for downstream merge / dedup gating:

1. **Explicit ISO code** in the text (`'EUR'`, `'GBP'`, …) →
   `confidence: 'iso'`. Word-boundary match — `'EURO'` doesn't
   trigger.
2. **Unique symbol** (`€`, `£`, `zł`, `Fr.`) →
   `confidence: 'symbol'`.
3. **Ambiguous symbol** (`'kr'` for SEK / NOK / DKK) —
   disambiguated by `opts.country` when supplied; falls back
   to SEK without a hint (Q-025) → `confidence: 'symbol'`.
4. **Country fallback** — when no in-text signal but
   `opts.country` is set, use the country's primary currency
   (e.g. `Country.GERMANY` → EUR) → `confidence: 'country'`.
5. **Default** — `opts.defaultCode ?? 'USD'` →
   `confidence: 'default'`.

### Locale dispatch (Spec 012 / § 7.3)

`parseSalaryNumber(raw, locale)` routes the numeric parse via
two locale branches:

- **`'continental'`** — decimal `,`, thousands `.` or U+00A0.
  `'45.000'` → `45000`; `'1 234,56'` → `1234.56`.
- **`'anglo'`** — decimal `.`, thousands `,` or U+00A0.
  `'45,000.50'` → `45000.50`. Also tolerates Swiss
  apostrophe-thousands (`"90'000"` → `90000`) per FR-12.

`extractSalary()` resolves the locale via a four-tier cascade:
explicit `options.locale` → `pickLocale(options.country)` →
currency-natural-locale (USD/GBP/CHF → anglo; EUR/SEK/NOK/DKK/
PLN → continental) → `'anglo'` default. Without an explicit
hint, `'45.000 €'` parses correctly because EUR's natural
locale is continental.

### Example call patterns

```ts
import { extractSalary } from '@ever-jobs/common';
import { Country } from '@ever-jobs/models';

// Pre-Spec-012 USD path — unchanged
extractSalary('$100,000 - $150,000');
// → { interval: 'yearly', minAmount: 100000, maxAmount: 150000, currency: 'USD' }

// Continental EUR with country hint
extractSalary('45.000 € – 60.000 €', { country: Country.GERMANY });
// → { interval: 'yearly', minAmount: 45000, maxAmount: 60000, currency: 'EUR' }

// Nordic kr disambiguated by country
extractSalary('500.000 kr - 700.000 kr', { country: Country.DENMARK });
// → { interval: 'yearly', minAmount: 500000, maxAmount: 700000, currency: 'DKK' }

// Plugin-author shortcut: pass the country once and let the
// parser pick locale + currency together.
extractSalary(input.salaryString, { country: input.country });
```

### Performance budget (Spec 012 / § 6, NFR-1..NFR-5)

| ID    | Requirement                              | Target                                  |
| ----- | ---------------------------------------- | --------------------------------------- |
| NFR-1 | Parser latency (single call)             | ≤ 0.5 ms p95 on a 200-char input        |
| NFR-2 | No new external runtime deps             | 0 — pure regex + Map dispatch           |
| NFR-3 | Bundle-size delta (`@ever-jobs/common`)  | ≤ +2 KB minified                        |
| NFR-4 | Memory (per call)                        | ≤ 4 KB transient — no caches            |
| NFR-5 | Test-suite delta (`helpers.spec.ts`)     | ≥ +14 cases, all green; ≤ +50 ms total  |

The micro-bench in
`packages/common/__tests__/helpers.bench.spec.ts` runs 1 000
warm-up + 5 000 measurement iterations on a 200-character
input mix and writes `dist/bench/helpers-salary.json` with
overall + per-currency `p50 / p95 / p99`. CI asserts
`p95 < 2.0 ms` (4× headroom over NFR-1's 0.5 ms target — keeps
the gate insensitive to GitHub-Actions runner cold-starts).
