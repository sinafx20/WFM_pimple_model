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

### ✅ ROOT CAUSE FOUND (2026-06-15): the Webflow SITE was never published
The 404 was never a build/deploy/config problem. Deploys are green; the local Cloudflare
worker serves `/app` with HTTP 200 (verified via `wrangler dev`). Proof it's a publish issue:
`curl -I` on the live host shows the **root `/`, bare `/app`, and `/app?tool=tp1` all return
the IDENTICAL Webflow 404** (same `ETag W/"6a2b0461-38a"`, `surrogate-key …404req`,
`CF-Cache-Status: HIT`, 5-day cache). i.e. requests hit Webflow's normal **site** CDN, which
has no page there — the Cloud `/app` mount is not registered on the live edge.
**FIX: publish the Webflow site** the Cloud project is attached to (Designer → Publish to
`workflowmax-lp.webflow.io`). Webflow docs: "if you deployed to an existing site, publish the
site and confirm the environment's mount path matches." The green Cloud deploy already placed
the worker; publishing wires the site CDN routing to it.
Also note: **Webflow's edge 301-strips trailing slashes** (`/app/` → `/app`), so the canonical
URLs are **bare** `…/app?tool=tp1` (NO trailing slash).

---
### (historical) earlier investigation before root cause was found
After the Astro migration (commit `9d5b964`) the URL still returned 404 when last checked.

**Local build is verified correct (2026-06-15, Claude):** ran `npm install` + `npm run build`
clean. Confirmed in `dist/`: assets emit to `dist/app/_astro/*`, the SSR worker references
them as `/app/_astro/...` (no bare `/_astro/` leaks), and `dist/_routes.json` routes `/*` to
the worker while excluding `/app/_astro/*` as static. So the **artifacts are correct — the 404
is on the Webflow Cloud side**, not the build.

**Done this session (commit `5ee893d`, pushed to `main` to re-trigger a fresh deploy):**
aligned `astro.config.mjs` to the current official Webflow Cloud Astro docs —
added `build.assetsPrefix: "/app"` (docs say it must match `base`) and
`security.checkOrigin: false` (Webflow proxies requests; the Origin header won't match the
worker host, which would otherwise reject form POSTs). Note: current Webflow docs use a
**literal** mount path (`/app`), not the older `"CLOUD_MOUNT_PATH"` token from the
hello-world-astro starter, so `base: "/app"` is correct as long as the env mount path is `/app`.

**🟡 Sina to check in the Webflow Cloud dashboard (only place this is visible):**
1. Project "Landing Pages" → env `main` → **Deployments**: is commit `5ee893d` Success /
   Building / Failed? If Failed, read the build log (paste back). If no deploy appears,
   hit **"Deploy latest commit"** (GitHub auto-deploy may not be wired).
2. Confirm the environment's **mount path is exactly `/app`** (must match `base`/`assetsPrefix`).
3. Once it returns 200 at `https://workflowmax-lp.webflow.io/app`, unblocks remaining-work #4
   (ResourceHub `TOOL_URLS`) and #3 (tracking code).
Starter reference: github.com/Webflow-Examples/hello-world-astro.

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
1. **Fix Webflow Cloud 404** → ROOT CAUSE = site not published (see top section). Waiting on a
   colleague to grant Sina publish permission, then Publish the site. After publish, test BOTH
   `https://lp.workflowmax.com/app?tool=tp1` (the site's real custom domain) and the
   `workflowmax-lp.webflow.io/app` staging URL.
2. **Step 5 — routing workflow** (HubSpot, not built yet): branch on `volcano_lead_score` bands →
   Warm notify AE / Hot AE task / Eruption create Lead + AE call. Owner-by-vertical: **Sina** =
   architecture, construction, consulting · **Denzel** = civil, engineering, creative.
3. ✅ **Step 6 tracking — DONE in code** (commit `e6ebc63`): HubSpot loader (portal 24214994) added
   to `src/layouts/Layout.astro` <head> so it fires on the tool pages (the Astro app, NOT reachable
   via Webflow site custom code). `hubspot.js` already attaches the resulting `hubspotutk` cookie to
   submissions. STILL TODO: also paste the same script into Webflow → Custom Code for the native
   `lp.workflowmax.com` solution pages; then verify the page-view scoring rule (switch operator to
   "contains" if "is equal to" misses).
4. ✅ **DONE in code** (commit `e6ebc63`): `ResourceHub.jsx` `TOOL_URLS` now point to the sibling
   tools via relative `?tool=tp1..tp5` (host/mount-agnostic; `withIndustry` preserves the `/app`
   base + carries `?industry=`). No further URL wiring needed — every other tool's solution/booking/
   walkthrough/free-trial link was already real.
5. Create property `volcano_heygen_video_url` (HeyGen link) when Clay is ready to write it
   (also used in the TP1 email link). NOT created yet. **TP1 code is already done** — `IntroVideo.jsx`
   `resolveVideo()` reads `?video=` and handles HeyGen share→embed + direct `.mp4`.
6. Build the `Volcano Model MVP` campaign + TP email sequence, then add the email scoring rules scoped to it.

## Housekeeping
- Delete test contacts when done: `volcano-test-lead@example.com` (228104221186) and
  `volcano-demo@example.com` (227675012614).
- **Rotate the HubSpot Private App token** ("Content Tools Setup") — shared in chat; won't
  carry to another device, so a fresh token is needed next session to script HubSpot.

## TP1 email link format (for Clay/HubSpot)
`https://<live-tool-host>/?tool=intro&firstname={{contact.firstname}}&company={{contact.company}}&industry=<architecture|engineering|consulting|construction|civil|creative>&email={{contact.email}}&video={{contact.volcano_heygen_video_url}}`
(host = the working Webflow Cloud URL once the 404 is fixed, e.g. `workflowmax-lp.webflow.io/app`)
