---
name: gtm-hub
description: Vision + architecture for turning the heygen-studio webapp into a central GTM execution hub (email + LinkedIn + scoring cockpit)
metadata: 
  node_type: memory
  type: project
  originSessionId: 7c2e50f7-96b6-452a-b06c-4a36f835ce76
---

Turning the local webapp ([[heygen-personalization-studio]]) into a **central GTM hub**.

**Confirmed operational flow:** Clay enriches basics + LinkedIn URL → HubSpot (source of truth) →
hub pulls contacts → personalize + AI video + co-branded thumbnail + URL blob (built) → **dispatch to
both channels**: Instantly (email, Pimple-{vertical} campaigns, built) AND **HeyReach** (LinkedIn
connection request + DM sequence) → engagement flows back → HubSpot scoring → lead creation + AE routing.

**Core principle:** generate the personalization asset set ONCE (video, thumbnail, brand colour, blob) and
reuse across every channel. LinkedIn uses the SAME co-branded thumbnail → same personalized landing page
(`?tool=intro&{{blob}}`); can't embed per-lead video natively in LinkedIn DMs, so thumbnail→landing is the pattern.

**Decisions (2026-07):**
- LinkedIn tool = **HeyReach** (agency-grade, API, webhooks).
- Hub model = **dispatcher + dashboard** (hub builds assets, pushes to Instantly + HeyReach, shows status;
  the tools + HubSpot workflows own scheduling/timing). NOT a full cadence engine.
- **Stay local** for now (control panel). NOTE: a local app can't receive webhooks — so engagement is
  **polled** from Instantly/HeyReach APIs (Instantly `leads/list` returns per-lead email_open_count/
  email_click_count/email_reply_count; `campaigns/analytics` gives campaign totals). Move to hosted
  webhooks when it becomes always-on.
- **Scoring stays in HubSpot** (don't build a competing score). Hub = engagement cockpit + signal router:
  aggregates all interactions, ranks most-engaged, and feeds signals into HubSpot so the existing
  `volcano_lead_score` + Step-5 lead-creation workflow stay the brain.

**Scoring points to ADD to volcano_lead_score** (on top of existing asset +25 / meeting +30 / page-visit +10):
email open +2 (weak, Apple MPP inflates), email click +10, email reply +30, LinkedIn connection accepted +8,
LinkedIn reply +30. Bands unchanged: Cold 0–24 · Warm 25–64 · Hot 65–99 · Eruption 100+.

**BUILT — Phase 1 cockpit:** `heygen-studio` server route `/dashboard` + `/api/dashboard` joins the HubSpot
list 3698 (firstname/company/vertical/owner/volcano_lead_score/volcano_thumb_url/linkedin_url) with Instantly
Pimple-campaign leads (opens/clicks/replies), computes hubEng = open*2+click*10+reply*30, ranks by
total = hubEng + hsScore, shows stage dots + bands. Read-only, on-demand poll.

**2026-07-06 — HeyReach WIRED (commits c6ab7d2, 012856a):** key in `.env` (`HEYREACH_API_KEY`, pasted in
chat → ROTATE with the other four). Server: `/api/heyreach/status` (GET `/auth/CheckApiKey` works),
`/api/heyreach/campaigns` (POST `/campaign/GetAll`), `/api/heyreach/push` (POST `/campaign/AddLeadsToCampaignV2`,
lead carries custom fields intro_link/health_check_link/thumb/booking/industry). Base
`https://api.heyreach.io/api/public`, header `X-API-KEY`. Cockpit: campaign picker in header + per-row
"LI push" for contacts with linkedin_url. Workspace has ONE campaign: "test pimple" (DRAFT, id 495358) —
leads can only be added once it's active with a linked sender seat. LinkedIn copy set (connection note ≤300
chars no links, 3-DM connector arc, InMail fallback for non-connectors, withdraw at day 10-14) =
`email-templates/linkedin-sequence.md`. AddLeadsToCampaignV2 payload shape still UNVERIFIED against a live
campaign. **BLOCKER: linkedin_url empty on ALL 334 contacts in list 3698 — Clay enrichment is the critical
path.** hardened readBody (malformed JSON no longer kills server).

**Campaign CREATED + PROGRAMMED via API (2026-07-06, commit 36f130b):** "Volcano LI - Sina" id **495367**
(DRAFT), list "Volcano LI leads" id **769492**, Sina's seat id **221310** (zareis01, Sales Nav valid,
isActive:false). Full sequence written via `/campaign/UpdateSequence` (script:
`heygen-studio/heyreach-sequence.mjs`, re-runnable): CR (withdraw 12d) → accepted: DM video → DM health-check
(+3d) → DM email/booking bridge (+4d); not accepted (+6d): CHECK_IS_OPEN_PROFILE → INMAIL or END.
**API schema knowledge:** full Postman collection = `https://documenter.gw.postman.com/api/collections/23808049/2sA2xb5F75?segregateAuth=true&versionTag=latest`
(fetchable JSON). Sequence = node tree {nodeType, actionDelay(≥3 HOUR for children of action nodes),
payload, conditionalNode (true branch: CR=accepted, CHECK_*=pass), unconditionalNode}. NodeTypes incl.
SEND_LEAD_TO_INSTANTLY (native email handoff!), FIND_EMAIL, CHECK_IS_CONNECTION/OPEN_PROFILE. INMAIL
messages are OBJECTS {subject,message}. Campaign Create needs name+linkedInAccountIds+linkedInUserListId.
No Delete endpoint. StartCampaign?campaignId= activates (needs sequence + active seat).
**UNVERIFIED:** custom-var brace syntax in message copy ({intro_link} etc.) — test with one lead before start.

**2026-07-06 later (commit eb77ebd) — AE WORKFLOW SHIPPED + BLOCKER DISSOLVED:**
- **The LinkedIn "blocker" never existed**: the HubSpot property is `hs_linkedin_url` (standard), NOT
  `linkedin_url` (which doesn't exist — batch-read silently ignores unknown props). **334/335 contacts
  on list 3698 HAVE LinkedIn URLs.** All code switched to hs_linkedin_url.
- **AE owner ids — CORRECTED 2026-08-29.** `80406430` = **Sina Zarei**, `80127259` = **Denzel
  Kereama**. An earlier note here claimed the opposite ("owner 80127259 (=Sina; verified via Sina's
  own contact record)") and that claim was wrong. It propagated into every code file and sent 153
  contacts the wrong AE's video, booking link, mailbox and LinkedIn seat before it was caught.
  The owners API is out of token scope, so verify the only way that actually works: read
  `hs_email_from_email` on logged emails per owner id (100/100 for 80127259 are denzel.kereama@,
  99/100 for 80406430 are sina.zarei@). Do not re-derive this from a contact record.
- **Contacts are assigned by HubSpot owner, not vertical.** Both AEs hold contacts in every
  vertical; vertical only picks the copy variant and campaign, never whose contact it is.
- **Ryan Kagan test contact**: id 126495762477, ryan.kagan@workflowmax.com, BlueRock (website
  bluerock.com.au drives logo), Consulting. Added to DYNAMIC list 3698 by adding his
  email to the test-email OR-branch via `/crm/v3/lists/3698/update-list-filters` (write shape: root OR →
  nested AND branches only; list = OR of lists 3693-3697 + email IN [volcano-test-lead@example.com, ryan]).
- **Studio UI = 4 workflow modules + KANBAN PIPELINE (commit 9afe748)**: modules 1 List / 2 HeyGen studio
  (✎ Scripts + 🎭 Casting modals) / 3 Dispatch (single "Push selected…" → modal) / 4 Track. Main screen =
  6-stage board: Pulled → Generated·review → Ready to push → Pushed:Instantly → Pushed:HeyReach → Completed.
  Stage derived from flags (stage(c) fn: _pushed/_liPushed/_status/hasVideo). Search + owner filter,
  per-column select-all, card→editor drawer (fixed right). NO chained popups — batchprog line narrates.
  Push modal: Instantly (none/auto/id) and/or HeyReach (none/id), skips already-pushed per channel →
  enables Instantly-first-then-HeyReach follow-up from the Pushed:Instantly column.
  **HeyReach message variable = `{company}`** (not {COMPANY_NAME}); sequence re-applied to 495367.
  Campaign 495367 was PAUSED (Sina activated it) — resume before AddLeads.
- **2026-07-06 latest (commits b10e757, 584963c):** cards show full name + jobtitle; drawer for ready+
  contacts = Generated-assets card (hosted video preview, 7 landing-page chip links, lead links to
  Instantly `app.instantly.ai/app/campaign/{id}/leads` + HeyReach `app.heyreach.io/campaigns/{id}` —
  both URL patterns UNVERIFIED guesses). `/api/contacts` joins Instantly+HeyReach membership → stages
  persist across refresh (stage(): _pushed||inInstantly etc). Drawer "Rebuild links & thumbnails" =
  re-writeback from existing hosted video + `/api/instantly/update` (finds lead by email in Pimple
  campaigns, PATCHes custom_variables). **Ran for the 4 pushed contacts (Alex Kibble, Kim Stoddart,
  Victor Sarris, Bjarne Dijkman): blobs rebuilt + Instantly leads updated.** Kim is also in HeyReach
  (test) → Completed column. Old-blob symptom: intro LP shows no video cover when blob lacks thumb=.

**2026-07-07 COMPACT TEST CAMPAIGN (in progress):** 5-day compressed run to feed a warm handpicked
audience (WFM internal, partners, marketing agency) all content for feedback. Decisions: all 7 TPs over
5 days (delays [1,1,0,1,0,1,0] = doubles up days 3-4), sender split half Sina/half Denzel (by contact
owner), 3 LinkedIn DMs nudging to email. Headshots swapped to real ones (heygen-studio/face-sina.png grey,
face-denzel.png lavender-left-as-is; old = *.backup.png) — intro email thumb + LP video cover now use them.
**Instantly: 4 draft test campaigns created via API** (clone of Pimple Consulting/Creative bodies, compressed):
Sina·Consulting 8967f755-4dca-4ac9-8bd5-682fa0bbe1a5, Sina·Creative ae1d7eca-3ff7-4504-a916-17b605860582,
Denzel·Consulting 8eea3039-5664-41a4-8475-8f158277f39a, Denzel·Creative b4eed078-0943-4854-8f66-6a429f9f9f61.
Instantly create API: POST /api/v2/campaigns needs name + campaign_schedule{schedules:[{timing,days,timezone}]}
+ email_list[] (sending mailboxes) + sequences[{steps:[{type:email,delay,variants:[{subject,body}]}]}]; delay =
days AFTER this step; **timezone MUST be Instantly's enum — Australia/Melbourne OK, Sydney/America NOT**;
DELETE /api/v2/campaigns/{id} works. Mailboxes: sina.zarei@{team,cloud}workflowmax.com, denzel.kereama@same.
**HeyReach: test campaign 497484 "Volcano TEST - Sina LinkedIn (5-day)"** (list 776762, Sina seat 221310),
compact 3-DM sequence. **Denzel has NO HeyReach seat yet** (only Sina's LinkedIn connected) — his LinkedIn
half needs his account connected in HeyReach before a Denzel LI test campaign can run. Push adds
resource_hub_link (tp6). ALL test campaigns in DRAFT — not launched. **NEXT: awaiting Sina's list** →
create/find + LinkedIn-enrich contacts in HubSpot, add to a test list, tag owner+vertical, process via GTM
studio, push to matching test campaign; then heads-up email to audience.

**2026-07-07 SEED PRE-FLIGHT (before real audience):** Two seeds run through the pipeline.
**Instantly seed VERIFIED GOOD** — contact s.zarei2001@gmail.com (id 109443572599, set to BlueRock/
bluerock.com/consulting) pushed to "Volcano TEST — Sina · Consulting" (8967f755...): lead's
custom_variables all correct & raw (volcano_blob encoded, thumb/logo/booking raw, brand_color #00315a
hex, presenter/video/industry set). Launch that campaign → email 1 hits the gmail; only the seed is
enrolled so it's isolated. **HeyReach seed = Jo Buckley** (contact 233783253287, linkedin
jo-buckley-712ba8320, BlueRock/consulting) into test campaign 497484/list 776762.
**HeyReach learnings:** (1) StartCampaign works even with seat isActive:false → IN_PROGRESS (seat only
needed to actually SEND); (2) starting an EMPTY-list campaign → FINISHED (seed list first); (3)
**custom fields (intro_link etc.) are NOT returned by any read endpoint** (GetLead/GetLeadsFromList/
GetLeadsFromCampaign) so attachment can't be API-verified — must check in HeyReach UI DM preview or a
live test DM; (4) AddLeadsToCampaignV2 (running campaign) is the documented method for custom vars —
list-seed via AddLeadsToListV2 is uncertain. **Recommended go-live order per HeyReach campaign: seed 1
lead to list → StartCampaign (IN_PROGRESS, seat can stay off) → push audience via studio (campaign-add
attaches custom vars) → activate seat to send.** Campaign 497484 left PAUSED with Jo enrolled. Video
used for both seeds = placeholder (reused bluerock mp4, denzel avatar) — regenerate a real Sina video
for a true-look test. Denzel HeyReach seat still not connected.

**2026-07-06 LinkedIn v2 (commit 1ec67d3):** HeyReach CANNOT attach an MP4 to a DM — API-confirmed,
message payload only keeps `messages`+`fallbackMessage` (probed attachment/videoUrl/media fields, all
stripped on round-trip). Solution = **rich unfurl card**: intro LP (Layout.astro, server output) now
emits per-contact OG tags from query params (og:image=thumb w/ burned-in play button, og:video=mp4,
og:type=video.other, twitter:player) so {intro_link} in a DM renders a play-thumbnail card, not a blob.
**Sequences connection-aware** (heyreach-sequence.mjs root = CHECK_IS_CONNECTION → connected: DM arc
directly; else CONNECTION_REQUEST → accepted: DM arc / not: CHECK_IS_OPEN_PROFILE → INMAIL). Sequence
STRUCTURE is immutable once a campaign starts (copy edits only), so new campaigns:
**495417 "Volcano LI - Sina v2 (connection-aware)"** = go-forward main (list 769492);
**495416 "Volcano - AI video test"** = one-message video DM for the Ryan test (connection-check→videoDM).
Old 495367 started/locked (superseded). Script: `node heyreach-sequence.mjs <id>` (full) or `<id> test`.
Seat 221310 isActive:false — activate before real sends. Automated-DM unfurl not 100% guaranteed; confirm
on the Ryan test send.

**2026-07-06 push-flow fix (commit pushed):** HeyReach gotcha — starting a campaign with an EMPTY list
makes it immediately FINISHED (can't then accept leads); AddLeadsToCampaignV2 needs status ACTIVE/
IN_PROGRESS. So `/api/heyreach/push` is now status-aware (GetById): running→AddLeadsToCampaignV2;
DRAFT/PAUSED→AddLeadsToListV2 into campaign's linkedInUserListId (works any state), then Start enrols;
FINISHED→error. **Correct AE flow: seed leads FIRST (push while DRAFT), THEN Start the campaign.**
Test campaign 495416 died FINISHED (started empty). Fresh **Ryan test: campaign 495434 "Volcano - AI
video test (Ryan)"**, list 769589, Ryan (126495762477) seeded (profile resolved: Ryan Kagan CRO). DRAFT,
ready — user Starts in HeyReach to fire the connection-check→video-DM. **Ryan now = TKD Architects**
(company+website changed from BlueRock; logo.dev tkda.com.au has real logo; thumb rebuilt teal #0178a8).
Also: thumb/demo_thumb URLs now carry `?v=<ts>` cache-bust (rebuild reused stable filename → stale
CDN/browser/LinkedIn-OG cache showed old monogram). logo.dev country-domain gap: bluerock.com.au 404s,
bluerock.com real — general resolveLogoDomain fallback still TODO (user deferred).
- **Cockpit**: LI eng column (dashboard joins HeyReach GetLeadsFromCampaign per-lead status defensively;
  liEng = accept 8 + reply 30 into total), "in seq" state, **Sync scores → HS** button →
  `/api/scores/sync` writes `volcano_engagement_score` (absolute, idempotent, batch/update 100s;
  property auto-created). volcano_lead_score stays forms-driven/HubSpot-owned; routing branches on sum.

**NEXT:** (1) Ryan end-to-end test: generate video in studio → write back → push Instantly + HeyReach
(campaign 495367 must be STARTED first: seat isActive:false + StartCampaign; AddLeads rejects DRAFT) →
verify custom vars render → check cockpit engagement + score sync; (2) verify per-lead status field
names from GetLeadsFromCampaign once Ryan's lead is in (join reads it.status/leadStatus/state
defensively); (3) HubSpot Step-5 routing to branch on volcano_lead_score + volcano_engagement_score;
(4) later: host the hub + webhooks (HeyReach has webhook endpoints). See [[email-templates-sequence]].
