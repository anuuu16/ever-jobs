/*
 * ats-serp-harvester.js — BROWSER CONSOLE snippet (Workday-only)
 * ---------------------------------------------------------------------------
 * Harvests Workday career URLs from a Google search-results page and appends
 * them to localStorage so results accumulate across every search and every
 * "Next page". Then one call copies the collection to your clipboard.
 *
 * Built for links exactly like the one you shared:
 *     https://gnw.wd1.myworkdayjobs.com/GNW
 *   →  tenant "gnw", datacenter "wd1", site "GNW"
 *   →  slug for this repo:  gnw:1:GNW   (company:NUMBER:site — no "wd" prefix)
 *
 * WHY .js and not .ts: it's pasted straight into Chrome DevTools (F12 →
 * Console) — browser globals + the DevTools-only copy(). Not part of the TS
 * build; saved here only as a reference.
 *
 * ── HOW TO USE ─────────────────────────────────────────────────────────────
 *   1. Google:  site:myworkdayjobs.com software engineer
 *      (append &num=100 to the URL for 100 results per page.)
 *   2. Open DevTools console, paste this whole file, then run  wdHarvest()
 *      — repeat on each page / new search. Duplicates are ignored.
 *   3. When done, run  wdCopy()  and paste the clipboard back here.
 *   4. Start over with  wdClear().  See counts with  wdList().
 */

(() => {
  const KEY = 'wdHarvest';

  // Unwrap Google's /url?...&url=<real> redirect wrappers, else return as-is.
  const deref = (href) => {
    try {
      const x = new URL(href, location.href);
      if (x.hostname.endsWith('google.com') && x.pathname === '/url') {
        return x.searchParams.get('url') || x.searchParams.get('q');
      }
      return x.href;
    } catch { return href; }
  };

  // A Workday URL → { tenant, dc, site, slug, url }. Null if not Workday.
  const parseWorkday = (u) => {
    let host, path;
    try { const x = new URL(u); host = x.hostname.toLowerCase(); path = x.pathname; } catch { return null; }
    // dc is the DIGITS only — the scraper prepends "wd", so the slug is
    // tenant:NUMBER:site (e.g. intel:1:External), not intel:wd1:External.
    const m = host.match(/^([\w-]+)\.wd(\d+)\.myworkdayjobs\.com$/);
    if (!m) return null;
    const [, tenant, dc] = m;
    // First path segment is the career-site name — unless it's a locale
    // (e.g. "en-US"), in which case the site is the segment after it.
    const seg = path.split('/').filter(Boolean);
    const isLocale = (s) => /^[a-z]{2}([-_][a-z]{2})?$/i.test(s);
    const site = (seg[0] && isLocale(seg[0]) ? seg[1] : seg[0]) || '';
    const url = `https://${host}/${site}`;
    return { tenant, dc, site, slug: `${tenant}:${dc}:${site}`, url };
  };

  const load = () => new Map(JSON.parse(localStorage.getItem(KEY) || '[]').map((r) => [r.slug, r]));

  // Scrape the current page, append new Workday rows. Returns running total.
  window.wdHarvest = () => {
    const store = load();
    let added = 0;
    document.querySelectorAll('a[href]').forEach((a) => {
      const u = deref(a.getAttribute('href') || a.href);
      if (!u) return;
      const r = parseWorkday(u);
      if (!r || !r.site) return;            // skip bare hosts with no site path
      if (!store.has(r.slug)) { store.set(r.slug, r); added++; }
    });
    localStorage.setItem(KEY, JSON.stringify([...store.values()]));
    console.log(`[WD] +${added} new on this page · ${store.size} total stored`);
    return store.size;
  };

  // Print the saved list as a table.
  window.wdList = () => { console.table([...load().values()]); return load().size; };

  // Copy everything as `slug<TAB>url` lines (DevTools copy()).
  window.wdCopy = () => {
    const rows = [...load().values()];
    const txt = rows.map((r) => `${r.slug}\t${r.url}`).join('\n');
    try { copy(txt); } catch { /* copy() is DevTools-only */ }
    console.log(`[WD] copied ${rows.length} rows to clipboard`);
    return txt;
  };

  // Wipe the collection.
  window.wdClear = () => { localStorage.removeItem(KEY); console.log('[WD] cleared'); };

  console.log('[WD] ready → wdHarvest() per page · wdList() · wdCopy() when done · wdClear()');
})();

/*
 * ── BOOKMARKLET (one click per page, survives navigation) ───────────────────
 * New bookmark → paste this whole line as the URL. Click it on each results
 * page; it harvests and alerts the running total.
 *
 * javascript:(function(){var K='wdHarvest';function D(h){try{var x=new URL(h,location.href);if(x.hostname.endsWith('google.com')&&x.pathname==='/url')return x.searchParams.get('url')||x.searchParams.get('q');return x.href;}catch(e){return h;}}function P(u){var host,path;try{var x=new URL(u);host=x.hostname.toLowerCase();path=x.pathname;}catch(e){return null;}var m=host.match(/^([\w-]+)\.wd(\d+)\.myworkdayjobs\.com$/);if(!m)return null;var seg=path.split('/').filter(Boolean),L=function(s){return/^[a-z]{2}([-_][a-z]{2})?$/i.test(s);};var site=(seg[0]&&L(seg[0])?seg[1]:seg[0])||'';if(!site)return null;return{slug:m[1]+':'+m[2]+':'+site,url:'https://'+host+'/'+site};}var st=new Map(JSON.parse(localStorage.getItem(K)||'[]').map(function(r){return[r.slug,r];})),n=0;document.querySelectorAll('a[href]').forEach(function(a){var u=D(a.getAttribute('href')||a.href);if(!u)return;var r=P(u);if(!r)return;if(!st.has(r.slug)){st.set(r.slug,r);n++;}});localStorage.setItem(K,JSON.stringify(Array.from(st.values())));alert('Workday harvest\n+'+n+' new\n'+st.size+' total stored');})();
 *
 * Copy later — second bookmark:
 * javascript:(function(){var r=JSON.parse(localStorage.getItem('wdHarvest')||'[]');var t=r.map(function(x){return x.slug+'\t'+x.url;}).join('\n');navigator.clipboard.writeText(t).then(function(){alert('Copied '+r.length+' rows');});})();
 */
