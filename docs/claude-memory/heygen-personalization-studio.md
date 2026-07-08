---
name: heygen-personalization-studio
description: HeyGen personalization studio — interim replacement for the broken Clay→HeyGen video step; local web app + batch runner in the pimple-model repo
metadata: 
  node_type: memory
  type: project
  originSessionId: 7c2e50f7-96b6-452a-b06c-4a36f835ce76
---

Interim replacement for the broken **Clay → HeyGen** integration (Clay wasn't
validating the HeyGen API key). **Verified the key works directly against HeyGen's
API (200 on /v2/avatars), so the bug is Clay-side** — good evidence for Sina's support ticket.

**Location:** `~/pimple-model-project/pimple-model/heygen-studio/` (inside the
WFM_pimple_model repo; see [[pimple-model-project]]). Gitignored `.env` holds
`HEYGEN_API_KEY` + `HUBSPOT_TOKEN` (both were pasted in chat → **rotate them**).

**Pieces:**
- `server.mjs` (node, port 5178) + `public/index.html` = **Personalization Studio**:
  Pull HubSpot list → cast owner→presenter → editable per-vertical script → pick
  avatar/voice → generate → inline preview. Avatars/voices cached to `*.cache.json`
  (HeyGen `/v2/avatars` returns ~1293 and takes ~60s, so it's cached 24h). Run: `node server.mjs`.
- `heygen-batch.mjs` = CLI batch runner. `node heygen-batch.mjs` = DRY RUN (renders
  scripts to output/volcano-scripts.csv); `--generate --limit N` = make videos + write
  back; `--no-writeback` = preview only. `compare-voices.mjs` = A/B voices on one script.

**HubSpot:** list **3698** = "Volcano Model MVP_all targets" (334 contacts). Owners on it:
**80127259 (178 contacts)** and **80406430 (154)** — names not resolvable via the token,
so map them to Sina/Denzel in the studio's casting UI. `volcano_icp_vertical` (text) already
exists + populated (Architecture / Consulting / Engineering / Creative Agency / Construction;
**no Civil on this list**) → drives services-vs-project script. `volcano_heygen_video_url`
was created via REST (token can write schema).

**Presenters / HeyGen IDs:**
- Sina = avatar `b8f33c1ab4cd48dbb356d9d38871703a` ("Sina - new avatar") + voice
  `2ef6edfd75494239bc22093fb671b7b3` ("new voice with mic" — the GOOD mic-recorded clone;
  earlier clones like "Voice Test 3" were unstable: filler words, accent drift).
- Denzel = avatar `b8aebde6a4664874ac1b014ea17e4635` ("Denzel Avatar") + voice
  `13cb23d75356448b828aed75430c1df0` ("Denzel Voice" — quality NOT yet vetted; likely needs a clean re-clone).

**Video scripts now OPEN with an AI-twin disclosure** for honesty: "Hi {firstName}, I'm {presenter}'s
AI twin from WorkflowMAX, so I'll keep this quick." Then ONE sharp MD-level insight (the leak isn't where
they think: unbilled time for services / quote-vs-delivered margin for project), tightened (~60-70s, less
wordy), ending on "you'll walk away knowing that number. Worth a look?" MD lens = what do they get + will
they click next. Source = `DEFAULT_TEMPLATES` (services/project) in `heygen-studio/public/index.html`,
**editable in-app via the "✎ Scripts" modal** (tokens {firstName}/{company}/{industry}/{presenter};
saved to localStorage; applies to every generate + the batch). The older heygen-batch.mjs CLI has a
separate copy.

**Latest studio-hub additions (this session):**
- **Captions/subtitles:** every video is generated with `caption: true`. HeyGen returns a SEPARATE captioned
  output, so `/api/status` + the batch poller now use **`video_url_caption`** (not `video_url`) — that's the
  subtitled MP4. Older videos made before this used the plain URL (re-generate to get subtitles).
- **Name/company hygiene:** server helpers `cleanFirst` (drops leading initials, "S. Adeel"→"Adeel") and
  `cleanCompany` (strips legal suffixes: Pty Ltd / Pte Ltd / Ltd / Limited / Inc / LLC / Corporation / GmbH /
  PLC / P/L / Pty) applied in `/api/contacts`, `/api/dashboard`, `/api/writeback`, `/api/instantly/push` (+ CLI).
  Real names (APIMatic, Studio.SC, BlueRock Digital) untouched. Applied at generation/dispatch time.
- **HubSpot list picker:** studio header searches lists via `/api/lists?q=` (678 lists), so you can pull ANY
  list (e.g., the per-industry `VolcanoV1_*`), not just 3698. Cockpit link carries `?list=`.
- **In-app script editor:** "✎ Scripts" modal edits the two master templates (services/project) live; saved to
  localStorage; applies to every generate + the batch. Tokens {firstName}/{company}/{industry}/{presenter}.

**Script logic:** mirrors the email copy — cost-of-inaction + value-first + "even if WFM is
never the right fit, you'll keep your number" + single CTA (the Workflow Health Check below
the video). Services = unbilled time/utilisation; Project (construction/civil) = quoted-vs-
delivered margin + variation black hole. No em dashes. Keep sentences complete (fragments make
the clone hallucinate fillers). Only the TP1 intro touchpoint has a video.

**Full pipeline is now BUILT in the studio** (command center: generate → review → CRM → campaign):
- **Batch UI**: checkboxes + select-all; "Generate selected" (3-up concurrency, live per-row status:
  generating → ready → written ✓ → in Instantly ✓); prompts to "Write back", then to "Push to Instantly".
- **Durable hosting SOLVED**: token now has `files` scope; `/api/host` downloads each HeyGen MP4
  (their URLs expire ~days) and re-uploads to HubSpot File Manager (`/volcano-videos`, PUBLIC),
  storing the durable `…hubspotusercontent…` URL. `/api/writeback` writes `volcano_heygen_video_url`
  + `volcano_personalization` (the blob) to the contact (creates the props if missing).
- **Blob** = `firstname&company&industry&email&video&logo` (each value URL-encoded), used as
  `?tool=tpN&{{volcano_blob}}`. Logos via `LOGODEV_TOKEN` (pk_ publishable; the pasted `sk_` was the
  wrong half — image API needs pk_). NOTE the pk_ in use (`pk_drySdpNITqaeLv8c9H9nNw`) is logo.dev's
  SHARED demo token from their API response — get Sina's own pk_ for reliability.
- **Preview**: intro page (`IntroVideo.jsx`) now renders a co-branded header (firm `?logo=` × WFM) +
  the `?video=`. Studio has "Preview landing page ↗". **Front-end co-branding is only on the intro
  page and only on localhost:4321 (astro dev) until DEPLOYED to Webflow Cloud** — deploy to make the
  live `lp.workflowmax.com/app` preview + campaign links show the logo. Rolling logo to tp1–tp6 = TODO.
- **Instantly** (`INSTANTLY_API_KEY`, base64 bearer): campaigns exist — `Pimple - Architecture/
  Engineering/Consulting/Construction/Creative` (no Civil). `/api/instantly/push` maps vertical→campaign
  by name and creates a lead with custom_variables {volcano_blob, industry, video} (they land in the
  lead's `payload`, usable as `{{merge}}` tags). Lead create = POST /api/v2/leads; delete = DELETE
  /api/v2/leads/{id} (no content-type header).

**CO-BRANDED PERSONALIZATION (built).** Emails are fully per-lead co-branded:
- **Per-contact thumbnail**: studio composites a split image = presenter face (Sina/Denzel by owner casting,
  from local `face-sina.png`/`face-denzel.png`) | firm logo on a white card over the firm's **brand colour**
  (extracted as the most-vibrant colour from the logo via sharp; WFM-green fallback for monochrome logos) +
  centered play button. Hosted on HubSpot `/volcano-assets`. logo.dev **Brand API is Pro-only (403)** so colour
  comes from the logo pixels, not the API.
- **Merge vars** (per-lead, pushed to Instantly as custom_variables): `{{thumb}}` (email-1 image), `{{logo}}`
  (co-branded header firm×WFM), `{{brand_color}}` (accent bar + footer rule + caption link, inline style),
  `{{presenter}}`/`{{presenter_title}}` (signature — Denzel campaigns sign as Denzel), `{{booking}}`,
  `{{volcano_blob}}` (CTA link). All 42 templates regenerated in this design (bg #eef1f0, white rounded card).
- **Server** (`server.mjs`): imports sharp; `composeThumb`/`vibrant`/`uploadPublic` helpers; `/api/writeback`
  now composites+hosts the thumbnail, extracts brand colour, and stores `volcano_thumb_url` + `volcano_brand_color`
  on the contact; `/api/instantly/push` sends thumb/logo/brand_color/presenter/presenter_title/booking as custom vars.
- **Assets hosted** (HubSpot CDN /volcano-assets): WFM-Logo.png, sina-intro-thumb.png, denzel-intro-thumb.png,
  face-sina/denzel base frames (local), per-contact `thumb-<id>.png`.
- **Previews**: `email-templates/sample-cobranded.html` = the approved FILLED look (Adeel@APIMatic, blue).
  `_gallery.html` shows RAW templates (merge tags unfilled → broken logo img / literal colour) — expected.
  `_export.html` = copy-ready per-campaign HTML+subjects for Instantly.

**2026-07-02 — LP video cover shipped (commit 57d3b93, pushed to main):** `/api/writeback` now appends
`thumb=<volcano_thumb_url>` to the personalization blob (thumb composited BEFORE blob build), and
`IntroVideo.jsx` renders `?thumb=` as a click-to-play cover overlay (burned-in play button = the single
play affordance; native controls only after playback starts; falls back to plain controls without thumb).
Verified headless (playwright-core + system Edge) on astro dev. **Existing contacts' stored blobs in
HubSpot predate this — re-run writeback to refresh them.**

**Also 2026-07-02 (commits 3ba7176 → df1e9ba → 5f1ff0d, user-confirmed live):** the strip above the LP
had TWO causes. (1) A HubSpot **web-interactive (CTA banner)** injected by the tracking script (portal
24214994); CSS hiding wasn't enough for cookied visitors (HubSpot re-shows with higher-specificity
!important), so Layout.astro uses a **MutationObserver pinning inline display:none** on every
`[id^=hs-web-interactives]` element. Root fix still available: pause the leftover CTA in HubSpot →
Marketing → CTAs. (2) A grey line remained: the card's 40px top margin **collapses through body**, so
the body-painted green backdrop started 40px down, exposing html's #F1F1F1 — shell.css now paints the
brand bg on `html` and makes body transparent ≥768px. Also new: IntroVideo header = WFM logo left +
green "Prepared for {company}" chip right with firm logo from `?logo=`.

**2026-07-03 — per-presenter routing + demo-email thumbnail (commits d05fb37, ec77784, pushed):**
- Blob now carries `presenter=` (sina|denzel), `booking=`, and `demo_thumb=`. All 7 LP components
  prefer `?booking=` (validated meetings.hubspot.com) over the vertical map; Benchmark/HealthCheck/
  Calculator's walkthrough link + DemoPage's video are presenter-aware (Denzel demo = YouTube
  `699el1Gba3M`, Sina = `X7RX3Bzz0sk`). DemoPage (tool=tp4) cover = `?demo_thumb=` composite
  (own play overlay suppressed — play button is burned in), YouTube frame fallback.
- `/api/writeback` composites a SECOND thumbnail for the demo email: presenter's product-demo frame |
  firm-logo card (same layout as composeThumb via `leftBuf` param), hosted `demo-thumb-<id>.png`,
  stored `volcano_demo_thumb_url`, pushed to Instantly as `{{demo_thumb}}` (studio UI carries
  `_demo_thumb` through). Frames: local `heygen-studio/demo-frame-<presenter>.png` preferred
  (Sina hand-picked them), YouTube maxres fallback.
- **demo-frame-denzel.png is in the repo** (grabbed from Sina's clipboard — pasted chat images
  aren't on disk, but `[System.Windows.Forms.Clipboard]::GetImage()` in PowerShell rescues the
  most recent one). **demo-frame-sina.png is MISSING** — Sina must re-copy his chosen frame
  (WFM Dashboard + My Calendar, face bubble bottom-left, no captions) to the clipboard, then run
  the same clipboard-grab → save to `heygen-studio/demo-frame-sina.png`, commit, restart studio.
- Email 5 (demo, tool=tp4) ×6 industries: green button replaced with clickable `{{demo_thumb}}`
  image + caption (email-1 pattern); `_export.html` embedded copies synced (script:
  `email-templates/add-demo-thumb.mjs`; export's H array is parsed/regenerated, not string-matched).
  Sina will paste the new Email 5 HTML into each Pimple campaign from `_export.html`.
- Crop decision: sharp `attention` crop of the frame (letterbox variant rejected — too small).
- **OPEN BUG (local only): astro dev 500s on ANY query param value ending `.png`** (e.g.
  `?x=x.png`, so `thumb=`/`demo_thumb=` can't be tested on localhost). Fresh dev server too;
  worked 2026-07-02; live Cloudflare = 200 for same URLs. Not yet root-caused — next step was
  reading the 500 body + `[watch]`-free dev-server log. Suspect Vite/wrangler middleware treating
  .png-suffixed query values as asset requests.
- **Contacts still need re-writeback** (blobs predate booking/presenter/demo_thumb) then re-push
  to Instantly for the new merge vars.

**NEXT SESSION:** (1) finish demo-frame-sina.png (clipboard grab above); (2) root-cause the local
.png-param 500 if it blocks testing; (3) the LinkedIn piece — wire HeyReach (`/api/heyreach/push`);
still blocked on Sina's HeyReach API key + the HubSpot `linkedin_url` property name. See [[gtm-hub]]
for the dispatch design + connection-note/DM copy plan.

**Still to do:** (1) paste each email's Subject+HTML into the matching Pimple campaign in Instantly, set send-day
delays, enable unsubscribe; (2) **test one live Instantly send** to confirm merge vars substitute RAW (not
URL-encoded) — critical for `{{volcano_blob}}` (has &) and `{{brand_color}}` in inline style; (3) deploy the Astro
front-end (intro page now reads `?logo=` for co-branding) + roll logo to tp1–tp6; (4) get Sina's own logo.dev pk_
(currently logo.dev's shared demo token); (5) vet the "Denzel Voice" clone (a Denzel test video exists); (6)
**rotate all four tokens** (HeyGen, HubSpot, logo.dev, Instantly) — all pasted in chat. See [[launch-next-steps]],
[[email-templates-sequence]].
