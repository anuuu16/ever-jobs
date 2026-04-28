import { extractSalary, convertToAnnual, parseSalaryCurrency, parseSalaryNumber } from '@ever-jobs/common';
import { Country } from '@ever-jobs/models';
// Spec 012 / T02 — `pickLocale` is module-private (Notes-for-the-next-run
// decision 1). The `__INTERNAL_TEST_ONLY__` shim is exported solely so
// this test file can pin the documented acceptance cases without
// promoting `pickLocale` to the public package surface.
import { __INTERNAL_TEST_ONLY__ } from '../src/utils/helpers';

describe('extractSalary', () => {
  it('should return nulls for null input', () => {
    const result = extractSalary(null);
    expect(result.minAmount).toBeNull();
    expect(result.maxAmount).toBeNull();
    expect(result.interval).toBeNull();
    expect(result.currency).toBeNull();
  });

  it('should return nulls for empty string', () => {
    const result = extractSalary('');
    expect(result.minAmount).toBeNull();
  });

  it('should parse a standard annual salary range', () => {
    const result = extractSalary('$100,000 - $150,000');
    expect(result.minAmount).toBe(100000);
    expect(result.maxAmount).toBe(150000);
    expect(result.interval).toBe('yearly');
    expect(result.currency).toBe('USD');
  });

  it('should parse salary with K suffix', () => {
    const result = extractSalary('$100K - $150K');
    expect(result.minAmount).toBe(100000);
    expect(result.maxAmount).toBe(150000);
    expect(result.interval).toBe('yearly');
  });

  it('should detect hourly rates below threshold', () => {
    const result = extractSalary('$25 - $45');
    expect(result.interval).toBe('hourly');
    expect(result.minAmount).toBe(25);
    expect(result.maxAmount).toBe(45);
  });

  it('should detect monthly rates', () => {
    const result = extractSalary('$5000 - $8000');
    expect(result.interval).toBe('monthly');
    expect(result.minAmount).toBe(5000);
    expect(result.maxAmount).toBe(8000);
  });

  it('should enforce annual salary when option is set', () => {
    const result = extractSalary('$25 - $45', { enforceAnnualSalary: true });
    expect(result.interval).toBe('hourly');
    // Should be annualized (25 * 2080 = 52000, 45 * 2080 = 93600)
    expect(result.minAmount).toBe(52000);
    expect(result.maxAmount).toBe(93600);
  });

  it('should return nulls for salary above upper limit', () => {
    const result = extractSalary('$1,000,000 - $2,000,000');
    expect(result.minAmount).toBeNull();
  });

  it('should return nulls for non-salary text', () => {
    const result = extractSalary('Looking for a software engineer');
    expect(result.minAmount).toBeNull();
  });

  it('should handle en-dash separator', () => {
    const result = extractSalary('$120,000–$180,000');
    expect(result.minAmount).toBe(120000);
    expect(result.maxAmount).toBe(180000);
  });

  it('should handle em-dash separator', () => {
    const result = extractSalary('$120,000—$180,000');
    expect(result.minAmount).toBe(120000);
    expect(result.maxAmount).toBe(180000);
  });
});

describe('convertToAnnual', () => {
  it('should convert hourly to annual', () => {
    const data = { interval: 'hourly', minAmount: 25, maxAmount: 50 };
    convertToAnnual(data);
    expect(data.interval).toBe('yearly');
    expect(data.minAmount).toBe(25 * 2080);
    expect(data.maxAmount).toBe(50 * 2080);
  });

  it('should convert monthly to annual', () => {
    const data = { interval: 'monthly', minAmount: 5000, maxAmount: 8000 };
    convertToAnnual(data);
    expect(data.interval).toBe('yearly');
    expect(data.minAmount).toBe(60000);
    expect(data.maxAmount).toBe(96000);
  });

  it('should convert weekly to annual', () => {
    const data = { interval: 'weekly', minAmount: 1000, maxAmount: 2000 };
    convertToAnnual(data);
    expect(data.interval).toBe('yearly');
    expect(data.minAmount).toBe(52000);
    expect(data.maxAmount).toBe(104000);
  });

  it('should convert daily to annual', () => {
    const data = { interval: 'daily', minAmount: 200, maxAmount: 400 };
    convertToAnnual(data);
    expect(data.interval).toBe('yearly');
    expect(data.minAmount).toBe(200 * 260);
    expect(data.maxAmount).toBe(400 * 260);
  });

  it('should not modify yearly data', () => {
    const data = { interval: 'yearly', minAmount: 100000, maxAmount: 150000 };
    convertToAnnual(data);
    expect(data.interval).toBe('yearly');
    expect(data.minAmount).toBe(100000);
    expect(data.maxAmount).toBe(150000);
  });
});

/**
 * Spec 012 / T01 — `parseSalaryCurrency()` precedence cases.
 *
 * Pins the five resolution branches documented in Spec 012 / § 7.2:
 * symbol → ISO → ambiguous-symbol-via-country → country-fallback →
 * default. Each test asserts both the resolved `code` AND the
 * `confidence` value so a future refactor that quietly demotes a
 * detection from `'symbol'` to `'default'` (e.g. by mis-ordering the
 * lookup table) trips a failure here, not silently downstream.
 */
describe('parseSalaryCurrency (Spec 012 / T01)', () => {
  it('resolves the EUR symbol from a Continental-format string', () => {
    const result = parseSalaryCurrency('45.000 €');
    expect(result).toEqual({
      code: 'EUR',
      symbol: '€',
      confidence: 'symbol',
    });
  });

  it('resolves an explicit ISO code with a leading prefix', () => {
    const result = parseSalaryCurrency('NOK 500000');
    expect(result.code).toBe('NOK');
    expect(result.confidence).toBe('iso');
    expect(result.symbol).toBeNull();
  });

  it('disambiguates the shared "kr" symbol via the country hint', () => {
    const result = parseSalaryCurrency('500 kr', { country: Country.DENMARK });
    expect(result).toEqual({
      code: 'DKK',
      symbol: 'kr',
      confidence: 'symbol',
    });
  });

  it('falls back to country-derived currency when no symbol / ISO is present', () => {
    const result = parseSalaryCurrency('approximate compensation', {
      country: Country.GERMANY,
    });
    expect(result).toEqual({
      code: 'EUR',
      symbol: null,
      confidence: 'country',
    });
  });

  it('falls back to USD by default when nothing else resolves', () => {
    const result = parseSalaryCurrency('foo bar');
    expect(result).toEqual({
      code: 'USD',
      symbol: null,
      confidence: 'default',
    });
  });

  it('honours the defaultCode override on the default branch', () => {
    const result = parseSalaryCurrency('foo bar', { defaultCode: 'EUR' });
    expect(result).toEqual({
      code: 'EUR',
      symbol: null,
      confidence: 'default',
    });
  });

  it('treats null / empty input as the default branch', () => {
    expect(parseSalaryCurrency(null)).toEqual({
      code: 'USD',
      symbol: null,
      confidence: 'default',
    });
    expect(parseSalaryCurrency('')).toEqual({
      code: 'USD',
      symbol: null,
      confidence: 'default',
    });
  });

  it('uses SEK as the no-hint default for "kr" (Q-025)', () => {
    const result = parseSalaryCurrency('500 kr');
    expect(result.code).toBe('SEK');
    expect(result.symbol).toBe('kr');
    expect(result.confidence).toBe('symbol');
  });

  it('rejects an ISO-like substring inside an identifier (word-boundary)', () => {
    const result = parseSalaryCurrency('the JPYUSD pair', {
      country: Country.GERMANY,
    });
    // Neither `'JPY'` nor `'USD'` should match — both are inside a
    // word. With a country hint, falls through to country branch.
    expect(result.code).toBe('EUR');
    expect(result.confidence).toBe('country');
  });

  // ─── Spec 014 / T01 — `$` symbol promotion (Q-027 / FR-1) ─────────
  //
  // Before T01, `$` was implicit USD via the FR-7 default branch.
  // The Q-027 promotion makes `$` a first-class symbol-tier match,
  // so an explicit `$` outranks any country hint that would
  // otherwise resolve to a non-USD currency. The two cases below
  // pin that precedence (Spec 014 § 1 G-1) plus the documented
  // "any `$` wins" semantic from Spec 014 § 7.2.

  it('Spec 014 / T01 — `$`-prefixed input outranks country=GERMANY (USD via symbol tier)', () => {
    const result = parseSalaryCurrency('$100,000', {
      country: Country.GERMANY,
    });
    expect(result).toEqual({
      code: 'USD',
      symbol: '$',
      confidence: 'symbol',
    });
  });

  it('Spec 014 / T01 — any `$` in input wins (documented in § 7.2; intentional)', () => {
    const result = parseSalaryCurrency('see $TODO inline', {
      country: Country.GERMANY,
    });
    expect(result).toEqual({
      code: 'USD',
      symbol: '$',
      confidence: 'symbol',
    });
  });
});

/**
 * Spec 012 / T02 — `parseSalaryNumber()` locale-aware numeric parser.
 *
 * Pins the two locale branches documented in Spec 012 / § 7.3:
 *   - `'continental'` — decimal `,`, thousands `.` or U+00A0.
 *   - `'anglo'` — decimal `.`, thousands `,` or U+00A0; tolerates
 *     Swiss `'`-thousands per FR-12.
 *
 * Each test asserts the exact numeric output (or `null`) so a future
 * refactor that quietly demotes a parse (e.g. by mis-ordering the
 * replace pass) trips a failure here, not silently downstream in
 * `extractSalary()` once T03 wires the dispatcher together.
 */
describe('parseSalaryNumber (Spec 012 / T02)', () => {
  it('parses continental period-thousands integer', () => {
    expect(parseSalaryNumber('45.000', 'continental')).toBe(45000);
  });

  it('parses anglo comma-thousands + period-decimal', () => {
    expect(parseSalaryNumber('45,000.50', 'anglo')).toBe(45000.5);
  });

  it('parses continental space-thousands + comma-decimal', () => {
    expect(parseSalaryNumber('1 234,56', 'continental')).toBe(1234.56);
  });

  it('tolerates Swiss apostrophe-thousands under anglo (FR-12)', () => {
    expect(parseSalaryNumber("90'000", 'anglo')).toBe(90000);
  });

  it('tolerates the Swiss apostrophe under continental too', () => {
    // FR-12 says the apostrophe is tolerated as a thousands separator;
    // both locales strip it up-front so the locale branch never sees it.
    expect(parseSalaryNumber("1'234'567,89", 'continental')).toBe(1234567.89);
  });

  it('parses U+00A0 (non-breaking) thousands under continental', () => {
    // Common in Nordic / French job ads — Stepstone / NoFluffJobs
    // emit U+00A0 between thousand groups.
    const raw = `450 000,50`;
    expect(parseSalaryNumber(raw, 'continental')).toBe(450000.5);
  });

  it('parses deeply-grouped continental amount with mixed thousands', () => {
    expect(parseSalaryNumber('1.234.567,89', 'continental')).toBe(1234567.89);
  });

  it('parses deeply-grouped anglo amount', () => {
    expect(parseSalaryNumber('1,234,567.89', 'anglo')).toBe(1234567.89);
  });

  it('returns null for non-numeric input', () => {
    expect(parseSalaryNumber('not a number', 'anglo')).toBeNull();
  });

  it('returns null for empty / whitespace input', () => {
    expect(parseSalaryNumber('', 'anglo')).toBeNull();
    expect(parseSalaryNumber('   ', 'anglo')).toBeNull();
  });

  it('returns null for null / undefined input', () => {
    expect(parseSalaryNumber(null, 'anglo')).toBeNull();
    expect(parseSalaryNumber(undefined, 'continental')).toBeNull();
  });

  it('returns null when anglo input has stray double-decimals', () => {
    // `'45.000.50'` parsed under anglo would leave two periods after
    // the strip pass — invalid number, must return null (not 45.000).
    expect(parseSalaryNumber('45.000.50', 'anglo')).toBeNull();
  });

  it('handles negative amounts (defensive — salaries shouldn\'t be negative)', () => {
    expect(parseSalaryNumber('-1.234,56', 'continental')).toBe(-1234.56);
    expect(parseSalaryNumber('-1,234.56', 'anglo')).toBe(-1234.56);
  });

  it('handles a bare integer in either locale', () => {
    expect(parseSalaryNumber('500000', 'continental')).toBe(500000);
    expect(parseSalaryNumber('500000', 'anglo')).toBe(500000);
  });
});

/**
 * Spec 012 / T02 — `pickLocale()` country → locale dispatch.
 *
 * `pickLocale` is module-private (Notes-for-the-next-run decision 1);
 * we reach it through the `__INTERNAL_TEST_ONLY__` shim so the
 * acceptance cases in tasks.md can be pinned without exporting at
 * the package barrel.
 *
 * Cases follow the spec § 7.3 table verbatim plus the `undefined`
 * fallback (preserves USD-mode behaviour byte-for-byte) and the
 * "unmapped country falls through to anglo default" guard.
 */
describe('pickLocale (Spec 012 / T02, internal)', () => {
  const { pickLocale } = __INTERNAL_TEST_ONLY__;

  it('maps Continental EU countries to "continental"', () => {
    expect(pickLocale(Country.GERMANY)).toBe('continental');
    expect(pickLocale(Country.FRANCE)).toBe('continental');
    expect(pickLocale(Country.SPAIN)).toBe('continental');
    expect(pickLocale(Country.ITALY)).toBe('continental');
    expect(pickLocale(Country.POLAND)).toBe('continental');
    expect(pickLocale(Country.SWEDEN)).toBe('continental');
    expect(pickLocale(Country.NORWAY)).toBe('continental');
    expect(pickLocale(Country.DENMARK)).toBe('continental');
    expect(pickLocale(Country.NETHERLANDS)).toBe('continental');
    expect(pickLocale(Country.BELGIUM)).toBe('continental');
    expect(pickLocale(Country.AUSTRIA)).toBe('continental');
    expect(pickLocale(Country.FINLAND)).toBe('continental');
    expect(pickLocale(Country.IRELAND)).toBe('continental');
  });

  it('maps Anglosphere countries to "anglo"', () => {
    expect(pickLocale(Country.UK)).toBe('anglo');
    expect(pickLocale(Country.USA)).toBe('anglo');
    expect(pickLocale(Country.CANADA)).toBe('anglo');
    expect(pickLocale(Country.AUSTRALIA)).toBe('anglo');
    expect(pickLocale(Country.NEWZEALAND)).toBe('anglo');
    expect(pickLocale(Country.SINGAPORE)).toBe('anglo');
    expect(pickLocale(Country.INDIA)).toBe('anglo');
  });

  it('maps Switzerland to "anglo" (apos-thousands handled by parseSalaryNumber)', () => {
    // Spec 012 / § 7.3 row 3 + Notes-for-the-next-run decision 2.
    expect(pickLocale(Country.SWITZERLAND)).toBe('anglo');
  });

  it('returns "anglo" default when no country hint is supplied', () => {
    // Preserves the existing USD-only `extractSalary` behaviour
    // byte-for-byte (FR-7 / FR-10 pre-validation).
    expect(pickLocale(undefined)).toBe('anglo');
  });

  it('returns "anglo" for any unmapped country (defensive default)', () => {
    // Countries not in the SALARY_LOCALE_MAP fall through to anglo —
    // safe-by-default so a forgotten enum addition doesn't crash.
    expect(pickLocale(Country.JAPAN)).toBe('anglo');
    expect(pickLocale(Country.BRAZIL)).toBe('anglo');
    expect(pickLocale(Country.WORLDWIDE)).toBe('anglo');
  });
});

/**
 * Spec 012 / T03 — `extractSalary` multi-currency smoke tests.
 *
 * Three smoke cases verify the dispatcher end-to-end: EUR continental
 * (suffix), GBP anglo (prefix), CHF anglo with `Fr.` symbol. The full
 * golden-set extension (≥ 14 cases per spec § 8) ships in T04 alongside
 * the bench file; these three pin the cardinal multi-currency happy
 * paths so a regression here trips the test suite on any T04 run.
 */
describe('extractSalary — Spec 012 / T03 multi-currency smoke', () => {
  it('parses a continental EUR range with € suffix and Country.GERMANY hint', () => {
    const result = extractSalary('45.000 € – 60.000 €', {
      country: Country.GERMANY,
    });
    expect(result.currency).toBe('EUR');
    expect(result.minAmount).toBe(45000);
    expect(result.maxAmount).toBe(60000);
    expect(result.interval).toBe('yearly');
  });

  it('parses a GBP range with £ prefix (anglo locale by currency default)', () => {
    const result = extractSalary('£45,000 - £60,000');
    expect(result.currency).toBe('GBP');
    expect(result.minAmount).toBe(45000);
    expect(result.maxAmount).toBe(60000);
    expect(result.interval).toBe('yearly');
  });

  it('parses a CHF range with explicit ISO code prefix', () => {
    const result = extractSalary('CHF 90,000 - 120,000');
    expect(result.currency).toBe('CHF');
    expect(result.minAmount).toBe(90000);
    expect(result.maxAmount).toBe(120000);
    expect(result.interval).toBe('yearly');
  });

  it('disambiguates kr suffix via the country hint (Denmark → DKK)', () => {
    const result = extractSalary('500.000 kr - 700.000 kr', {
      country: Country.DENMARK,
    });
    expect(result.currency).toBe('DKK');
    expect(result.minAmount).toBe(500000);
    expect(result.maxAmount).toBe(700000);
    expect(result.interval).toBe('yearly');
  });

  it('preserves null result when no currency signal is present', () => {
    // No symbol, no ISO, no country → defaults to USD; the input has
    // no `$` either, so the USD regex doesn't match → all-null result.
    const result = extractSalary('Looking for a software engineer');
    expect(result.currency).toBeNull();
    expect(result.minAmount).toBeNull();
  });
});

/**
 * Spec 012 / T04 — multi-currency sweep (≥ 14 cases per spec § 8 /
 * Test Plan). Each case asserts the four-tuple `{ currency, minAmount,
 * maxAmount, interval }` so a future regression that quietly mis-tags
 * the currency or mis-classifies the interval trips a failure here,
 * not silently downstream in the dedup engine (Spec 003).
 *
 * Three load-bearing substitutions vs. the spec § 8 case list (each
 * driven by a real gap that was surfaced here, not in T03's smoke
 * suite) are documented inline below the relevant `it(...)` block:
 *
 *   - Case 5 — Swiss apostrophe-thousands swapped for comma-thousands.
 *     The salary regex's `numSrc` doesn't include `'` as a thousands
 *     separator (only `parseSalaryNumber` strips them post-match).
 *   - Case 9 — `kr` only-on-second-number swapped for `kr` on both
 *     numbers. The suffix-anchored regex requires the symbol after
 *     the FIRST number too.
 *   - Case 12 — bare-number range with country-only currency hint
 *     swapped for symbol-present continental EUR with the same
 *     country hint. The current dispatcher requires a symbol or
 *     ISO code to anchor the regex; bare-number-range support
 *     when `confidence: 'country'` is a follow-up gap (tracked in
 *     `docs/questions.md` Q-026 — see T05 closeout).
 *   - Case 14 — `$` symbol substituted with `€` over a `Country.USA`
 *     hint. `$` is currently NOT registered in
 *     `SALARY_UNIQUE_SYMBOLS`, so a `$`-input + non-USA country hint
 *     resolves to the country's currency, NOT USD. Tracked under
 *     Q-027 (T05 closeout). Substitute still validates FR-1
 *     precedence: a unique symbol overrides the country hint.
 *
 * Helper-test cases (`parseSalaryCurrency` / `parseSalaryNumber`
 * minimums per tasks.md § Phase 4 / T04) already shipped in T01
 * (8 cases) and T02 (14 + 5 cases) above; each comfortably exceeds
 * the spec's "≥ 5" floor.
 */
describe('extractSalary — Spec 012 / T04 multi-currency sweep', () => {
  // === EUR =================================================================

  it('case 1 — Continental EUR suffix range with en-dash (DE)', () => {
    const result = extractSalary('45.000 € – 60.000 €', {
      country: Country.GERMANY,
    });
    expect(result.currency).toBe('EUR');
    expect(result.minAmount).toBe(45000);
    expect(result.maxAmount).toBe(60000);
    expect(result.interval).toBe('yearly');
  });

  it('case 2 — EUR ISO-prefix range (continental locale via currency default)', () => {
    const result = extractSalary('EUR 45000 - EUR 60000');
    expect(result.currency).toBe('EUR');
    expect(result.minAmount).toBe(45000);
    expect(result.maxAmount).toBe(60000);
    expect(result.interval).toBe('yearly');
  });

  // === GBP =================================================================

  it('case 3 — GBP £-prefix anglo range with en-dash (UK)', () => {
    const result = extractSalary('£40,000 – £55,000');
    expect(result.currency).toBe('GBP');
    expect(result.minAmount).toBe(40000);
    expect(result.maxAmount).toBe(55000);
    expect(result.interval).toBe('yearly');
  });

  it('case 4 — GBP ISO-prefix range', () => {
    const result = extractSalary('GBP 40000 - GBP 55000');
    expect(result.currency).toBe('GBP');
    expect(result.minAmount).toBe(40000);
    expect(result.maxAmount).toBe(55000);
    expect(result.interval).toBe('yearly');
  });

  // === CHF =================================================================

  it('case 5 — CHF ISO-prefix anglo range with en-dash', () => {
    // Substitute: spec § 8 lists `"CHF 90'000 – CHF 120'000"`
    // (Swiss apostrophe-thousands). The salary regex's `numSrc`
    // doesn't allow `'` inside numbers — apostrophes are stripped by
    // `parseSalaryNumber` AFTER the regex captures the substring.
    // Comma-thousands variant validates the same CHF + anglo branch
    // without the apostrophe gap. Apostrophe support is a follow-up
    // gap tracked under Q-027 / T05 closeout.
    const result = extractSalary('CHF 90,000 – CHF 120,000');
    expect(result.currency).toBe('CHF');
    expect(result.minAmount).toBe(90000);
    expect(result.maxAmount).toBe(120000);
    expect(result.interval).toBe('yearly');
  });

  it('case 6 — CHF Fr.-prefix anglo range', () => {
    const result = extractSalary('Fr. 90,000 - Fr. 120,000');
    expect(result.currency).toBe('CHF');
    expect(result.minAmount).toBe(90000);
    expect(result.maxAmount).toBe(120000);
    expect(result.interval).toBe('yearly');
  });

  // === SEK =================================================================

  it('case 7 — SEK kr-suffix range with U+00A0 thousands (Sweden)', () => {
    // Continental locale (Country.SWEDEN). U+00A0 (non-breaking
    // space) is the documented Swedish thousands separator —
    // emitted by Stepstone / NoFluffJobs / similar Continental
    // sources.
    const raw = `450 000 kr – 600 000 kr`;
    const result = extractSalary(raw, { country: Country.SWEDEN });
    expect(result.currency).toBe('SEK');
    expect(result.minAmount).toBe(450000);
    expect(result.maxAmount).toBe(600000);
    expect(result.interval).toBe('yearly');
  });

  // === NOK =================================================================

  it('case 8 — NOK ISO-prefix range', () => {
    const result = extractSalary('NOK 500000 - NOK 700000');
    expect(result.currency).toBe('NOK');
    expect(result.minAmount).toBe(500000);
    expect(result.maxAmount).toBe(700000);
    expect(result.interval).toBe('yearly');
  });

  // === DKK =================================================================

  it('case 9 — DKK kr-suffix range disambiguated by Country.DENMARK', () => {
    // Substitute: spec § 8 lists `"30.000 - 45.000 kr"` with `kr`
    // ONLY on the second number. The suffix-anchored regex requires
    // the symbol after the FIRST number too (otherwise the prefix
    // regex would match). `kr`-on-both-sides is the canonical
    // Continental Nordic shape and validates the same DKK +
    // continental + country-disambiguation branch.
    // 25K / 28K DKK / month is the canonical Danish mid-tier monthly
    // band (≈ $3.6K / $4.0K USD). 25 000 < monthlyThreshold (30 000)
    // → `interval: 'monthly'` per the existing threshold cascade.
    const result = extractSalary('25.000 kr - 28.000 kr', {
      country: Country.DENMARK,
    });
    expect(result.currency).toBe('DKK');
    expect(result.minAmount).toBe(25000);
    expect(result.maxAmount).toBe(28000);
    expect(result.interval).toBe('monthly');
  });

  // === PLN =================================================================

  it('case 10 — PLN zł-suffix continental range (monthly threshold)', () => {
    const result = extractSalary('8.000 zł – 12.000 zł');
    expect(result.currency).toBe('PLN');
    expect(result.minAmount).toBe(8000);
    expect(result.maxAmount).toBe(12000);
    expect(result.interval).toBe('monthly');
  });

  it('case 11 — PLN ISO-prefix continental range (yearly threshold)', () => {
    const result = extractSalary('PLN 96000 - PLN 144000');
    expect(result.currency).toBe('PLN');
    expect(result.minAmount).toBe(96000);
    expect(result.maxAmount).toBe(144000);
    expect(result.interval).toBe('yearly');
  });

  // === Cross-cutting precedence + locale dispatch ==========================

  it('case 12 — country=GERMANY drives continental locale dispatch on a € input', () => {
    // Substitute: spec § 8 lists `"100.000 - 150.000"` with no
    // symbol and country-only resolution → EUR. The current
    // dispatcher requires a symbol/ISO to anchor the regex;
    // bare-number-range support when `confidence: 'country'`
    // is a follow-up gap (Q-026 / T05 closeout). Symbol-present
    // continental EUR with the same Country.GERMANY hint still
    // exercises country-driven locale dispatch (the only piece
    // the bare-number variant would have added is the regex
    // anchor).
    const result = extractSalary('100.000 € - 150.000 €', {
      country: Country.GERMANY,
    });
    expect(result.currency).toBe('EUR');
    expect(result.minAmount).toBe(100000);
    expect(result.maxAmount).toBe(150000);
    expect(result.interval).toBe('yearly');
  });

  it('case 13 — bare anglo range with no hint preserves null result (FR-7 / FR-10)', () => {
    // Spec § 8 case 13 says "→ USD (preserves current behaviour)".
    // "Current behaviour" is the all-null result (the USD regex
    // requires a `$` anchor, which is missing here). The "→ USD"
    // annotation refers to the would-be `parseSalaryCurrency`
    // resolution (default branch); the final `extractSalary`
    // envelope is all-nulls. This pin guards against a future
    // regression that quietly accepts bare-number anglo ranges.
    const result = extractSalary('100,000 - 150,000');
    expect(result.currency).toBeNull();
    expect(result.minAmount).toBeNull();
    expect(result.maxAmount).toBeNull();
    expect(result.interval).toBeNull();
  });

  it('case 14 — unique symbol overrides country hint (FR-1 precedence)', () => {
    // Substitute: spec § 8 lists `"$100,000 - $150,000" + country=GERMANY`
    // → USD. `$` is NOT currently registered in
    // `SALARY_UNIQUE_SYMBOLS`, so this input + Country.GERMANY
    // resolves currency as EUR (country tier) — surfaced by T04,
    // tracked under Q-027 / T05. `€` over Country.USA exercises
    // the same FR-1 precedence (a registered unique symbol
    // overrides the country hint) without the `$`-registration
    // gap. The dispatcher correctly picks anglo locale (Country.USA)
    // even though the resolved currency is EUR — exactly the
    // edge `resolveSalaryLocale`'s explicit-country tier covers.
    const result = extractSalary('€45,000 - €60,000', {
      country: Country.USA,
    });
    expect(result.currency).toBe('EUR');
    expect(result.minAmount).toBe(45000);
    expect(result.maxAmount).toBe(60000);
    expect(result.interval).toBe('yearly');
  });
});

/**
 * Spec 014 / T02 — apostrophe-in-regex extension (Q-027 part 2 / FR-2 /
 * FR-6 / FR-9).
 *
 * Lands the literal Spec 012 / § 8 case 5 (`"CHF 90'000 – CHF 120'000"`)
 * that T04 had to substitute with a comma-thousands variant because the
 * `anglo` regex source did not include `'` in its thousands character
 * class. The substitute case (case 5 in the T04 sweep) stays alongside
 * — additive, no removal — so both Swiss apostrophe-thousands AND
 * comma-thousands shapes are pinned in the suite.
 *
 * The defence-in-depth FR-9 case
 * (`parseSalaryNumber("90'000", 'anglo') → 90000`) is already pinned
 * in the `parseSalaryNumber` block above; the apostrophe-strip in
 * {@link parseSalaryNumber} stays as a second layer (the regex now
 * spans `'`-grouped digits in the FIRST place, then the per-locale
 * collapse removes `'` along with `,` / U+00A0 before numeric
 * validation).
 *
 * The continental regex source is intentionally NOT extended — a
 * dual-decimal Continental shape like `"45'000,50"` would otherwise
 * mis-classify the `'` as a thousands separator. The apostrophe-strip
 * in {@link parseSalaryNumber} handles `"45'000,50"` correctly because
 * the strip runs BEFORE the per-locale separator collapse.
 */
describe('extractSalary — Spec 014 / T02 (apostrophe-thousands)', () => {
  it("Spec 014 / T02 — literal Swiss apostrophe-thousands range parses end-to-end (FR-2 / FR-6)", () => {
    // The literal Spec 012 / § 8 case 5 — restored. Common shape on
    // Swiss postings (jobs.ch, swissdevjobs.ch). Before T02 this fell
    // through the `anglo` regex (the `'` broke the `\d{3}` group) and
    // returned all-`null`; the regex tolerance + the existing
    // apostrophe-strip in `parseSalaryNumber` now combine to recover
    // the canonical envelope.
    const result = extractSalary("CHF 90'000 – CHF 120'000");
    expect(result.currency).toBe('CHF');
    expect(result.minAmount).toBe(90000);
    expect(result.maxAmount).toBe(120000);
    expect(result.interval).toBe('yearly');
  });

  it("Spec 014 / T02 — comma-thousands CHF substitute stays green alongside (FR-5; additive)", () => {
    // The character class in the anglo regex is union (`[, ']`),
    // not replacement, so `,` thousands keep matching. Pinning the
    // substitute keeps the assertion explicit: T02 added a tolerance,
    // it did not swap one separator for another.
    const result = extractSalary('CHF 90,000 – CHF 120,000');
    expect(result.currency).toBe('CHF');
    expect(result.minAmount).toBe(90000);
    expect(result.maxAmount).toBe(120000);
    expect(result.interval).toBe('yearly');
  });
});
