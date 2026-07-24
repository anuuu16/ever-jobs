# ATS SERP Harvester (Chrome extension)

An unpacked Chrome extension that **auto-runs a saved list of Google searches**
and collects ATS career slugs from the results into one global, copyable list —
across many platforms, not just Workday. No pasting, no manual paging.

## Platforms recognised

Workday, Greenhouse, Lever, Ashby, BambooHR, Breezy, JazzHR, Personio, Workable,
Recruitee, Teamtailor, Eightfold, Sense, Zoho Recruit, Freshteam,
SmartRecruiters, Taleo, Avature. Each link is parsed into the exact
`companySlug` the matching scraper expects (e.g. Workday
`proofpoint.wd5.myworkdayjobs.com/ProofpointCareers` → `proofpoint:wd5:ProofpointCareers`).

## How it works

- **Passive harvest:** on every Google results page it reads the ATS links
  already on the page (no network calls, no clicking results) and appends them
  to `chrome.storage.local`, deduped by `platform + slug`.
- **Auto-run:** you save a *search plan* — a list of `site:` targets × optional
  keywords. Hit **Run** and it navigates the tab through every query, pages
  through each (up to *Max pages/query*) with human-ish 3–6.5s delays, and moves
  on to the next query. It **pauses itself** the instant Google shows a CAPTCHA /
  "unusual traffic" wall — it never tries to solve or bypass it.
- **Resume, don't restart:** a pause keeps its exact place (`queries`, current
  query index, current page) and the last known-good results URL. Solve the
  CAPTCHA in the tab (or just navigate back to the results yourself), then
  click **Resume** in the popup — it jumps back to that URL and continues the
  *same* run. Clicking **Run** instead always starts a brand-new run from
  query 0 / page 1, discarding that position (already-collected data is
  never lost either way — it lives in a separate list).

## Install (one time)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. **Load unpacked** → select `scripts/wd-harvester-extension`.
4. Pin the extension.

## Use

1. Click the icon → expand **Search plan**. The **Site targets** box is
   pre-filled with the common ATS domains; add/remove as you like. Optionally add
   **Keywords** (one per line) to widen coverage — leave empty for bare
   `site:<domain>` queries. Set **Max pages/query** (default 3).
2. Click **▶ Run (new)**. The popup closes and the active tab starts working
   through the plan. Reopen the popup anytime to watch progress
   (`query 4/45 · page 2`) and the live count. **■ Stop** pauses it.
   - **If Google shows a CAPTCHA:** the run pauses automatically (status shows
     "Paused: Google CAPTCHA…"). Solve it in that tab, then click
     **▶ Resume** — it navigates back to the last good results page and
     continues from the same query/page, no rebuilding, no lost progress.
3. When done, pick a **Filter** (or leave "all platforms"), then either:
   - **Copy** — the human-readable `platform ⇥ slug ⇥ url` lines, or
   - **Copy for verify** — compact JSON grouped by platform,
     `{ "workday": ["proofpoint:wd5:ProofpointCareers", ...], "greenhouse": [...] }`,
     ready to paste straight back to Claude for per-platform verification.

   Each slug is verified through the real scraper before being added to
   `ats-company-directory.ts`.

## Notes

- The collected list and your search plan persist in `chrome.storage.local`
  (survive restarts) until you **Clear**.
- `&num=100` is added to each query to pull up to 100 results per page — set
  Google's own "Results per page" high too if it downgrades you.
- Tip: append `&num=100` aside, varying keywords surfaces *different* companies,
  since Google caps results per identical query.
- Dev/tooling helper — plain browser JS + manifest, intentionally outside the
  repo's TypeScript build.
- **Etiquette:** auto-run is deliberately slow and self-pauses on a challenge
  page, but many `site:` queries back-to-back can still trip Google's bot wall.
  If it pauses with "CAPTCHA", solve it (or wait a bit) and use **Resume** —
  don't just mash Run, which restarts from scratch and re-triggers the same
  burst pattern. This mirrors the etiquette in
  `scripts/discover-ats-companies-via-google.ts`.
