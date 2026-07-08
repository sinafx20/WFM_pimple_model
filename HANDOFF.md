# Running this project on a new machine

Everything below is in GitHub. The only things that are **not** in the repo (by design)
are your API keys and Claude's working memory — see the two callouts.

## 1. Clone + install
```bash
git clone https://github.com/sinafx20/WFM_pimple_model.git
cd WFM_pimple_model
npm install        # installs astro app + sharp (used by the studio)
```

## 2. Secrets — the ONE thing you must bring over manually
`heygen-studio/.env` holds all API keys and is **gitignored** (never in GitHub).
Copy it from the old machine, or create it from the template and paste keys:
```bash
cp heygen-studio/.env.example heygen-studio/.env   # then fill in the 5 keys
```
Keys needed: `HEYGEN_API_KEY`, `HUBSPOT_TOKEN`, `LOGODEV_TOKEN` (pk_…),
`INSTANTLY_API_KEY`, `HEYREACH_API_KEY`. **Rotate any that were shared in chat.**

## 3. Run
```bash
npm run studio     # HeyGen studio + GTM cockpit  → http://localhost:5178  (and /dashboard)
npm run dev        # Astro landing pages          → http://localhost:4321/app?tool=intro
```
The live landing pages deploy to Webflow Cloud automatically on push to `main`
(https://lp.workflowmax.com/app). Node 20+ required (built on v24).

## 4. What's where
- `src/` — Astro/React landing-page tools (intro video, health check, calculator, benchmark, demo, firms-like-yours, resource hub)
- `heygen-studio/` — the local app: `server.mjs` (studio + cockpit), `heyreach-sequence.mjs` (LinkedIn sequences), face/demo images, cache files
- `email-templates/` — the 7-email × 6-industry sequence + `_export.html` (copy-ready) + `linkedin-sequence.md`

## Claude memory (for continuing with Claude on the new machine)
Claude Code's project memory lives OUTSIDE the repo at
`~/.claude/projects/<project>/memory/*.md` and is machine-local — it will NOT be on
the new device. To keep continuity either copy that `memory/` folder across, or ask
Claude to rebuild context from this repo. The detailed current state (test-campaign
IDs, the deliverability finding, pending decisions) is captured there.

## Current state (2026-07) — quick pointer
- **GTM studio + cockpit**: built and working locally.
- **Live campaign** (list 3698): assets/pipeline ready.
- **Compact TEST campaign**: 4 Instantly test campaigns + 1 HeyReach test campaign built in DRAFT.
- **Open blocker**: Instantly cold sending-domains are too new to deliver (warming since ~1 Jul);
  seed emails sent but didn't land at Gmail. Decision pending: use an established mailbox for the
  warm test, or wait ~2–3 weeks for warmup. LinkedIn side works.
- Nothing is live to real recipients — all test campaigns are draft/paused.
