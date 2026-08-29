---
name: volcano-test-campaign
description: "Compact 5-day Volcano TEST campaign (warm feedback audience) — Instantly + HeyReach IDs, the deliverability blocker, and the decisions Sina must make before running it"
metadata: 
  node_type: memory
  type: project
  originSessionId: 473f292a-696f-4c9f-bd4b-e491e4be883c
---

Compact 5-day version of the Volcano campaign to feed a **warm handpicked audience** (WFM internal,
partners, marketing agency) all the content in ~4-5 days for feedback. Everyone assumed consulting or
creative. Separate/isolated from the live Pimple campaigns. Part of [[gtm-hub]] / [[heygen-personalization-studio]].

**Design (locked):** all 7 touchpoints over 5 days (intro video → health check → profit-leak calculator →
benchmark → demo → firms-like-yours → resource hub); sender split half Sina / half Denzel by contact
owner; LinkedIn overlay of DMs that nudge to the email + share each tool.

## Instantly test campaigns (DRAFT, 4 = sender × vertical), compressed delays [1,1,0,1,0,1,0]
- Sina·Consulting `8967f755-4dca-4ac9-8bd5-682fa0bbe1a5`
- Sina·Creative `ae1d7eca-3ff7-4504-a916-17b605860582`
- Denzel·Consulting `8eea3039-5664-41a4-8475-8f158277f39a`
- Denzel·Creative `b4eed078-0943-4854-8f66-6a429f9f9f61`
Cloned live Pimple bodies. **Instantly create API:** POST /api/v2/campaigns {name, campaign_schedule:{schedules:[{name,timing:{from,to},days:{"0".."6":bool},timezone}]}, email_list:[mailbox…], sequences:[{steps:[{type:'email',delay,variants:[{subject,body}]}]}]}. delay = days AFTER this step. **timezone must be Instantly's enum: Australia/Melbourne + Australia/Brisbane + Pacific/Auckland OK; Australia/Sydney + America/New_York REJECTED.** Activate = POST /api/v2/campaigns/{id}/activate with body `{}` (empty body 400s). DELETE works. Add lead = POST /api/v2/leads {campaign,email,first_name}. Mailboxes (8, all warming since ~2026-07-01, daily_limit 18): sina.zarei@{team,cloud}workflowmax.com, denzel.kereama@{team,cloud}workflowmax.com, workflowmax@{star,team,cloud,hq}workflowmax.com.

## HeyReach test campaigns
- **497484 "Volcano TEST - Sina LinkedIn (5-day)"** (list 776762) = the real LI test. `heyreach-sequence.mjs <id> compact`: CHECK_IS_CONNECTION → connected: 6 DMs (intro→health→calculator→benchmark→demo→hub) → END; not connected: CONNECTION_REQUEST → accepted: 6 DMs / not accepted (2d): 3-InMail chain (video→tools→hub). InMail messages are {subject,message} objects; fallback must be TOKEN-FREE.
- **497592 "Volcano DEMO - fire now (Jo)"** = 0-delay demo. Finding: **HeyReach PACES sends even at 0 delay** — Jo enrolled instantly (inProgress=1) but messagesSent stayed 0 for 3+ min; status flickered PAUSED (trial throttling). "Immediate" = next action slot, not to-the-second.
- Other campaigns: 495417 v2 connection-aware main; 495434 Ryan test; 495367 old locked main; 495416 dead/FINISHED.
- **Seat 221310** (Sina, s.zarei2001@gmail.com) is **ACTIVE on trial**, Sales Nav valid. **Denzel has NO HeyReach seat** (only Sina's LinkedIn connected) → his LinkedIn half is blocked until his account is connected.
- **Custom fields (intro_link etc.) attach via AddLeadsToCampaignV2 on a RUNNING campaign, NOT via AddLeadsToListV2 (list-seed).** Not verifiable via any read endpoint (GetLead/GetLeadsFromCampaign don't echo custom fields) — must check in the HeyReach UI DM preview. Go-live order: seed list → StartCampaign (works even with seat off) → push via campaign-add → activate seat. StartCampaign on empty list → FINISHED.
- **DM links are shortened via TinyURL** in the push (server.mjs) — 744-char blob → tinyurl → 301 to the co-branded page. LinkedIn rarely auto-unfurls automated DMs, so the thumbnail card is NOT guaranteed in the DM (it IS guaranteed on the landing page + email). Can't attach an image directly in a HeyReach message.

## THE BLOCKER — Instantly deliverability (verified 2026-07-07)
Both a branded AND a truly-plain-text seed email (same mailbox sina.zarei@teamworkflowmax.com → s.zarei2001@gmail.com) **sent cleanly, 0 bounce, but NEVER landed** at Gmail (not inbox/spam/promo/all-mail). Cause = **sending domains too new** (warming only since 2026-07-01). warmup_score 100 is misleading — it only reflects Instantly's warmup pool, not real Gmail deliverability. Content is NOT the issue (plain text also vanished). Cold domains need ~2-4 weeks warmup + slow ramp.

## Seeds (staged)
- Email: s.zarei2001@gmail.com = HubSpot contact **109443572599** (set to BlueRock/bluerock.com/consulting/owner 80127259, which is DENZEL not Sina — see gtm-hub.md, the ids were inverted in earlier notes); enrolled in Instantly Sina·Consulting test — **custom vars VERIFIED correct** (blob encoded; thumb/logo/booking raw; brand_color #00315a hex).
- LinkedIn: **Jo Buckley** = contact **233783253287**, linkedin jo-buckley-712ba8320, in HeyReach test list/demo.
- Both used a PLACEHOLDER video (reused bluerock mp4, Denzel avatar) — regenerate a real Sina video for a true-look test.

## DECISIONS SINA MUST MAKE (before running the real test)
1. **Email path for the warm test:** (a) RECOMMENDED — connect an established mailbox (real sina.zarei@workflowmax.com + Denzel's) in Instantly and I repoint the 4 test campaigns' email_list to them → lands reliably to warm audience; OR (b) LinkedIn-only first; OR (c) wait ~2-3 weeks for cold domains to warm. Keep cold domains for the eventual REAL cold campaign.
2. **Connect Denzel's LinkedIn to HeyReach** for his LI half.
3. **Provide the real test-audience list** (name / email / company / LinkedIn URL / consulting-or-creative / owner Sina-or-Denzel) → then: create+enrich in HubSpot, add to a "Volcano TEST audience" list, process via GTM studio (generate videos + write back), push to the matching test campaign.
4. **Heads-up email** to the audience ("you'll get a few emails + LinkedIn notes from me and Denzel this week, please give feedback") — Claude to draft when ready.
5. Still pending from before: demo-frame-sina.png (clipboard grab), regenerate real Sina seed video.

**Resume:** studio server `cd heygen-studio && node server.mjs` (localhost:5178, /dashboard cockpit); astro dev `npm run dev` (localhost:4321). All test campaigns are DRAFT/paused — nothing sends to real people until launched.
