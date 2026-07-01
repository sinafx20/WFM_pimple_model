# Volcano Model — email templates

Two master templates you drop copy + links into. Built for **Instantly** (cold
outbound, domain rotation), but the branded one works fine in HubSpot too.

| File | Use it for | Notes |
|------|-----------|-------|
| `master-light.html` | **Cold sends from Instantly** | Plain text, one link, no images. Best inbox placement. **Default choice.** |
| `master-branded.html` | HubSpot nurture / warm follow-ups | Full brand, green CTA button, footer. Heavy HTML — use sparingly on cold. |

## ⚠️ Deliverability (read before sending cold)
Rotating-domain cold email lands in the **primary inbox** only when it looks like
a personal 1:1 note. So for Instantly:
- Prefer **`master-light.html`**. No images, no buttons, no tracking pixels.
- Vary the subject + first line with **spintax**: `{Quick question|One thing}` →
  Instantly randomises per send.
- Personalise beyond `{{firstName}}` — use `{{companyName}}` / `{{industry}}` in
  the body so each email is genuinely different.
- Keep one link max. More links = more spam signal.
- Warm up domains and ramp volume slowly (Instantly's warmup).

## Merge fields
**Built-in Instantly variables** (from the standard lead fields):
- `{{firstName}}`, `{{lastName}}`, `{{companyName}}`, `{{email}}`

**Custom variables** — add these as columns in your lead CSV, then reference by
column name:
- `{{industry}}` — `architecture | engineering | consulting | construction | civil | creative`
- `{{toolLink}}` — the full personalised tool URL for THIS email (pre-build per
  lead, see below)

> Unsubscribe: don't hand-roll one. Enable Instantly's unsubscribe setting (or
> HubSpot's) and it appends a compliant link automatically. A physical address +
> unsubscribe are legally required (CAN-SPAM, AU Spam Act 2003, UK PECR, GDPR).

## Building the `{{toolLink}}` per touchpoint
Pre-build the URL in your CSV's `toolLink` column. Format (bare, **no trailing
slash**; host = the live URL once the Webflow site is published):

```
https://lp.workflowmax.com/app?tool=TPID&industry={INDUSTRY}&company={COMPANY}&firstname={FIRST}&email={EMAIL}
```

Swap `tool=` per email in the sequence:

| Email | `tool=` | Tool |
|-------|---------|------|
| 1 | `intro` | TP1 — intro video (also add `&video=` HeyGen link) |
| 2 | `tp1` | Workflow Health Check |
| 3 | `tp2` | Profit Leak Calculator |
| 4 | `tp3` | Firm Benchmark |
| 5 | `tp4` | Demo landing |
| 6 | `tp5` | Firms Like Yours |
| 7 | `tp6` | Resource Hub |

> Reminder from the build: today only `industry` (and `email`, for silent
> completion tracking) is actually read by the tools. `company` / `firstname`
> pass through harmlessly but aren't rendered yet.

> `email={EMAIL}` matters — it fires the HubSpot completion silently when the
> lead reaches the results, which feeds `volcano_lead_score`.

## Filling a template
1. Open the file, paste the whole thing into Instantly's HTML/code view.
2. Replace every `[[ ... ]]` slot with copy.
3. Leave `{{ ... }}` merge tags as-is.
4. Send yourself a test to Gmail **and** Outlook before launching.
