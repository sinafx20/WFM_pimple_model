# Memory Index

> **FIRST RUN ON A NEW MACHINE — do before anything else:** `heygen-studio/.env` is
> gitignored and did NOT clone. Before running the studio or dispatching to any channel,
> ASK Sina for the 5 API keys — HEYGEN_API_KEY, HUBSPOT_TOKEN, LOGODEV_TOKEN (pk_…),
> INSTANTLY_API_KEY, HEYREACH_API_KEY — and write them into `heygen-studio/.env` (copy
> from `.env.example`). Remind Sina to rotate any key previously shared in chat. Repo:
> github.com/sinafx20/WFM_pimple_model (private); setup steps in HANDOFF.md.

- [project-integration-state.md](project-integration-state.md) — Full integration state: what's built, HubSpot stage IDs configured, what's still pending (Pylon API, infra)
- [pimple-model-project.md](pimple-model-project.md) — WorkflowMAX CRO content tools (separate project, ~/pimple-model-project): stack, Webflow/HubSpot wiring, CTA + booking routing decisions
- [launch-next-steps.md](launch-next-steps.md) — Launch checklist (mostly superseded; remaining: HubSpot Step-5 routing workflow, Step-6 tracking code, campaign scoring rules)
- [user-sina.md](user-sina.md) — Sina Zarei: WorkflowMAX CRO tools + Pylon integration builder, Windows 11, Node v24 installed
- [heygen-personalization-studio.md](heygen-personalization-studio.md) — HeyGen video studio + full dispatch pipeline (heygen-studio/ in pimple-model repo): presenter/voice IDs, list 3698; 2026-07-03 per-presenter booking/demo-video/demo-thumb shipped; PENDING: demo-frame-sina.png via clipboard grab, local .png-param 500 bug, HeyReach wiring
- [email-templates-sequence.md](email-templates-sequence.md) — 7-email Instantly sequence × 6 industries in email-templates/; voice, design, copy logic, master template
- [gtm-hub.md](gtm-hub.md) — GTM hub + cockpit; 2026-07-06: HeyReach fully wired (campaign 495367 programmed via API), studio = 4-module AE workflow w/ dual-channel dispatch pickers, score sync → volcano_engagement_score; LinkedIn property = hs_linkedin_url (334/335 populated, no Clay blocker); Ryan Kagan test contact ready
- [volcano-test-campaign.md](volcano-test-campaign.md) — Compact 5-day TEST campaign (warm audience): Instantly + HeyReach IDs, headshots swapped, DM links shortened; BLOCKER = cold domains too new to deliver (Gmail dropped seed emails); PENDING DECISIONS Sina must make before running (real mailbox vs wait, Denzel LI seat, the audience list)
