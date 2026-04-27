import {
  CompensationInterval,
  Country,
  JobType,
  getJobTypeFromString,
} from '@ever-jobs/models';

/**
 * Locale dispatch for the Spec 012 salary parser.
 *
 * - `'continental'` — decimal-comma + period-thousands (e.g. `45.000,50`)
 *   used across the Continental EU corpus (DE / FR / ES / IT / NL / PL etc.).
 * - `'anglo'` — decimal-period + comma-thousands (e.g. `45,000.50`)
 *   used across UK / USA / Canada / Australia / NZ etc. The same family
 *   covers Switzerland (with apostrophe-thousands tolerance per FR-12).
 *
 * Spec 012 / § 7.3 documents the full country → locale mapping.
 */
export type SalaryLocale = 'continental' | 'anglo';

/**
 * Result shape returned by {@link parseSalaryCurrency}.
 *
 *   - `code` — ISO 4217 string (`'USD' | 'EUR' | 'GBP' | 'CHF' | 'SEK' |
 *     'NOK' | 'DKK' | 'PLN'`); never null per FR-13.
 *   - `symbol` — the raw character (or short string) detected in the
 *     input that drove the resolution (`'€' | '£' | 'zł' | 'kr' | 'Fr.'`).
 *     `null` when the resolution path was ISO / country / default.
 *   - `confidence` — which detection branch fired:
 *     `'symbol' | 'iso' | 'country' | 'default'`. Roughly equates to
 *     "how strong a signal drove the resolution"; consumers can use it
 *     to gate downstream merge / dedup decisions.
 */
export interface ParseSalaryCurrencyResult {
  readonly code: string;
  readonly symbol: string | null;
  readonly confidence: 'symbol' | 'iso' | 'country' | 'default';
}

/**
 * Spec 012 / § 7.2 — explicit ISO 4217 codes the parser recognises in
 * input text. Order matters here: longer / more specific codes do NOT
 * exist in this set, but a future contributor adding (say) `MXN`
 * should know that the lookup is exact-match against an upper-cased
 * input slice. Map values are the canonical ISO codes returned in
 * {@link ParseSalaryCurrencyResult.code}.
 *
 * Listed alphabetically inside the Map so a `git diff` against a
 * future addition reads cleanly.
 */
const SALARY_ISO_CODES: ReadonlyArray<string> = [
  'CHF', 'DKK', 'EUR', 'GBP', 'NOK', 'PLN', 'SEK', 'USD',
];

/**
 * Spec 012 / § 7.2 — symbol → ISO 4217 lookup. Each entry is
 * unambiguous; the ambiguous shared `'kr'` symbol (SEK / NOK / DKK)
 * lives in {@link SALARY_AMBIGUOUS_SYMBOLS} instead so it can be
 * disambiguated by the country hint.
 *
 * Order is "longest first" so the matcher prefers `'Fr.'` over a
 * stray `'F'` if a future addition introduces one. The match is
 * case-insensitive for `'CHF'` / `'Fr.'` per FR-3.
 */
const SALARY_UNIQUE_SYMBOLS: ReadonlyArray<readonly [string, string]> = [
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['zł', 'PLN'],
  ['Fr.', 'CHF'],
];

/**
 * Spec 012 / § 7.2, rule 3 — symbols that map to multiple ISO codes
 * unless a country hint disambiguates. The keys are the raw symbols
 * as they appear in input text; values are the country → ISO mapping
 * the parser uses when an `opts.country` hint is supplied.
 *
 * `'kr'` is the canonical ambiguous case (Sweden / Norway / Denmark
 * all use `kr` — and Iceland uses `kr.` with a trailing period, which
 * we don't currently support). Fallback default = SEK per Q-025.
 */
const SALARY_AMBIGUOUS_SYMBOLS: ReadonlyMap<
  string,
  { readonly fallback: string; readonly byCountry: ReadonlyMap<Country, string> }
> = new Map([
  [
    'kr',
    {
      fallback: 'SEK',
      byCountry: new Map<Country, string>([
        [Country.SWEDEN, 'SEK'],
        [Country.NORWAY, 'NOK'],
        [Country.DENMARK, 'DKK'],
      ]),
    },
  ],
]);

/**
 * Spec 012 / § 7.2, rule 4 — country → primary-currency lookup. Used
 * when neither a symbol nor an explicit ISO code resolves the
 * currency, but the caller passed `opts.country`. Lists only
 * countries whose primary currency is one of the eight ISO codes the
 * parser supports; other countries fall through to the
 * `defaultCode ?? 'USD'` branch.
 */
const SALARY_COUNTRY_TO_CURRENCY: ReadonlyMap<Country, string> = new Map<
  Country,
  string
>([
  // EUR — Eurozone members in `Country` enum
  [Country.AUSTRIA, 'EUR'],
  [Country.BELGIUM, 'EUR'],
  [Country.FINLAND, 'EUR'],
  [Country.FRANCE, 'EUR'],
  [Country.GERMANY, 'EUR'],
  [Country.IRELAND, 'EUR'],
  [Country.ITALY, 'EUR'],
  [Country.LUXEMBOURG, 'EUR'],
  [Country.NETHERLANDS, 'EUR'],
  [Country.PORTUGAL, 'EUR'],
  [Country.SPAIN, 'EUR'],
  // GBP / USD / CHF
  [Country.UK, 'GBP'],
  [Country.USA, 'USD'],
  [Country.SWITZERLAND, 'CHF'],
  // Nordics — distinct currencies
  [Country.SWEDEN, 'SEK'],
  [Country.NORWAY, 'NOK'],
  [Country.DENMARK, 'DKK'],
  // PLN
  [Country.POLAND, 'PLN'],
]);

/**
 * Detect the currency of a salary string.
 *
 * Resolution precedence (Spec 012 / § 7.2):
 *
 *   1. **Explicit ISO code** in the input (`'USD'`, `'EUR'`, …) →
 *      `confidence: 'iso'`.
 *   2. **Unique symbol** (`'€'`, `'£'`, `'zł'`, `'Fr.'`) →
 *      `confidence: 'symbol'`.
 *   3. **Ambiguous symbol** (`'kr'`) — disambiguated by `opts.country`
 *      when supplied → `confidence: 'symbol'`. Without a country hint,
 *      falls back to the symbol's documented default (Q-025: SEK for
 *      `'kr'`) and STILL reports `confidence: 'symbol'` because the
 *      symbol *was* detected.
 *   4. **No symbol, no ISO, country hint present** — pick the
 *      country's primary currency (e.g. `Country.GERMANY` → EUR) →
 *      `confidence: 'country'`.
 *   5. **None of the above** — `defaultCode ?? 'USD'` →
 *      `confidence: 'default'`.
 *
 * The function NEVER throws and NEVER returns `null` for `code` —
 * FR-13 pins this. Callers that need to know whether a meaningful
 * detection happened should inspect `confidence`.
 *
 * @param text — the raw salary string (or any free-form input that
 *               may contain currency hints).
 * @param opts.country — country hint for ambiguous-symbol +
 *               no-currency-found cases.
 * @param opts.defaultCode — override the default `'USD'` fallback.
 *               Useful for plugins that already know they're in a
 *               specific currency context.
 */
export function parseSalaryCurrency(
  text: string | null | undefined,
  opts?: { country?: Country; defaultCode?: string },
): ParseSalaryCurrencyResult {
  const defaultCode = opts?.defaultCode ?? 'USD';
  if (!text) {
    return { code: defaultCode, symbol: null, confidence: 'default' };
  }

  // Rule 1 — explicit ISO 4217 code anywhere in the text. Word-boundary
  // match so we don't catch `'USDJPY'` or a stray `'EUR'` inside an
  // identifier. Case-insensitive per FR-1..FR-5.
  const isoMatch = matchIsoCode(text);
  if (isoMatch) {
    return { code: isoMatch, symbol: null, confidence: 'iso' };
  }

  // Rule 2 — unique symbol. Order-preserved iteration so the longest
  // shapes (`'Fr.'` is two chars + a period) win over single-char
  // symbols if they happen to overlap in a future addition.
  for (const [symbol, code] of SALARY_UNIQUE_SYMBOLS) {
    if (text.includes(symbol) || text.toLowerCase().includes(symbol.toLowerCase())) {
      return { code, symbol, confidence: 'symbol' };
    }
  }

  // Rule 3 — ambiguous symbol. We only check for the documented set
  // (`'kr'` today). Match against the lower-cased input so `'Kr'` /
  // `'KR'` / `'kr'` all hit. Disambiguate by `opts.country` when
  // present; otherwise use the documented fallback (Q-025: SEK).
  const lowered = text.toLowerCase();
  for (const [symbol, ambiguous] of SALARY_AMBIGUOUS_SYMBOLS.entries()) {
    if (lowered.includes(symbol.toLowerCase())) {
      const fromCountry = opts?.country
        ? ambiguous.byCountry.get(opts.country)
        : undefined;
      return {
        code: fromCountry ?? ambiguous.fallback,
        symbol,
        confidence: 'symbol',
      };
    }
  }

  // Rule 4 — country fallback when no in-text signal resolved.
  if (opts?.country) {
    const fromCountry = SALARY_COUNTRY_TO_CURRENCY.get(opts.country);
    if (fromCountry) {
      return { code: fromCountry, symbol: null, confidence: 'country' };
    }
  }

  // Rule 5 — global default.
  return { code: defaultCode, symbol: null, confidence: 'default' };
}

/**
 * Internal helper — match an ISO 4217 code in `text` with a strict
 * word boundary on each side. Returns the canonical (upper-cased)
 * code on a hit, or `null`. Pulled into a function so the loop in
 * {@link parseSalaryCurrency} stays readable and so a future spec
 * extending the supported ISO set has one place to amend.
 */
function matchIsoCode(text: string): string | null {
  const upper = text.toUpperCase();
  for (const code of SALARY_ISO_CODES) {
    // `\b...\b` won't anchor against punctuation like `'EUR.'`, so we
    // lean on a manual char-class check on the surrounding chars
    // instead. `RegExp` is overkill for an 8-element exact-match set.
    const idx = upper.indexOf(code);
    if (idx === -1) continue;
    const before = idx === 0 ? '' : upper[idx - 1];
    const after = idx + code.length >= upper.length ? '' : upper[idx + code.length];
    if (isWordChar(before) || isWordChar(after)) continue;
    return code;
  }
  return null;
}

/** Word-character test for the ISO-code boundary check. */
function isWordChar(ch: string): boolean {
  return /[A-Z0-9_]/.test(ch);
}

/**
 * Spec 012 / § 7.3 — country → locale dispatch table for {@link pickLocale}.
 *
 * Continental rows use decimal-comma + period-thousands (`45.000,50`);
 * anglo rows use decimal-period + comma-thousands (`45,000.50`).
 * Switzerland intentionally lands on `'anglo'` and relies on the
 * apostrophe-thousands tolerance baked into {@link parseSalaryNumber}
 * (see Spec 012 / Notes-for-the-next-run decision 2 — a third
 * `'swiss'` locale was rejected as over-engineering for one edge).
 *
 * Countries not listed fall through to the documented `'anglo'`
 * default (see {@link pickLocale}). Adding a new country is the only
 * place to amend; both helpers branch off this single table.
 */
const SALARY_LOCALE_MAP: ReadonlyMap<Country, SalaryLocale> = new Map<
  Country,
  SalaryLocale
>([
  // Continental EU + extended (Spec 012 / § 7.3 row 1).
  [Country.AUSTRIA, 'continental'],
  [Country.BELGIUM, 'continental'],
  [Country.CZECHREPUBLIC, 'continental'],
  [Country.DENMARK, 'continental'],
  [Country.FINLAND, 'continental'],
  [Country.FRANCE, 'continental'],
  [Country.GERMANY, 'continental'],
  [Country.HUNGARY, 'continental'],
  [Country.IRELAND, 'continental'],
  [Country.ITALY, 'continental'],
  [Country.LUXEMBOURG, 'continental'],
  [Country.NETHERLANDS, 'continental'],
  [Country.NORWAY, 'continental'],
  [Country.POLAND, 'continental'],
  [Country.PORTUGAL, 'continental'],
  [Country.ROMANIA, 'continental'],
  [Country.SPAIN, 'continental'],
  [Country.SWEDEN, 'continental'],
  // Anglosphere (Spec 012 / § 7.3 row 2).
  [Country.AUSTRALIA, 'anglo'],
  [Country.CANADA, 'anglo'],
  [Country.HONGKONG, 'anglo'],
  [Country.INDIA, 'anglo'],
  [Country.MALAYSIA, 'anglo'],
  [Country.NEWZEALAND, 'anglo'],
  [Country.PHILIPPINES, 'anglo'],
  [Country.SINGAPORE, 'anglo'],
  [Country.SOUTHAFRICA, 'anglo'],
  [Country.UK, 'anglo'],
  [Country.USA, 'anglo'],
  // Switzerland — anglo with apostrophe-thousands tolerance
  // (Spec 012 / § 7.3 row 3 + Notes-for-the-next-run decision 2).
  [Country.SWITZERLAND, 'anglo'],
]);

/**
 * Pick the {@link SalaryLocale} for a given `country` hint.
 *
 *   - Maps Continental EU + extended → `'continental'`.
 *   - Maps Anglosphere + Switzerland → `'anglo'`.
 *   - `undefined` (no hint) → `'anglo'` (preserves existing USD
 *     behaviour byte-for-byte; Spec 012 / § 7.3 row 4).
 *   - Any unmapped country (e.g. JAPAN, BRAZIL) → `'anglo'` default.
 *
 * Module-private per Spec 012 / Notes-for-the-next-run decision 1
 * ("`pickLocale` stays private"); consumers should pass `country`
 * to {@link parseSalaryNumber} via the eventual `extractSalary()`
 * dispatcher (Spec 012 / T03) rather than calling this directly.
 *
 * Re-exported solely through {@link __INTERNAL_TEST_ONLY__} so the
 * acceptance cases listed in tasks.md (Phase 2 / T02) can be pinned.
 */
function pickLocale(country: Country | undefined): SalaryLocale {
  if (country === undefined) return 'anglo';
  return SALARY_LOCALE_MAP.get(country) ?? 'anglo';
}

/**
 * Spec 012 / § 7.3 — locale-aware numeric parser. Strips
 * locale-appropriate thousands separators, normalises the decimal
 * separator to `'.'`, and returns a JavaScript `number`.
 *
 * Locale dispatch (FR-6, FR-9, FR-12):
 *
 *   - **`'continental'`** — decimal `,`, thousands `.` or U+00A0.
 *     Examples: `'45.000'` → `45000`; `'1 234,56'` → `1234.56`;
 *     `'1.234.567,89'` → `1234567.89`.
 *   - **`'anglo'`** — decimal `.`, thousands `,` or U+00A0.
 *     Examples: `'45,000.50'` → `45000.50`; `'1,234,567.89'` →
 *     `1234567.89`.
 *
 * Both locales tolerate the Swiss apostrophe-thousands convention
 * (`"90'000"` → `90000`) per FR-12 — the apostrophe is stripped
 * up-front before either branch runs, so it never collides with
 * the decimal separator.
 *
 * Returns `null` (NEVER throws) for any input that isn't parseable
 * as a number under the chosen locale: empty string, non-numeric
 * text, or a string with multiple decimal separators / mismatched
 * separator pattern.
 *
 * Bench target (NFR-1): ≤ 0.5 ms p95 on a 200-char input. Pure
 * `String.prototype.replace` + one `parseFloat`; no `RegExp`
 * compilation per call (the validating regex literals are compiled
 * once at module-load).
 *
 * @param raw    — the raw numeric substring (typically already
 *                 plucked out of a wider salary string by the
 *                 dispatcher in {@link extractSalary}).
 * @param locale — `'continental'` or `'anglo'`. Use {@link pickLocale}
 *                 (private) or pass through from the caller's
 *                 explicit `Country` hint.
 */
export function parseSalaryNumber(
  raw: string | null | undefined,
  locale: SalaryLocale,
): number | null {
  if (raw === null || raw === undefined) return null;

  // Up-front normalisation applied to both locales:
  //   - U+00A0 (non-breaking space) → regular space, so the same
  //     `' '` strip handles both.
  //   - Swiss thousands apostrophe → empty, per FR-12.
  //   - Trim outer whitespace.
  let s = String(raw).replace(/ /g, ' ').replace(/'/g, '').trim();
  if (!s) return null;

  // Reject anything that isn't a digit / `.` / `,` / space / leading
  // sign before doing the locale-specific replace pass. Cheap regex
  // bail-out — keeps the hot path on parseable inputs.
  if (!SALARY_NUMBER_PRE_PATTERN.test(s)) return null;

  if (locale === 'continental') {
    // Continental: `.` and ` ` are thousands; `,` is the decimal.
    s = s.replace(/[. ]/g, '').replace(',', '.');
  } else {
    // Anglo: `,` and ` ` are thousands; `.` is the decimal.
    s = s.replace(/[, ]/g, '');
  }

  // Final numeric validation — exactly one optional decimal, optional
  // sign, all digits otherwise. Catches stray double-decimals like
  // `'45.000.50'` parsed under `'anglo'`.
  if (!SALARY_NUMBER_POST_PATTERN.test(s)) return null;

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pre-strip validating regex for {@link parseSalaryNumber}. Allows
 * a leading sign, digits, `.`, `,`, and ASCII space (U+00A0 has
 * already been normalised by the time we reach this check).
 */
const SALARY_NUMBER_PRE_PATTERN = /^-?[\d., ]+$/;

/**
 * Post-strip validating regex for {@link parseSalaryNumber}. After
 * the locale-specific replace pass, the result MUST be a clean
 * `[-]digits[.digits]` shape — anything else (multiple decimals,
 * trailing punctuation) means the input wasn't a real number.
 */
const SALARY_NUMBER_POST_PATTERN = /^-?\d+(\.\d+)?$/;

/**
 * @internal — single test-shim symbol so the unit-test suite can
 * pin the {@link pickLocale} acceptance cases listed in
 * `.specify/specs/012-european-salary-parser/tasks.md` (Phase 2 /
 * T02) without exporting the helper at the public package barrel.
 *
 * Production code MUST NOT consume this object. The symbol name
 * (`__INTERNAL_TEST_ONLY__`) plus the leading-double-underscore
 * convention should make stray imports easy to spot in code review.
 *
 * Why a shim instead of a normal `export`? Spec 012's
 * Notes-for-the-next-run decision 1 keeps `pickLocale` "private"
 * for the same reason T01's `matchIsoCode` / `isWordChar` are
 * private — it's an implementation detail of the eventual
 * `extractSalary()` dispatcher (Spec 012 / T03). Exposing it via
 * a clearly-flagged shim preserves that intent while still giving
 * the test suite a way to anchor the acceptance assertions.
 */
export const __INTERNAL_TEST_ONLY__ = Object.freeze({ pickLocale });

/**
 * Extract email addresses from text.
 * Replaces Python's extract_emails_from_text().
 */
export function extractEmails(text: string | null): string[] | null {
  if (!text) return null;
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(regex);
  return matches && matches.length > 0 ? matches : null;
}

/**
 * Extract salary information from a description string.
 * Returns [interval, minAmount, maxAmount, currency] or nulls.
 * Replaces Python's extract_salary().
 */
export function extractSalary(
  salaryStr: string | null,
  options?: {
    lowerLimit?: number;
    upperLimit?: number;
    hourlyThreshold?: number;
    monthlyThreshold?: number;
    enforceAnnualSalary?: boolean;
  },
): { interval: string | null; minAmount: number | null; maxAmount: number | null; currency: string | null } {
  const result = { interval: null as string | null, minAmount: null as number | null, maxAmount: null as number | null, currency: null as string | null };

  if (!salaryStr) return result;

  const lowerLimit = options?.lowerLimit ?? 1000;
  const upperLimit = options?.upperLimit ?? 700000;
  const hourlyThreshold = options?.hourlyThreshold ?? 350;
  const monthlyThreshold = options?.monthlyThreshold ?? 30000;
  const enforceAnnualSalary = options?.enforceAnnualSalary ?? false;

  const pattern = /\$(\d+(?:,\d+)?(?:\.\d+)?)([kK]?)\s*[-—–]\s*(?:\$)?(\d+(?:,\d+)?(?:\.\d+)?)([kK]?)/;
  const match = salaryStr.match(pattern);

  if (!match) return result;

  let minSalary = parseFloat(match[1].replace(/,/g, ''));
  let maxSalary = parseFloat(match[3].replace(/,/g, ''));

  if (match[2].toLowerCase() === 'k' || match[4].toLowerCase() === 'k') {
    minSalary *= 1000;
    maxSalary *= 1000;
  }

  let interval: string;
  let annualMinSalary: number;
  let annualMaxSalary: number | null = null;

  if (minSalary < hourlyThreshold) {
    interval = CompensationInterval.HOURLY;
    annualMinSalary = minSalary * 2080;
    annualMaxSalary = maxSalary < hourlyThreshold ? maxSalary * 2080 : null;
  } else if (minSalary < monthlyThreshold) {
    interval = CompensationInterval.MONTHLY;
    annualMinSalary = minSalary * 12;
    annualMaxSalary = maxSalary < monthlyThreshold ? maxSalary * 12 : null;
  } else {
    interval = CompensationInterval.YEARLY;
    annualMinSalary = minSalary;
    annualMaxSalary = maxSalary;
  }

  if (annualMaxSalary === null) return result;

  if (
    annualMinSalary >= lowerLimit &&
    annualMinSalary <= upperLimit &&
    annualMaxSalary >= lowerLimit &&
    annualMaxSalary <= upperLimit &&
    annualMinSalary < annualMaxSalary
  ) {
    return {
      interval,
      minAmount: enforceAnnualSalary ? annualMinSalary : minSalary,
      maxAmount: enforceAnnualSalary ? annualMaxSalary : maxSalary,
      currency: 'USD',
    };
  }

  return result;
}

/**
 * Extract job types from a description using keyword matching.
 * Replaces Python's extract_job_type().
 */
export function extractJobType(description: string | null): JobType[] | null {
  if (!description) return null;

  const keywords: Record<string, RegExp> = {
    [JobType.FULL_TIME]: /full\s?time/i,
    [JobType.PART_TIME]: /part\s?time/i,
    [JobType.INTERNSHIP]: /internship/i,
    [JobType.CONTRACT]: /contract/i,
  };

  const types: JobType[] = [];
  for (const [jobType, pattern] of Object.entries(keywords)) {
    if (pattern.test(description)) {
      types.push(jobType as JobType);
    }
  }

  return types.length > 0 ? types : null;
}

/**
 * Resolve a raw job type string to a JobType enum value.
 * Replaces Python's get_enum_from_job_type().
 */
export function getEnumFromJobType(jobTypeStr: string): JobType | null {
  return getJobTypeFromString(jobTypeStr);
}

/**
 * Parse a currency string removing non-numeric characters.
 * Replaces Python's currency_parser().
 */
export function parseCurrency(curStr: string): number {
  let cleaned = curStr.replace(/[^-0-9.,]/g, '');
  // Remove thousands separators
  const last3 = cleaned.slice(-3);
  const before = cleaned.slice(0, -3);
  cleaned = before.replace(/[.,]/g, '') + last3;

  if (last3.includes('.')) {
    return Math.round(parseFloat(cleaned) * 100) / 100;
  } else if (last3.includes(',')) {
    return Math.round(parseFloat(cleaned.replace(',', '.')) * 100) / 100;
  }
  return Math.round(parseFloat(cleaned) * 100) / 100;
}

/**
 * Convert a job's salary to annual equivalent.
 * Mutates the input object. Replaces Python's convert_to_annual().
 */
export function convertToAnnual(jobData: {
  interval: string;
  minAmount: number;
  maxAmount: number;
}): void {
  const multipliers: Record<string, number> = {
    hourly: 2080,
    monthly: 12,
    weekly: 52,
    daily: 260,
  };
  const multiplier = multipliers[jobData.interval];
  if (multiplier) {
    jobData.minAmount *= multiplier;
    jobData.maxAmount *= multiplier;
    jobData.interval = 'yearly';
  }
}

/**
 * Desired column order for output (matches Python desired_order list).
 */
export const DESIRED_ORDER: string[] = [
  'id', 'site', 'jobUrl', 'jobUrlDirect', 'title', 'company', 'location',
  'datePosted', 'jobType', 'salarySource', 'interval', 'minAmount', 'maxAmount',
  'currency', 'isRemote', 'jobLevel', 'jobFunction', 'listingType', 'emails',
  'description', 'companyIndustry', 'companyUrl', 'companyLogo', 'companyUrlDirect',
  'companyAddresses', 'companyNumEmployees', 'companyRevenue', 'companyDescription',
  'skills', 'experienceRange', 'companyRating', 'companyReviewsCount',
  'vacancyCount', 'workFromHomeType',
];

/**
 * Sleep utility for adding delays between requests.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sleep for a random duration between min and max milliseconds.
 */
export function randomSleep(minMs: number, maxMs: number): Promise<void> {
  const duration = Math.random() * (maxMs - minMs) + minMs;
  return sleep(duration);
}
