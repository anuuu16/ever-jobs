/**
 * Central configuration factory.
 * Maps every environment variable to a typed config object.
 */
export default () => {
  const parseBool = (val: string | undefined, fallback: boolean): boolean => {
    if (val === undefined || val === '') return fallback;
    return ['true', '1', 'yes', 'on'].includes(val.toLowerCase());
  };

  const parseList = (val: string | undefined): string[] => {
    if (!val || val.trim() === '') return [];
    return val.split(',').map((s) => s.trim()).filter(Boolean);
  };

  const parseInt = (val: string | undefined, fallback: number): number => {
    if (val === undefined || val === '') return fallback;
    const n = Number(val);
    return Number.isNaN(n) ? fallback : n;
  };

  return {
    port: parseInt(process.env.PORT, 3001),

    // API Security
    auth: {
      enabled: parseBool(process.env.ENABLE_API_KEY_AUTH, false),
      apiKeys: parseList(process.env.API_KEYS),
      headerName: process.env.API_KEY_HEADER_NAME || 'x-api-key',
    },

    // Rate Limiting
    rateLimit: {
      enabled: parseBool(process.env.RATE_LIMIT_ENABLED, false),
      maxRequests: parseInt(process.env.RATE_LIMIT_REQUESTS, 100),
      timeframeSec: parseInt(process.env.RATE_LIMIT_TIMEFRAME, 3600),
    },

    // Proxy
    proxy: {
      defaults: parseList(process.env.DEFAULT_PROXIES),
      caCertPath: process.env.CA_CERT_PATH || null,
    },

    // Search Defaults
    defaults: {
      siteNames: parseList(
        process.env.DEFAULT_SITE_NAMES ||
          'linkedin,indeed,zip_recruiter,glassdoor,google,bayt,naukri,bdjobs,internshala,exa,upwork',
      ),
      resultsWanted: parseInt(process.env.DEFAULT_RESULTS_WANTED, 20),
      distance: parseInt(process.env.DEFAULT_DISTANCE, 50),
      descriptionFormat: process.env.DEFAULT_DESCRIPTION_FORMAT || 'markdown',
      country: process.env.DEFAULT_COUNTRY || 'USA',
    },

    // Caching
    cache: {
      enabled: parseBool(process.env.ENABLE_CACHE, false),
      expirySec: parseInt(process.env.CACHE_EXPIRY, 3600),
      redisUrl: process.env.REDIS_URL || null,
      maxItems: parseInt(process.env.CACHE_MAX_ITEMS, 500),
    },

    // Retry policies
    retry: {
      defaultRetries: parseInt(process.env.RETRY_DEFAULT_RETRIES, 3),
      defaultDelayMs: parseInt(process.env.RETRY_DEFAULT_DELAY_MS, 1000),
      defaultBackoff: process.env.RETRY_DEFAULT_BACKOFF || 'linear',
      perSource: (() => {
        try {
          return JSON.parse(process.env.RETRY_PER_SOURCE || '{}');
        } catch {
          return {};
        }
      })(),
    },

    // GraphQL
    graphql: {
      enabled: parseBool(process.env.ENABLE_GRAPHQL, true),
      playground: parseBool(process.env.GRAPHQL_PLAYGROUND, true),
      path: process.env.GRAPHQL_PATH || 'graphql',
    },

    // Prometheus Metrics
    metrics: {
      enabled: parseBool(process.env.ENABLE_METRICS, true),
    },

    // Plugins
    plugins: {
      enabled: parseBool(process.env.ENABLE_PLUGINS, false),
      dir: process.env.PLUGINS_DIR || null,
    },

    // Daily job export — periodic push of freshly-seen jobs to a
    // downstream platform (or, absent a target URL, a local file).
    // Opt-in: a full fan-out across every registered source is
    // expensive, so this stays off until an operator configures it.
    // Cross-run "already exported" tracking lives in the active
    // EVER_JOBS_STORE backend (EXPORTED_JOB_STORE_TOKEN), not on disk.
    dailyExport: {
      enabled: parseBool(process.env.ENABLE_DAILY_EXPORT, false),
      intervalMs: parseInt(process.env.DAILY_EXPORT_INTERVAL_MS, 86_400_000),
      // Empty by default — the cron falls back to `defaults.siteNames`
      // (the curated job-board list) rather than fanning out across
      // every registered source.
      siteNames: parseList(process.env.DAILY_EXPORT_SITES),
      searchTerm: process.env.DAILY_EXPORT_SEARCH_TERM || undefined,
      location: process.env.DAILY_EXPORT_LOCATION || undefined,
      isRemote: parseBool(process.env.DAILY_EXPORT_IS_REMOTE, false),
      resultsWanted: parseInt(process.env.DAILY_EXPORT_RESULTS_WANTED, 100),
      hoursOld: process.env.DAILY_EXPORT_HOURS_OLD
        ? parseInt(process.env.DAILY_EXPORT_HOURS_OLD, 24)
        : undefined,
      retentionDays: parseInt(process.env.DAILY_EXPORT_RETENTION_DAYS, 30),
      // Push target — your platform's ingest endpoint. When unset, the
      // cron falls back to writing a local file instead.
      targetUrl: process.env.DAILY_EXPORT_TARGET_URL || undefined,
      targetMethod: (process.env.DAILY_EXPORT_TARGET_METHOD || 'POST').toUpperCase(),
      targetHeaders: (() => {
        try {
          return JSON.parse(process.env.DAILY_EXPORT_TARGET_HEADERS || '{}');
        } catch {
          return {};
        }
      })(),
      targetTimeoutMs: parseInt(process.env.DAILY_EXPORT_TARGET_TIMEOUT_MS, 30_000),
      // Local-file fallback, used only when targetUrl is unset.
      dir: process.env.DAILY_EXPORT_DIR || './exports',
      format: (process.env.DAILY_EXPORT_FORMAT || 'json').toLowerCase(),
    },

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
    environment: process.env.NODE_ENV || 'development',

    // Local admin UI — plain server-rendered table over the persisted job
    // store (search/filter/paginate + full-detail view + export status).
    // Defaults ON in dev/test, OFF in production unless explicitly
    // re-enabled; this is a local debugging tool, not a hardened surface.
    adminUi: {
      enabled: parseBool(
        process.env.ENABLE_ADMIN_UI,
        (process.env.NODE_ENV || 'development') !== 'production',
      ),
    },

    // CORS
    cors: {
      origins: parseList(process.env.CORS_ORIGINS || '*'),
    },

    // Swagger
    swagger: {
      enabled: parseBool(process.env.ENABLE_SWAGGER, true),
      path: process.env.SWAGGER_PATH || 'swg',
    },

    // Scalar
    scalar: {
      enabled: parseBool(process.env.ENABLE_SCALAR, true),
      path: process.env.SCALAR_PATH || 'docs',
    },
  };
};
