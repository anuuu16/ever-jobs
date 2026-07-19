/**
 * Self-contained (no CDN deps) local admin page — served as-is by
 * `AdminController.page()`. Plain HTML/CSS/vanilla JS on purpose: this
 * is a local debugging tool, not a product surface, so it stays a
 * single dependency-free file instead of a build step.
 */
export const ADMIN_UI_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>MyLivecv Jobs — Local Admin</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root {
    color-scheme: light dark;
    --border: #d0d7de;
    --muted: #6e7781;
    --bg-alt: #f6f8fa;
    --accent: #0969da;
    --ok: #1a7f37;
    --bad: #cf222e;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 1.5rem;
    max-width: 1200px;
    margin-inline: auto;
  }
  h1 { font-size: 1.25rem; margin: 0 0 1rem; }
  .run-panel {
    background: var(--bg-alt);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
  }
  .run-panel h2 { font-size: 0.95rem; margin: 0 0 0.75rem; }
  #tab-analytics h2 { font-size: 0.95rem; margin: 1.5rem 0 0.75rem; }
  #tab-analytics h2:first-of-type { margin-top: 0; }
  .hint { font-weight: 400; color: var(--muted); }
  .checkbox-label {
    flex-direction: row !important;
    align-items: center;
    gap: 0.4rem !important;
  }
  hr { border: none; border-top: 1px solid var(--border); margin: 1.25rem 0; }
  .bg-job-row { margin-bottom: 1rem; }
  .bg-job-row:last-child { margin-bottom: 0; }
  .bg-job-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
  button.danger { border-color: var(--bad); color: var(--bad); }
  button.danger:hover:not(:disabled) { background: var(--bad); color: #fff; }
  .confirm-inline {
    display: none;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding: 0.5rem 0.7rem;
    background: var(--bg-alt);
    border: 1px solid var(--border);
    border-radius: 6px;
  }
  .confirm-inline.open { display: flex; }
  .confirm-inline input {
    font: inherit;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    min-width: 14rem;
  }
  .bg-job-progress { color: var(--muted); font-size: 0.8rem; }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
    align-items: end;
  }
  .filters label {
    display: flex;
    flex-direction: column;
    font-size: 0.75rem;
    color: var(--muted);
    gap: 0.25rem;
  }
  .filters input, .filters select {
    font: inherit;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    min-width: 10rem;
  }
  button {
    font: inherit;
    padding: 0.45rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-alt);
    cursor: pointer;
  }
  button:hover:not(:disabled) { border-color: var(--accent); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th, td {
    text-align: left;
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  th { color: var(--muted); font-weight: 600; }
  tbody tr { cursor: pointer; }
  tbody tr:hover { background: var(--bg-alt); }
  .badge {
    display: inline-block;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge.yes { background: #dafbe1; color: var(--ok); }
  .badge.no { background: #ffebe9; color: var(--bad); }
  .badge.unknown { background: var(--bg-alt); color: var(--muted); }
  .badge.remote { background: #ddf4ff; color: var(--accent); }
  .badge.onsite { background: var(--bg-alt); color: var(--muted); }
  .pager { display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem; }
  .pager span { color: var(--muted); font-size: 0.85rem; }
  .status { color: var(--muted); font-size: 0.85rem; margin: 0.5rem 0; min-height: 1.2em; }
  .empty { color: var(--muted); padding: 2rem 0; text-align: center; }
  .stats-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .stat-tile {
    background: var(--bg-alt);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
    min-width: 9rem;
  }
  .stat-tile .stat-value { font-size: 1.3rem; font-weight: 600; line-height: 1.2; }
  .stat-tile .stat-label { font-size: 0.75rem; color: var(--muted); }

  .tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--border); margin-bottom: 1.25rem; }
  .tab-btn {
    font: inherit;
    padding: 0.55rem 1rem;
    border: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }
  .tab-btn:hover:not(.active) { color: var(--accent); }
  .tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  .badge.warn { background: #fff8c5; color: #9a6700; }

  #overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  #overlay.open { display: flex; }
  #detail-panel {
    background: Canvas;
    color: CanvasText;
    border-radius: 10px;
    max-width: 720px;
    width: 100%;
    max-height: 85vh;
    overflow: auto;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  }
  #detail-panel h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
  #detail-panel .sub { color: var(--muted); margin-bottom: 1rem; }
  .kv { display: grid; grid-template-columns: 9rem 1fr; gap: 0.35rem 0.75rem; font-size: 0.85rem; margin-bottom: 1rem; }
  .kv dt { color: var(--muted); }
  .kv dd { margin: 0; word-break: break-word; }
  #detail-desc {
    white-space: pre-wrap;
    font-size: 0.85rem;
    background: var(--bg-alt);
    border-radius: 6px;
    padding: 0.75rem;
    max-height: 16rem;
    overflow: auto;
  }
  .sources-list { list-style: none; padding: 0; margin: 0; font-size: 0.8rem; }
  .sources-list li { padding: 0.4rem 0; border-bottom: 1px solid var(--border); }
  .raw-response { margin-top: 0.4rem; }
  .raw-response summary { cursor: pointer; color: var(--accent); font-size: 0.75rem; }
  .raw-response pre {
    white-space: pre-wrap;
    word-break: break-all;
    font-size: 0.7rem;
    background: var(--bg-alt);
    border-radius: 6px;
    padding: 0.6rem;
    max-height: 20rem;
    overflow: auto;
    margin: 0.4rem 0 0;
  }
  .close-btn { float: right; }

  #sites-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.4);
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    z-index: 10;
  }
  #sites-overlay.open { display: flex; }
  #sites-panel {
    background: Canvas;
    color: CanvasText;
    border-radius: 10px;
    max-width: 640px;
    width: 100%;
    max-height: 85vh;
    overflow: auto;
    padding: 1.25rem 1.5rem;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
  }
  #sites-panel h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
  #sites-panel .sub { color: var(--muted); font-size: 0.8rem; margin-bottom: 0.75rem; }
  #sites-search {
    font: inherit;
    padding: 0.4rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    margin-bottom: 0.6rem;
  }
  .sites-toolbar { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.75rem; }
  #sites-groups { overflow: auto; flex: 1; min-height: 10rem; }
  .site-category { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 0.5rem; }
  .site-category summary {
    cursor: pointer;
    padding: 0.5rem 0.7rem;
    font-size: 0.85rem;
    background: var(--bg-alt);
    list-style: none;
  }
  .site-category summary label { cursor: pointer; }
  .site-list { padding: 0.4rem 0.7rem 0.6rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.2rem 0.75rem; }
  .site-item { display: flex; align-items: center; gap: 0.35rem; font-size: 0.8rem; cursor: pointer; }
  .site-item .hint { font-size: 0.7rem; }
  #btn-sites-done { margin-top: 0.75rem; }
</style>
</head>
<body>
  <h1>MyLivecv Jobs — Local Admin</h1>

  <div class="tabs" role="tablist">
    <button type="button" class="tab-btn active" id="tabbtn-run" role="tab">Run &amp; Extract</button>
    <button type="button" class="tab-btn" id="tabbtn-jobs" role="tab">Jobs</button>
    <button type="button" class="tab-btn" id="tabbtn-sources" role="tab">Sources</button>
    <button type="button" class="tab-btn" id="tabbtn-analytics" role="tab">Analytics</button>
  </div>

  <div id="tab-run" class="tab-panel active">

  <div class="run-panel">
    <h2>Run extraction</h2>
    <div class="filters">
      <label>Sites
        <button type="button" id="btn-choose-sites">Choose sites… <span id="sites-summary" class="hint">(default list)</span></button>
      </label>
      <label>Search term
        <input id="r-search-term" type="text" placeholder="e.g. engineer" />
      </label>
      <label>Location
        <input id="r-location" type="text" placeholder="e.g. Remote" />
      </label>
      <label>Results wanted
        <input id="r-results" type="number" min="1" max="100" value="20" />
      </label>
      <label class="checkbox-label">
        <input id="r-remote" type="checkbox" /> Remote only
      </label>
      <label class="checkbox-label">
        <input id="r-capture-raw" type="checkbox" /> Capture raw response
      </label>
      <button class="primary" id="btn-run">Run now</button>
    </div>
    <div class="status" id="run-status"></div>
  </div>

  <div class="run-panel">
    <h2>Background jobs</h2>
    <div class="sub">
      These run automatically with no manual site or company selection, start in the
      background (the request returns immediately), and their status is still visible
      after a page refresh.
    </div>

    <div class="bg-job-row">
      <div class="bg-job-controls">
        <button type="button" id="btn-extract-all">Extract ALL sources</button>
        <span class="hint">Runs every registered source AND every known ATS company (~530 companies) — can take a very long time.</span>
      </div>
      <div class="confirm-inline" id="confirm-extract-all">
        <input type="text" id="confirm-extract-all-input" placeholder='Type "EXTRACT ALL" to confirm' />
        <button type="button" class="primary" id="confirm-extract-all-btn" disabled>Confirm</button>
        <button type="button" id="confirm-extract-all-cancel">Cancel</button>
      </div>
      <div class="status" id="extract-all-status"></div>
    </div>

    <div class="bg-job-row">
      <div class="bg-job-controls">
        <button type="button" id="btn-export-all">Sync new to platform</button>
        <span class="hint">Pushes only NOT-yet-exported jobs to the configured downstream target (DAILY_EXPORT_TARGET_URL) and marks them exported — already-exported jobs are skipped, not re-sent. Requires a configured target.</span>
      </div>
      <div class="status" id="export-all-status"></div>
    </div>

    <div class="bg-job-row">
      <div class="bg-job-controls">
        <button type="button" id="btn-export-all-full">Sync ALL to platform</button>
        <span class="hint">Re-pushes EVERY job to the target, ignoring already-exported status — use this to propagate data changes (a re-scrape updated a description/compensation/etc.) that "Sync new" would skip. Does not check whether a posting has expired; it's a full data resync, not an expiry sweep. Can be a very large/expensive run on a big store.</span>
      </div>
      <div class="confirm-inline" id="confirm-export-all-full">
        <input type="text" id="confirm-export-all-full-input" placeholder='Type "SYNC ALL" to confirm' />
        <button type="button" class="primary" id="confirm-export-all-full-btn" disabled>Confirm</button>
        <button type="button" id="confirm-export-all-full-cancel">Cancel</button>
      </div>
      <div class="status" id="export-all-full-status"></div>
    </div>

    <div class="bg-job-row">
      <div class="bg-job-controls">
        <button type="button" id="btn-reset-exported">Mark all as NOT exported</button>
        <span class="hint">Clears every "already exported" mark (job data is untouched) — the next sync/cron tick re-pushes everything.</span>
      </div>
      <div class="confirm-inline" id="confirm-reset-exported">
        <input type="text" id="confirm-reset-exported-input" placeholder='Type "RESET EXPORTED" to confirm' />
        <button type="button" class="primary" id="confirm-reset-exported-btn" disabled>Confirm</button>
        <button type="button" id="confirm-reset-exported-cancel">Cancel</button>
      </div>
      <div class="status" id="reset-exported-status"></div>
    </div>

    <div class="bg-job-row">
      <div class="bg-job-controls">
        <button type="button" id="btn-delete-all" class="danger">Delete ALL data</button>
        <span class="hint">Wipes every canonical job, exported mark, and run watermark. Irreversible.</span>
      </div>
      <div class="confirm-inline" id="confirm-delete-all">
        <input type="text" id="confirm-delete-all-input" placeholder='Type "DELETE ALL" to confirm' />
        <button type="button" class="primary" id="confirm-delete-all-btn" disabled>Confirm</button>
        <button type="button" id="confirm-delete-all-cancel">Cancel</button>
      </div>
      <div class="status" id="delete-all-status"></div>
    </div>
  </div>

  <div class="run-panel">
    <h2>ATS company batch</h2>
    <div class="sub">
      Pick an ATS platform and scrape its known companies (or type a slug manually) without
      hand-entering a URL each time. "Results per company" applies to <em>each</em> selected
      company — 10 means 10 jobs from every one you pick, not 10 total.
    </div>
    <div class="filters">
      <label>ATS platform
        <select id="ats-platform-select"><option value="">Loading…</option></select>
      </label>
      <label>Search term
        <input id="ats-search-term" type="text" placeholder="e.g. engineer" />
      </label>
      <label>Location
        <input id="ats-location" type="text" placeholder="e.g. Remote" />
      </label>
      <label>Results per company
        <input id="ats-results" type="number" min="1" max="100" value="10" />
      </label>
      <label class="checkbox-label">
        <input id="ats-remote" type="checkbox" /> Remote only
      </label>
      <label class="checkbox-label">
        <input id="ats-capture-raw" type="checkbox" /> Capture raw response
      </label>
    </div>

    <div id="ats-companies-section" style="display:none">
      <div class="sites-toolbar">
        <button type="button" id="btn-ats-select-all">Select all known</button>
        <button type="button" id="btn-ats-clear-all">Clear all</button>
        <span id="ats-selected-count" class="hint"></span>
      </div>
      <div id="ats-companies-list"></div>

      <div class="filters" style="margin-top:0.5rem">
        <label>Add custom slug <span class="hint">(not in the list above)</span>
          <input id="ats-custom-slug" type="text" placeholder="e.g. mycompany or mycompany:5:External" />
        </label>
        <button type="button" id="btn-ats-add-slug">Add</button>
      </div>
      <ul id="ats-custom-slugs-list" class="sources-list"></ul>
    </div>

    <button class="primary" id="btn-ats-run">Scrape selected companies</button>
    <div class="status" id="ats-run-status"></div>
  </div>

  </div> <!-- /tab-run -->

  <div id="tab-jobs" class="tab-panel">

  <div class="stats-bar">
    <div class="stat-tile">
      <div class="stat-value" id="stat-total">—</div>
      <div class="stat-label">Available (matching filters)</div>
    </div>
    <div class="stat-tile">
      <div class="stat-value" id="stat-exported">—</div>
      <div class="stat-label">Exported (all time)</div>
    </div>
  </div>

  <div class="filters">
    <label>Search (title)
      <input id="f-search" type="text" placeholder="e.g. engineer" />
    </label>
    <label>Company
      <input id="f-company" type="text" placeholder="e.g. Acme" />
    </label>
    <label>Location
      <input id="f-location" type="text" placeholder="e.g. Remote" />
    </label>
    <label>Since
      <input id="f-since" type="date" />
    </label>
    <label>Remote
      <select id="f-remote">
        <option value="">All</option>
        <option value="true">Remote only</option>
        <option value="false">Onsite / hybrid only</option>
      </select>
    </label>
    <label>Page size
      <select id="f-limit">
        <option>25</option>
        <option selected>50</option>
        <option>100</option>
        <option>250</option>
      </select>
    </label>
    <button class="primary" id="btn-search">Search</button>
    <button id="btn-reset">Reset</button>
  </div>

  <div class="status" id="status"></div>

  <table>
    <thead>
      <tr>
        <th>Title</th>
        <th>Company</th>
        <th>Location</th>
        <th>Remote</th>
        <th>Merged At</th>
        <th>Sources</th>
        <th>Exported</th>
      </tr>
    </thead>
    <tbody id="rows"></tbody>
  </table>
  <div id="empty" class="empty" style="display:none">No jobs match these filters.</div>

  <div class="pager">
    <button id="btn-prev">&larr; Prev</button>
    <button id="btn-next">Next &rarr;</button>
    <span id="pager-info"></span>
  </div>

  </div> <!-- /tab-jobs -->

  <div id="tab-sources" class="tab-panel">
    <div class="sub" style="margin-bottom:0.75rem">
      Per-source job counts (from the persisted store) and circuit-breaker health for
      <strong>this running process</strong> — health resets on restart. "Untested" means a
      source hasn't been called since the API last started, not that it's broken.
    </div>
    <div class="sites-toolbar">
      <button type="button" id="btn-sources-refresh">Refresh</button>
      <span id="sources-summary" class="hint"></span>
    </div>
    <div class="status" id="sources-status"></div>
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th>Category</th>
          <th>Jobs</th>
          <th>Status</th>
          <th>Success rate</th>
          <th>p95 latency</th>
          <th>Last error</th>
        </tr>
      </thead>
      <tbody id="sources-rows"></tbody>
    </table>
    <div id="sources-empty" class="empty" style="display:none">No registered sources found.</div>
  </div> <!-- /tab-sources -->

  <div id="tab-analytics" class="tab-panel">
    <div class="sub" style="margin-bottom:0.75rem">
      Basic analytics from the persisted store — full scan, same cost as the Sources tab.
      Days are bucketed by UTC calendar day the job was merged in.
    </div>
    <div class="sites-toolbar">
      <button type="button" id="btn-analytics-refresh">Refresh</button>
    </div>
    <div class="status" id="analytics-status"></div>

    <div class="stats-bar">
      <div class="stat-tile">
        <div class="stat-value" id="stat-analytics-total">—</div>
        <div class="stat-label">Total jobs</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value" id="stat-analytics-remote">—</div>
        <div class="stat-label">Remote</div>
      </div>
      <div class="stat-tile">
        <div class="stat-value" id="stat-analytics-exported">—</div>
        <div class="stat-label">Exported</div>
      </div>
    </div>

    <h2>Jobs by day</h2>
    <table>
      <thead>
        <tr>
          <th>Day</th>
          <th>Jobs</th>
          <th>Remote</th>
          <th>Exported</th>
        </tr>
      </thead>
      <tbody id="analytics-day-rows"></tbody>
    </table>
    <div id="analytics-day-empty" class="empty" style="display:none">No jobs found.</div>

    <h2>Jobs by source</h2>
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th>Jobs</th>
          <th>Remote</th>
          <th>Exported</th>
        </tr>
      </thead>
      <tbody id="analytics-source-rows"></tbody>
    </table>
    <div id="analytics-source-empty" class="empty" style="display:none">No jobs found.</div>
  </div> <!-- /tab-analytics -->

  <div id="overlay">
    <div id="detail-panel">
      <button class="close-btn" id="btn-close">&times; Close</button>
      <div id="detail-body"></div>
    </div>
  </div>

  <div id="sites-overlay">
    <div id="sites-panel">
      <button class="close-btn" id="btn-sites-close">&times; Close</button>
      <h2>Choose sites</h2>
      <div class="sub">Blank selection (or Clear all) falls back to the default curated list.</div>
      <input id="sites-search" type="text" placeholder="Filter by id or name…" />
      <div class="sites-toolbar">
        <button type="button" id="btn-sites-select-all">Select all (filtered)</button>
        <button type="button" id="btn-sites-clear-all">Clear all</button>
        <span id="sites-selected-count" class="hint"></span>
      </div>
      <div id="sites-groups"><p class="hint">Loading…</p></div>
      <button class="primary" id="btn-sites-done">Done</button>
    </div>
  </div>

<script>
(function () {
  var cursorStack = []; // cursors of pages visited, for "Prev"
  var currentCursor = undefined;
  var nextCursor = undefined;
  var selectedSites = new Set(); // empty = use server-side default site list
  var siteCatalog = null; // cached /api/admin/sites response, fetched lazily
  var atsCustomSlugs = []; // manually-typed slugs, not in the known directory
  var atsCurrentCompanies = []; // known companies for the currently-selected ATS platform

  var els = {
    search: document.getElementById('f-search'),
    company: document.getElementById('f-company'),
    location: document.getElementById('f-location'),
    since: document.getElementById('f-since'),
    remote: document.getElementById('f-remote'),
    limit: document.getElementById('f-limit'),
    rows: document.getElementById('rows'),
    empty: document.getElementById('empty'),
    status: document.getElementById('status'),
    statTotal: document.getElementById('stat-total'),
    statExported: document.getElementById('stat-exported'),
    pagerInfo: document.getElementById('pager-info'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    overlay: document.getElementById('overlay'),
    detailBody: document.getElementById('detail-body'),
    rSearchTerm: document.getElementById('r-search-term'),
    rLocation: document.getElementById('r-location'),
    rResults: document.getElementById('r-results'),
    rRemote: document.getElementById('r-remote'),
    rCaptureRaw: document.getElementById('r-capture-raw'),
    btnRun: document.getElementById('btn-run'),
    btnExtractAll: document.getElementById('btn-extract-all'),
    confirmExtractAll: document.getElementById('confirm-extract-all'),
    confirmExtractAllInput: document.getElementById('confirm-extract-all-input'),
    confirmExtractAllBtn: document.getElementById('confirm-extract-all-btn'),
    confirmExtractAllCancel: document.getElementById('confirm-extract-all-cancel'),
    extractAllStatus: document.getElementById('extract-all-status'),
    btnExportAll: document.getElementById('btn-export-all'),
    exportAllStatus: document.getElementById('export-all-status'),
    btnExportAllFull: document.getElementById('btn-export-all-full'),
    confirmExportAllFull: document.getElementById('confirm-export-all-full'),
    confirmExportAllFullInput: document.getElementById('confirm-export-all-full-input'),
    confirmExportAllFullBtn: document.getElementById('confirm-export-all-full-btn'),
    confirmExportAllFullCancel: document.getElementById('confirm-export-all-full-cancel'),
    exportAllFullStatus: document.getElementById('export-all-full-status'),
    btnResetExported: document.getElementById('btn-reset-exported'),
    confirmResetExported: document.getElementById('confirm-reset-exported'),
    confirmResetExportedInput: document.getElementById('confirm-reset-exported-input'),
    confirmResetExportedBtn: document.getElementById('confirm-reset-exported-btn'),
    confirmResetExportedCancel: document.getElementById('confirm-reset-exported-cancel'),
    resetExportedStatus: document.getElementById('reset-exported-status'),
    btnDeleteAll: document.getElementById('btn-delete-all'),
    confirmDeleteAll: document.getElementById('confirm-delete-all'),
    confirmDeleteAllInput: document.getElementById('confirm-delete-all-input'),
    confirmDeleteAllBtn: document.getElementById('confirm-delete-all-btn'),
    confirmDeleteAllCancel: document.getElementById('confirm-delete-all-cancel'),
    deleteAllStatus: document.getElementById('delete-all-status'),
    runStatus: document.getElementById('run-status'),
    btnChooseSites: document.getElementById('btn-choose-sites'),
    sitesSummary: document.getElementById('sites-summary'),
    sitesOverlay: document.getElementById('sites-overlay'),
    sitesSearch: document.getElementById('sites-search'),
    sitesGroups: document.getElementById('sites-groups'),
    sitesSelectedCount: document.getElementById('sites-selected-count'),
    btnSitesSelectAll: document.getElementById('btn-sites-select-all'),
    btnSitesClearAll: document.getElementById('btn-sites-clear-all'),
    btnSitesClose: document.getElementById('btn-sites-close'),
    btnSitesDone: document.getElementById('btn-sites-done'),
    atsPlatformSelect: document.getElementById('ats-platform-select'),
    atsSearchTerm: document.getElementById('ats-search-term'),
    atsLocation: document.getElementById('ats-location'),
    atsResults: document.getElementById('ats-results'),
    atsRemote: document.getElementById('ats-remote'),
    atsCaptureRaw: document.getElementById('ats-capture-raw'),
    atsCompaniesSection: document.getElementById('ats-companies-section'),
    atsCompaniesList: document.getElementById('ats-companies-list'),
    atsSelectedCount: document.getElementById('ats-selected-count'),
    btnAtsSelectAll: document.getElementById('btn-ats-select-all'),
    btnAtsClearAll: document.getElementById('btn-ats-clear-all'),
    atsCustomSlug: document.getElementById('ats-custom-slug'),
    btnAtsAddSlug: document.getElementById('btn-ats-add-slug'),
    atsCustomSlugsList: document.getElementById('ats-custom-slugs-list'),
    btnAtsRun: document.getElementById('btn-ats-run'),
    atsRunStatus: document.getElementById('ats-run-status'),
    tabbtnRun: document.getElementById('tabbtn-run'),
    tabbtnJobs: document.getElementById('tabbtn-jobs'),
    tabbtnSources: document.getElementById('tabbtn-sources'),
    tabbtnAnalytics: document.getElementById('tabbtn-analytics'),
    tabRun: document.getElementById('tab-run'),
    tabJobs: document.getElementById('tab-jobs'),
    tabSources: document.getElementById('tab-sources'),
    tabAnalytics: document.getElementById('tab-analytics'),
    btnSourcesRefresh: document.getElementById('btn-sources-refresh'),
    sourcesStatus: document.getElementById('sources-status'),
    sourcesSummary: document.getElementById('sources-summary'),
    sourcesRows: document.getElementById('sources-rows'),
    sourcesEmpty: document.getElementById('sources-empty'),
    btnAnalyticsRefresh: document.getElementById('btn-analytics-refresh'),
    analyticsStatus: document.getElementById('analytics-status'),
    statAnalyticsTotal: document.getElementById('stat-analytics-total'),
    statAnalyticsRemote: document.getElementById('stat-analytics-remote'),
    statAnalyticsExported: document.getElementById('stat-analytics-exported'),
    analyticsDayRows: document.getElementById('analytics-day-rows'),
    analyticsDayEmpty: document.getElementById('analytics-day-empty'),
    analyticsSourceRows: document.getElementById('analytics-source-rows'),
    analyticsSourceEmpty: document.getElementById('analytics-source-empty'),
  };

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function formatCount(n) {
    return typeof n === 'number' ? n.toLocaleString() : '—';
  }

  function badge(exported) {
    if (exported === true) return '<span class="badge yes">exported</span>';
    if (exported === false) return '<span class="badge no">not exported</span>';
    return '<span class="badge unknown">unknown</span>';
  }

  function remoteBadge(isRemote) {
    if (isRemote === true) return '<span class="badge remote">remote</span>';
    if (isRemote === false) return '<span class="badge onsite">onsite / hybrid</span>';
    return '<span class="badge unknown">unknown</span>';
  }

  // ── Tabs (each tab's data loads lazily, once, on first activation) ──

  var tabLoaded = { run: false, jobs: false, sources: false, analytics: false };

  function activateTab(name) {
    var tabs = { run: els.tabRun, jobs: els.tabJobs, sources: els.tabSources, analytics: els.tabAnalytics };
    var buttons = { run: els.tabbtnRun, jobs: els.tabbtnJobs, sources: els.tabbtnSources, analytics: els.tabbtnAnalytics };
    Object.keys(tabs).forEach(function (key) {
      tabs[key].classList.toggle('active', key === name);
      buttons[key].classList.toggle('active', key === name);
    });
    if (tabLoaded[name]) return;
    tabLoaded[name] = true;
    if (name === 'run') {
      loadAtsPlatformOptions();
      pollBackgroundStatus();
    } else if (name === 'jobs') {
      load(undefined, false);
    } else if (name === 'sources') {
      loadSourcesOverview();
    } else if (name === 'analytics') {
      loadAnalytics();
    }
  }

  els.tabbtnRun.addEventListener('click', function () { activateTab('run'); });
  els.tabbtnJobs.addEventListener('click', function () { activateTab('jobs'); });
  els.tabbtnSources.addEventListener('click', function () { activateTab('sources'); });
  els.tabbtnAnalytics.addEventListener('click', function () { activateTab('analytics'); });

  // ── Sources tab ───────────────────────────

  function sourceBadge(state) {
    if (state === 'closed') return '<span class="badge yes">working</span>';
    if (state === 'half-open') return '<span class="badge warn">recovering</span>';
    if (state === 'open') return '<span class="badge no">not working</span>';
    return '<span class="badge unknown">untested</span>';
  }

  function renderSourcesOverview(data) {
    els.sourcesSummary.textContent = data.totalSources + ' source(s), ' +
      formatCount(data.totalJobs) + ' job(s) total';
    els.sourcesEmpty.style.display = data.sources.length ? 'none' : 'block';
    els.sourcesRows.innerHTML = data.sources.map(function (s) {
      return '<tr>' +
        '<td>' + escapeHtml(s.name) + ' <span class="hint">(' + escapeHtml(s.site) + ')</span></td>' +
        '<td>' + escapeHtml(s.category) + '</td>' +
        '<td>' + formatCount(s.jobCount) + '</td>' +
        '<td>' + sourceBadge(s.state) + '</td>' +
        '<td>' + (s.successRate == null ? '—' : Math.round(s.successRate * 100) + '%') + '</td>' +
        '<td>' + (s.p95LatencyMs == null ? '—' : s.p95LatencyMs + ' ms') + '</td>' +
        '<td>' + (s.lastError ? escapeHtml(s.lastError.code) + ': ' + escapeHtml(s.lastError.message) : '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function loadSourcesOverview() {
    els.btnSourcesRefresh.disabled = true;
    els.sourcesStatus.textContent = 'Loading — this scans the full job store, may take a moment…';
    els.sourcesStatus.style.color = 'var(--muted)';
    fetch('/api/admin/sources-overview')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        renderSourcesOverview(data);
        els.sourcesStatus.textContent = '';
      })
      .catch(function (err) {
        els.sourcesStatus.textContent = 'Failed to load: ' + err.message;
        els.sourcesStatus.style.color = 'var(--bad)';
      })
      .finally(function () {
        els.btnSourcesRefresh.disabled = false;
      });
  }

  els.btnSourcesRefresh.addEventListener('click', loadSourcesOverview);

  // ── Analytics tab ───────────────────────────

  function renderAnalytics(data) {
    els.statAnalyticsTotal.textContent = formatCount(data.totalJobs);
    els.statAnalyticsRemote.textContent = formatCount(data.totalRemote);
    els.statAnalyticsExported.textContent = data.totalExported == null ? '—' : formatCount(data.totalExported);

    els.analyticsDayEmpty.style.display = data.byDay.length ? 'none' : 'block';
    els.analyticsDayRows.innerHTML = data.byDay.map(function (d) {
      return '<tr>' +
        '<td>' + escapeHtml(d.date) + '</td>' +
        '<td>' + formatCount(d.jobCount) + '</td>' +
        '<td>' + formatCount(d.remoteCount) + '</td>' +
        '<td>' + formatCount(d.exportedCount) + '</td>' +
        '</tr>';
    }).join('');

    els.analyticsSourceEmpty.style.display = data.bySource.length ? 'none' : 'block';
    els.analyticsSourceRows.innerHTML = data.bySource.map(function (s) {
      return '<tr>' +
        '<td>' + escapeHtml(s.name) + ' <span class="hint">(' + escapeHtml(s.site) + ')</span></td>' +
        '<td>' + formatCount(s.jobCount) + '</td>' +
        '<td>' + formatCount(s.remoteCount) + '</td>' +
        '<td>' + formatCount(s.exportedCount) + '</td>' +
        '</tr>';
    }).join('');
  }

  function loadAnalytics() {
    els.btnAnalyticsRefresh.disabled = true;
    els.analyticsStatus.textContent = 'Loading — this scans the full job store, may take a moment…';
    els.analyticsStatus.style.color = 'var(--muted)';
    fetch('/api/admin/analytics')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        renderAnalytics(data);
        els.analyticsStatus.textContent = '';
      })
      .catch(function (err) {
        els.analyticsStatus.textContent = 'Failed to load: ' + err.message;
        els.analyticsStatus.style.color = 'var(--bad)';
      })
      .finally(function () {
        els.btnAnalyticsRefresh.disabled = false;
      });
  }

  els.btnAnalyticsRefresh.addEventListener('click', loadAnalytics);

  function buildQuery(cursor) {
    var params = new URLSearchParams();
    if (els.search.value.trim()) params.set('search', els.search.value.trim());
    if (els.company.value.trim()) params.set('company', els.company.value.trim());
    if (els.location.value.trim()) params.set('location', els.location.value.trim());
    if (els.since.value) params.set('since', new Date(els.since.value).toISOString());
    if (els.remote.value) params.set('isRemote', els.remote.value);
    params.set('limit', els.limit.value);
    if (cursor) params.set('cursor', cursor);
    return params.toString();
  }

  function setStatus(msg, isError) {
    els.status.textContent = msg || '';
    els.status.style.color = isError ? 'var(--bad)' : 'var(--muted)';
  }

  function load(cursor, pushToStack) {
    setStatus('Loading…');
    fetch('/api/admin/jobs?' + buildQuery(cursor))
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (pushToStack && currentCursor !== undefined) cursorStack.push(currentCursor);
        currentCursor = cursor;
        nextCursor = data.nextCursor;
        render(data.items);
        els.btnNext.disabled = !nextCursor;
        els.btnPrev.disabled = cursorStack.length === 0 && !cursor;
        els.pagerInfo.textContent = data.items.length + ' row(s) shown';
        els.statTotal.textContent = formatCount(data.total);
        els.statExported.textContent = formatCount(data.totalExported);
        setStatus('');
      })
      .catch(function (err) {
        setStatus('Failed to load: ' + err.message, true);
        render([]);
      });
  }

  function render(items) {
    els.rows.innerHTML = '';
    els.empty.style.display = items.length ? 'none' : 'block';
    items.forEach(function (job) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(job.title) + '</td>' +
        '<td>' + escapeHtml(job.company) + '</td>' +
        '<td>' + escapeHtml(job.location) + '</td>' +
        '<td>' + remoteBadge(job.isRemote) + '</td>' +
        '<td>' + escapeHtml(job.mergedAt) + '</td>' +
        '<td>' + (job.sources ? job.sources.length : 0) + '</td>' +
        '<td>' + badge(job.exported) + '</td>';
      tr.addEventListener('click', function () { openDetail(job.canonicalJobId); });
      els.rows.appendChild(tr);
    });
  }

  function openDetail(id) {
    els.detailBody.innerHTML = 'Loading…';
    els.overlay.classList.add('open');
    fetch('/api/admin/jobs/' + encodeURIComponent(id))
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        renderDetail(data);
      })
      .catch(function (err) {
        els.detailBody.innerHTML = '<p style="color:var(--bad)">Failed to load: ' + escapeHtml(err.message) + '</p>';
      });
  }

  function renderDetail(data) {
    var job = data.job;
    var fieldsEntries = Object.entries(job.fields || {});
    var fieldsHtml = fieldsEntries.length
      ? '<dl class="kv">' + fieldsEntries.map(function (e) {
          return '<dt>' + escapeHtml(e[0]) + '</dt><dd>' + escapeHtml(JSON.stringify(e[1])) + '</dd>';
        }).join('') + '</dl>'
      : '<p style="color:var(--muted)">No provenance fields.</p>';

    var sourcesHtml = (data.sources && data.sources.length)
      ? '<ul class="sources-list">' + data.sources.map(function (s) {
          var rawSection = s.rawResponse
            ? '<details class="raw-response"><summary>Raw response (' + s.rawResponse.length + ' chars)</summary>' +
              '<pre>' + escapeHtml(s.rawResponse) + '</pre></details>'
            : '';
          return '<li><strong>' + escapeHtml(s.site) + '</strong> — ' +
            '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.sourceJobId) + '</a>' +
            ' <span style="color:var(--muted)">observed ' + escapeHtml(s.observedAt) + '</span>' +
            rawSection + '</li>';
        }).join('') + '</ul>'
      : '<p style="color:var(--muted)">No per-source observations recorded.</p>';

    els.detailBody.innerHTML =
      '<h2>' + escapeHtml(job.title) + '</h2>' +
      '<div class="sub">' + escapeHtml(job.company) + ' — ' + escapeHtml(job.location) + '</div>' +
      '<dl class="kv">' +
        '<dt>URL</dt><dd><a href="' + escapeHtml(job.url) + '" target="_blank" rel="noopener">' + escapeHtml(job.url) + '</a></dd>' +
        '<dt>Remote</dt><dd>' + remoteBadge(job.isRemote) + '</dd>' +
        '<dt>Merged at</dt><dd>' + escapeHtml(job.mergedAt) + '</dd>' +
        '<dt>Canonical ID</dt><dd>' + escapeHtml(job.canonicalJobId) + '</dd>' +
        '<dt>Exported</dt><dd>' + badge(data.exported) + '</dd>' +
      '</dl>' +
      '<h3>Description</h3>' +
      '<div id="detail-desc">' + escapeHtml(job.description || '(none)') + '</div>' +
      '<h3>Provenance fields</h3>' + fieldsHtml +
      '<h3>Source observations</h3>' + sourcesHtml;
  }

  // ── Site catalog / multi-select ──────────

  function updateSitesSummary() {
    els.sitesSummary.textContent = selectedSites.size
      ? '(' + selectedSites.size + ' selected)'
      : '(default list)';
    els.sitesSelectedCount.textContent = selectedSites.size + ' selected';
  }

  function categoryLabel(category) {
    return category.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function renderSiteCatalog() {
    els.sitesGroups.innerHTML = siteCatalog.categories.map(function (group) {
      var itemsHtml = group.sites.map(function (s) {
        return '<label class="site-item" data-id="' + escapeHtml(s.id) + '" data-name="' + escapeHtml(s.name.toLowerCase()) + '">' +
          '<input type="checkbox" class="site-checkbox" value="' + escapeHtml(s.id) + '" />' +
          escapeHtml(s.name) + ' <span class="hint">(' + escapeHtml(s.id) + ')</span></label>';
      }).join('');
      return '<details class="site-category" data-category="' + escapeHtml(group.category) + '">' +
        '<summary><label onclick="event.stopPropagation()">' +
          '<input type="checkbox" class="category-select-all" /> ' +
          escapeHtml(categoryLabel(group.category)) + ' (' + group.sites.length + ')' +
        '</label></summary>' +
        '<div class="site-list">' + itemsHtml + '</div>' +
      '</details>';
    }).join('');

    // Reflect current selection onto freshly-rendered checkboxes.
    els.sitesGroups.querySelectorAll('.site-checkbox').forEach(function (cb) {
      cb.checked = selectedSites.has(cb.value);
    });
    syncCategoryCheckboxes();

    els.sitesGroups.querySelectorAll('.site-checkbox').forEach(function (cb) {
      cb.addEventListener('change', function () {
        if (cb.checked) selectedSites.add(cb.value); else selectedSites.delete(cb.value);
        syncCategoryCheckboxes();
        updateSitesSummary();
      });
    });
    els.sitesGroups.querySelectorAll('.category-select-all').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var details = cb.closest('.site-category');
        details.querySelectorAll('.site-item:not([style*="display: none"]) .site-checkbox').forEach(function (item) {
          item.checked = cb.checked;
          if (cb.checked) selectedSites.add(item.value); else selectedSites.delete(item.value);
        });
        updateSitesSummary();
      });
    });
  }

  /** Each category's "select all" checkbox reflects whether every visible item in it is checked. */
  function syncCategoryCheckboxes() {
    els.sitesGroups.querySelectorAll('.site-category').forEach(function (details) {
      var items = Array.from(details.querySelectorAll('.site-item')).filter(function (el) {
        return el.style.display !== 'none';
      });
      var checkboxes = items.map(function (el) { return el.querySelector('.site-checkbox'); });
      var allChecked = checkboxes.length > 0 && checkboxes.every(function (cb) { return cb.checked; });
      details.querySelector('.category-select-all').checked = allChecked;
    });
  }

  function applySitesFilter() {
    var term = els.sitesSearch.value.trim().toLowerCase();
    els.sitesGroups.querySelectorAll('.site-category').forEach(function (details) {
      var anyVisible = false;
      details.querySelectorAll('.site-item').forEach(function (item) {
        var match = !term || item.getAttribute('data-id').indexOf(term) !== -1 ||
          item.getAttribute('data-name').indexOf(term) !== -1;
        item.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });
      details.style.display = anyVisible ? '' : 'none';
      if (term && anyVisible) details.open = true;
    });
    syncCategoryCheckboxes();
  }

  // Fetches (once) and caches the full /api/admin/sites catalog.
  function loadSiteCatalog() {
    if (siteCatalog) return Promise.resolve(siteCatalog);
    return fetch('/api/admin/sites')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        siteCatalog = data;
        return data;
      });
  }

  function openSitesModal() {
    els.sitesOverlay.classList.add('open');
    if (siteCatalog) return;
    loadSiteCatalog()
      .then(function () {
        renderSiteCatalog();
      })
      .catch(function (err) {
        els.sitesGroups.innerHTML = '<p style="color:var(--bad)">Failed to load sites: ' + escapeHtml(err.message) + '</p>';
      });
  }

  els.btnChooseSites.addEventListener('click', openSitesModal);
  els.btnSitesClose.addEventListener('click', function () {
    els.sitesOverlay.classList.remove('open');
  });
  els.btnSitesDone.addEventListener('click', function () {
    els.sitesOverlay.classList.remove('open');
  });
  els.sitesOverlay.addEventListener('click', function (e) {
    if (e.target === els.sitesOverlay) els.sitesOverlay.classList.remove('open');
  });
  els.sitesSearch.addEventListener('input', applySitesFilter);
  els.btnSitesSelectAll.addEventListener('click', function () {
    els.sitesGroups.querySelectorAll('.site-item').forEach(function (item) {
      if (item.style.display === 'none') return;
      var cb = item.querySelector('.site-checkbox');
      cb.checked = true;
      selectedSites.add(cb.value);
    });
    syncCategoryCheckboxes();
    updateSitesSummary();
  });
  els.btnSitesClearAll.addEventListener('click', function () {
    selectedSites.clear();
    els.sitesGroups.querySelectorAll('.site-checkbox').forEach(function (cb) { cb.checked = false; });
    syncCategoryCheckboxes();
    updateSitesSummary();
  });

  updateSitesSummary();

  // ── ATS company batch ────────────────────

  function loadAtsPlatformOptions() {
    fetch('/api/admin/ats-companies')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (list) {
        els.atsPlatformSelect.innerHTML = '<option value="">Choose a platform…</option>' +
          list.map(function (entry) {
            return '<option value="' + escapeHtml(entry.site) + '">' +
              escapeHtml(entry.site) + ' (' + entry.count + ' known)</option>';
          }).join('');
      })
      .catch(function (err) {
        els.atsPlatformSelect.innerHTML = '<option value="">Failed to load: ' + escapeHtml(err.message) + '</option>';
      });
  }

  function updateAtsSelectedCount() {
    var checked = els.atsCompaniesList.querySelectorAll('.site-checkbox:checked').length;
    els.atsSelectedCount.textContent = (checked + atsCustomSlugs.length) + ' selected';
  }

  function renderAtsCustomSlugs() {
    els.atsCustomSlugsList.innerHTML = atsCustomSlugs.map(function (slug, i) {
      return '<li>' + escapeHtml(slug) +
        ' <button type="button" class="ats-remove-slug" data-index="' + i + '">remove</button></li>';
    }).join('');
    els.atsCustomSlugsList.querySelectorAll('.ats-remove-slug').forEach(function (btn) {
      btn.addEventListener('click', function () {
        atsCustomSlugs.splice(Number(btn.getAttribute('data-index')), 1);
        renderAtsCustomSlugs();
        updateAtsSelectedCount();
      });
    });
  }

  els.atsPlatformSelect.addEventListener('change', function () {
    var site = els.atsPlatformSelect.value;
    atsCustomSlugs = [];
    renderAtsCustomSlugs();
    if (!site) {
      els.atsCompaniesSection.style.display = 'none';
      return;
    }
    els.atsCompaniesSection.style.display = '';
    els.atsCompaniesList.innerHTML = '<p class="hint">Loading…</p>';
    fetch('/api/admin/ats-companies?site=' + encodeURIComponent(site))
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        atsCurrentCompanies = data.companies;
        if (!atsCurrentCompanies.length) {
          els.atsCompaniesList.innerHTML =
            '<p class="hint">No known companies yet for this platform — add one manually below, ' +
            'or add entries to apps/api/src/admin/ats-company-directory.ts.</p>';
          updateAtsSelectedCount();
          return;
        }
        els.atsCompaniesList.innerHTML = '<div class="site-list">' + atsCurrentCompanies.map(function (c) {
          return '<label class="site-item">' +
            '<input type="checkbox" class="site-checkbox" value="' + escapeHtml(c.slug) + '" checked /> ' +
            escapeHtml(c.name) + ' <span class="hint">(' + escapeHtml(c.slug) + ')</span></label>';
        }).join('') + '</div>';
        els.atsCompaniesList.querySelectorAll('.site-checkbox').forEach(function (cb) {
          cb.addEventListener('change', updateAtsSelectedCount);
        });
        updateAtsSelectedCount();
      })
      .catch(function (err) {
        els.atsCompaniesList.innerHTML = '<p style="color:var(--bad)">Failed to load: ' + escapeHtml(err.message) + '</p>';
      });
  });

  els.btnAtsSelectAll.addEventListener('click', function () {
    els.atsCompaniesList.querySelectorAll('.site-checkbox').forEach(function (cb) { cb.checked = true; });
    updateAtsSelectedCount();
  });
  els.btnAtsClearAll.addEventListener('click', function () {
    els.atsCompaniesList.querySelectorAll('.site-checkbox').forEach(function (cb) { cb.checked = false; });
    atsCustomSlugs = [];
    renderAtsCustomSlugs();
    updateAtsSelectedCount();
  });
  els.btnAtsAddSlug.addEventListener('click', function () {
    var slug = els.atsCustomSlug.value.trim();
    if (!slug || atsCustomSlugs.indexOf(slug) !== -1) return;
    atsCustomSlugs.push(slug);
    els.atsCustomSlug.value = '';
    renderAtsCustomSlugs();
    updateAtsSelectedCount();
  });
  els.atsCustomSlug.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') els.btnAtsAddSlug.click();
  });

  els.btnAtsRun.addEventListener('click', function () {
    var site = els.atsPlatformSelect.value;
    if (!site) {
      els.atsRunStatus.textContent = 'Choose an ATS platform first.';
      els.atsRunStatus.style.color = 'var(--bad)';
      return;
    }
    var checkedSlugs = Array.from(els.atsCompaniesList.querySelectorAll('.site-checkbox:checked'))
      .map(function (cb) { return cb.value; });
    var companySlugs = Array.from(new Set(checkedSlugs.concat(atsCustomSlugs)));
    if (companySlugs.length === 0) {
      els.atsRunStatus.textContent = 'Select at least one company (or add a custom slug).';
      els.atsRunStatus.style.color = 'var(--bad)';
      return;
    }

    var body = {
      site: site,
      companySlugs: companySlugs,
      searchTerm: els.atsSearchTerm.value.trim() || undefined,
      location: els.atsLocation.value.trim() || undefined,
      resultsWanted: Number(els.atsResults.value) || undefined,
      isRemote: els.atsRemote.checked,
      captureRawResponse: els.atsCaptureRaw.checked,
    };
    els.btnAtsRun.disabled = true;
    els.atsRunStatus.textContent = 'Scraping ' + companySlugs.length + ' compan' +
      (companySlugs.length === 1 ? 'y' : 'ies') + ' on ' + site + '…';
    els.atsRunStatus.style.color = 'var(--muted)';
    fetch('/api/admin/jobs/run-companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (e) { throw new Error(e.message || ('HTTP ' + res.status)); });
        return res.json();
      })
      .then(function (data) {
        els.atsRunStatus.textContent = 'Done — ' + data.companiesSucceeded + '/' + data.companiesRequested +
          ' compan' + (data.companiesRequested === 1 ? 'y' : 'ies') + ' succeeded, ' +
          data.rawCount + ' raw / ' + data.outputCount + ' after dedup' +
          (data.companiesFailed ? ' (' + data.companiesFailed + ' failed)' : '') + '. Refreshing table…';
        els.atsRunStatus.style.color = data.companiesFailed ? 'var(--bad)' : 'var(--ok)';
        cursorStack = [];
        currentCursor = undefined;
        load(undefined, false);
      })
      .catch(function (err) {
        els.atsRunStatus.textContent = 'Batch scrape failed: ' + err.message;
        els.atsRunStatus.style.color = 'var(--bad)';
      })
      .finally(function () {
        els.btnAtsRun.disabled = false;
      });
  });

  document.getElementById('btn-search').addEventListener('click', function () {
    cursorStack = [];
    currentCursor = undefined;
    load(undefined, false);
  });
  document.getElementById('btn-reset').addEventListener('click', function () {
    els.search.value = '';
    els.company.value = '';
    els.location.value = '';
    els.since.value = '';
    els.remote.value = '';
    els.limit.value = '50';
    cursorStack = [];
    currentCursor = undefined;
    load(undefined, false);
  });
  els.btnNext.addEventListener('click', function () {
    if (nextCursor) load(nextCursor, true);
  });
  els.btnPrev.addEventListener('click', function () {
    var prev = cursorStack.pop();
    load(prev, false);
  });
  document.getElementById('btn-close').addEventListener('click', function () {
    els.overlay.classList.remove('open');
  });
  els.overlay.addEventListener('click', function (e) {
    if (e.target === els.overlay) els.overlay.classList.remove('open');
  });
  [els.search, els.company, els.location].forEach(function (el) {
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') document.getElementById('btn-search').click();
    });
  });

  els.btnRun.addEventListener('click', function () {
    var body = {
      sites: Array.from(selectedSites),
      searchTerm: els.rSearchTerm.value.trim() || undefined,
      location: els.rLocation.value.trim() || undefined,
      resultsWanted: Number(els.rResults.value) || undefined,
      isRemote: els.rRemote.checked,
      captureRawResponse: els.rCaptureRaw.checked,
    };
    els.btnRun.disabled = true;
    els.runStatus.textContent = 'Running extraction — this can take a while for many sites…';
    els.runStatus.style.color = 'var(--muted)';
    fetch('/api/admin/jobs/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (e) { throw new Error(e.message || ('HTTP ' + res.status)); });
        return res.json();
      })
      .then(function (data) {
        var perSiteHtml = (data.perSite && data.perSite.length)
          ? '<ul class="sources-list">' + data.perSite.map(function (s) {
              var status = s.persisted ? 'persisted' : (s.persistError ? 'persist FAILED' : 'not persisted');
              return '<li>' + escapeHtml(s.site) + ': ' + s.rawCount + ' → ' + s.outputCount +
                ' (' + status + ')</li>';
            }).join('') + '</ul>'
          : '';
        els.runStatus.innerHTML = 'Done — found ' + data.rawCount + ' raw, ' + data.outputCount +
          ' after per-site dedup, across [' + data.sites.join(', ') + ']. Refreshing table…' + perSiteHtml;
        els.runStatus.style.color = 'var(--ok)';
        cursorStack = [];
        currentCursor = undefined;
        load(undefined, false);
      })
      .catch(function (err) {
        els.runStatus.textContent = 'Extraction failed: ' + err.message;
        els.runStatus.style.color = 'var(--bad)';
      })
      .finally(function () {
        els.btnRun.disabled = false;
      });
  });

  // ── Background jobs: "Extract ALL sources" / "Delete ALL data" ──────

  var bgPollTimer = null;

  // Wires a type-to-confirm gate: clicking triggerBtn reveals panel (a text
  // input + Confirm/Cancel button); confirmBtn stays disabled until the
  // input's value exactly matches phrase. Confirming hides the panel,
  // clears the input, and calls onConfirm.
  function wireTypedConfirmation(triggerBtn, panel, input, confirmBtn, cancelBtn, phrase, onConfirm) {
    triggerBtn.addEventListener('click', function () {
      panel.classList.add('open');
      input.value = '';
      confirmBtn.disabled = true;
      input.focus();
    });
    input.addEventListener('input', function () {
      confirmBtn.disabled = input.value !== phrase;
    });
    confirmBtn.addEventListener('click', function () {
      if (input.value !== phrase) return;
      panel.classList.remove('open');
      input.value = '';
      onConfirm();
    });
    cancelBtn.addEventListener('click', function () {
      panel.classList.remove('open');
      input.value = '';
    });
  }

  function formatBgResult(status) {
    if (status.state === 'failed') {
      return 'Failed: ' + (status.error || 'unknown error');
    }
    if (status.state !== 'done' || !status.result) return '';
    var r = status.result;
    if (status.name === 'extract-all' && r.sites && r.atsCompanies) {
      return 'Done — sites: ' + r.sites.rawCount + ' raw / ' + r.sites.outputCount + ' after dedup; ' +
        'ATS: ' + r.atsCompanies.platforms + ' platform(s), ' +
        r.atsCompanies.companiesSucceeded + ' succeeded / ' + r.atsCompanies.companiesFailed + ' failed, ' +
        r.atsCompanies.rawCount + ' raw / ' + r.atsCompanies.outputCount + ' after dedup.';
    }
    if (status.name === 'clear-all') {
      return 'Done — deleted ' + r.deletedJobs + ' job(s)' +
        (r.deletedExportedMarks === null ? '' : ', ' + r.deletedExportedMarks + ' exported mark(s)') +
        (r.resetRunState ? ', reset run watermark' : '') + '.';
    }
    if (status.name === 'export-all') {
      return 'Done — synced ' + r.pushed + ' new job(s) to ' + r.destination +
        ' in ' + r.batches + ' batch(es) (skipped ' + r.skipped + ' already-exported, ' +
        r.scanned + ' / ' + r.total + ' scanned).';
    }
    if (status.name === 'export-all-full') {
      return 'Done — resynced ' + r.pushed + ' job(s) to ' + r.destination +
        ' in ' + r.batches + ' batch(es) (' + r.scanned + ' / ' + r.total + ' scanned).';
    }
    if (status.name === 'reset-exported') {
      return 'Done — cleared ' + r.clearedMarks + ' exported mark(s). Every job now shows as not exported.';
    }
    return 'Done.';
  }

  function renderBgStatus(statusEl, triggerBtn, status) {
    if (!status || status.state === 'idle') {
      statusEl.textContent = '';
      triggerBtn.disabled = false;
      return;
    }
    triggerBtn.disabled = status.state === 'running';
    if (status.state === 'running') {
      var label = status.progress ? status.progress.label : 'Running…';
      var frac = status.progress ? ' (' + status.progress.done + '/' + status.progress.total + ')' : '';
      statusEl.textContent = 'Running — ' + label + frac;
      statusEl.style.color = 'var(--muted)';
    } else {
      statusEl.textContent = formatBgResult(status);
      statusEl.style.color = status.state === 'failed' ? 'var(--bad)' : 'var(--ok)';
    }
  }

  function pollBackgroundStatus() {
    fetch('/api/admin/jobs/background-status')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        renderBgStatus(els.extractAllStatus, els.btnExtractAll, data['extract-all']);
        renderBgStatus(els.deleteAllStatus, els.btnDeleteAll, data['clear-all']);
        renderBgStatus(els.exportAllStatus, els.btnExportAll, data['export-all']);
        renderBgStatus(els.exportAllFullStatus, els.btnExportAllFull, data['export-all-full']);
        renderBgStatus(els.resetExportedStatus, els.btnResetExported, data['reset-exported']);

        var anyRunning = data['extract-all'].state === 'running' ||
          data['clear-all'].state === 'running' ||
          data['export-all'].state === 'running' ||
          data['export-all-full'].state === 'running' ||
          data['reset-exported'].state === 'running';
        if (anyRunning) {
          bgPollTimer = setTimeout(pollBackgroundStatus, 3000);
        } else {
          bgPollTimer = null;
        }

        // A background wipe/extraction/sync/reset just finished — the jobs
        // table and stat tiles (incl. exported badges) are stale until the
        // next manual search, so refresh them automatically once.
        if (data['clear-all'].state === 'done' || data['extract-all'].state === 'done' ||
            data['export-all'].state === 'done' || data['export-all-full'].state === 'done' ||
            data['reset-exported'].state === 'done') {
          if (!anyRunning) {
            cursorStack = [];
            currentCursor = undefined;
            load(undefined, false);
          }
        }
      })
      .catch(function () {
        // Best-effort — a failed poll just tries again on the next tick
        // if something is running, or silently gives up if idle.
      });
  }

  wireTypedConfirmation(
    els.btnExtractAll, els.confirmExtractAll, els.confirmExtractAllInput,
    els.confirmExtractAllBtn, els.confirmExtractAllCancel, 'EXTRACT ALL',
    function () {
      fetch('/api/admin/jobs/extract-all', { method: 'POST' })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (e) { throw new Error(e.message || ('HTTP ' + res.status)); });
          return res.json();
        })
        .then(function (status) {
          renderBgStatus(els.extractAllStatus, els.btnExtractAll, status);
          if (!bgPollTimer) bgPollTimer = setTimeout(pollBackgroundStatus, 3000);
        })
        .catch(function (err) {
          els.extractAllStatus.textContent = 'Failed to start: ' + err.message;
          els.extractAllStatus.style.color = 'var(--bad)';
        });
    },
  );

  wireTypedConfirmation(
    els.btnDeleteAll, els.confirmDeleteAll, els.confirmDeleteAllInput,
    els.confirmDeleteAllBtn, els.confirmDeleteAllCancel, 'DELETE ALL',
    function () {
      fetch('/api/admin/jobs/clear-all', { method: 'POST' })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (e) { throw new Error(e.message || ('HTTP ' + res.status)); });
          return res.json();
        })
        .then(function (status) {
          renderBgStatus(els.deleteAllStatus, els.btnDeleteAll, status);
          if (!bgPollTimer) bgPollTimer = setTimeout(pollBackgroundStatus, 3000);
        })
        .catch(function (err) {
          els.deleteAllStatus.textContent = 'Failed to start: ' + err.message;
          els.deleteAllStatus.style.color = 'var(--bad)';
        });
    },
  );

  wireTypedConfirmation(
    els.btnResetExported, els.confirmResetExported, els.confirmResetExportedInput,
    els.confirmResetExportedBtn, els.confirmResetExportedCancel, 'RESET EXPORTED',
    function () {
      fetch('/api/admin/jobs/reset-exported', { method: 'POST' })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (e) { throw new Error(e.message || ('HTTP ' + res.status)); });
          return res.json();
        })
        .then(function (status) {
          renderBgStatus(els.resetExportedStatus, els.btnResetExported, status);
          if (!bgPollTimer) bgPollTimer = setTimeout(pollBackgroundStatus, 3000);
        })
        .catch(function (err) {
          els.resetExportedStatus.textContent = 'Failed to start: ' + err.message;
          els.resetExportedStatus.style.color = 'var(--bad)';
        });
    },
  );

  // "Sync new to platform" — non-destructive (only ever pushes NOT-yet-exported
  // jobs), so no type-to-confirm gate.
  els.btnExportAll.addEventListener('click', function () {
    els.btnExportAll.disabled = true;
    els.exportAllStatus.textContent = 'Starting…';
    els.exportAllStatus.style.color = 'var(--muted)';
    fetch('/api/admin/jobs/export-all', { method: 'POST' })
      .then(function (res) {
        if (!res.ok) return res.json().then(function (e) { throw new Error(e.message || ('HTTP ' + res.status)); });
        return res.json();
      })
      .then(function (status) {
        renderBgStatus(els.exportAllStatus, els.btnExportAll, status);
        if (!bgPollTimer) bgPollTimer = setTimeout(pollBackgroundStatus, 3000);
      })
      .catch(function (err) {
        els.btnExportAll.disabled = false;
        els.exportAllStatus.textContent = 'Failed to start: ' + err.message;
        els.exportAllStatus.style.color = 'var(--bad)';
      });
  });

  // "Sync ALL to platform" — not destructive (no data is deleted), but it
  // ignores already-exported status and can push the ENTIRE store to the
  // downstream target, which is easy to trigger by accident and expensive
  // to undo — gated behind a type-to-confirm, like the other expensive ops.
  wireTypedConfirmation(
    els.btnExportAllFull, els.confirmExportAllFull, els.confirmExportAllFullInput,
    els.confirmExportAllFullBtn, els.confirmExportAllFullCancel, 'SYNC ALL',
    function () {
      fetch('/api/admin/jobs/export-all-full', { method: 'POST' })
        .then(function (res) {
          if (!res.ok) return res.json().then(function (e) { throw new Error(e.message || ('HTTP ' + res.status)); });
          return res.json();
        })
        .then(function (status) {
          renderBgStatus(els.exportAllFullStatus, els.btnExportAllFull, status);
          if (!bgPollTimer) bgPollTimer = setTimeout(pollBackgroundStatus, 3000);
        })
        .catch(function (err) {
          els.exportAllFullStatus.textContent = 'Failed to start: ' + err.message;
          els.exportAllFullStatus.style.color = 'var(--bad)';
        });
    },
  );

  // Only the default active tab's data loads on page open — the rest
  // (Jobs table, Sources overview) load lazily the first time their tab
  // is clicked, so opening the page doesn't fan out every API at once.
  // Activating 'run' also restores any in-progress/finished background
  // job status across a page refresh.
  activateTab('run');
})();
</script>
</body>
</html>
`;
