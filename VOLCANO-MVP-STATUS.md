# Volcano Model MVP — build & wiring status

Handoff/resume doc. Last updated 2026-06-14. (No secrets in here.)

## What's built (in this repo)
- 6 content tools + a **TP1 intro video page** (`?tool=intro`), full desktop redesign
  (green brand-bg canvas, two-pane BrandSidebar for interactive tools, floating ~1040px
  card for landing pages; shared `src/styles/shell.css` + `src/components/shared/bands.jsx`).
  Responsive, mobile column untouched.
- **TP5 "Firms like yours" is fully real** — videos + firms + people + quotes:
  Guymer Bailey Architects (Kavan Applegate, featured), Engenera (Luphus Oosthuizen),
  Your HR System (Steve Luxmoore), BlueRock Digital (Sarah No). Construction & Civil
  have no video and fall back gracefully.

## Hosting / build — NOW ASTRO on Webflow Cloud (migrated 2026-06-13)
Webflow Cloud only serves **Astro/Next.js** (not a raw Vite SPA — that's why the first
deploy 404'd). So the app was migrated to the official Webflow Cloud Astro scaffold,
reusing 100% of the React components:
- **Astro 5 + @astrojs/react + @astrojs/cloudflare**, React 19. `astro.config.mjs`
  `base: "/app"` (the Webflow Cloud mount path). `webflow.json` = `{"cloud":{"framework":"astro"}}`.
  `src/pages/index.astro` renders `<App client:only="react">`; `Layout.astro` imports
  `index.css` + `shell.css` + DM Sans; favicon = `WFM-Logo.svg`.
- Removed Vite entry (`index.html`, `vite.config.js`, `src/main.jsx`) + the old GitHub
  Pages workflow. **`npm run dev` is now `astro dev`** (serves at `localhost:4321/app/…`);
  `npm run build` = `astro build` → Cloudflare Worker (`dist/_worker.js` + `dist/app/`).
  Builds clean locally.
- **Deployed to Webflow Cloud:** project "Landing Pages" (this GitHub repo connected),
  env `main`, mount path `/app`, URL `https://workflowmax-lp.webflow.io/app`.

### 🔴 OPEN: Webflow Cloud still 404s at `/app`
After the Astro migration (commit `9d5b964`) the URL still returned 404 when last checked.
**Need the Webflow Cloud → Deployments status for `9d5b964`** (Success / Building / Failed
+ build log) to diagnose. Likely culprits:
- Build not triggered / still building → "Deploy latest commit".
- Build failed → read the log.
- Built OK but 404 → base-path mismatch. The official starter uses a literal
  `"CLOUD_MOUNT_PATH"` token that Webflow swaps in; we hardcoded `"/app"`. If the
  GitHub-connected build doesn't swap, `/app` is correct; if Webflow strips the `/app`
  prefix before the worker, switch `astro.config` base back to `"CLOUD_MOUNT_PATH"`.
Starter reference: github.com/Webflow-Examples/hello-world-astro (cloned to /tmp during setup).

## HubSpot wiring (Portal ID 24214994, Pro tier) — capture verified end-to-end
- Property group **"Volcano Model MVP"** (`wfm_content_tools`) + **11 `wfm_*` properties**.
- Form **"Volcano Model MVP – Content Tool Results"**, GUID
  `1905567d-53d7-4103-971e-9abb13bc6796` → wired into `src/lib/hubspot.js` (Portal ID set).
- Dropped `wfm_industry` + `wfm_tool_used` (industry from Clay; tool implied by completion flag).

## Lead score — "Volcano Lead Score" (engagement score) — LIVE + SCOPED
Property `volcano_lead_score`. Rules:
- **Tool Completions**: form submission of our form → **+25**, group limit **75**.
- **Buying Signals**: Meeting booked **+30**; Page visit (Base URL is any of 5 solution pages) **+10**.
- **Email engagement**: DEFERRED until the TP email sequence + a `Volcano Model MVP` campaign exist.
- Tiers (applied in the Step-5 workflow, NOT on the property): **Cold 0–24 · Warm 25–64 · Hot 65–99 · Eruption 100+**.
- ✅ **Scoped** via Contacts tab → "Score specific contacts" → segment **`Volcano Model MVP_all targets`**.
  Out-of-scope contacts clear to blank; the earlier "scored the whole DB" issue is resolved
  (read-only score, engine clears excluded contacts).
- **Campaign audience** = the `VolcanoV1_*` active lists (industry-split: Construction, Architecture,
  Creative, Consulting, Engineering; **Civil list still TBD**). Owners split Sina/Denzel within them.

### End-to-end test (2026-06-13) — PASSED
- MCP-created test contact **Volcano Testlead** `volcano-test-lead@example.com` (id **228104221186**),
  added to the segment by Sina.
- Fired a Health Check submission → all `wfm_` properties populated + form-submission timeline
  activity. `volcano_lead_score` read `0` (in-scope, eval pending) → becomes **+25** on the next
  batch eval (~30 min) or instantly via the scoring tool's **"Test a contact"** button.
- Full chain proven: tool completion → contact + properties + timeline → score.

## Remaining work
1. **Fix Webflow Cloud 404** (get deploy status for `9d5b964`; maybe base token vs `/app`).
2. **Step 5 — routing workflow**: branch on `volcano_lead_score` bands → Warm notify AE /
   Hot AE task / Eruption create Lead + AE call. Owner-by-vertical: **Sina** = architecture,
   construction, consulting · **Denzel** = civil, engineering, creative.
3. **Step 6 — tracking**: HubSpot tracking code into Webflow (Project Settings → Custom Code)
   + on the tool pages. Enables page-view scoring + de-anonymisation. Then verify the page-view
   rule (switch operator to "contains" if "is equal to" misses).
4. `src/components/resource-hub/ResourceHub.jsx` — `TOOL_URLS` → live tool URLs (once the
   Webflow Cloud URL works, e.g. `https://workflowmax-lp.webflow.io/app?tool=tp1`).
5. Create property `volcano_heygen_video_url` (HeyGen link) when Clay is ready to write it
   (also used in the TP1 email link). NOT created yet.
6. Build the `Volcano Model MVP` campaign + TP email sequence, then add the email scoring rules scoped to it.

## Housekeeping
- Delete test contacts when done: `volcano-test-lead@example.com` (228104221186) and
  `volcano-demo@example.com` (227675012614).
- **Rotate the HubSpot Private App token** ("Content Tools Setup") — shared in chat; won't
  carry to another device, so a fresh token is needed next session to script HubSpot.

## TP1 email link format (for Clay/HubSpot)
`https://<live-tool-host>/?tool=intro&firstname={{contact.firstname}}&company={{contact.company}}&industry=<architecture|engineering|consulting|construction|civil|creative>&email={{contact.email}}&video={{contact.volcano_heygen_video_url}}`
(host = the working Webflow Cloud URL once the 404 is fixed, e.g. `workflowmax-lp.webflow.io/app`)
