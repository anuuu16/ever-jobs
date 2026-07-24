/*
 * content.js — runs on every Google results page.
 *
 * Two jobs:
 *  1) PASSIVE HARVEST: read the ATS career links already on the page (no
 *     network calls, no clicking results) and append them to storage, deduped.
 *  2) AUTO-RUN (optional): when a run is active, page through the current query
 *     then advance to the next saved query — all by navigating the tab itself.
 *     Pauses instantly on a Google CAPTCHA / "unusual traffic" wall (never
 *     tries to solve or bypass it) WITHOUT losing its place: `queries`,
 *     `qIndex`, and `page` stay exactly as they were, and `lastGoodUrl` keeps
 *     tracking the freshest non-challenge results page — including while
 *     paused, since the user may navigate/solve things by hand. Clicking
 *     Resume in the popup jumps back to `lastGoodUrl` and re-arms `running`,
 *     continuing the same run instead of rebuilding the query list from
 *     scratch (which is what re-clicking Run does).
 */

const DATA = 'atsHarvest';   // Array<{platform, slug, url}>
const RUN = 'atsRun';        // { running, queries[], qIndex, page, maxPages, lastGoodUrl, stoppedReason }

// ── URL → { platform, slug, url } ──────────────────────────────────────────
function parseAts(u) {
  let host, path;
  try { const x = new URL(u); host = x.hostname.toLowerCase(); path = x.pathname; } catch { return null; }
  const seg = path.split('/').filter(Boolean);
  const loc = (s) => /^[a-z]{2}([-_][a-z]{2})?$/i.test(s || '');
  let m;

  if (m = host.match(/^([\w-]+)\.wd(\d+)\.myworkdayjobs\.com$/)) {
    // wdNumber is the DIGITS only — the scraper prepends "wd" itself, so the
    // slug is company:NUMBER:site (e.g. intel:1:External), not intel:wd1:...
    const site = loc(seg[0]) ? seg[1] : seg[0];
    return site ? { platform: 'workday', slug: `${m[1]}:${m[2]}:${site}`, url: `https://${host}/wd${m[2]}/${site}` } : null;
  }
  if (/(^|\.)greenhouse\.io$/.test(host) && seg[0] && seg[0] !== 'embed')
    return { platform: 'greenhouse', slug: seg[0].toLowerCase(), url: `https://boards.greenhouse.io/${seg[0].toLowerCase()}` };
  if (/(^|\.)lever\.co$/.test(host) && seg[0])
    return { platform: 'lever', slug: seg[0].toLowerCase(), url: `https://jobs.lever.co/${seg[0].toLowerCase()}` };
  if (/(^|\.)ashbyhq\.com$/.test(host) && seg[0])
    return { platform: 'ashby', slug: seg[0], url: `https://jobs.ashbyhq.com/${seg[0]}` };
  if (m = host.match(/^([\w-]+)\.bamboohr\.com$/))
    return { platform: 'bamboohr', slug: m[1], url: `https://${host}/careers` };
  if (m = host.match(/^([\w-]+)\.breezy\.hr$/))
    return { platform: 'breezyhr', slug: m[1], url: `https://${host}` };
  if (m = host.match(/^([\w-]+)\.applytojob\.com$/))
    return { platform: 'jazzhr', slug: m[1], url: `https://${host}/apply/jobs/` };
  if (m = host.match(/^([\w-]+)\.jobs\.personio\.(com|de)$/))
    return { platform: 'personio', slug: m[1], url: `https://${host}` };
  if (/(^|\.)workable\.com$/.test(host) && seg[0])
    return { platform: 'workable', slug: seg[0], url: `https://apply.workable.com/${seg[0]}` };
  if ((m = host.match(/^([\w-]+)\.recruitee\.com$/)) && m[1] !== 'jobs')
    return { platform: 'recruitee', slug: m[1], url: `https://${host}` };
  if ((m = host.match(/^([\w-]+)\.teamtailor\.com$/)) && !['career', 'www', 'app'].includes(m[1]))
    return { platform: 'teamtailor', slug: m[1], url: `https://${host}` };
  if (m = host.match(/^([\w-]+)\.eightfold\.ai$/))
    return { platform: 'eightfold', slug: m[1], url: `https://${host}` };
  if (m = host.match(/^([\w-]+)\.sensehq\.com$/))
    return { platform: 'sense', slug: m[1], url: `https://${host}/careers` };
  if (m = host.match(/^([\w-]+)\.zohorecruit\.com$/))
    return { platform: 'zohorecruit', slug: m[1], url: `https://${host}` };
  if (m = host.match(/^([\w-]+)\.freshteam\.com$/))
    return { platform: 'freshteam', slug: m[1], url: `https://${host}` };
  if (/smartrecruiters\.com$/.test(host) && seg[0])
    return { platform: 'smartrecruiters', slug: seg[0], url: `https://careers.smartrecruiters.com/${seg[0]}` };
  if (m = host.match(/^([\w-]+)\.taleo\.net$/))
    return { platform: 'taleo', slug: m[1], url: `https://${host}` };
  if (m = host.match(/^([\w-]+)\.avature\.net$/))
    return { platform: 'avature', slug: m[1], url: `https://${host}` };
  return null;
}

// Unwrap Google's /url?...&url=<real> redirect wrappers.
function deref(href) {
  try {
    const x = new URL(href, location.href);
    if (x.hostname.endsWith('google.com') && x.pathname === '/url') {
      return x.searchParams.get('url') || x.searchParams.get('q');
    }
    return x.href;
  } catch { return href; }
}

function isChallengePage() {
  if (location.pathname.startsWith('/sorry')) return true;
  const t = (document.body && document.body.innerText || '').toLowerCase();
  return /unusual traffic|are you a robot|not a robot|detected unusual/.test(t)
    || !!document.querySelector('form[action*="sorry"], iframe[src*="recaptcha"]');
}

const key = (r) => `${r.platform}|${r.slug}`;

function harvestPage(cb) {
  chrome.storage.local.get([DATA], (res) => {
    const store = new Map((res[DATA] || []).map((r) => [key(r), r]));
    let added = 0;
    document.querySelectorAll('a[href]').forEach((a) => {
      const r = parseAts(deref(a.getAttribute('href') || a.href));
      if (r && !store.has(key(r))) { store.set(key(r), r); added++; }
    });
    const list = [...store.values()];
    chrome.storage.local.set({ [DATA]: list }, () => cb(added, list.length));
  });
}

function buildUrl(q) {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}&num=100&hl=en`;
}

function syncAndDrive() {
  chrome.storage.local.get([RUN], (res) => {
    const raw = res[RUN];
    if (!raw) return; // no search plan saved yet — nothing to drive or track

    const challenge = isChallengePage();
    // Keep the freshest known-good results URL for Resume — computed once so
    // every write below uses the SAME snapshot (avoids a stale-`raw` write
    // clobbering this update; see note on the paused branch).
    const s = challenge ? raw : { ...raw, lastGoodUrl: location.href };

    if (!raw.running) {
      // Paused (CAPTCHA or manual Stop). Never auto-navigate — but do persist
      // a fresher lastGoodUrl if the user has manually browsed forward while
      // paused, so Resume jumps to where they actually are, not where the
      // pause first happened.
      if (s.lastGoodUrl !== raw.lastGoodUrl) chrome.storage.local.set({ [RUN]: s });
      return;
    }

    if (challenge) {
      chrome.storage.local.set({ [RUN]: { ...s, running: false, stoppedReason: 'captcha' } });
      console.warn('[ATS] CAPTCHA / unusual-traffic wall — run PAUSED, not lost. Solve it in this tab, then click Resume in the popup to continue from the same query/page.');
      return;
    }

    const delay = 3000 + Math.random() * 3500; // 3–6.5s, human-ish
    const next = document.querySelector('a#pnnext');

    if (s.page < s.maxPages && next) {
      chrome.storage.local.set({ [RUN]: { ...s, page: s.page + 1 } }, () => {
        setTimeout(() => { location.href = next.href; }, delay);
      });
      return;
    }

    // No more pages (or hit maxPages) → advance to the next saved query.
    const qIndex = s.qIndex + 1;
    if (qIndex >= s.queries.length) {
      chrome.storage.local.set({ [RUN]: { ...s, running: false, stoppedReason: 'done' } });
      console.log('[ATS] run complete.');
      return;
    }
    chrome.storage.local.set({ [RUN]: { ...s, qIndex, page: 1 } }, () => {
      setTimeout(() => { location.href = buildUrl(s.queries[qIndex]); }, delay);
    });
  });
}

// Passive harvest on every load, then drive (or track) the run if one exists.
harvestPage((added, total) => {
  console.log(`[ATS] +${added} new · ${total} total`);
  syncAndDrive();
});
