# Volcano Model MVP — build & wiring status

Handoff/resume doc. Last updated 2026-06-11. (No secrets in here.)

## What's built (in this repo)
- 6 content tools + a new **TP1 intro video page** (`?tool=intro`) that bridges the
  TP1 email and the Health Check. Reads `?firstname=&company=&industry=&email=&video=`
  from the campaign link; CTA carries identity through to `?tool=tp1`.
- **Desktop redesign across all touchpoints** (responsive, mobile column untouched):
  - Shared `src/styles/shell.css` (green brand-bg canvas + two-pane/card/grid utils),
    `src/components/shared/BrandSidebar.jsx`, `src/components/shared/bands.jsx`.
  - Interactive tools (Health Check, Calculator, Benchmark): branded left sidebar +
    white content pane on desktop; results in 2-col grids; CTAs side-by-side.
  - Landing pages (Intro, Demo, Firms, Resource): float as a white card on the green
    canvas, widened to ~1040px (Firms/Resource grids → 3 cols).
  - `src/assets/brand-bg.png` = WorkflowMAX brand backdrop (logo painted out). ~1.3MB,
    compress to WebP at polish time.
- Benchmark inputs now use the Calculator's banded format (shared `bands.jsx`).

## Deployment (GitHub Pages)
- Remote is **SSH** (`git@github.com:sinafx20/WFM_pimple_model.git`); push works via SSH
  key (HTTPS has no creds). Repo: https://github.com/sinafx20/WFM_pimple_model
- `.github/workflows/deploy.yml` builds + publishes `dist/` to Pages on push to `main`.
- Build is path-agnostic (`vite.config.js` `base: "./"`).
- ⚠️ **TODO (manual, one-time):** repo **Settings → Pages → Source: "GitHub Actions"**.
  Then live at `https://sinafx20.github.io/WFM_pimple_model/?tool=intro`. Custom domain
  `tools.workflowmax.com` is a later step (add `public/CNAME` + DNS once DNS is ready).

## HubSpot wiring (Portal ID 24214994, Pro tier)
DONE & verified end-to-end (submission → contact → properties):
- Property group **"Volcano Model MVP"** (internal `wfm_content_tools`) + **11 properties**:
  `wfm_completed_health_check/_calculator/_benchmark` (checkbox), `wfm_firm_size`,
  `wfm_revenue_band`, `wfm_health_score`, `wfm_maturity_tier`, `wfm_profit_leak`,
  `wfm_benchmark_gap`, `wfm_biggest_issue`, `wfm_results_summary`.
- Form **"Volcano Model MVP – Content Tool Results"**, GUID
  `1905567d-53d7-4103-971e-9abb13bc6796` → wired into `src/lib/hubspot.js`
  (Portal ID `24214994` also set). Tools POST here; form submission also shows as a
  timeline activity (the "summary in timeline").
- Dropped `wfm_industry` + `wfm_tool_used` from each tool's `hubspotFields()` and from the
  form (industry comes from Clay enrichment; tool implied by completion flag).

## Lead scoring — "Volcano Lead Score" (engagement score)
Property `volcano_lead_score` (+ `volcano_lead_score_threshold`). Rules built:
- **Tool Completions**: form submission of our form → **+25**, group limit **75**.
- **Buying Signals**: Meeting booked → **+30**; Page visit (Base URL is any of the 5
  solution pages) → **+10**.
- **Email engagement**: DEFERRED until the TP email sequence + a `Volcano Model MVP`
  campaign exist (so it scopes to those emails, not any marketing email).
- Tiers (interpreted later in the Step 5 workflow, NOT on the property):
  **Cold 0–24 · Warm 25–64 · Hot 65–99 · Eruption 100+**.

### ⛔ WHERE WE LEFT OFF — score is scoring the WHOLE database
A lead score computes for every contact; the Meeting/Page-visit rules fire for any
contact, not just campaign ones. **Fix:** turn the score OFF, scope it to a campaign
audience, turn back on (non-members recalc to 0).
- Campaign audience = the **Sina + Denzel target lists** (the 250 split by AE), or a
  combined **"Volcano Model MVP – Targets"** list. Build these (needed for sequence +
  routing anyway), then either set the score's **audience** (Settings/Contacts tab) to
  that list, OR add a per-rule condition "Contact is member of [campaign list]".
- Future cleaner marker: "**HeyGen video URL is known**" (Clay enriches it per contact) —
  but contacts aren't enriched yet, so use the campaign lists for now.

## Remaining work
HubSpot:
1. **Scope the Volcano score** to the campaign audience (above) and re-enable.
2. **Step 5 — routing workflow**: branch on `volcano_lead_score` bands → Warm notify AE /
   Hot AE task / Eruption create Lead + AE call. Owner-by-vertical: **Sina** =
   architecture, construction, consulting · **Denzel** = civil, engineering, creative.
3. **Step 6 — tracking**: paste HubSpot tracking code into Webflow (Project Settings →
   Custom Code) + on the tool pages. Needed for page-view scoring + de-anonymisation.
   Then verify the page-view rule (consider operator "contains" if "is equal to" misses).
4. Create property `volcano_heygen_video_url` (HeyGen link) when Clay is ready to write it
   (also used in the TP1 email link). NOT created yet.
5. Build the `Volcano Model MVP` campaign + TP email sequence, then add the email scoring
   rules scoped to it.

Code placeholders before go-live:
- `src/components/resource-hub/ResourceHub.jsx` — `TOOL_URLS` → live tool URLs.
- `src/components/firms-like-yours/FirmsLikeYours.jsx` — real testimonial `youtubeId`s +
  `[Firm Name]`/`[Director Name]`.

Housekeeping:
- Delete demo contact **volcano-demo@example.com** (id 227675012614) once done testing.
- **Rotate the HubSpot Private App token** ("Content Tools Setup") — it was shared in chat.

## TP1 email link format (for Clay/HubSpot)
`https://tools.workflowmax.com/?tool=intro&firstname={{contact.firstname}}&company={{contact.company}}&industry=<architecture|engineering|consulting|construction|civil|creative>&email={{contact.email}}&video={{contact.volcano_heygen_video_url}}`
