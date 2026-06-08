# Deploying the WorkflowMAX content tools (for Leo)

Six standalone touchpoints, built as one **Vite + React** app. You deploy the
build once; each touchpoint is served by a URL parameter. No per-tool build, no
font hosting to wrangle — the Bruna fonts ship in `/public/fonts` and are served
from `/fonts/...` automatically.

## Run / build locally

```bash
npm install
npm run dev      # preview at http://localhost:5173 (dev switcher across all 6)
npm run build    # outputs the deployable site to dist/
npm run preview  # serve the production build locally to sanity-check
```

## How each touchpoint is addressed

A single deployed build serves all six via `?tool=`:

| Touchpoint | URL |
|---|---|
| TP1 Health Check | `/?tool=tp1` |
| TP2 Profit Leak Calculator | `/?tool=tp2` |
| TP3 Firm Benchmark | `/?tool=tp3` |
| TP4 Demo Landing | `/?tool=tp4` |
| TP5 Firms Like Yours | `/?tool=tp5` |
| TP6 Resource Hub | `/?tool=tp6` |

Personalisation params pass straight through and stack, e.g.
`/?tool=tp3&industry=engineering&email=jane@firm.com.au`:
- `industry` → architecture | engineering | consulting | construction | civil | creative
  (pre-selects the vertical, routes the booking link, tailors copy)
- `email` → records a completion in HubSpot the moment they reach results (no form fill)

Without `?tool=`, you get the dev switcher (not for production).

## Recommended deployment

**Host the build on the same root domain as the marketing site** (e.g.
`tools.workflowmax.com`, or `workflowmax.com/tools/*` via a reverse proxy/rewrite).
Same-origin matters: it lets the HubSpot tracking cookie, the ad pixels, and the
links back to `workflowmax.com/...` all work seamlessly.

1. Connect this GitHub repo to **Netlify / Vercel / Cloudflare Pages**:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Add a SPA rewrite so deep links work: serve `index.html` for all paths
     (Netlify: a `_redirects` line `/* /index.html 200`; Vercel/CF: SPA fallback).
2. Point `tools.workflowmax.com` (or the proxied path) at that deployment.
3. Each Webflow email/ad link goes to e.g.
   `https://tools.workflowmax.com/?tool=tp1&industry=architecture`.

### If you must embed inside a Webflow page via iframe (cross-domain)
It still works — the lead-capture form posts straight to HubSpot, and `?email=`
completions still fire. The only thing that degrades is the automatic tie to an
already-known visitor via the HubSpot cookie (cross-origin iframe can't read the
`workflowmax.com` cookie). Same-origin hosting (above) avoids this.

## Add to each page / the deployment (for tracking + retargeting)

- **HubSpot tracking script** — sets the `hubspotutk` cookie the tools read and
  auto-identifies known contacts. Add it to the deployment (or the host page).
- **Meta Pixel + Google Ads tag + LinkedIn Insight Tag** — so we can retarget
  everyone who reaches results, not just those who click a CTA.
  (Use Google Consent Mode v2 for AU consent.)

## Before go-live — fill these placeholders

- **`src/lib/hubspot.js`** — set `PORTAL_ID` and `FORM_GUID` (see `HUBSPOT-SETUP.md`).
- **`src/components/resource-hub/ResourceHub.jsx`** — `TOOL_URLS`: set each to the
  live tool URL (e.g. `https://tools.workflowmax.com/?tool=tp1`).
- **`src/components/firms-like-yours/FirmsLikeYours.jsx`** — real testimonial
  `youtubeId`s + `[Firm Name]` / `[Director Name]` placeholders.
- All other links (booking, solution pages, free trial, walkthrough video) are
  already set; double-check they're current.

## Already wired (no action needed)

- Per-vertical solution-page links and booking routing (Sina vs Denzel).
- Free-trial CTA (TP4 + TP5), product walkthrough video (TP4).
- Responsive desktop layouts; client-side PDF download (TP1–TP3).
