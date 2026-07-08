---
name: pimple-model-project
description: "WorkflowMAX CRO content tools project (pimple-model) — location, stack, deployment, and integration decisions"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58022249-5fde-410c-95eb-7e0a91437f2a
---

**Separate project from the Pylon integration** (the cwd). Lives at
`C:\Users\SinaZarei\pimple-model-project\pimple-model`. Run with `npm run dev`
(Vite, http://localhost:5173) — `App.jsx` is a dev switcher across all 6 tools.

**On GitHub:** https://github.com/sinafx20/WFM_pimple_model (private, sinafx20's
account; HTTPS push via Git Credential Manager — SSH key isn't accessible in this
env so use HTTPS). **Deploy model:** deploy the Vite build once; each touchpoint is
served by `?tool=tp1..tp6` (+ `?industry=` / `?email=` pass through). Host
same-origin to WFM (e.g. tools.workflowmax.com) so HubSpot cookie + pixels work.
Leo's guide = `DEPLOY.md`; Sina's HubSpot steps = `HUBSPOT-SETUP.md`.

A set of **WorkflowMAX** (Xero job-management product) interactive CRO/marketing
"touchpoint" tools, built Vite + React 18, each deployed as its own standalone
embed on **Webflow** under `workflowmax.com/...` (Leo handles hosting). Six
verticals: architecture, engineering, consulting, construction, civil, creative.
Brand: evergreen `#0A2F28`, moneytree `#63DB94`, Bruna headings / DM Sans body
(`@font-face` in `src/index.css`); tokens in `src/styles/tokens.js`.

Tools: TP1 Health Check, TP2 Profit Leak Calculator, TP3 Firm Benchmark (all
three now refined + consistent), TP4 Demo Landing, TP5 Firms Like Yours, TP6
Resource Hub (`resource-hub/ResourceHub.jsx`) — final-touchpoint "everything in
one place" page: grouped resource links (Diagnose / See it in action) +
CredibilityStrip + free-trial/book/solution CTAs; links to the other tools via
`TOOL_URLS` (placeholder `#` until Leo sets the workflowmax.com pages; carries
?industry= through). All 6 registered in the App.jsx dev switcher.

Shared `src/components/shared/CredibilityStrip.jsx` (used in TP4 + TP5): stats =
100,000+ professionals · 18 years · 4.2★ G2 · 4.3★ Capterra; integration chips
(Xero, QuickBooks, HubSpot, SharePoint, Zapier, Google Drive, Outlook & Google
Calendar, AI tools) — **text chips for now, real logos to come later**.

**TP5 was redesigned** (was a long scroll of 6 fake-number case studies): now a
featured video (visitor's vertical if available, else the architecture flagship —
Sina's pick) + CredibilityStrip + compact horizontal story gallery + built-in CTAs
top & bottom. **Important constraint: WFM does NOT have verifiable quantifiable
customer outcomes**, so TP5 uses qualitative outcome tags only — the testimonial
videos carry specifics. 5 real videos exist (architecture/engineering/consulting/
creative; one vertical has 2); none for construction/civil yet — placeholders
`REPLACE_VIDEO_ID_*` + `[Firm Name]` await Sina's real footage/names.

Key decisions made (2026-06):
- **CTAs are tiered**: soft vertical solution page (primary) → walkthrough
  (secondary, youtube X7RX3Bzz0sk) → booking demoted/optional. Booking routes by
  vertical: **Sina** (architecture/construction/consulting) vs **Denzel**
  (civil/engineering/creative); civil solution page falls back to
  building-and-construction. URLs hardcoded in `SOLUTION_URLS`/`BOOKING_URLS` per
  component. **"Start your free trial"** CTA (app.workflowmax.com/register/sign_up,
  `FREE_TRIAL_URL`) is intentionally **only on TP4 + TP5**, not the trilogy (doesn't
  fit a results page). All 5 use the precise logo SVG (the old TP4/TP5 export had a
  malformed first "o" — fixed).
- **Lead capture = HubSpot Forms API** (no backend, no DB; HubSpot CRM is the
  store). Shared libs `src/lib/hubspot.js` (set PORTAL_ID + FORM_GUID) and
  `src/lib/resultsPdf.js` (client-side branded PDF, jsPDF lazy-loaded). Each
  tool fires completion on email submit AND silently on results if `?email=` is
  in the enriched campaign link. Full setup steps in repo `HUBSPOT-SETUP.md`.
- Scoring is HubSpot-side (Cold/Warm/Hot/Eruption by points); tools just report
  completions + result props. Phase-1 results delivery = client PDF download +
  automated personalised email "from contact owner" (rep), no PDF backend.

Goal of the funnel: identify most-engaged prospects → AE call (speed-to-lead);
soft landings + retargeting over forcing bookings.

**UPDATE 2026-06-15 — repo has moved well past the above.** Source of truth is now
`VOLCANO-MVP-STATUS.md` in the repo (read it first each session). Key deltas:
- **Build migrated Vite → Astro 5** (`@astrojs/react` + `@astrojs/cloudflare`, React 19)
  for **Webflow Cloud** hosting. `npm run dev` is now `astro dev` (localhost:4321/app/…);
  `npm run build` = `astro build` → Cloudflare worker in `dist/`. `astro.config.mjs`
  `base: "/app"` (+ now `assetsPrefix: "/app"` and `security.checkOrigin:false`, matching
  official Webflow Cloud docs). Deployed to Webflow Cloud project "Landing Pages", env `main`,
  URL `https://workflowmax-lp.webflow.io/app`.
- **404 ROOT CAUSE FOUND (2026-06-15): the Webflow SITE was never published.** NOT a
  build/deploy/config issue — deploys are green and the local Cloudflare worker serves `/app`
  200 (`wrangler dev`). `curl -I` proved it: live root `/`, bare `/app`, and `/app?tool=tp1`
  all return the IDENTICAL Webflow site 404 (same ETag/`surrogate-key …404req`), so requests
  hit Webflow's site CDN, not the Cloud worker — the `/app` mount isn't on the live edge.
  **Fix = publish the Webflow site** (Designer → Publish to `workflowmax-lp.webflow.io`).
  Also: Webflow's edge **301-strips trailing slashes**, so canonical URLs are **bare**
  `…/app?tool=tp1` (NO trailing slash). `?tool=` ids: intro, tp1, tp2, tp3, tp4, tp5, tp6.
- **HubSpot is LIVE** (Portal 24214994): form GUID `1905567d-53d7-4103-971e-9abb13bc6796`
  wired into `src/lib/hubspot.js`, 11 `wfm_*` props, `volcano_lead_score` engagement score
  (Cold/Warm/Hot/Eruption), scoped to `Volcano Model MVP_all targets` segment. E2E capture
  test PASSED 2026-06-13.
- **TP5 fully real** (videos+firms+quotes); **TP1 intro video page** (`?tool=intro`) added +
  full desktop brand redesign (BrandSidebar, shell.css). Construction/Civil have no TP5 video
  (graceful fallback).
- Remaining: fix 404, HubSpot Step-5 routing workflow + Step-6 tracking code, ResourceHub
  `TOOL_URLS` (blocked on live URL), `volcano_heygen_video_url` prop, campaign + email sequence.
  See [[launch-next-steps]].
