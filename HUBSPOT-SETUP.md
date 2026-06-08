# HubSpot + deployment setup for the content tools

This wires the three tools (Health Check, Calculator, Benchmark) into HubSpot so
that **completions are captured, scored, and routed to the right rep**. There is
**no database and no backend** — HubSpot's CRM is the store, and the tools post
straight to a HubSpot form.

The code is already done. What remains is point-and-click setup in HubSpot, plus
pasting two IDs into one file. Order below is the fastest path.

---

## 1. Find your Portal ID (a.k.a. Hub ID)

This is the unique number for your HubSpot account. Two easy ways:

- **From the URL:** after logging in, look at the address bar:
  `app.hubspot.com/contacts/`**`1234567`**`/...` — that number is your Portal ID.
- **From settings:** ⚙️ Settings → Account Management → **Account Defaults** →
  it's shown as **Account ID / Hub ID** at the top.

It's the same for all three tools and it is not secret.

---

## 2. Create ONE form and get its Form GUID

We use a single form for all three tools (the `wfm_tool_used` field tells them
apart), so you only do this once.

1. **Marketing → Forms → Create form → Embedded form → Blank.**
2. Name it `Content Tool Results`.
3. Add the fields from section 3 below (drag them in). They can be set to
   **hidden** — the tool fills them programmatically; the prospect never sees
   them. The only one that matters visually is **Email**.
4. **Publish** the form.
5. Get the **Form GUID**: open the form, click **Share → Embed**, and in the
   embed snippet you'll see `formId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"`.
   That long value is the Form GUID. (It's also in the form editor URL.)

> The Forms API only accepts fields that exist **on the form** and map to an
> existing contact property. So every `wfm_…` property in section 3 must be (a)
> created as a property and (b) added to this form.

---

## 3. Create the custom contact properties

⚙️ Settings → Properties → **Contact properties → Create property**. The
**internal name must match exactly** (the tools send these names):

| Internal name | Label | Field type | Notes |
|---|---|---|---|
| `wfm_tool_used` | Tool used | Dropdown or single-line text | Health Check / Profit Leak Calculator / Firm Benchmark |
| `wfm_completed_health_check` | Completed Health Check | Single checkbox (boolean) | set to `true` |
| `wfm_completed_calculator` | Completed Calculator | Single checkbox (boolean) | set to `true` |
| `wfm_completed_benchmark` | Completed Benchmark | Single checkbox (boolean) | set to `true` |
| `wfm_industry` | Industry (self-selected) | Dropdown or text | see industry values below |
| `wfm_firm_size` | Firm size | Single-line text | e.g. "45 staff", "25 to 80 staff" |
| `wfm_revenue_band` | Revenue band | Single-line text | e.g. "$5M - $10M", "$7.0M" |
| `wfm_health_score` | Health Check score | Number | 0–32 |
| `wfm_maturity_tier` | Maturity tier | Dropdown or text | Reactive / Structured / Optimised |
| `wfm_profit_leak` | Profit leak ($/yr) | Number | from the Calculator |
| `wfm_benchmark_gap` | Benchmark gap ($/yr) | Number | from the Benchmark |
| `wfm_biggest_issue` | Biggest issue | Single-line text | their weakest area |
| `wfm_results_summary` | Results summary | Multi-line text | full plain-text recap |

If you make `wfm_industry` a **dropdown**, the option values must match exactly:
`Architecture & Design`, `Engineering Consultancy`, `Management & Business
Consulting`, `Construction & Trades`, `Civil & Infrastructure`,
`Creative & Marketing`. (Using **single-line text** avoids any mismatch and is
totally fine.)

`email` is built-in — no need to create it.

---

## 4. Paste the two IDs into the code

In [`src/lib/hubspot.js`](src/lib/hubspot.js), set:

```js
const PORTAL_ID = "1234567";                                   // from step 1
const FORM_GUID = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx";       // from step 2
```

That's the entire code change. Until these are set, the tools keep working and
fall back to the user's mail client (so nothing breaks pre-launch).

---

## 5. Lead scoring — your Cold / Warm / Hot / Eruption model

Use a **HubSpot Score** property (Settings → Properties → create a *score*
property, e.g. `wfm_engagement_score`) and add positive attributes. These are
the points **our three tools** contribute; your other touchpoints (TP4–TP6,
email opens/clicks, page visits) add the rest to reach the higher tiers.

Suggested starting points (tune freely):

| Signal (contact attribute) | Points |
|---|---|
| `wfm_completed_health_check` is true | +25 |
| `wfm_completed_calculator` is true | +25 |
| `wfm_completed_benchmark` is true | +25 |
| Visited a vertical solution page (workflowmax.com/architects, etc.) | +10 |
| Clicked "Book a time" / booking page view | +30 |
| Opened a nurture email | +3 each |
| Clicked a nurture email | +8 each |

Then a **workflow** reads the score and applies your table (set a
`wfm_lead_tier` text property + the action):

| Tier | Score | Workflow action |
|---|---|---|
| **Cold** | 0–24 | Stay in nurture sequence. No AE action. |
| **Warm** | 25–64 | Notify AE (internal email). Stay in sequence. |
| **Hot** | 65–99 | Unenroll from sequence. Create AE task "Outreach within 24h". |
| **Eruption** | 100+ | Unenroll from sequence. High-priority task "Call within 1h" + Slack/SMS. |
| **Dead** | <25 after TP6 | Set status to 90-day nurture hold; re-enrol in wave 2. |

> "Dead (<25 post-TP6)" needs a TP6 marker. Our three tools are TP1–TP3, so add
> a `wfm_tp6_reached` (date/boolean) when you build TP6, and key the Dead branch
> off that + score.

---

## 6. The personalised "from the rep" results email (Phase 1)

No backend needed — HubSpot sends it:

1. **Assign the Contact Owner by vertical** (same split as the booking links) in
   the routing workflow:
   - **Sina** → Architecture & Design, Construction & Trades, Management & Business Consulting
   - **Denzel** → Civil & Infrastructure, Engineering Consultancy, Creative & Marketing
2. Build an **automated email** (Marketing → Email → Automated) and set
   **Send from: Contact owner**. Replies go to the real rep.
3. Personalise the body with tokens — `{{ contact.wfm_industry }}`,
   `{{ contact.wfm_profit_leak }}`, `{{ contact.wfm_health_score }}`,
   `{{ contact.wfm_biggest_issue }}`, etc. — plus buttons to the walkthrough and
   the rep's booking link.
4. Trigger it from the **form submission / completion** in a workflow.
   - **Warm:** send automatically.
   - **Hot / Eruption:** the rep is already actioning a task, so either send
     automatically or attach a draft for them to personalise (their call).

The prospect also gets an **instant branded PDF** client-side via the
"Download results as PDF" button — that part needs nothing from HubSpot.

---

## 7. Put the HubSpot tracking script on the tool pages

On the Webflow pages that host the tools, add your HubSpot tracking code
(Settings → Tracking & Analytics → Tracking Code). This:
- sets the `hubspotutk` cookie the tools read, tying submissions to the right
  contact;
- auto-identifies **returning known/enriched contacts**;
- prevents duplicate contacts.

---

## 8. Notes for Leo (Webflow deployment)

- **Hosting:** each tool deploys as its own page on `workflowmax.com/...`. All
  outbound links are already absolute `https://workflowmax.com/...` URLs, so they
  work regardless of which page the tool sits on.
- **Enriched links → frictionless completion:** the tools read identity from the
  campaign URL. If your HubSpot emails/ads append `?email={{contact.email}}`
  (and `?industry=…`), a completion is recorded the moment the prospect reaches
  results — **no form fill needed**. Without it, completion is captured when they
  use the email/share block.
- **Pixels for retargeting:** put the Meta Pixel, Google Ads tag and LinkedIn
  Insight Tag on the **tool pages themselves** (not just the solution pages), so
  we can retarget everyone who reaches results, whether or not they click a CTA.
- **Civil mapping:** Civil & Infrastructure points at
  `workflowmax.com/building-and-construction` (no dedicated civil page). Change in
  `SOLUTION_URLS` if that changes.
- **Booking routing** is by vertical: Sina (architecture, construction,
  consulting) / Denzel (civil, engineering, creative) — defined in `BOOKING_URLS`
  in each component, mirror it with the HubSpot owner assignment in section 6.
