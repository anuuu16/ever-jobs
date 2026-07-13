/**
 * Hand-maintained directory of known companies per ATS platform, so the
 * admin UI can offer a "pick a company" list instead of requiring a
 * manually-typed `companySlug` / URL for every ATS search.
 *
 * **To add a company**: find its ATS's key below and append one
 * `{ name, slug }` entry to the array. Keys are every `Site` enum id that
 * is an ATS plugin (`category: 'ats'`) — all of them are pre-declared
 * here, most starting empty. `slug` is whatever that ATS plugin expects
 * for `ScraperInputDto.companySlug` — usually the company's subdomain,
 * but some platforms need a compound value (see per-key comments below,
 * e.g. Workday's `company:wdNumber:site`).
 *
 * The non-empty entries were seeded once from `docs/COMPANY_SLUG_DIRECTORY.md`
 * — that file remains the prose/human-readable reference; this file is
 * what the admin UI actually reads. The two are not auto-synced — update
 * both if you want a new entry documented there too.
 */
export interface AtsCompanyEntry {
  readonly name: string;
  readonly slug: string;
  readonly industry?: string;
}

export const ATS_COMPANY_DIRECTORY: Record<string, AtsCompanyEntry[]> = {
  greenhouse: [
    {
      name: "AccuWeather Careers",
      slug: "accuweather",
      industry: "Private-Sector Weather Forecasting",
    },
    {
      name: "ACI Learning",
      slug: "acilearning",
      industry: "IT Certification Training / Audit Education",
    },
    {
      name: "Ackermann Group",
      slug: "ackermanngroup",
      industry: "Multi-Family / Commercial Real-Estate-Services",
    },
    {
      name: "American College of Obstetricians and Gynecologists",
      slug: "acog",
      industry:
        "Medical-Specialty Membership Society / Women's-Health Clinical Guidance",
    },
    {
      name: "aCommerce",
      slug: "acommerce",
      industry: "Southeast-Asia E-commerce Enablement / Brand-Fulfilment",
    },
    {
      name: "Academy with Community Partners",
      slug: "acp",
      industry:
        "Arizona Online Instruction Charter-School / Alternative-Curriculum K-12 Education",
    },
    {
      name: "Acquia",
      slug: "acquia",
      industry:
        "Drupal-based Enterprise DXP / Open-Source-Cloud Digital Experience Platform",
    },
    {
      name: "Acrisure Innovation",
      slug: "acrisureinnovation",
      industry:
        "Insurance-Brokerage Innovation Unit / AI- and Data-Driven Broker Products",
    },
    {
      name: "Acryl Data (DataHub)",
      slug: "acryldata",
      industry: "Enterprise Metadata-Platform / Steward of Open-Source DataHub",
    },
    {
      name: "Acumen",
      slug: "acumen",
      industry:
        "Impact-Investing Nonprofit / Patient-Capital Social-Enterprise Fund + Acumen Academy Leadership Development",
    },
    {
      name: "Acurus Solutions Private Limited",
      slug: "acurussolutions",
      industry:
        "Healthcare Revenue-Cycle-Management (RCM) Outsourcing / U.S. Hospital + Physician-Group BPO (Bengaluru-HQ)",
    },
    {
      name: "Adaptive Biotechnologies",
      slug: "adaptivebiotechnologies",
      industry:
        "Commercial Immunosequencing Platform / immunoSEQ + clonoSEQ MRD Diagnostics (Seattle-HQ, NASDAQ: ADPT)",
    },
    { name: "Airbnb", slug: "airbnb", industry: "Travel / Tech" },
    { name: "Spotify", slug: "spotify", industry: "Music / Tech" },
    { name: "Discord", slug: "discord", industry: "Social / Tech" },
    { name: "SpaceX", slug: "spacex", industry: "Aerospace" },
    { name: "Cloudflare", slug: "cloudflare", industry: "Infrastructure" },
    { name: "Twilio", slug: "twilio", industry: "Communications" },
    { name: "Databricks", slug: "databricks", industry: "Data / AI" },
    { name: "Datadog", slug: "datadog", industry: "Monitoring" },
    { name: "MongoDB", slug: "mongodb", industry: "Database" },
    { name: "Elastic", slug: "elastic", industry: "Search / Analytics" },
    { name: "Snowflake", slug: "snowflakeinc", industry: "Data Cloud" },
    { name: "Roblox", slug: "roblox", industry: "Gaming" },
    { name: "Unity", slug: "unity3d", industry: "Gaming / 3D" },
    { name: "Shopify", slug: "shopify", industry: "E-commerce" },
    { name: "Canva", slug: "canva", industry: "Design" },
    { name: "Pinterest", slug: "pinterest", industry: "Social / Tech" },
    { name: "Lyft", slug: "lyft", industry: "Transportation" },
    { name: "DoorDash", slug: "doordash", industry: "Delivery" },
    { name: "Instacart", slug: "instacart", industry: "Grocery / Delivery" },
    { name: "Snap", slug: "snap", industry: "Social / Tech" },
    { name: "Rivian", slug: "rivian", industry: "Electric Vehicles" },
    {
      name: "Lucid Motors",
      slug: "lucidmotors",
      industry: "Electric Vehicles",
    },
    { name: "Block (Square)", slug: "block", industry: "Fintech" },
    { name: "Notion", slug: "notion", industry: "Productivity" },
    { name: "Stripe", slug: "stripe", industry: "Payments" },
    { name: "Coinbase", slug: "coinbase", industry: "Crypto / Finance" },
    { name: "HubSpot", slug: "hubspot", industry: "Marketing / CRM" },
    { name: "Plaid", slug: "plaid", industry: "Fintech" },
    { name: "10Alabs", slug: "10alabs" },
    { name: "Alixpartners", slug: "alixpartners" },
    { name: "Arlosolutionsllc", slug: "arlosolutionsllc" },
    { name: "Bigid", slug: "bigid" },
    { name: "Cadencesolutions", slug: "cadencesolutions" },
    { name: "Clevelandguardiansbops", slug: "clevelandguardiansbops" },
    { name: "Danieloconnellssons", slug: "danieloconnellssons" },
    { name: "Effectual", slug: "effectual" },
    { name: "Fastly", slug: "fastly" },
    { name: "Garnerhealth", slug: "garnerhealth" },
    { name: "Guild", slug: "guild" },
    { name: "Iherb", slug: "iherb" },
    { name: "Juvare", slug: "juvare" },
    { name: "Lightningai", slug: "lightningai" },
    { name: "Meridianpartners", slug: "meridianpartners" },
    {
      name: "Nationallifeinsurancecompany",
      slug: "nationallifeinsurancecompany",
    },
    { name: "Olly", slug: "olly" },
    { name: "Penninteractive", slug: "penninteractive" },
    { name: "Qualia", slug: "qualia" },
    { name: "Royalvet", slug: "royalvet" },
    { name: "Simula", slug: "simula" },
    { name: "Stemhealthcare", slug: "stemhealthcare" },
    { name: "Thatlot", slug: "thatlot" },
    { name: "Twitch", slug: "twitch" },
    { name: "Vulcanelements", slug: "vulcanelements" },
    { name: "Cresta", slug: "cresta", industry: "AI Contact Center" },
    {
      name: "Samsara",
      slug: "samsara",
      industry: "Connected Operations / IoT",
    },
    { name: "Sezzle", slug: "sezzle", industry: "BNPL Payments / Fintech" },
    {
      name: "Shopmonkey",
      slug: "shopmonkey",
      industry: "Vertical-SaaS Auto-Repair-Shop POS",
    },
    {
      name: "SimpliSafe",
      slug: "simplisafe",
      industry: "DIY Wireless Home Security",
    },
    {
      name: "Symphony Communication Services",
      slug: "symphony",
      industry: "Institutional Encrypted Collaboration",
    },
    {
      name: "Tatari",
      slug: "tatari",
      industry: "Streaming-and-Linear-TV Connected Attribution",
    },
    {
      name: "Textio",
      slug: "textio",
      industry: "Augmented-Writing / HR-Language-AI",
    },
    { name: "Nubank", slug: "nubank", industry: "Fintech / Neobank" },
    {
      name: "CookUnity",
      slug: "cookunity",
      industry: "Food-tech / Meal delivery",
    },
    { name: "Oklo", slug: "oklo", industry: "Energy / Advanced nuclear" },
    { name: "Fetch", slug: "fetch", industry: "Consumer / Loyalty & rewards" },
    { name: "Zocdoc", slug: "zocdoc", industry: "Health-tech / Marketplace" },
    { name: "Thunes", slug: "thunes", industry: "Fintech / Payments" },
    {
      name: "Strive Health",
      slug: "strivehealth",
      industry: "Health-tech / Value-based care",
    },
    { name: "Home Chef", slug: "homechef", industry: "Food-tech / Meal kits" },
    {
      name: "Pacific Fusion",
      slug: "pacificfusion",
      industry: "Energy / Fusion",
    },
    { name: "Otter.ai", slug: "otterai", industry: "AI / Productivity" },
    { name: "Observe.AI", slug: "observeai", industry: "AI / Contact center" },
    { name: "Honor", slug: "honor", industry: "Health-tech / Home care" },
    { name: "Weee!", slug: "weee", industry: "E-commerce / Grocery" },
    { name: "Narvar", slug: "narvar", industry: "E-commerce / Logistics SaaS" },
    {
      name: "Transcarent",
      slug: "transcarent",
      industry: "Health-tech / Navigation",
    },
    {
      name: "Watershed Informatics",
      slug: "watershed",
      industry: "Bio-tech / Computational biology",
    },
    { name: "Quaise Energy", slug: "quaise", industry: "Energy / Geothermal" },
    { name: "Upside", slug: "upside", industry: "Consumer / Retail tech" },
    { name: "Hungryroot", slug: "hungryroot", industry: "Food-tech / Grocery" },
    { name: "Nayya", slug: "nayya", industry: "Insurtech / Benefits" },
    {
      name: "Caribou Financial",
      slug: "caribou",
      industry: "Fintech / Lending",
    },
    {
      name: "HealthJoy",
      slug: "healthjoy",
      industry: "Health-tech / Benefits",
    },
    { name: "Papa", slug: "papa", industry: "Health-tech / Care" },
    {
      name: "AIR COMPANY",
      slug: "aircompany",
      industry: "Climate Tech / Carbon Conversion & Synthetic Fuels",
    },
    {
      name: "Arbor Energy",
      slug: "arborenergy",
      industry: "Climate Tech / Carbon-Negative Power (BECCS)",
    },
    {
      name: "Aurora Innovation",
      slug: "aurorainnovation",
      industry: "Autonomous Vehicles / Self-Driving Trucking",
    },
    {
      name: "EarnIn",
      slug: "earnin",
      industry: "Fintech / Earned-Wage Access",
    },
    {
      name: "Faraday Future",
      slug: "faradayfuture",
      industry: "Automotive / Electric Vehicles",
    },
    {
      name: "FastSpring",
      slug: "fastspring",
      industry: "Fintech / Merchant-of-Record Commerce & Subscription Billing",
    },
    {
      name: "Gravity R&D",
      slug: "gravity",
      industry: "AdTech / Recommendation & Personalization Software",
    },
    {
      name: "Runwise",
      slug: "runwise",
      industry: "Climate Tech / Smart Building Energy Management",
    },
    {
      name: "SES AI",
      slug: "sesai",
      industry: "Battery Technology / EV Energy Storage (Li-Metal)",
    },
    {
      name: "Solaris",
      slug: "solarisbank",
      industry: "Fintech / Banking-as-a-Service (Embedded Finance)",
    },
    {
      name: "Stack AV",
      slug: "stackav",
      industry: "Autonomous Vehicles / Self-Driving Trucking",
    },
    {
      name: "tastytrade",
      slug: "tastytrade",
      industry: "Fintech / Online Brokerage (Options & Futures Trading)",
    },
    {
      name: "Torc Robotics",
      slug: "torcrobotics",
      industry: "Autonomous Vehicles / Self-Driving Trucking",
    },
    {
      name: "Ursa Major",
      slug: "ursamajor",
      industry: "Aerospace & Defense / Rocket Propulsion",
    },
    {
      name: "Via",
      slug: "via",
      industry: "TransitTech / Mobility Software (SaaS + Operations)",
    },
    {
      name: "Zuora",
      slug: "zuora",
      industry: "Enterprise SaaS / Subscription Billing & Quote-to-Cash",
    },
    {
      name: "Accela",
      slug: "accela",
      industry: "Govtech (government permitting/licensing SaaS)",
    },
    {
      name: "AEVEX Aerospace",
      slug: "aevexaerospace",
      industry: "Defense aerospace (UAS, ISR, full-spectrum)",
    },
    {
      name: "Akaysha Energy",
      slug: "akayshaenergy",
      industry: "Grid/storage / grid-scale battery storage",
    },
    {
      name: "Anduril Industries",
      slug: "andurilindustries",
      industry: "Defense technology (autonomous systems, C2, counter-UAS)",
    },
    { name: "Armis", slug: "armissecurity", industry: "Asset/IoT security" },
    {
      name: "Atomic Machines",
      slug: "atomicmachines",
      industry:
        "Robotics, industrial automation, warehouse/manufacturing automation",
    },
    {
      name: "Augury",
      slug: "augury",
      industry: "Industrial IoT / machine-health sensors",
    },
    {
      name: "Aura",
      slug: "aura",
      industry: "Consumer identity / fraud protection",
    },
    {
      name: "Avantus",
      slug: "avantus",
      industry: "Clean energy / utility-scale solar & storage",
    },
    {
      name: "Avride",
      slug: "avride",
      industry:
        "Robotics, industrial automation, warehouse/manufacturing automation",
    },
    {
      name: "Axonius",
      slug: "axonius",
      industry: "Cyber asset attack surface management",
    },
    {
      name: "Beam Therapeutics",
      slug: "beamtherapeutics",
      industry: "Gene editing",
    },
    {
      name: "Blockchain.com",
      slug: "blockchain",
      industry: "Fintech — crypto wallet / exchange",
    },
    { name: "Bot Auto", slug: "botauto", industry: "Autonomous trucking" },
    {
      name: "BuildOps",
      slug: "buildops",
      industry: "Construction tech (commercial contractor management software)",
    },
    {
      name: "C3 AI",
      slug: "c3iot",
      industry: "Enterprise applied AI applications",
    },
    {
      name: "Cabify",
      slug: "cabify",
      industry: "Ride-hailing / mobility platform",
    },
    {
      name: "Cargomatic",
      slug: "cargomatic",
      industry: "Drayage / digital freight marketplace",
    },
    {
      name: "Censys",
      slug: "censys",
      industry: "Security data / applied AI platform",
    },
    {
      name: "CharterUP",
      slug: "charterup",
      industry: "Group transportation / charter mobility platform",
    },
    {
      name: "Checkbook",
      slug: "checkbook",
      industry: "Fintech — digital payments / disbursements",
    },
    {
      name: "CodePath",
      slug: "codepath",
      industry: "Edtech / tech career upskilling",
    },
    {
      name: "Cognitiv",
      slug: "cognitiv",
      industry: "Adtech (AI/deep-learning ads)",
    },
    {
      name: "Collibra",
      slug: "collibra",
      industry: "Compliance / data governance",
    },
    {
      name: "Colossal Biosciences",
      slug: "colossalbiosciences",
      industry: "Genomics / synthetic biology",
    },
    {
      name: "Customer.io",
      slug: "customerio",
      industry: "Martech (marketing automation/messaging)",
    },
    {
      name: "Cypress Creek Renewables",
      slug: "cypresscreekrenewables",
      industry: "Clean energy / utility-scale solar & storage",
    },
    {
      name: "Daybreak Game Company",
      slug: "daybreakgames",
      industry: "Gaming studios / interactive entertainment",
    },
    {
      name: "dbt Labs",
      slug: "dbtlabsinc",
      industry: "Data transformation / analytics engineering platform",
    },
    {
      name: "Dealpath",
      slug: "dealpath",
      industry:
        "Proptech / commercial real estate (deal management & investment platform)",
    },
    {
      name: "Defense Unicorns",
      slug: "defenseunicorns",
      industry: "Defense software (mission infrastructure/DevSecOps)",
    },
    {
      name: "Digital Extremes",
      slug: "digitalextremes",
      industry: "Gaming studios / interactive entertainment",
    },
    { name: "Dorsia", slug: "dorsia", industry: "Restaurant tech" },
    {
      name: "Easyship",
      slug: "easyship",
      industry: "E-commerce enablement (shipping/fulfillment SaaS)",
    },
    {
      name: "Eleventh Hour Games",
      slug: "eleventhhourgames",
      industry: "Gaming studios / interactive entertainment",
    },
    {
      name: "EMARKETER",
      slug: "emarketer",
      industry: "Martech/media (marketing research)",
    },
    {
      name: "emnify",
      slug: "emnify",
      industry: "IoT connectivity / cellular hardware-SIM platform",
    },
    {
      name: "Energy Solutions",
      slug: "energysolutions",
      industry: "Clean energy / efficiency & decarbonization services",
    },
    {
      name: "Esusu",
      slug: "esusu",
      industry:
        "Fintech — rent reporting / credit building / consumer payments",
    },
    {
      name: "Exiger",
      slug: "exiger",
      industry: "Regtech (supply-chain risk / AML / compliance)",
    },
    {
      name: "ExtraHop",
      slug: "extrahopnetworks",
      industry: "Network detection & response",
    },
    {
      name: "Federato",
      slug: "federato",
      industry: "Insurtech and insurance technology",
    },
    { name: "Feedzai", slug: "feedzai", industry: "Regtech (fraud / AML)" },
    {
      name: "Fieldwire",
      slug: "fieldwire",
      industry:
        "Construction tech (jobsite field management & coordination software)",
    },
    { name: "Flashfood", slug: "flashfood", industry: "Foodtech / food waste" },
    {
      name: "Fleetio",
      slug: "fleetio",
      industry: "Fleet management software / logistics",
    },
    { name: "Forbes", slug: "forbes", industry: "Media (publishing)" },
    { name: "Forter", slug: "forter", industry: "Fraud prevention / risk" },
    {
      name: "Freeform",
      slug: "freeformfuturecorp",
      industry: "Aerospace & defense metal additive manufacturing",
    },
    {
      name: "Galvanize Climate Solutions",
      slug: "galvanizeclimatesolutions",
      industry: "Climate tech / climate investment firm",
    },
    {
      name: "Gatik AI",
      slug: "gatikaiinc",
      industry:
        "Robotics, industrial automation, warehouse/manufacturing automation",
    },
    {
      name: "Glean",
      slug: "gleanwork",
      industry: "Enterprise AI search & assistant (applied AI)",
    },
    {
      name: "GlossGenius",
      slug: "glossgenius",
      industry: "Fintech — embedded payments / SMB platform",
    },
    {
      name: "Goodway Group",
      slug: "goodwaygroup",
      industry: "Adtech/martech (digital media agency)",
    },
    {
      name: "Gotion",
      slug: "gotion",
      industry: "Grid/storage / EV & energy-storage lithium batteries",
    },
    {
      name: "GovTech Singapore (Government Technology Agency)",
      slug: "govtech",
      industry: "Govtech (government digital services)",
    },
    {
      name: "Ghost Story Games",
      slug: "gsgcareers",
      industry: "Gaming studios / interactive entertainment",
    },
    {
      name: "Hanwha Renewables",
      slug: "hanwharenewables",
      industry: "Clean energy / utility-scale solar & storage",
    },
    {
      name: "Herald",
      slug: "heraldapi",
      industry: "Insurtech and insurance technology",
    },
    {
      name: "Homeward",
      slug: "homeward",
      industry: "Real estate tech (cash-offer home buying)",
    },
    {
      name: "Hyliion",
      slug: "hyliion",
      industry: "Electrified powertrain / clean transport",
    },
    {
      name: "Hyperproof",
      slug: "hyperproof",
      industry: "Compliance / GRC (security compliance)",
    },
    { name: "ID.me", slug: "idme", industry: "Identity verification / fraud" },
    {
      name: "InCharge Energy",
      slug: "inchargeenergy",
      industry: "Clean energy / fleet EV charging infrastructure",
    },
    { name: "Innovid", slug: "innovid", industry: "Adtech (ad serving/CTV)" },
    {
      name: "Instawork",
      slug: "instawork",
      industry: "Workforce management - hourly / flexible staffing marketplace",
    },
    {
      name: "Intrinsic",
      slug: "intrinsicrobotics",
      industry:
        "Robotics, industrial automation, warehouse/manufacturing automation",
    },
    {
      name: "Integrated Specialty Coverages",
      slug: "isccareers",
      industry: "Insurtech and insurance technology",
    },
    {
      name: "ITS Logistics",
      slug: "itslogisticsllc",
      industry: "3PL / freight / warehousing",
    },
    {
      name: "K2 Space",
      slug: "k2spacecorporation",
      industry: "Satellites (large GEO/MEO buses)",
    },
    {
      name: "Kasa",
      slug: "kasa",
      industry:
        "Proptech / real estate (tech-enabled hospitality & flexible accommodations)",
    },
    {
      name: "KH Aerospace",
      slug: "khaerospace",
      industry: "Aerospace & defense (UAS manufacturing/training)",
    },
    {
      name: "KnowBe4",
      slug: "knowbe4",
      industry: "Compliance / security awareness training",
    },
    {
      name: "Legion Technologies",
      slug: "legion",
      industry: "Workforce management software (scheduling / labor)",
    },
    {
      name: "LogicGate",
      slug: "logicgate",
      industry: "Compliance / GRC (risk management)",
    },
    {
      name: "Mark43",
      slug: "mark43",
      industry: "Govtech / public safety (police RMS/CAD)",
    },
    {
      name: "Matic Insurance",
      slug: "matic",
      industry: "Insurtech and insurance technology",
    },
    {
      name: "May Mobility",
      slug: "maymobility",
      industry: "Autonomous vehicles / mobility",
    },
    {
      name: "mediasmart",
      slug: "mediasmart",
      industry: "Adtech (omnichannel/CTV/DOOH DSP)",
    },
    {
      name: "Metropolis Technologies",
      slug: "metropolis",
      industry:
        "Proptech / real estate (AI computer-vision parking & mobility platform)",
    },
    {
      name: "MobilityWare",
      slug: "mobilityware",
      industry: "Mobile gaming / interactive entertainment",
    },
    {
      name: "Modernize Home Services",
      slug: "modernize",
      industry: "Proptech / home services (home improvement lead generation)",
    },
    {
      name: "MrBeast (Beast Industries)",
      slug: "mrbeastyoutube",
      industry: "Creator economy (media/YouTube)",
    },
    {
      name: "Nabis",
      slug: "nabis",
      industry: "Distribution / last-mile delivery",
    },
    {
      name: "NPR (National Public Radio)",
      slug: "nationalpublicradioinc",
      industry: "Media/streaming (public radio/podcasts)",
    },
    {
      name: "Neon Aerospace",
      slug: "neonaerospace",
      industry: "Aerospace (autonomous flight / propulsion)",
    },
    {
      name: "Neros Technologies",
      slug: "nerostechnologies",
      industry:
        "Robotics, industrial automation, warehouse/manufacturing automation",
    },
    {
      name: "New Leaf Energy",
      slug: "newleafenergy",
      industry: "Clean energy / solar & storage development",
    },
    {
      name: "Nex",
      slug: "nex",
      industry: "Gaming studios / interactive entertainment (motion gaming)",
    },
    {
      name: "Next Insurance",
      slug: "nextinsurance66",
      industry: "Insurtech and insurance technology",
    },
    {
      name: "Nimble Robotics",
      slug: "nimblerobotics",
      industry:
        "Robotics, industrial automation, warehouse/manufacturing automation",
    },
    {
      name: "NMI",
      slug: "nmi",
      industry: "Fintech — payments gateway / embedded payments",
    },
    {
      name: "Northspyre",
      slug: "northspyre",
      industry:
        "Proptech / real estate (development project & cost management software)",
    },
    {
      name: "Nothing",
      slug: "nothing",
      industry: "Consumer electronics (smartphones, earbuds)",
    },
    {
      name: "OneTrust",
      slug: "onetrust",
      industry: "Data privacy, security & governance",
    },
    {
      name: "OpenSpace",
      slug: "openspace",
      industry: "Construction tech (AI jobsite capture & reality mapping)",
    },
    { name: "OpenTable", slug: "opentable", industry: "Restaurant tech" },
    {
      name: "Veo",
      slug: "operationscareers",
      industry: "Shared micromobility (bikes/scooters)",
    },
    {
      name: "Orca Security",
      slug: "orcasecurity",
      industry: "Cloud security (CNAPP)",
    },
    {
      name: "Origis Energy",
      slug: "origisenergy",
      industry: "Clean energy / utility-scale solar & storage",
    },
    { name: "Osano", slug: "osano", industry: "Compliance / data privacy" },
    {
      name: "Pacvue",
      slug: "pacvue",
      industry: "E-commerce enablement / retail media SaaS",
    },
    {
      name: "Palmetto Clean Technology",
      slug: "palmettocleantech",
      industry: "Clean energy / residential solar platform",
    },
    {
      name: "Pathward",
      slug: "pathward",
      industry: "Fintech — banking-as-a-service / sponsor bank",
    },
    {
      name: "PayNearMe",
      slug: "paynearmeinc",
      industry: "Fintech — bill pay / payments platform",
    },
    {
      name: "Payoneer",
      slug: "payoneer",
      industry: "Fintech — cross-border payments",
    },
    {
      name: "Pixability",
      slug: "pixability",
      industry: "Adtech (YouTube/CTV video ads)",
    },
    {
      name: "Plus Power",
      slug: "pluspower",
      industry: "Grid/storage / standalone battery storage developer",
    },
    {
      name: "The Pokémon Company International",
      slug: "pokemoncareers",
      industry: "Gaming / interactive entertainment / esports",
    },
    { name: "Prime Medicine", slug: "primemedicine", industry: "Gene editing" },
    { name: "PubMatic", slug: "pubmatic", industry: "Adtech (SSP)" },
    {
      name: "Qualia",
      slug: "qualia",
      industry: "Real estate tech (digital closing / title & escrow platform)",
    },
    {
      name: "Razorpay",
      slug: "razorpaysoftwareprivatelimited",
      industry: "Fintech — payments gateway / banking-as-a-service",
    },
    {
      name: "Recorded Future",
      slug: "recordedfuture",
      industry: "Threat intelligence",
    },
    {
      name: "Renaissance Learning",
      slug: "renaissancelearning-nam",
      industry: "Edtech / pre-K-12 assessment & learning",
    },
    {
      name: "Riskified",
      slug: "riskified",
      industry: "Fraud prevention / e-commerce risk",
    },
    {
      name: "Rithum",
      slug: "rithum",
      industry: "E-commerce enablement / commerce network SaaS",
    },
    {
      name: "Rocket Lawyer",
      slug: "rocketlawyer",
      industry: "Legaltech (online legal services)",
    },
    { name: "Roku", slug: "roku", industry: "Media/streaming (CTV platform)" },
    {
      name: "Sana Biotechnology",
      slug: "sanabiotech",
      industry: "Cell & gene therapy",
    },
    {
      name: "Sayari",
      slug: "sayari",
      industry: "Regtech (corporate risk intelligence / AML)",
    },
    {
      name: "Scout AI",
      slug: "scoutai",
      industry: "Defense robotics / autonomous drones",
    },
    {
      name: "SecurityScorecard",
      slug: "securityscorecard",
      industry: "Compliance / cyber risk ratings",
    },
    {
      name: "SeekOut",
      slug: "seekout",
      industry: "Recruiting tech - talent sourcing & talent intelligence AI",
    },
    {
      name: "Seoul Robotics",
      slug: "seoulrobotics",
      industry:
        "Robotics, industrial automation, warehouse/manufacturing automation",
    },
    {
      name: "Shift Technology",
      slug: "shifttechnology",
      industry: "Insurtech and insurance technology",
    },
    { name: "ShipBob", slug: "shipbobinc", industry: "Fulfillment / 3PL" },
    { name: "ShipMonk", slug: "shipmonk", industry: "Fulfillment / 3PL" },
    {
      name: "Skillsoft",
      slug: "skillsoft",
      industry: "HR tech - corporate learning & talent development",
    },
    {
      name: "SmartRent",
      slug: "smartrent",
      industry:
        "Proptech (smart home & access automation for rental communities)",
    },
    {
      name: "Snorkel AI",
      slug: "snorkelai",
      industry: "Data-centric AI / data development platform",
    },
    {
      name: "Sol de Janeiro",
      slug: "soldejaneiro",
      industry: "DTC beauty brand",
    },
    {
      name: "PlayStation (Sony Interactive Entertainment)",
      slug: "sonyinteractiveentertainmentglobal",
      industry: "Gaming / interactive entertainment",
    },
    {
      name: "Speechify",
      slug: "speechify",
      industry: "Edtech / assistive learning (text-to-speech)",
    },
    {
      name: "Spin",
      slug: "spin",
      industry: "Shared micromobility (e-scooters)",
    },
    {
      name: "Splice",
      slug: "splice",
      industry: "Creator economy (music creation platform)",
    },
    { name: "SpotHopper", slug: "spothopper", industry: "Restaurant tech" },
    {
      name: "StackAdapt",
      slug: "stackadapt",
      industry: "Adtech (programmatic DSP)",
    },
    {
      name: "Starface World",
      slug: "starfaceworld",
      industry: "DTC beauty/skincare brand",
    },
    {
      name: "Stoke Space",
      slug: "stokespacetechnologies",
      industry: "Space launch (reusable rockets)",
    },
    {
      name: "Strand Therapeutics",
      slug: "strandtherapeutics",
      industry: "mRNA / synthetic biology",
    },
    {
      name: "Sumo Logic",
      slug: "sumologic",
      industry: "Security analytics (SIEM)",
    },
    {
      name: "Tebra",
      slug: "tebra",
      industry: "Digital health (practice & telehealth software)",
    },
    {
      name: "TEGNA",
      slug: "tegnainc",
      industry: "Media/streaming (broadcast TV)",
    },
    {
      name: "Tenable",
      slug: "tenableinc",
      industry: "Vulnerability & exposure management",
    },
    {
      name: "Terran Orbital",
      slug: "terranorbitalcorporation",
      industry: "Satellites (small-sat manufacturing)",
    },
    {
      name: "Tessera Therapeutics",
      slug: "tesseratherapeutics",
      industry: "Gene editing / genomics",
    },
    {
      name: "Dutchie",
      slug: "thedutchie",
      industry: "Retail tech (POS + e-commerce platform)",
    },
    {
      name: "The New York Times",
      slug: "thenewyorktimes",
      industry: "Media (news publishing)",
    },
    { name: "The Trade Desk", slug: "thetradedesk", industry: "Adtech (DSP)" },
    {
      name: "Third Wave Automation",
      slug: "thirdwaveautomation",
      industry:
        "Robotics, industrial automation, warehouse/manufacturing automation",
    },
    {
      name: "Too Good To Go",
      slug: "toogoodtogo",
      industry: "Foodtech / food waste",
    },
    {
      name: "Toradex",
      slug: "toradex",
      industry: "Embedded computing / IoT modules (SoMs)",
    },
    {
      name: "Transmit Security",
      slug: "transmitsecurity",
      industry: "Identity / fraud & CIAM",
    },
    {
      name: "True Anomaly",
      slug: "trueanomalyinc",
      industry: "Space defense / space domain awareness",
    },
    {
      name: "Picnic Delivery",
      slug: "try-picnic",
      industry: "Foodtech / food delivery",
    },
    {
      name: "Uber Freight",
      slug: "uberfreight",
      industry: "Freight marketplace / brokerage",
    },
    {
      name: "Unqork",
      slug: "unqork",
      industry: "Insurtech and insurance technology",
    },
    {
      name: "Varda Space Industries",
      slug: "vardaspace",
      industry: "Space (in-orbit manufacturing, reentry capsules)",
    },
    {
      name: "Verra Mobility",
      slug: "verramobility",
      industry: "Smart transportation / mobility tech",
    },
    {
      name: "Viant Technology",
      slug: "vianttechnology",
      industry: "Adtech (omnichannel DSP)",
    },
    {
      name: "Viral Nation",
      slug: "viralnation",
      industry: "Creator economy (influencer marketing)",
    },
    {
      name: "Vox Media",
      slug: "voxmedia",
      industry: "Media/streaming (digital publisher)",
    },
    {
      name: "VTS",
      slug: "vts",
      industry:
        "Proptech / commercial real estate (leasing & asset management platform)",
    },
    {
      name: "Wildlife Studios",
      slug: "wildlifestudios",
      industry: "Mobile gaming / interactive entertainment",
    },
    { name: "Wiz", slug: "wizinc", industry: "Cloud security (CNAPP)" },
    {
      name: "Wurl",
      slug: "wurljobs",
      industry: "Media/streaming + adtech (CTV distribution)",
    },
    {
      name: "Zynga",
      slug: "zyngacareers",
      industry: "Mobile gaming / interactive entertainment",
    },
  ],
  // Workday companySlug format: `{company}:{wdNumber}:{careerSite}`
  workday: [
    {
      // Live-verified 2026-07-13 (scripts/verify-ats-directory-slugs.ts) —
      // the prior slug "salesforce:12:External" 404s; the real career-site
      // ID is "External_Career_Site" (1463 open roles at verification time).
      name: "Salesforce",
      slug: "salesforce:12:External_Career_Site",
      industry: "CRM / Cloud",
    },
    { name: "Intel", slug: "intel:1:External", industry: "Semiconductors" },
    {
      // Live-verified 2026-07-13 — prior slug "cisco:5:Cisco_External" 404s;
      // the real career-site ID is "Cisco_Careers" (965 open roles).
      name: "Cisco",
      slug: "cisco:5:Cisco_Careers",
      industry: "Networking",
    },
    {
      // Live-verified 2026-07-13 — prior slug "adobe:5:External" 404s; the
      // real career-site ID is "external_experienced" (903 open roles).
      name: "Adobe",
      slug: "adobe:5:external_experienced",
      industry: "Software",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — tried
      // "epicgames:5:EpicExternalSite" (404), "epicgames:5:External" (404),
      // "epicgames:1:Epic_Games" (422), "epicgames:5:EPIC_GAMES" (403), and
      // "epicgames:5:External_Careers" (404). The confirmed real career-site
      // ID "Epic_Games" (per web search) returns 403 "permission denied" on
      // the public CXS endpoint — possibly gated differently than other
      // tenants. Left in place per policy (never auto-remove); needs a human
      // to confirm the live careers URL and re-derive the slug, or drop it
      // if Epic Games' Workday board genuinely isn't publicly queryable.
      name: "Epic Games",
      slug: "epicgames:5:EpicExternalSite",
      industry: "Gaming",
    },
    {
      // Live-verified 2026-07-13 — prior slug "warnerbros:5:WarnerBros"
      // 404s; the real career-site ID is "global" (424 open roles).
      name: "Warner Bros",
      slug: "warnerbros:5:global",
      industry: "Entertainment",
    },
    {
      name: "Disney",
      slug: "disney:5:disneycareer",
      industry: "Entertainment",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "deloitte:5:DeloitteUSCareers"
      // and "deloitte:5:Deloitte" both 422. Deloitte's US careers funnel
      // through apply.deloitte.com; deloitteie.wd3.myworkdayjobs.com
      // (Experienced_Professionals) is a real Workday board but is
      // Deloitte IRELAND, not US — needs a human to find the correct
      // tenant/site for whichever Deloitte entity this entry should track.
      name: "Deloitte",
      slug: "deloitte:5:DeloitteUSCareers",
      industry: "Consulting",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "mckinsey:5:External"
      // and "mckinsey:5:McKinsey" both 422. McKinsey's public careers site
      // is jobs.mckinsey.com; no public myworkdayjobs.com tenant found via
      // search — may not expose a public Workday CXS board at all.
      name: "McKinsey",
      slug: "mckinsey:5:External",
      industry: "Consulting",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "tesla:5:Tesla"
      // and "tesla:1:Tesla" and "tesla:5:External" all 422 (one earlier hit
      // also returned a Cloudflare challenge page). Tesla's public careers
      // site (tesla.com/careers) may not run on a public myworkdayjobs.com
      // tenant — no working combination found via search either.
      name: "Tesla",
      slug: "tesla:5:Tesla",
      industry: "EV / Energy",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "qualcomm:5:External"
      // 422s. "qualcomm:12:External" DOES resolve (HTTP 200) but returns
      // total=0, jobPostings=[] AND facets=[] — unusual even for a
      // genuinely job-free board (facets are normally still populated).
      // Real tenant, but needs a human to confirm this is the live board
      // and not a decommissioned one.
      name: "Qualcomm",
      slug: "qualcomm:5:External",
      industry: "Semiconductors",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "amd:5:External"
      // and "amd:1:External" both 422. AMD's public careers site
      // (careers.amd.com) may not run on a public myworkdayjobs.com
      // tenant — no working combination found via search either.
      name: "AMD",
      slug: "amd:5:External",
      industry: "Semiconductors",
    },
    {
      name: "Broadcom",
      slug: "broadcom:1:External_Career",
      industry: "Semiconductors",
    },
    {
      // Live-verified 2026-07-13 — prior slug "samsung:3:Global" 422s; the
      // real tenant/site is "sec:3:Samsung_Careers" (562 open roles) — the
      // Workday company subdomain is Samsung Electronics' "sec", not
      // "samsung".
      name: "Samsung",
      slug: "sec:3:Samsung_Careers",
      industry: "Electronics",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "siemens:3:External",
      // "siemens:1:External" and "siemens:5:External" all 422. Only a
      // Siemens GAMESA (renewable-energy subsidiary) board was found via
      // search (siemensgamesa.wd3.myworkdayjobs.com/SGRE) — needs a human
      // to confirm whether that's the intended entity for a generic
      // "Siemens" entry, or find the parent company's own board.
      name: "Siemens",
      slug: "siemens:3:External",
      industry: "Industrial",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "lmco:5:LMCareers"
      // 422s. Lockheed Martin's public careers site
      // (lockheedmartinjobs.com) is transitioning platforms per search
      // results and may not expose a public myworkdayjobs.com tenant right
      // now — no working combination found via search either.
      name: "Lockheed Martin",
      slug: "lmco:5:LMCareers",
      industry: "Aerospace / Defense",
    },
    {
      name: "Thales Group",
      slug: "thales:3:Careers",
      industry: "Aerospace / Defense",
    },
    {
      name: "Kyndryl",
      slug: "kyndryl:5:KyndrylProfessionalCareers",
      industry: "CRM / Cloud",
    },
    {
      name: "FNZ",
      slug: "fnz:3:fnz_careers",
      industry: "Wealth Management / Fintech",
    },
    { name: "Visa", slug: "visa:5:Visa", industry: "Payments / Fintech" },
    {
      name: "Mastercard",
      slug: "mastercard:1:CorporateCareers",
      industry: "Payments / Fintech",
    },
    {
      name: "Boeing",
      slug: "boeing:1:EXTERNAL_CAREERS",
      industry: "Aerospace / Defense",
    },
    { name: "Nike", slug: "nike:1:nke", industry: "Apparel / Footwear" },
    { name: "Autodesk", slug: "autodesk:1:Ext", industry: "Software / Design" },
    {
      name: "Hewlett Packard Enterprise",
      slug: "hpe:5:ACJobSite",
      industry: "Enterprise Technology",
    },
    {
      name: "Caterpillar",
      slug: "cat:5:CaterpillarCareers",
      industry: "Heavy Equipment / Industrial",
    },
    {
      name: "Johnson & Johnson",
      slug: "jj:5:JJ",
      industry: "Healthcare / Pharmaceuticals",
    },
    {
      name: "Johnson Controls",
      slug: "jci:5:JCI",
      industry: "Building Technology / Industrial",
    },
    {
      name: "SC Johnson",
      slug: "scj:5:External_Career_Site",
      industry: "Consumer Goods",
    },
    {
      name: "Johnson Matthey",
      slug: "matthey:3:Ext_Career_Site",
      industry: "Chemicals / Materials",
    },
    {
      name: "Marriott Vacations Worldwide",
      slug: "mymvw:5:MVW",
      industry: "Hospitality / Vacation Ownership",
    },
    {
      name: "Pfizer",
      slug: "pfizer:1:PfizerCareers",
      industry: "Pharmaceuticals",
    },
    {
      name: "Merck & Co. (MSD)",
      slug: "msd:5:SearchJobs",
      industry: "Pharmaceuticals",
    },
    {
      name: "RTX (Raytheon Technologies)",
      slug: "globalhr:5:REC_RTX_Ext_Gateway",
      industry: "Aerospace / Defense",
    },
    {
      name: "NVIDIA",
      slug: "nvidia:5:NVIDIAExternalCareerSite",
      industry: "Semiconductors / AI",
    },
    {
      name: "GDIT (General Dynamics IT)",
      slug: "gdit:5:External_Career_Site",
      industry: "Defense / IT Services",
    },
    {
      name: "General Motors",
      slug: "generalmotors:5:Careers_GM",
      industry: "Automotive",
    },
    {
      name: "UPS",
      slug: "hcmportal:5:Search",
      industry: "Logistics / Transportation",
    },
    { name: "Target", slug: "target:5:targetcareers", industry: "Retail" },
    { name: "Chevron", slug: "chevron:5:jobs", industry: "Energy / Oil & Gas" },

    {
      name: "Marmon Holdings",
      slug: "marmon:501:Marmon_Careers",
      industry: "Diversified Industrial",
    },
    {
      name: "Pluralsight",
      slug: "pluralsight:1:Careers",
      industry: "EdTech / Software",
    },
    {
      name: "Air Products",
      slug: "airproducts:5:AP0001",
      industry: "Industrial Gases / Chemicals",
    },
    {
      name: "Cloudera",
      slug: "cloudera:5:External_Career",
      industry: "Data / Software",
    },
    {
      name: "Equiniti (EQ)",
      slug: "equiniti:3:Opportunities",
      industry: "Financial Services / Registrar",
    },
    {
      name: "Reworld",
      slug: "reworld:5:External",
      industry: "Waste Management / Sustainable Energy",
    },
    {
      name: "Opella",
      slug: "chloe:3:OpellaCareers",
      industry: "Consumer Healthcare",
    },
    {
      name: "AutoStore",
      slug: "autostore:3:autostore",
      industry: "Robotics / Warehouse Automation",
    },
    {
      name: "Sovereign Network Group",
      slug: "sovereignnetworkgroup:103:SNGExternal",
      industry: "Housing / Real Estate",
    },
    {
      name: "ROCKWOOL Group",
      slug: "rockwoolgroup:3:ROCKWOOL",
      industry: "Building Materials / Insulation",
    },
    {
      name: "Automation Anywhere",
      slug: "automationanywhere:5:AutomationAnywhereJobs",
      industry: "RPA / Software",
    },
    { name: "Snyk", slug: "snyk:103:External", industry: "Cybersecurity" },
    {
      name: "Starr Companies",
      slug: "starrcompanies:1:careers",
      industry: "Insurance",
    },
    {
      name: "Occidental Petroleum (Oxy)",
      slug: "oxy:5:Corporate",
      industry: "Energy / Oil & Gas",
    },
    {
      name: "Genentech",
      slug: "roche:3:ROG-A2O-GENE",
      industry: "Biotechnology",
    },
    {
      name: "Guidehouse",
      slug: "guidehouse:1:External",
      industry: "Consulting / Professional Services",
    },
    {
      name: "Booz Allen Hamilton",
      slug: "bah:1:BAH_Jobs",
      industry: "Consulting / Government Services",
    },
    {
      name: "Owens & Minor",
      slug: "owensminor:1:OMCareers",
      industry: "Healthcare Distribution",
    },
    {
      name: "McKesson",
      slug: "mckesson:3:External_Careers",
      industry: "Healthcare Distribution",
    },
    {
      name: "BDO",
      slug: "bdo:3:BDO",
      industry: "Professional Services / Accounting",
    },
    {
      name: "Nationwide",
      slug: "nationwide:1:Nationwide_Career",
      industry: "Insurance",
    },
    {
      name: "Barclays",
      slug: "barclays:3:External_Career_Site_Barclays",
      industry: "Banking / Financial Services",
    },
    {
      name: "PNC",
      slug: "pnc:5:External",
      industry: "Banking / Financial Services",
    },
    {
      name: "CrowdStrike",
      slug: "crowdstrike:5:crowdstrikecareers",
      industry: "Cybersecurity",
    },
    { name: "CDW", slug: "cdw:5:Careers", industry: "IT Solutions / Reseller" },
    {
      name: "Fortrea",
      slug: "fortrea:1:Fortrea",
      industry: "Clinical Research / CRO",
    },
    {
      name: "Motorola Solutions",
      slug: "motorolasolutions:5:Careers",
      industry: "Public Safety Technology",
    },
    {
      name: "Richemont",
      slug: "richemont:3:broadbean_external",
      industry: "Luxury Goods",
    },
    {
      name: "NCR Atleos",
      slug: "ncratleos:1:ext_atleos_us",
      industry: "Banking Technology / Self-Service",
    },
    { name: "Procter & Gamble", slug: "pg:5:1000", industry: "Consumer Goods" },
    {
      name: "Kimberly-Clark",
      slug: "kimberlyclark:1:GLOBAL",
      industry: "Consumer Goods",
    },
    {
      name: "Cushman & Wakefield",
      slug: "cw:1:External",
      industry: "Real Estate Services",
    },
    {
      name: "Prudential Financial",
      slug: "pru:5:Careers",
      industry: "Financial Services / Insurance",
    },
    {
      name: "Prudential plc",
      slug: "prudential:3:prudential",
      industry: "Insurance / Asset Management (Asia/Africa)",
    },
    { name: "Travelers", slug: "travelers:5:External", industry: "Insurance" },
    {
      name: "Ultra Intelligence & Communications",
      slug: "ultra:3:UICCareers",
      industry: "Defense / Aerospace",
    },
    {
      name: "RBC (Royal Bank of Canada)",
      slug: "rbc:3:RBCGLOBAL1",
      industry: "Banking / Financial Services",
    },
    {
      name: "Revelyst",
      slug: "revelyst:1:EXTERNAL_REVELYST",
      industry: "Outdoor Products / Consumer Goods",
    },
    {
      name: "Integra LifeSciences",
      slug: "integralife:1:Careers",
      industry: "Medical Devices",
    },
    {
      name: "Aviagen",
      slug: "aviagen:1:aviagen-careers",
      industry: "Agriculture / Animal Genetics",
    },
    {
      name: "Wellcome Trust",
      slug: "wellcome:3:Wellcome",
      industry: "Biomedical Research / Nonprofit",
    },
    {
      name: "Premier Research",
      slug: "premierresearch:12:PremierResearch",
      industry: "Clinical Research / CRO",
    },
    {
      name: "Genesys",
      slug: "genesys:1:Genesys",
      industry: "Customer Experience Software",
    },
    {
      name: "Advantech",
      slug: "advantech:3:External",
      industry: "Industrial IoT / Hardware",
    },
    {
      name: "Southwest Airlines",
      slug: "swa:1:external",
      industry: "Airlines",
    },
    {
      // Live-verified 2026-07-13 — prior slug "aaregional:5:Search" 422s;
      // the real wdNumber is 503, not 5 (50 open roles at "aaregional:503:Search").
      name: "Piedmont Airlines",
      slug: "aaregional:503:Search",
      industry: "Regional Airline (American Airlines Group)",
    },
    {
      name: "USAA",
      slug: "usaa:1:USAAJOBSWD",
      industry: "Financial Services / Insurance",
    },
    {
      name: "Les Schwab",
      slug: "lesschwab:1:Stores",
      industry: "Automotive Retail / Tire Services",
    },
    {
      name: "Lowe's",
      slug: "lowes:5:LWS_External_CS",
      industry: "Retail / Home Improvement",
    },
    {
      name: "Best Buy Canada",
      slug: "bestbuycanada:3:BestBuyCA_Career",
      industry: "Retail / Consumer Electronics",
    },
    {
      name: "ConAgra Brands",
      slug: "conagrabrands:1:Careers_US",
      industry: "Consumer Packaged Goods",
    },
    {
      name: "Coca-Cola",
      slug: "coke:1:coca-cola-careers",
      industry: "Beverages",
    },
    {
      name: "Kraft Heinz",
      slug: "heinz:1:KraftHeinz_Careers",
      industry: "Consumer Packaged Goods",
    },
    {
      name: "P.L. Marketing",
      slug: "plmarketing:12:PLM",
      industry: "Merchandising Services",
    },
    {
      name: "J.M. Smucker",
      slug: "smucker:5:US_External_Careers",
      industry: "Consumer Packaged Goods",
    },
    {
      name: "Tyson Foods",
      slug: "tysonfoods:5:tsn",
      industry: "Food Production",
    },
    {
      name: "Mondelez International",
      slug: "mdlz:3:External",
      industry: "Consumer Packaged Goods / Snacks",
    },
    {
      // Note (not a bad slug): live-verified 2026-07-13 — this tenant/site
      // resolves fine (HTTP 200) but currently reports 0 open roles. Left
      // as-is; may simply be a quiet hiring period, not a wrong slug.
      name: "Concentrix",
      slug: "cnx:1:external_us",
      industry: "BPO / Customer Experience Services",
    },
    { name: "3M", slug: "3m:1:Search", industry: "Industrial / Conglomerate" },
    {
      name: "DuPont",
      slug: "dupont:5:Jobs",
      industry: "Chemicals / Materials Science",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "eatonvance:5:Professional"
      // 422s, as do wd1/wd12 variants. Eaton Vance is now part of Morgan
      // Stanley Investment Management (acquired 2021); its postings appear
      // to live under Morgan Stanley's own board ("ms:5:External", 1328
      // open roles, confirmed live) rather than a standalone Eaton Vance
      // tenant — needs a human to decide whether to point this entry at
      // Morgan Stanley's board (loses Eaton-Vance-only filtering) or drop it.
      name: "Eaton Vance",
      slug: "eatonvance:5:Professional",
      industry: "Asset Management",
    },
    {
      name: "Ingredion",
      slug: "ingredion:1:IngredionCareers",
      industry: "Food Ingredients",
    },
    {
      name: "Applied Materials",
      slug: "amat:1:External",
      industry: "Semiconductor Equipment",
    },
    {
      name: "KLA Corporation",
      slug: "kla:1:Search",
      industry: "Semiconductor Equipment",
    },
    {
      name: "University of Texas at Austin",
      slug: "utaustin:1:UTstaff",
      industry: "Higher Education",
    },
    {
      name: "Abbott Laboratories",
      slug: "abbott:5:abbottcareers",
      industry: "Healthcare / Medical Devices / Pharma",
    },
    {
      name: "Stryker",
      slug: "stryker:1:StrykerCareers",
      industry: "Medical Technology",
    },
    {
      name: "Medtronic",
      slug: "medtronic:1:MedtronicCareers",
      industry: "Medical Technology",
    },
    {
      name: "BD (Becton, Dickinson and Company)",
      slug: "bdx:1:EXTERNAL_CAREER_SITE_USA",
      industry: "Medical Technology",
    },
    {
      name: "Baxter International",
      slug: "baxter:1:baxter",
      industry: "Healthcare / Medical Devices",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "baxter:1:Vantive"
      // returns Workday error S22 (permission denied), unlike the sibling
      // "baxter:1:baxter" entry above which works fine. Vantive (Baxter's
      // kidney-care spinoff) may have its own separate tenant/site rather
      // than living under the "baxter" wd1 tenant — needs a human to find
      // the correct board.
      name: "Vantive",
      slug: "baxter:1:Vantive",
      industry: "Kidney Care (Baxter spinoff)",
    },
    {
      name: "Edwards Lifesciences",
      slug: "edwards:5:edwardscareers",
      industry: "Medical Technology / Structural Heart",
    },
    {
      name: "Danaher",
      slug: "danaher:1:DanaherJobs",
      industry: "Life Sciences / Diagnostics",
    },
    {
      name: "Thermo Fisher Scientific",
      slug: "thermofisher:5:ThermoFisherCareers",
      industry: "Life Sciences / Lab Equipment",
    },
    {
      name: "Illumina",
      slug: "illumina:1:illumina-careers",
      industry: "Genomics / Biotech",
    },
    {
      // Live-verified 2026-07-13 — prior slug "illuminateusa:5:Illuminate_Careers"
      // 422s; the real wdNumber is 503, not 5 (45 open roles at
      // "illuminateusa:503:Illuminate_Careers").
      name: "Illuminate USA",
      slug: "illuminateusa:503:Illuminate_Careers",
      industry: "Solar Manufacturing",
    },
    {
      name: "Regeneron Pharmaceuticals",
      slug: "regeneron:1:Careers",
      industry: "Biotechnology",
    },
    { name: "Amgen", slug: "amgen:1:Careers", industry: "Biotechnology" },
    {
      name: "Gilead Sciences",
      slug: "gilead:1:gileadcareers",
      industry: "Biopharmaceuticals",
    },
    {
      // Live-verified 2026-07-13 — prior slug "vrtx:5:Vertex_Careers" 422s;
      // the real wdNumber is 501, not 5 (257 open roles at "vrtx:501:Vertex_Careers").
      name: "Vertex Pharmaceuticals",
      slug: "vrtx:501:Vertex_Careers",
      industry: "Biotechnology",
    },
    {
      name: "Vertex Inc.",
      slug: "vertexinc:1:VertexInc",
      industry: "Tax Software / SaaS",
    },
    { name: "Biogen", slug: "biibhr:3:external", industry: "Biotechnology" },
    {
      name: "Novartis",
      slug: "novartis:3:Novartis_Careers",
      industry: "Pharmaceuticals",
    },
    {
      name: "Sanofi",
      slug: "sanofi:3:SanofiCareers",
      industry: "Pharmaceuticals",
    },
    {
      name: "Bristol Myers Squibb",
      slug: "bristolmyerssquibb:5:BMS",
      industry: "Pharmaceuticals",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — "lilly:5:LLY"
      // 422s, as do wd1/wd501/wd503 variants and "lilly:5:CMP". Search
      // confirms lilly.wd5.myworkdayjobs.com/en-US/LLY as the real public
      // URL, so the tenant/site names look right — the 422 may be a
      // transient/regional gating issue rather than a wrong slug. Needs a
      // human to re-check from a browser.
      name: "Eli Lilly",
      slug: "lilly:5:LLY",
      industry: "Pharmaceuticals",
    },
    { name: "GSK", slug: "gsk:5:GSKCareers", industry: "Pharmaceuticals" },
    {
      name: "Haleon",
      slug: "gsknch:3:GSKCareers",
      industry: "Consumer Health",
    },
    {
      name: "Roche",
      slug: "roche:3:roche-ext",
      industry: "Pharmaceuticals / Diagnostics",
    },
    {
      name: "AskBio",
      slug: "askbio:12:AskBio",
      industry: "Gene Therapy (Bayer subsidiary)",
    },
    {
      name: "Takeda Pharmaceutical",
      slug: "takeda:3:External",
      industry: "Pharmaceuticals",
    },
    {
      name: "AstraZeneca",
      slug: "astrazeneca:3:Careers",
      industry: "Pharmaceuticals",
    },
    {
      name: "Alexion",
      slug: "astrazeneca:3:Alexion",
      industry: "Rare Disease Biopharma",
    },
    {
      name: "Moderna",
      slug: "modernatx:1:M_tx",
      industry: "mRNA Biotechnology",
    },
    {
      name: "Cumming Group",
      slug: "cumminggroup:1:CGC",
      industry: "Construction Consulting",
    },
    {
      name: "Rockwell Automation",
      slug: "rockwellautomation:1:External_Rockwell_Automation",
      industry: "Industrial Automation",
    },
    {
      // TODO(verify manually): live-verified 2026-07-13 — public web search
      // confirms real job postings under this exact URL
      // (rockwellautomation.wd1.myworkdayjobs.com/en-US/External-Sensia/job/...),
      // but the public CXS API returns Workday error S22 "permission
      // denied" for it — same symptom as the Epic Games entry above.
      // Likely a board that renders in a browser but blocks the
      // programmatic search endpoint; needs a human to confirm.
      name: "Sensia",
      slug: "rockwellautomation:1:External-Sensia",
      industry: "Oil & Gas Automation (Rockwell/Schlumberger JV)",
    },
    {
      name: "Emerson College",
      slug: "emerson:5:Emerson_College_Staff",
      industry: "Higher Education",
    },
    {
      name: "Dow",
      slug: "dow:1:ExternalCareers",
      industry: "Chemicals / Materials Science",
    },
    {
      name: "Dow Jones",
      slug: "dowjones:1:Dow_Jones_Career",
      industry: "Media / Publishing",
    },
    {
      name: "Air Liquide",
      slug: "airliquidehr:3:AirLiquideExternalCareer",
      industry: "Industrial Gases / Chemicals",
    },
    {
      // Live-verified 2026-07-13 — prior slug "kiongroup:3:KION_ITS_EMEA"
      // 422s; the general/global board is "KIONGroup", not the
      // EMEA-specific "KION_ITS_EMEA" site (980 open roles).
      name: "KION Group",
      slug: "kiongroup:3:KIONGroup",
      industry: "Industrial Trucks / Material Handling",
    },
    {
      name: "Siemens Healthineers",
      slug: "onehealthineers:3:SHSJB",
      industry: "Medical Technology",
    },
    {
      name: "Philips",
      slug: "philips:3:jobs-and-careers",
      industry: "Health Technology",
    },
    // Batch added 2026-07-13, all live-verified via
    // scripts/verify-ats-directory-slugs.ts before being added (per the
    // "never commit a slug on search-guess alone" policy).
    {
      name: "Walmart",
      slug: "walmart:504:WalmartExternal",
      industry: "Retail",
    },
    {
      // Search surfaced this as a Bank of America lateral-hire recruiting
      // board (ghr = "Global Human Resources"?), not a generic "External"
      // board — 1722 open roles confirmed live, but flagged in case a
      // broader public board exists under a different tenant/site.
      name: "Bank of America",
      slug: "ghr:1:Lateral-US",
      industry: "Banking / Financial Services",
    },
    {
      name: "Allstate",
      slug: "allstate:5:allstate_careers",
      industry: "Insurance",
    },
    {
      name: "Cardinal Health",
      slug: "cardinalhealth:1:EXT",
      industry: "Healthcare Distribution",
    },
    {
      name: "Comcast",
      slug: "comcast:5:Comcast_Careers",
      industry: "Media / Telecommunications",
    },
    {
      name: "Wells Fargo",
      slug: "wf:1:WellsFargoJobs",
      industry: "Banking / Financial Services",
    },
    { name: "Unum", slug: "unum:1:External", industry: "Insurance" },
    {
      name: "Unilever",
      slug: "unilever:3:Unilever_Experienced_Professionals",
      industry: "Consumer Packaged Goods",
    },
    {
      // Workday tenant is "ag" (Airbus Group's legacy short name), not "airbus".
      name: "Airbus",
      slug: "ag:3:Airbus",
      industry: "Aerospace / Defense",
    },
    // Second batch added 2026-07-13, all live-verified.
    {
      name: "Workday",
      slug: "workday:5:Workday",
      industry: "HR / Finance Software",
    },
    {
      name: "JLL",
      slug: "jll:1:jllcareers",
      industry: "Commercial Real Estate",
    },
    {
      name: "Broadridge Financial Solutions",
      slug: "broadridge:5:Careers",
      industry: "Financial Technology",
    },
    {
      name: "Flex",
      slug: "flextronics:1:Careers",
      industry: "Electronics Manufacturing Services",
    },
    {
      name: "Duke Energy",
      slug: "dukeenergy:1:Search",
      industry: "Utilities / Energy",
    },
    {
      // Small board (1 open role at verification time) — likely United
      // Aviate Academy (United's flight school subsidiary) rather than the
      // whole airline's general hiring, per the "uaa" tenant name.
      name: "United Airlines",
      slug: "uaa:12:EXT",
      industry: "Airlines",
    },
    {
      name: "Carrier",
      slug: "carrier:5:jobs",
      industry: "HVAC / Building Systems",
    },
    // Third batch added 2026-07-13, all live-verified.
    {
      name: "Verizon",
      slug: "verizon:12:verizon-careers",
      industry: "Telecommunications",
    },
    { name: "AT&T", slug: "att:1:ATTGeneral", industry: "Telecommunications" },
    {
      name: "T-Mobile",
      slug: "tmobile:1:External",
      industry: "Telecommunications",
    },
    {
      name: "CVS Health",
      slug: "cvshealth:1:CVS_Health_Careers",
      industry: "Healthcare / Pharmacy Retail",
    },
    {
      name: "Humana",
      slug: "humana:5:Humana_External_Career_Site",
      industry: "Health Insurance",
    },
    {
      name: "HCA Healthcare",
      slug: "hcahealthcare:3:hcacareers",
      industry: "Hospital Operations",
    },
    // Fourth batch added 2026-07-13, all live-verified.
    {
      name: "Elevance Health",
      slug: "elevancehealth:1:ANT",
      industry: "Health Insurance",
    },
    {
      name: "Marsh McLennan",
      slug: "mmc:1:MMC",
      industry: "Insurance Brokerage / Risk Management",
    },
    {
      name: "Accenture",
      slug: "accenture:103:AccentureCareers",
      industry: "IT Consulting",
    },
    {
      name: "HP Inc.",
      slug: "hp:5:ExternalCareerSite",
      industry: "Computer Hardware",
    },
    // Fifth batch added 2026-07-13, all live-verified.
    {
      name: "GE Aerospace",
      slug: "geaerospace:5:GE_ExternalSite",
      industry: "Aerospace / Jet Engines",
    },
    {
      // Workday tenant is "gevernova", distinct from the "geaerospace"
      // tenant above — the two GE spinoffs run separate Workday instances.
      name: "GE Vernova",
      slug: "gevernova:5:Vernova_ExternalSite",
      industry: "Energy / Power Generation",
    },
    {
      name: "Northrop Grumman",
      slug: "ngc:1:Northrop_Grumman_External_Site",
      industry: "Aerospace / Defense",
    },
    {
      name: "Leidos",
      slug: "leidos:5:External",
      industry: "Defense / IT Services",
    },
    // Sixth batch added 2026-07-13, all live-verified.
    {
      name: "S&P Global",
      slug: "spgi:5:SPGI_Careers",
      industry: "Financial Data / Ratings",
    },
    {
      name: "Nasdaq",
      slug: "nasdaq:1:Global_External_Site",
      industry: "Financial Markets / Exchange Technology",
    },
    {
      name: "CME Group",
      slug: "cmegroup:1:cme_careers",
      industry: "Derivatives Exchange",
    },
    { name: "Fiserv", slug: "fiserv:5:EXT", industry: "Financial Technology" },
    // Seventh batch added 2026-07-13, all live-verified.
    {
      // Workday tenant is "priceline" (Booking Holdings' legacy corporate
      // name), not "booking" or "bookingholdings".
      name: "Booking Holdings",
      slug: "priceline:1:BookingHoldings",
      industry: "Online Travel",
    },
    {
      name: "Expedia Group",
      slug: "expedia:108:search",
      industry: "Online Travel",
    },
    { name: "PayPal", slug: "paypal:1:jobs", industry: "Payments / Fintech" },
    // Eighth batch added 2026-07-13, all live-verified.
    {
      name: "Cigna",
      slug: "cigna:5:cignacareers",
      industry: "Health Insurance",
    },
    { name: "AIG", slug: "aig:1:aig", industry: "Insurance" },
    {
      name: "The Hartford",
      slug: "thehartford:5:Careers_External",
      industry: "Insurance / Financial Services",
    },
    // Ninth batch added 2026-07-13, all live-verified.
    {
      name: "DXC Technology",
      slug: "dxctechnology:1:DXCJobs",
      industry: "IT Services",
    },
    {
      name: "NCR Voyix",
      slug: "ncr:1:ext_us",
      industry: "Retail / Restaurant Technology",
    },
    {
      name: "Micron Technology",
      slug: "micron:1:External",
      industry: "Semiconductors / Memory",
    },
    {
      name: "Analog Devices",
      slug: "analogdevices:1:External",
      industry: "Semiconductors",
    },
    {
      // Small board (1 open role at verification time), but a real,
      // live tenant/site — Lexmark is now a Xerox subsidiary.
      name: "Lexmark",
      slug: "lexmark:1:Lexmark",
      industry: "Printing / Imaging (Xerox subsidiary)",
    },
    // Tenth batch added 2026-07-13, all live-verified.
    {
      name: "Mars",
      slug: "mars:3:External",
      industry: "Food / Confectionery / Pet Care",
    },
    {
      // Workday tenant is "bpinternational", not "bp".
      name: "BP",
      slug: "bpinternational:3:bpCareers",
      industry: "Energy / Oil & Gas",
    },
    {
      name: "Baker Hughes",
      slug: "bakerhughes:5:BakerHughes",
      industry: "Energy Technology / Oilfield Services",
    },
    {
      // Workday tenant is "lbg" (Lloyds Banking Group's initials), not "lloyds".
      name: "Lloyds Banking Group",
      slug: "lbg:3:LBG_Careers",
      industry: "Banking / Financial Services",
    },
    {
      name: "BMO",
      slug: "bmo:3:External",
      industry: "Banking / Financial Services",
    },
    {
      name: "U.S. Bank",
      slug: "usbank:1:US_Bank_Careers",
      industry: "Banking / Financial Services",
    },
    {
      name: "TD Bank",
      slug: "td:3:TD_Bank_Careers",
      industry: "Banking / Financial Services",
    },
    {
      name: "Shell",
      slug: "shell:3:ShellCareers",
      industry: "Energy / Oil & Gas",
    },
    // Eleventh batch added 2026-07-13, all live-verified.
    {
      name: "Centene",
      slug: "centene:5:Centene_External",
      industry: "Managed Health Care",
    },
    {
      name: "O'Reilly Auto Parts",
      slug: "oreillyauto:1:oreilly",
      industry: "Automotive Retail",
    },
    {
      name: "Genuine Parts Company",
      slug: "genpt:1:Careers",
      industry: "Automotive / Industrial Parts Distribution",
    },
    {
      name: "TJX Companies",
      slug: "tjx:1:TJX_EXTERNAL",
      industry: "Off-Price Retail",
    },
    { name: "Gap Inc.", slug: "gapinc:1:GAPINC", industry: "Apparel Retail" },
    {
      name: "Nordstrom",
      slug: "nordstrom:501:nordstrom_careers",
      industry: "Department Store Retail",
    },
    {
      name: "Dollar Tree",
      slug: "dollartree:5:dollartreeus",
      industry: "Discount Retail",
    },
    {
      name: "Advance Auto Parts",
      slug: "advanceauto:5:AdvanceExternalCareers",
      industry: "Automotive Retail",
    },
    // Twelfth batch added 2026-07-13, all live-verified.
    {
      name: "Kohl's",
      slug: "kohls:504:kohlscareers",
      industry: "Department Store Retail",
    },
    {
      name: "Ecolab",
      slug: "ecolab:1:Ecolab_External",
      industry: "Industrial Cleaning / Water Treatment",
    },
    {
      name: "Republic Services",
      slug: "republic:5:Republic",
      industry: "Waste Management",
    },
    {
      name: "Old Dominion Freight Line",
      slug: "odfl:1:ODFL_Careers",
      industry: "Trucking / Logistics",
    },
    {
      name: "J.B. Hunt",
      slug: "jbhunt:501:Careers",
      industry: "Trucking / Logistics",
    },
    {
      name: "Citi",
      slug: "citi:5:2",
      industry: "Banking / Financial Services",
    },
    {
      name: "Truist",
      slug: "truist:1:Careers",
      industry: "Banking / Financial Services",
    },
    {
      name: "Fifth Third Bank",
      slug: "fifththird:5:53careers",
      industry: "Banking / Financial Services",
    },
    {
      name: "KeyBank",
      slug: "keybank:5:External_Career_Site",
      industry: "Banking / Financial Services",
    },
    {
      name: "Regions Bank",
      slug: "regions:5:Regions_Careers",
      industry: "Banking / Financial Services",
    },
    {
      name: "M&T Bank",
      slug: "mtb:5:MTB",
      industry: "Banking / Financial Services",
    },
    {
      name: "Synchrony",
      slug: "synchronyfinancial:5:careers",
      industry: "Consumer Finance / Fintech",
    },
    {
      name: "State Street",
      slug: "statestreet:1:Global",
      industry: "Financial Services / Custody Banking",
    },
    {
      name: "TD Bank",
      slug: "td:3:TD_Bank_Careers",
      industry: "Banking / Financial Services",
    },
    {
      name: "BMO",
      slug: "bmo:3:External",
      industry: "Banking / Financial Services",
    },
    {
      name: "Morgan Stanley",
      slug: "ms:5:External",
      industry: "Investment Banking / Financial Services",
    },
    {
      name: "Dell Technologies",
      slug: "dell:1:External",
      industry: "Computer Hardware / Enterprise Technology",
    },
    {
      name: "Zoom",
      slug: "zoom:5:Zoom",
      industry: "Video Communications / Software",
    },
    {
      name: "Marvell",
      slug: "marvell:1:MarvellCareers",
      industry: "Semiconductors",
    },
    {
      name: "Nordstrom",
      slug: "nordstrom:501:nordstrom_careers",
      industry: "Retail / Fashion",
    },
    {
      name: "TJX Companies",
      slug: "tjx:1:TJX_EXTERNAL",
      industry: "Retail / Off-Price Apparel",
    },
    { name: "Gap Inc.", slug: "gapinc:1:GAPINC", industry: "Retail / Apparel" },
    {
      name: "Sysco",
      slug: "sysco:5:syscocareers",
      industry: "Foodservice Distribution",
    },
    {
      name: "Baker Hughes",
      slug: "bakerhughes:5:BakerHughes",
      industry: "Energy Technology / Oilfield Services",
    },
    {
      name: "Enbridge",
      slug: "enbridge:3:enbridge_careers",
      industry: "Energy / Pipelines & Utilities",
    },
    {
      name: "ConocoPhillips",
      slug: "conocophillips:1:eQuest",
      industry: "Energy / Oil & Gas",
    },
    {
      name: "IQVIA",
      slug: "iqvia:1:IQVIA",
      industry: "Clinical Research / Healthcare Data",
    },
    {
      name: "Labcorp",
      slug: "labcorp:1:External",
      industry: "Diagnostics / Life Sciences",
    },
    {
      name: "Zoetis",
      slug: "zoetis:5:zoetis",
      industry: "Animal Health / Pharmaceuticals",
    },
    /** Workday END  */
  ],
  lever: [
    {
      name: "Palantir",
      slug: "palantir",
      industry: "Data Analytics / Defense",
    },
    { name: "Netflix", slug: "netflix", industry: "Streaming" },
    { name: "Atlassian", slug: "atlassian", industry: "Developer Tools" },
    { name: "Eventbrite", slug: "eventbrite", industry: "Events" },
    { name: "KPMG", slug: "kpmg", industry: "Consulting" },
    { name: "100Ms", slug: "100ms" },
    { name: "Allegiantair", slug: "allegiantair" },
    { name: "Asapp 2", slug: "asapp-2" },
    { name: "Blablacar", slug: "blablacar" },
    { name: "Cartrawler", slug: "cartrawler" },
    { name: "Coinmarketcap", slug: "coinmarketcap" },
    { name: "Deepsky", slug: "deepsky" },
    { name: "Ekohealth", slug: "ekohealth" },
    { name: "Findhelp", slug: "findhelp" },
    { name: "Glass Health Inc", slug: "glass-health-inc" },
    { name: "Hivemapper", slug: "hivemapper" },
    { name: "Jamcity", slug: "jamcity" },
    { name: "Lamudi", slug: "lamudi" },
    { name: "Madhappy", slug: "madhappy" },
    { name: "Monkshillventures", slug: "monkshillventures" },
    { name: "Numeris", slug: "numeris" },
    { name: "Peoplegrove", slug: "peoplegrove" },
    { name: "Princesspolly", slug: "princesspolly" },
    { name: "Redwoodcu", slug: "redwoodcu" },
    { name: "Sandboxvr", slug: "sandboxvr" },
    { name: "Snappr", slug: "snappr" },
    { name: "Sure", slug: "sure" },
    { name: "Thrivecausemetics", slug: "thrivecausemetics" },
    { name: "Unusual", slug: "unusual" },
    { name: "Waveapps", slug: "waveapps" },
  ],
  ashby: [
    { name: "OpenAI", slug: "openai", industry: "AI" },
    { name: "Ramp", slug: "ramp", industry: "Fintech" },
    { name: "Figma", slug: "figma", industry: "Design" },
    { name: "Linear", slug: "linear", industry: "Developer Tools" },
    { name: "Vercel", slug: "vercel", industry: "Developer Tools" },
    { name: "Plaid", slug: "plaid", industry: "Fintech" },
    { name: "Retool", slug: "retool", industry: "Developer Tools" },
    { name: "Notion", slug: "notion", industry: "Productivity" },
  ],
  // Taleo companySlug format: `{company}:{careerSection}`
  taleo: [
    {
      name: "Oracle",
      slug: "oracle:ORACLEEXT",
      industry: "Enterprise Software",
    },
    {
      name: "JPMorgan Chase",
      slug: "jpmorganchase:ExternalCareerSite",
      industry: "Banking",
    },
    {
      name: "PepsiCo",
      slug: "pepsico:ExternalSite",
      industry: "Consumer Goods",
    },
  ],
  icims: [
    { name: "EA (Electronic Arts)", slug: "ea", industry: "Gaming" },
    { name: "Goldman Sachs", slug: "goldmansachs", industry: "Banking" },
    { name: "UPS", slug: "ups", industry: "Logistics" },
  ],
  smartrecruiters: [
    { name: "Visa", slug: "Visa", industry: "Payments" },
    { name: "Bosch", slug: "BoschGroup", industry: "Industrial / Tech" },
    { name: "Equinox", slug: "Equinox", industry: "Fitness" },
    { name: "Skechers", slug: "Skechers", industry: "Footwear" },
    { name: "10Minuteschool", slug: "10minuteschool" },
    { name: "Ajua", slug: "ajua" },
    { name: "Artelia", slug: "artelia" },
    { name: "Blueally", slug: "blueally" },
    { name: "Check24", slug: "check24" },
    { name: "Continental", slug: "continental" },
    { name: "Deloittenordic", slug: "deloittenordic" },
    {
      name: "Elizabethglaserpediatricaidsfoundation3",
      slug: "elizabethglaserpediatricaidsfoundation3",
    },
    { name: "Firstdrivelogisticsinc", slug: "firstdrivelogisticsinc" },
    { name: "Ginastechjobs", slug: "ginastechjobs" },
    { name: "Hexagroup", slug: "hexagroup" },
    { name: "Ingramcontentgroup1", slug: "ingramcontentgroup1" },
    { name: "Kanadeviainova", slug: "kanadeviainova" },
    { name: "Liftedanupworkcompany", slug: "liftedanupworkcompany" },
    { name: "Mcwaneinc", slug: "mcwaneinc" },
    { name: "Mytime", slug: "mytime" },
    { name: "Nxtkeycorporation", slug: "nxtkeycorporation" },
    { name: "Primark", slug: "primark" },
    { name: "Renaud Bray", slug: "renaud-bray" },
    { name: "Samsungena", slug: "samsungena" },
    { name: "Siloamcareers", slug: "siloamcareers" },
    { name: "Sterlingenterprisellc", slug: "sterlingenterprisellc" },
    { name: "Telefonicatech", slug: "telefonicatech" },
    { name: "Trustonic", slug: "trustonic" },
    { name: "Virtuaadvancedsolution", slug: "virtuaadvancedsolution" },
  ],
  successfactors: [
    { name: "SAP", slug: "sap:SAP", industry: "Enterprise Software" },
    { name: "Accenture", slug: "accenture:Accenture", industry: "Consulting" },
    {
      name: "Siemens",
      slug: "siemens:SiemensExternal",
      industry: "Industrial",
    },
  ],
  workable: [
    { name: "Sephora", slug: "sephora", industry: "Retail / Beauty" },
    { name: "Forbes", slug: "forbes", industry: "Media" },
    { name: "Our Home", slug: "-our-home" },
    { name: "Alliedteam", slug: "alliedteam" },
    { name: "Auprosports", slug: "auprosports" },
    { name: "Blitzoo Games", slug: "blitzoo-games" },
    { name: "Cdr Companies", slug: "cdr-companies" },
    { name: "Constructor 1", slug: "constructor-1" },
    { name: "Deep Science Ventures", slug: "deep-science-ventures" },
    { name: "Elevated Hiring", slug: "elevated-hiring" },
    { name: "Fergus", slug: "fergus" },
    { name: "Gamigo", slug: "gamigo" },
    { name: "Healthsnap", slug: "healthsnap" },
    {
      name: "Infini Capital Management Limited",
      slug: "infini-capital-management-limited",
    },
    { name: "Karohealthcare", slug: "karohealthcare" },
    { name: "Lingoace", slug: "lingoace" },
    { name: "Mention Me Ltd", slug: "mention-me-ltd" },
    { name: "Nawy Real Estate", slug: "nawy-real-estate" },
    { name: "Optibpo", slug: "optibpo" },
    { name: "Pinnacle Middle East", slug: "pinnacle-middle-east" },
    { name: "Radley Yeldar", slug: "radley-yeldar" },
    { name: "Samsung Sds America", slug: "samsung-sds-america" },
    { name: "Snowed In Studios 3", slug: "snowed-in-studios-3" },
    { name: "Switchboard Hiring 1", slug: "switchboard-hiring-1" },
    { name: "Thetsuigroup", slug: "thetsuigroup" },
    {
      name: "University Of Mount Saint Vincent",
      slug: "university-of-mount-saint-vincent",
    },
    { name: "Wearenoble", slug: "wearenoble" },
  ],
  bamboohr: [
    {
      name: "StackOverflow",
      slug: "stackoverflow",
      industry: "Developer Community",
    },
    { name: "Zapier", slug: "zapier", industry: "Automation" },
    { name: "Buffer", slug: "buffer", industry: "Social Media" },
  ],
  recruitee: [
    { name: "Toggl", slug: "toggl", industry: "Productivity" },
    { name: "Hostinger", slug: "hostinger", industry: "Web Hosting" },
  ],
  manatal: [{ name: "Manatal", slug: "manatal", industry: "HR Tech" }],
  paylocity: [
    {
      name: "(Discover from company career page URL pattern: `recruiting.paylocity.com/Recruiting/Jobs/Details/{guid}`)",
      slug: "",
    },
  ],
  phenom: [
    { name: "Boeing", slug: "boeing", industry: "Aerospace" },
    { name: "Hilton", slug: "hilton", industry: "Hospitality" },
    { name: "Nestle", slug: "nestle", industry: "Consumer Goods" },
    { name: "Comcast", slug: "comcast", industry: "Telecom" },
    { name: "Verizon", slug: "verizon", industry: "Telecom" },
  ],
  bullhorn: [
    {
      name: "(Discover from staffing agency career portal source code)",
      slug: "",
    },
  ],
  avature: [
    { name: "Bloomberg", slug: "bloomberg", industry: "Financial Data" },
    {
      name: "KPMG Ireland",
      slug: "kpmgireland",
      industry: "Professional Services",
    },
    {
      name: "Deloitte (PNG)",
      slug: "deloittepng",
      industry: "Professional Services",
    },
    { name: "Maximus", slug: "maximus", industry: "Government Services" },
    { name: "Plante Moran", slug: "plantemoran", industry: "Accounting" },
    { name: "NVA (Vet Group)", slug: "nva", industry: "Veterinary" },
    { name: "Delta", slug: "delta", industry: "Aviation" },
    {
      name: "One800Flowers",
      slug: "one800flowers",
      industry: "Retail / E-commerce",
    },
    { name: "Ally", slug: "ally", industry: "Banking / Finance" },
    { name: "Astellas", slug: "astellas", industry: "Pharmaceuticals" },
    { name: "Bupa ANZ", slug: "bupaanz", industry: "Healthcare / Insurance" },
    { name: "CBRE Global", slug: "cbreglobal", industry: "Real Estate" },
    {
      name: "GPS Hospitality",
      slug: "gpshospitality",
      industry: "Restaurants / Franchising",
    },
    {
      name: "Monadelphous",
      slug: "monadelphous",
      industry: "Engineering / Construction",
    },
    {
      name: "Resource Bank",
      slug: "resourcebank",
      industry: "Financial Services",
    },
  ],
  gem: [
    { name: "Accel", slug: "accel", industry: "Venture Capital" },
    { name: "43North", slug: "43north", industry: "Startup Accelerator" },
    {
      name: "8020 Consulting",
      slug: "8020-consulting",
      industry: "Consulting",
    },
    {
      name: "A16Z Speedrun",
      slug: "a16z-speedrun",
      industry: "Venture Capital",
    },
    { name: "Acre", slug: "acre", industry: "Climate / Sustainability" },
    { name: "Agora", slug: "agora", industry: "Real Estate Tech" },
    { name: "Airframe", slug: "airframe", industry: "Developer Tools" },
    {
      name: "Alex and Ani",
      slug: "alex-and-ani",
      industry: "Retail / Jewelry",
    },
    { name: "11X AI", slug: "11x-ai", industry: "AI / SaaS" },
    {
      name: "10X Construction AI",
      slug: "10xconstruction-ai",
      industry: "Construction Tech",
    },
    { name: "Aarden AI", slug: "aarden-ai", industry: "AI / Sales" },
    { name: "Acely", slug: "acely", industry: "Education Tech" },
    { name: "Afterquery", slug: "afterquery", industry: "AI / Data" },
    { name: "Agenta AI", slug: "agenta-ai", industry: "LLM Ops" },
  ],
  join_com: [
    { name: "Awork", slug: "awork", industry: "Productivity / SaaS" },
    { name: "Alteos", slug: "alteos", industry: "Insurance Tech" },
    { name: "Aitad", slug: "aitad", industry: "AI / Data" },
    { name: "Capitalmind", slug: "capitalmind", industry: "Asset Management" },
    {
      name: "Brandcircle",
      slug: "brandcircle",
      industry: "Marketing / E-commerce",
    },
    { name: "Cinnamood", slug: "cinnamood", industry: "Food / Hospitality" },
    { name: "Brandneo", slug: "brandneo", industry: "Marketing" },
    {
      name: "Brunathelabel",
      slug: "brunathelabel",
      industry: "Fashion / Apparel",
    },
    { name: "Allunity", slug: "allunity", industry: "Crypto / DeFi" },
    {
      name: "Citychickennhas490",
      slug: "citychickennhas490",
      industry: "Restaurants / QSR",
    },
    { name: "Caiz", slug: "caiz", industry: "Crypto / Fintech" },
    { name: "Cannaleo", slug: "cannaleo", industry: "Cannabis Retail" },
    {
      name: "Big City Beats",
      slug: "bigcitybeats",
      industry: "Music / Events",
    },
    { name: "AXSOL", slug: "axsol", industry: "Power / Energy Storage" },
    {
      name: "Career Sancovia",
      slug: "career-sancovia",
      industry: "Career Services",
    },
  ],
  oracle: [
    { name: "Oracle", slug: "eeho-us2", industry: "Enterprise Software" },
    { name: "City of Atlanta", slug: "ehxr-us2", industry: "Government" },
    { name: "TTX", slug: "ejjc-us6", industry: "Rail / Logistics" },
    {
      name: "CooperCompanies",
      slug: "hcjy-us2",
      industry: "Healthcare / MedTech",
    },
    { name: "EXP", slug: "elcn-us2", industry: "Engineering Consulting" },
    { name: "Kroll", slug: "hcxs-us2", industry: "Risk / Financial Advisory" },
    { name: "Macy's", slug: "ebwh-us2", industry: "Retail" },
    { name: "Westpac Group", slug: "ebuu-ap1", industry: "Banking" },
    { name: "DTCC", slug: "ebxr-us2", industry: "Financial Infrastructure" },
    { name: "Hologic", slug: "ebwb-us2", industry: "Medical Devices" },
    { name: "Mountaire", slug: "ebtg-us2", industry: "Food / Poultry" },
    { name: "Mouser", slug: "eabw-us2", industry: "Electronics Distribution" },
    { name: "Ricoh", slug: "cbha-us2", industry: "Imaging / Technology" },
    { name: "Galliford Try", slug: "cbct-em2", industry: "Construction" },
    { name: "Apollo Hospitals", slug: "cgs-ap2", industry: "Healthcare" },
  ],
  mercor: [
    { name: "Stripe", slug: "stripe", industry: "Payments" },
    { name: "OpenAI", slug: "openai", industry: "AI / Foundation Models" },
    {
      name: "Anthropic",
      slug: "anthropic",
      industry: "AI / Foundation Models",
    },
    { name: "Notion", slug: "notion", industry: "Productivity SaaS" },
    { name: "Airbnb", slug: "airbnb", industry: "Travel / Marketplace" },
    { name: "Figma", slug: "figma", industry: "Design Tools" },
    { name: "Vercel", slug: "vercel", industry: "Developer Infrastructure" },
    { name: "Linear", slug: "linear", industry: "Productivity / DevTools" },
    { name: "Discord", slug: "discord", industry: "Social / Communication" },
    { name: "Coinbase", slug: "coinbase", industry: "Crypto / Finance" },
    { name: "Plaid", slug: "plaid", industry: "Fintech / Open Banking" },
    { name: "Ramp", slug: "ramp", industry: "Fintech / Spend Management" },
  ],
  tesla: [
    { name: "Tesla", slug: "tesla", industry: "Electric Vehicles / Energy" },
    { name: "Upstart", slug: "upstart", industry: "Fintech / AI Lending" },
    { name: "Tamara", slug: "tamara", industry: "Fintech / BNPL" },
    {
      name: "TrueLayer",
      slug: "truelayer",
      industry: "Fintech / Open Banking",
    },
    { name: "Public", slug: "public", industry: "Fintech / Retail Investing" },
    { name: "Paystack", slug: "paystack", industry: "Fintech / Payments" },
    {
      name: "Moniepoint",
      slug: "moniepoint",
      industry: "Fintech / Business Banking",
    },
    {
      name: "Thrive Market",
      slug: "thrivemarket",
      industry: "E-commerce / Online Grocery",
    },
    {
      name: "Form3",
      slug: "form3",
      industry: "Fintech / Payments Infrastructure",
    },
    {
      name: "Marvel Fusion",
      slug: "marvelfusion",
      industry: "Energy / Fusion",
    },
    {
      name: "Kairos Power",
      slug: "kairospower",
      industry: "Energy / Advanced Nuclear",
    },
    { name: "Wolt", slug: "wolt", industry: "Food Delivery / Local Commerce" },
    {
      name: "Redwood Materials",
      slug: "redwoodmaterials",
      industry: "Energy / Battery Materials",
    },
    {
      name: "Group14 Technologies",
      slug: "group14",
      industry: "Energy / Battery Materials",
    },
    {
      name: "Carbon",
      slug: "carbon",
      industry: "Manufacturing / Additive Manufacturing",
    },
    {
      name: "Forward",
      slug: "forward",
      industry: "Digital Health / Primary Care",
    },
    { name: "Tia", slug: "tia", industry: "Digital Health / Women’s Health" },
    {
      name: "Headway",
      slug: "headway",
      industry: "Digital Health / Mental Health",
    },
    {
      name: "Talkspace",
      slug: "talkspace",
      industry: "Digital Health / Mental Health",
    },
    {
      name: "Octave",
      slug: "octave",
      industry: "Digital Health / Mental Health",
    },
    { name: "Freenome", slug: "freenome", industry: "Biotech / Diagnostics" },
    {
      name: "Natera",
      slug: "natera",
      industry: "Biotech / Genetic Diagnostics",
    },
    {
      name: "Generate Biomedicines",
      slug: "generatebiomedicines",
      industry: "Biotech / AI Drug Discovery",
    },
    { name: "Oura", slug: "oura", industry: "Consumer Health Hardware" },
    { name: "Carvana", slug: "carvana", industry: "E-commerce / Auto Retail" },
    {
      name: "unybrands",
      slug: "unybrands",
      industry: "E-commerce / Brand Aggregator",
    },
    { name: "Yotpo", slug: "yotpo", industry: "MarTech / E-commerce" },
    { name: "TaxBit", slug: "taxbit", industry: "Fintech / Crypto Tax" },
    {
      name: "Culture Amp",
      slug: "cultureamp",
      industry: "HR Tech / People Analytics",
    },
    {
      name: "Energage",
      slug: "energage",
      industry: "HR Tech / Employee Engagement",
    },
    { name: "Veriff", slug: "veriff", industry: "Identity / KYC" },
    { name: "Thoropass", slug: "thoropass", industry: "Security / Compliance" },
    { name: "Endor Labs", slug: "endorlabs", industry: "Security / AppSec" },
    { name: "Cybereason", slug: "cybereason", industry: "Security / Endpoint" },
    {
      name: "Tanium",
      slug: "tanium",
      industry: "Security / Endpoint Management",
    },
    { name: "Expel", slug: "expel", industry: "Security / MDR" },
    { name: "Figure", slug: "figureai", industry: "Humanoid Robotics / AI" },
    {
      name: "Slice",
      slug: "slice",
      industry: "SMB Fintech / Restaurant Technology",
    },
    {
      name: "Chowbus",
      slug: "chowbus",
      industry: "Restaurant Technology / Food Delivery",
    },
    {
      name: "TabaPay",
      slug: "tabapay",
      industry: "Payments / Fintech Infrastructure",
    },
    {
      name: "PathAI",
      slug: "pathai",
      industry: "Healthcare AI / Digital Pathology",
    },
    {
      name: "Found",
      slug: "found",
      industry: "SMB Fintech / Business Banking",
    },
    {
      name: "Parsley Health",
      slug: "parsleyhealth",
      industry: "Healthcare / Telehealth",
    },
    {
      name: "Neuralink",
      slug: "neuralink",
      industry: "Neurotechnology / Brain-Computer Interface",
    },
    { name: "CLEAR", slug: "clear", industry: "Identity / Biometric Security" },
  ],

  // No known companies yet for the platforms below — add entries as you
  // find them (see the file header for the format).
  adp: [],
  akkencloud: [],
  altamira: [],
  applicantpro: [],
  applicantstack: [],
  applied: [],
  apploi: [],
  arcoro: [],
  avionte: [],
  beamery: [],
  beesite: [],
  beetween: [],
  beisen: [],
  bizneo: [],
  brassring: [],
  breathehr: [],
  breezyhr: [],
  careerplug: [],
  carerix: [],
  catsone: [],
  ceipal: [],
  cezanne: [],
  clearcompany: [],
  cleverconnect: [],
  comeet: [],
  concludis: [],
  connexys: [],
  cornerstone: [],
  crelate: [],
  cvwarehouse: [],
  darwinbox: [],
  dayforce: [],
  deel: [],
  digitalrecruiters: [],
  dover: [],
  dvinci: [],
  easycruit: [],
  eddy: [],
  eightfold: [],
  elmo: [],
  employmenthero: [],
  emply: [],
  eploy: [],
  exacthire: [],
  expr3ss: [],
  factorial: [],
  flatchr: [],
  fountain: [],
  freshteam: [],
  gohire: [],
  greeting: [],
  greythr: [],
  gupy: [],
  harri: [],
  heyrecruit: [],
  hibob: [],
  hireful: [],
  hirehive: [],
  hireology: [],
  hireserve: [],
  hiringthing: [],
  homerun: [],
  hreasily: [],
  hron: [],
  hrone: [],
  hrpartner: [],
  inrecruiting: [],
  ismartrecruit: [],
  isolved: [],
  jazzhr: [],
  jobadder: [],
  jobdiva: [],
  jobscore: [],
  jobsoid: [],
  jobtoolz: [],
  jobtrain: [],
  jobvite: [],
  jobylon: [],
  keka: [],
  kenjo: [],
  livehire: [],
  loxo: [],
  mindscope: [],
  mokahr: [],
  namely: [],
  niceboard: [],
  occupop: [],
  oleeo: [],
  oorwin: [],
  otys: [],
  pageup: [],
  paychex: [],
  paycom: [],
  paycor: [],
  pcrecruiter: [],
  peoplefluent: [],
  // PeopleHR companySlug is the subdomain at `{slug}.peoplehr.net`.
  peoplehr: [
    {
      name: "CBM Global",
      slug: "cbmglobal",
      industry: "HR Tech / Employee Engagement",
    },
  ],
  peoplestrong: [],
  personio: [],
  pinpoint: [],
  polymer: [],
  prescreen: [],
  pyjamahr: [],
  radancy: [],
  reachmee: [],
  recooty: [],
  recruitcrm: [],
  recruiterflow: [],
  recruiteze: [],
  recruitis: [],
  recruitly: [],
  rexx: [],
  roubler: [],
  sagehr: [],
  sagepeople: [],
  scouttalent: [],
  sense: [],
  sesamehr: [],
  skeeled: [],
  snaphunt: [],
  softgarden: [],
  softy: [],
  solides: [],
  subscribehr: [],
  sympa: [],
  symphonytalent: [],
  taleez: [],
  talentadore: [],
  talentera: [],
  talentlyft: [],
  talentreef: [],
  talentsoft: [],
  teamdash: [],
  teamtailor: [],
  tempworks: [],
  trackerrms: [],
  traffit: [],
  trakstar: [],
  tribepad: [],
  turbohire: [],
  ukg: [],
  umantis: [],
  varbi: [],
  vidcruiter: [],
  vincere: [],
  vivahr: [],
  webcruiter: [],
  workatastartup: [],
  workforce: [],
  workstream: [],
  workwise: [],
  wttj: [],
  zimyo: [],
  zohorecruit: [],
  zwayam: [],
};
