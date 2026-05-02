export enum Site {
  LINKEDIN = 'linkedin',
  INDEED = 'indeed',
  ZIP_RECRUITER = 'zip_recruiter',
  GLASSDOOR = 'glassdoor',
  GOOGLE = 'google',
  BAYT = 'bayt',
  NAUKRI = 'naukri',
  BDJOBS = 'bdjobs',
  INTERNSHALA = 'internshala',
  EXA = 'exa',
  UPWORK = 'upwork',
  ASHBY = 'ashby',
  GREENHOUSE = 'greenhouse',
  LEVER = 'lever',
  WORKABLE = 'workable',
  SMARTRECRUITERS = 'smartrecruiters',
  RIPPLING = 'rippling',
  WORKDAY = 'workday',
  AMAZON = 'amazon',
  APPLE = 'apple',
  MICROSOFT = 'microsoft',
  NVIDIA = 'nvidia',
  TIKTOK = 'tiktok',
  UBER = 'uber',
  CURSOR = 'cursor',
  JOBICY = 'jobicy',
  HIMALAYAS = 'himalayas',
  REMOTEOK = 'remoteok',
  REMOTIVE = 'remotive',
  RECRUITEE = 'recruitee',
  TEAMTAILOR = 'teamtailor',
  ARBEITNOW = 'arbeitnow',
  WEWORKREMOTELY = 'weworkremotely',
  USAJOBS = 'usajobs',
  ADZUNA = 'adzuna',
  REED = 'reed',
  JOOBLE = 'jooble',
  CAREERJET = 'careerjet',
  BAMBOOHR = 'bamboohr',
  PERSONIO = 'personio',
  JAZZHR = 'jazzhr',
  DICE = 'dice',
  SIMPLYHIRED = 'simplyhired',
  WELLFOUND = 'wellfound',
  STEPSTONE = 'stepstone',
  MONSTER = 'monster',
  CAREERBUILDER = 'careerbuilder',
  ICIMS = 'icims',
  TALEO = 'taleo',
  SUCCESSFACTORS = 'successfactors',
  JOBVITE = 'jobvite',
  ADP = 'adp',
  UKG = 'ukg',
  // Phase 6: New company scrapers
  GOOGLE_CAREERS = 'google_careers',
  META = 'meta',
  NETFLIX = 'netflix',
  STRIPE = 'stripe',
  OPENAI = 'openai',
  // Phase 6: New ATS integrations
  BREEZYHR = 'breezyhr',
  COMEET = 'comeet',
  PINPOINT = 'pinpoint',
  // Phase 7: Additional job boards
  BUILTIN = 'builtin',
  SNAGAJOB = 'snagajob',
  DRIBBBLE = 'dribbble',
  // Phase 8: ATS Expansion
  MANATAL = 'manatal',
  PAYLOCITY = 'paylocity',
  FRESHTEAM = 'freshteam',
  BULLHORN = 'bullhorn',
  TRAKSTAR = 'trakstar',
  HIRINGTHING = 'hiringthing',
  LOXO = 'loxo',
  FOUNTAIN = 'fountain',
  DEEL = 'deel',
  PHENOM = 'phenom',
  // Phase 8: Company scrapers
  IBM = 'ibm',
  BOEING = 'boeing',
  ZOOM = 'zoom',
  // Phase 9: Job board expansion
  THEMUSE = 'themuse',
  WORKINGNOMADS = 'workingnomads',
  FOURDAYWEEK = 'fourdayweek',
  STARTUPJOBS = 'startupjobs',
  NODESK = 'nodesk',
  WEB3CAREER = 'web3career',
  ECHOJOBS = 'echojobs',
  JOBSTREET = 'jobstreet',
  // Phase 10: Government boards & ATS expansion
  CAREERONESTOP = 'careeronestop',
  ARBEITSAGENTUR = 'arbeitsagentur',
  JOBYLON = 'jobylon',
  HOMERUN = 'homerun',
  // Phase 11: Niche boards & developer API expansion
  HACKERNEWS = 'hackernews',
  LANDINGJOBS = 'landingjobs',
  FINDWORK = 'findwork',
  JOBDATAAPI = 'jobdataapi',
  // Phase 12: ATS & niche board expansion
  AUTHENTICJOBS = 'authenticjobs',
  JOBSCORE = 'jobscore',
  TALENTLYFT = 'talentlyft',
  // Phase 13: RSS niche board expansion
  CRYPTOJOBSLIST = 'cryptojobslist',
  JOBSPRESSO = 'jobspresso',
  HIGHEREDJOBS = 'higheredjobs',
  FOSSJOBS = 'fossjobs',
  LARAJOBS = 'larajobs',
  PYTHONJOBS = 'pythonjobs',
  DRUPALJOBS = 'drupaljobs',
  REALWORKFROMANYWHERE = 'realworkfromanywhere',
  GOLANGJOBS = 'golangjobs',
  WORDPRESSJOBS = 'wordpressjobs',
  // Phase 14: API-key sources & ATS expansion
  TALROO = 'talroo',
  INFOJOBS = 'infojobs',
  CRELATE = 'crelate',
  ISMARTRECRUIT = 'ismartrecruit',
  RECRUITERFLOW = 'recruiterflow',
  // Phase 15: European government & regional boards
  JOBTECHDEV = 'jobtechdev',
  FRANCETRAVAIL = 'francetravail',
  NAVJOBS = 'navjobs',
  JOBSACUK = 'jobsacuk',
  JOBINDEX = 'jobindex',
  // Phase 16: Global expansion (LatAm, gig, startup, Canada)
  GETONBOARD = 'getonboard',
  FREELANCERCOM = 'freelancercom',
  JOINRISE = 'joinrise',
  CANADAJOBBANK = 'canadajobbank',
  // Phase 17: Niche & international expansion (NGO, UN, IT)
  RELIEFWEB = 'reliefweb',
  UNDPJOBS = 'undpjobs',
  DEVITJOBS = 'devitjobs',
  // Phase 18: Niche RSS expansion (tech, design, environment, regional)
  PYJOBS = 'pyjobs',
  VUEJOBS = 'vuejobs',
  CONSERVATIONJOBS = 'conservationjobs',
  COROFLOT = 'coroflot',
  BERLINSTARTUPJOBS = 'berlinstartupjobs',
  // Phase 19: Tech niche, crypto, regional expansion
  RAILSJOBS = 'railsjobs',
  ELIXIRJOBS = 'elixirjobs',
  CRUNCHBOARD = 'crunchboard',
  CRYPTOCURRENCYJOBS = 'cryptocurrencyjobs',
  HASJOB = 'hasjob',
  // Phase 20: European regional & niche expansion
  ICRUNCHDATA = 'icrunchdata',
  SWISSDEVJOBS = 'swissdevjobs',
  GERMANTECHJOBS = 'germantechjobs',
  VIRTUALVOCATIONS = 'virtualvocations',
  NOFLUFFJOBS = 'nofluffjobs',
  // Phase 21: Niche & academic expansion
  GREENJOBSBOARD = 'greenjobsboard',
  EUROJOBS = 'eurojobs',
  OPENSOURCEDESIGNJOBS = 'opensourcedesignjobs',
  ACADEMICCAREERS = 'academiccareers',
  REMOTEFIRSTJOBS = 'remotefirstjobs',
  // Phase 22: Eastern European, CIS & Singapore expansion
  DJINNI = 'djinni',
  HEADHUNTER = 'headhunter',
  HABRCAREER = 'habrcareer',
  MYCAREERSFUTURE = 'mycareersfuture',
  // Phase 23: Japan, Nordic & Swiss expansion
  JOBSINJAPAN = 'jobsinjapan',
  DUUNITORI = 'duunitori',
  JOBSCH = 'jobsch',
  // Phase 24: UK & mobile dev expansion
  GUARDIANJOBS = 'guardianjobs',
  ANDROIDJOBS = 'androidjobs',
  IOSDEVJOBS = 'iosdevjobs',
  // Phase 25: DevOps, FP, diversity & niche expansion
  DEVOPSJOBS = 'devopsjobs',
  FUNCTIONALWORKS = 'functionalworks',
  POWERTOFLY = 'powertofly',
  CLOJUREJOBS = 'clojurejobs',
  // Phase 26: Environmental & conservation
  ECOJOBS = 'ecojobs',
  // Phase 27: Asia-Pacific & US tech expansion
  JOBSDB = 'jobsdb',
  TECHCAREERS = 'techcareers',
  // Phase 28: Spec 006 — ATS-Scrapers Parity, Batch 1
  AVATURE = 'avature',
  GEM = 'gem',
  JOIN_COM = 'join_com',
  // Phase 29: Spec 013 — ATS-Scrapers Parity, Batch 2 (Oracle HCM / Mercor / Tesla)
  ORACLE = 'oracle',
  MERCOR = 'mercor',
  TESLA = 'tesla',
  TESLA_PLAYWRIGHT = 'tesla_playwright',
  // Phase 30: Spec 020 — Source Company Plugin: Anthropic
  ANTHROPIC = 'anthropic',
  // Phase 31: Spec 021 — Source Company Plugin: Databricks
  DATABRICKS = 'databricks',
  // Phase 32: Spec 022 — Source Company Plugin: Discord
  DISCORD = 'discord',
  // Phase 33: Spec 023 — Source Company Plugin: Coinbase
  COINBASE = 'coinbase',
  // Phase 34: Spec 024 — Source Company Plugin: DoorDash
  DOORDASH = 'doordash',
  // Phase 35: Spec 025 — Source Company Plugin: Airbnb
  AIRBNB = 'airbnb',
  // Phase 36: Spec 026 — Source Company Plugin: Robinhood
  ROBINHOOD = 'robinhood',
  // Phase 37: Spec 027 — Source Company Plugin: Reddit
  REDDIT = 'reddit',
  // Phase 38: Spec 028 — Source Company Plugin: Pinterest
  PINTEREST = 'pinterest',
  // Phase 39: Spec 029 — Source Company Plugin: Lyft
  LYFT = 'lyft',
  // Phase 40: Spec 030 — Source Company Plugin: Plaid
  PLAID = 'plaid',
  // Phase 41: Spec 031 — Source Company Plugin: Asana
  ASANA = 'asana',
  // Phase 42: Spec 032 — Source Company Plugin: Figma
  FIGMA = 'figma',
  // Phase 43: Spec 033 — Source Company Plugin: Gitlab
  GITLAB = 'gitlab',
  // Phase 44: Spec 034 — Source Company Plugin: Twitch
  TWITCH = 'twitch',
  // Phase 45: Spec 035 — Source Company Plugin: Twilio
  TWILIO = 'twilio',
  // Phase 46: Spec 036 — Source Company Plugin: Cloudflare
  CLOUDFLARE = 'cloudflare',
  // Phase 47: Spec 037 — Source Company Plugin: MongoDB
  MONGODB = 'mongodb',
  // Phase 48: Spec 038 — Source Company Plugin: Datadog
  DATADOG = 'datadog',
  // Phase 49: Spec 039 — Source Company Plugin: Instacart
  INSTACART = 'instacart',
  // Phase 50: Spec 040 — Source Company Plugin: Dropbox
  DROPBOX = 'dropbox',
  // Phase 51: Spec 041 — Source Company Plugin: Roblox
  ROBLOX = 'roblox',
  // Phase 52: Spec 042 — Source Company Plugin: Block
  BLOCK = 'block',
  // Phase 53: Spec 043 — Source Company Plugin: Vercel
  VERCEL = 'vercel',
  // Phase 54: Spec 044 — Source Company Plugin: Affirm
  AFFIRM = 'affirm',
  // Phase 55: Spec 045 — Source Company Plugin: Klaviyo
  KLAVIYO = 'klaviyo',
  // Phase 56: Spec 046 — Source Company Plugin: Duolingo
  DUOLINGO = 'duolingo',
  // Phase 57: Spec 047 — Source Company Plugin: Brex
  BREX = 'brex',
}

/**
 * Map a raw string (case-insensitive) to a Site enum value.
 */
export function mapStringToSite(siteName: string): Site {
  const key = siteName.toUpperCase() as keyof typeof Site;
  if (Site[key] !== undefined) {
    return Site[key];
  }
  // Fallback for custom plugins/scrapers
  return siteName.toLowerCase() as Site;
}
