---
name: launch-next-steps
description: "Active launch checklist for the WFM content-tools email campaign — what Leo and Sina each do next, and what to bring back"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58022249-5fde-410c-95eb-7e0a91437f2a
---

**SUPERSEDED 2026-06-15 — the deploy/wire plan below is mostly DONE or changed.**
Current remaining work (source of truth = repo `VOLCANO-MVP-STATUS.md`; see
[[pimple-model-project]] 2026-06-15 update):
1. ✅ **Webflow Cloud 404 RESOLVED (verified live 2026-06-29).** Site was published;
   both `https://lp.workflowmax.com/app?tool=tp3&industry=…` (real custom domain) AND
   `https://workflowmax-lp.webflow.io/app` now return HTTP 200 and render the Astro app
   (astro-island + `_astro/client…js`). Old 404 fingerprint (ETag `6a2b…` + surrogate-key
   `…404req`) is gone. Personalised `?tool=` links + ResourceHub TOOL_URLS now resolve live.
2. HubSpot **Step-5 routing workflow** (branch on `volcano_lead_score` bands → AE notify/
   task/call; owner-by-vertical Sina vs Denzel).
3. HubSpot **Step-6 tracking code** into Webflow (Project Settings → Custom Code) for
   page-view scoring + de-anonymisation.
4. ResourceHub `TOOL_URLS` → live URLs (blocked on #1).
5. Create `volcano_heygen_video_url` property (Clay/TP1 email link).
6. Build `Volcano Model MVP` campaign + TP email sequence, then add email scoring rules.
Note: Leo's Netlify/Vercel deploy path below is OBSOLETE — hosting is now Webflow Cloud (Astro).

---
[Historical pre-Astro plan, kept for context:]

Action plan to launch the WFM content-tools email campaign, set 2026-06-08 (Sina
resuming ~2026-06-09). Content for all 6 touchpoints is DONE; this is the
deploy → connect → test path. Full context: [[pimple-model-project]]. Repo:
https://github.com/sinafx20/WFM_pimple_model (guides: `DEPLOY.md` for Leo,
`HUBSPOT-SETUP.md` for Sina).

**Leo — deploy:**
1. Accept GitHub invite; `git clone` the repo; read `DEPLOY.md`.
2. Deploy via Netlify/Vercel/Cloudflare Pages — build `npm run build`, publish
   `dist`, add SPA redirect.
3. Serve it on a WFM URL (e.g. tools.workflowmax.com — same domain = tracking works).
4. Add HubSpot tracking script + Meta/Google/LinkedIn pixels to the deployment.
5. Send back the **live base URL**.

**Sina — HubSpot + content:**
1. Add Leo as repo collaborator.
2. In HubSpot (follow `HUBSPOT-SETUP.md`): get **Portal ID**; create the one
   **form** → copy **Form GUID**; create the **custom properties**.
3. Gather the **5 TP5 testimonial details**: each video's YouTube ID + firm/
   director name.
4. (optional) confirm homepage stats OK to claim (100k / 18yr / G2 4.2 / Capterra 4.3).

**Then bring these 3 back to Claude to finish wiring:**
1. Portal ID + Form GUID → into `src/lib/hubspot.js`
2. Leo's live base URL → into `TOOL_URLS` in `ResourceHub.jsx` (TP6 "Open →" links)
3. The 5 video IDs + firm names → into `FirmsLikeYours.jsx` (TP5)

After wiring: Leo redeploys → quick QA (mobile+desktop, test form submit lands in
HubSpot, booking routes Sina vs Denzel) → launch. Scoring rules + rep "results"
email (also in HUBSPOT-SETUP.md) can be a post-launch fast-follow. Est. ~2 days to
minimum-viable launch.
