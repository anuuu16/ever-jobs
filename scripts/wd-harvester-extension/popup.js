/* popup.js — search-plan editor, run/stop controls, list view + copy. */

const DATA = 'atsHarvest';
const RUN = 'atsRun';
const PLAN = 'atsPlan';

const DEFAULT_SITES = [
  'myworkdayjobs.com',
  'boards.greenhouse.io',
  'jobs.lever.co',
  'jobs.ashbyhq.com',
  'bamboohr.com',
  'breezy.hr',
  'applytojob.com',
  'jobs.personio.com',
  'apply.workable.com',
  'recruitee.com',
  'teamtailor.com',
  'eightfold.ai',
  'sensehq.com',
  'zohorecruit.com',
  'smartrecruiters.com',
];

const $ = (id) => document.getElementById(id);
const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function buildQueries() {
  const sites = lines($('sites').value);
  const kws = lines($('keywords').value);
  const queries = [];
  for (const site of sites) {
    if (kws.length === 0) queries.push(`site:${site}`);
    else for (const kw of kws) queries.push(`site:${site} ${kw}`);
  }
  return queries;
}

function savePlan() {
  chrome.storage.local.set({
    [PLAN]: { sites: $('sites').value, keywords: $('keywords').value, maxPages: +$('maxPages').value || 3 },
  });
  $('planCount').textContent = `${buildQueries().length} queries`;
}

function firstUrl(q) { return `https://www.google.com/search?q=${encodeURIComponent(q)}&num=100&hl=en`; }

function renderData() {
  chrome.storage.local.get([DATA], (res) => {
    const rows = res[DATA] || [];
    const byPlat = {};
    for (const r of rows) byPlat[r.platform] = (byPlat[r.platform] || 0) + 1;

    // Keep the filter dropdown in sync.
    const sel = $('filter');
    const cur = sel.value;
    sel.innerHTML = '<option value="">all platforms</option>' +
      Object.keys(byPlat).sort().map((p) => `<option value="${p}">${p} (${byPlat[p]})</option>`).join('');
    sel.value = cur;

    const filtered = cur ? rows.filter((r) => r.platform === cur) : rows;
    $('count').textContent = `${rows.length} collected`;
    $('list').value = filtered.map((r) => `${r.platform}\t${r.slug}\t${r.url}`).join('\n');
  });
}

function renderRun() {
  chrome.storage.local.get([RUN], (res) => {
    const s = res[RUN];
    const running = !!(s && s.running);
    $('run').disabled = running;
    $('stop').disabled = !running;
    if (running) {
      $('status').textContent = `Running · query ${s.qIndex + 1}/${s.queries.length} · page ${s.page}`;
    } else if (s && s.stoppedReason === 'captcha') {
      $('status').textContent = 'Stopped: Google CAPTCHA — wait a bit, then Run again.';
    } else if (s && s.stoppedReason === 'done') {
      $('status').textContent = 'Run complete.';
    } else {
      $('status').textContent = '';
    }
  });
}

// ── controls ────────────────────────────────────────────────────────────────
$('run').addEventListener('click', () => {
  const queries = buildQueries();
  if (queries.length === 0) { $('status').textContent = 'Add at least one site target.'; return; }
  savePlan();
  const maxPages = +$('maxPages').value || 3;
  chrome.storage.local.set({ [RUN]: { running: true, queries, qIndex: 0, page: 1, maxPages, stoppedReason: null } }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.update(tab.id, { url: firstUrl(queries[0]) });
      window.close(); // let it run; reopen the popup anytime to watch progress
    });
  });
});

$('stop').addEventListener('click', () => {
  chrome.storage.local.get([RUN], (res) => {
    chrome.storage.local.set({ [RUN]: { ...(res[RUN] || {}), running: false, stoppedReason: 'manual' } }, renderRun);
  });
});

$('copy').addEventListener('click', () => {
  navigator.clipboard.writeText($('list').value).then(() => {
    const b = $('copy'); const old = b.textContent; b.textContent = 'Copied!';
    setTimeout(() => (b.textContent = old), 1200);
  });
});

$('copyVerify').addEventListener('click', () => {
  chrome.storage.local.get([DATA], (res) => {
    const rows = res[DATA] || [];
    const cur = $('filter').value;
    const use = cur ? rows.filter((r) => r.platform === cur) : rows;
    // { platform: [slug, ...] } — deduped, sorted — ready to run per platform.
    const grouped = {};
    for (const r of use) (grouped[r.platform] ||= []).push(r.slug);
    for (const p of Object.keys(grouped)) grouped[p] = [...new Set(grouped[p])].sort();
    const out = JSON.stringify(grouped, null, 2);
    navigator.clipboard.writeText(out).then(() => {
      const b = $('copyVerify'); const old = b.textContent;
      b.textContent = `Copied ${use.length}!`;
      setTimeout(() => (b.textContent = old), 1400);
    });
  });
});

$('clear').addEventListener('click', () => {
  if (!confirm('Clear the whole collected list?')) return;
  chrome.storage.local.set({ [DATA]: [] }, renderData);
});

$('filter').addEventListener('change', renderData);
['sites', 'keywords', 'maxPages'].forEach((id) => $(id).addEventListener('input', savePlan));

chrome.storage.onChanged.addListener((c) => { if (c[DATA]) renderData(); if (c[RUN]) renderRun(); });

// ── init ────────────────────────────────────────────────────────────────────
chrome.storage.local.get([PLAN], (res) => {
  const p = res[PLAN] || {};
  $('sites').value = p.sites != null ? p.sites : DEFAULT_SITES.join('\n');
  $('keywords').value = p.keywords != null ? p.keywords : '';
  $('maxPages').value = p.maxPages || 3;
  $('planCount').textContent = `${buildQueries().length} queries`;
});
renderData();
renderRun();
