import { extractSalary, convertToAnnual, parseSalaryCurrency } from '@ever-jobs/common';
import { Country } from '@ever-jobs/models';

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
});
