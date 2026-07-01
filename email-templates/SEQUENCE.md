# Volcano Model — 7-email sequence (Instantly)

Cold sequence for {{industry}} firms. All emails use the **master design**
(`variation-2b-minimal-face.html`): personal layout + your single face thumbnail,
one CTA, slim footer. Each links to its tool on the live host
`https://lp.workflowmax.com/app`.

## Before you send — fill these
- **Logo** (`WFM-Logo.png`): currently a relative path so it shows in local preview.
  Host it before sending and swap the `src` to an absolute URL — after your next
  Webflow deploy it's also live at `https://lp.workflowmax.com/app/WFM-Logo.png`
  (same domain as your links = good for cold deliverability).
- `REPLACE_WITH_YOUR_FACE_THUMBNAIL_URL` (**email 1 only** — the one touchpoint with a
  video) → your hosted face/video thumbnail.
- `[[ YOUR booking link ]]` → your meetings/Calendly URL (all 7).
- `[[ unsubscribe ]]` → let Instantly auto-append (enable in settings).

Already filled: signature **Sina Zarei, Account Executive**; address **1/525 Collins
Street, Melbourne, VIC, 3000**.

## Instantly setup
- **Built-in tokens:** `{{firstName}}` `{{companyName}}` `{{email}}`
- **Custom CSV column:** `{{industry}}` = `architecture|engineering|consulting|construction|civil|creative`
- **Subjects use spintax** `{a|b}` — Instantly randomises per send. Paste the subject
  line (from each file's header comment) into Instantly's subject field, not the body.
- The tool link is **built inline** in each email — only `industry` needs to be a column.

## The sequence
| # | Day | Tool | File | Subject (spintax) |
|---|-----|------|------|-------------------|
| 1 | 0  | `intro` | email-1-intro.html | `{ {{firstName}}, made you a quick video \| a quick hello to {{companyName}} }` |
| 2 | 3  | `tp1` | email-2-health-check.html | `{ {{firstName}}, where's the time going at {{companyName}}? \| a 60-second check for {{companyName}} }` |
| 3 | 6  | `tp2` | email-3-profit-leak.html | `{ the hidden cost of unbilled hours \| {{companyName}}'s profit leak, in dollars }` |
| 4 | 9  | `tp3` | email-4-benchmark.html | `{ how does {{companyName}} compare? \| {{companyName}} vs the {{industry}} average }` |
| 5 | 12 | `tp4` | email-5-demo.html | `{ {{firstName}}, want to see it in action? \| a 6-minute look at how it works }` |
| 6 | 16 | `tp5` | email-6-firms-like-yours.html | `{ firms like {{companyName}} \| what {{industry}} firms actually say }` |
| 7 | 20 | `tp6` | email-7-resource-hub.html | `{ everything in one place for {{companyName}} \| I'll leave you with this, {{firstName}} }` |

Days are suggested gaps (skip weekends in Instantly's schedule). The narrative:
**intro video → see your own numbers (health check → profit leak → benchmark) →
see it work (demo) → proof (firms like yours) → everything in one place (soft close).**

## Deliverability notes (cold + domain rotation)
- Only **email 1** carries an image (the face video thumbnail) — emails 2–7 are
  plain text + logo + one button, which is ideal for cold inbox placement.
- Keep warming domains; ramp volume slowly.
- Personalise `{{companyName}}`/`{{industry}}` (already in copy + subjects) — variation
  is what keeps you out of spam.

## Honest caveat carried from the build
The tools currently only render `industry` (and use `email` for silent completion
tracking that feeds `volcano_lead_score`). `company`/`firstname` ride along in the
URL but aren't shown on the pages yet. Links are live (Webflow site published 2026-06-29).
