# Volcano LinkedIn sequence (HeyReach)

Paste into the HeyReach sequence builder. One campaign, two paths: connectors get the
DM arc, non-connectors get one InMail. Merge fields: `{{firstName}}` `{{companyName}}`
are HeyReach built-ins; `intro_link` / `health_check_link` / `thumb` / `booking` /
`industry` arrive as custom user fields on every lead the cockpit pushes (check the
exact custom-field tag syntax in the builder, e.g. `{{customField.intro_link}}`).

Voice rules (same as email): cost-of-inaction first, value-first ("even if WFM is never
the right fit, you keep your number"), one CTA per message, no em dashes, AU spelling,
AI-twin honesty wherever the video is mentioned.

---

## Step 0 — Connection request note (max 300 chars, NO links)

> Hi {{firstName}}, I work with {{industry}} firms on where quoted time quietly turns
> into unbilled work. A couple of the numbers surprised firms like {{companyName}}, so
> thought it was worth connecting.

Links in invites lower acceptance. Keep it link-free.

---

## Path A — accepted the connection

### DM 1 — send ~1 hour after accept
> Thanks for connecting, {{firstName}}. I put together a short video for {{companyName}}
> on where {{industry}} firms usually leak margin. My AI twin presents it so I will keep
> it honest: it is 2 minutes and worth it. {{intro_link}}

### DM 2 — +3 days, only if no reply
> Most {{industry}} directors I speak with cannot name last month's real utilisation.
> Not the target, the actual number. This gives {{companyName}} an instant read in about
> 2 minutes: {{health_check_link}}. Even if WorkflowMAX is never the right fit, you keep
> your number.

### DM 3 — +4 days, only if no reply (the email bridge)
> Happy to keep this async, {{firstName}}. If email is easier, say the word and I will
> send over the benchmark for {{industry}} firms your size instead. And if you would
> rather talk it through, my calendar is here: {{booking}}

### Housekeeping
- Stop sequence on reply (HeyReach default) so a human takes over.
- Withdraw pending requests at day 10 to 14 to protect the seat's acceptance rate.

---

## Path B — did NOT accept after 5 to 7 days: InMail

Only reaches open profiles (free InMail) or needs Sales Navigator credits on the
sending seat. Value first, one CTA, mention the email option.

**Subject:** the number most {{industry}} firms cannot name

> Hi {{firstName}}, no worries on the connection, inbox zero is a myth on here anyway.
> One thing worth having regardless: most {{industry}} firms cannot name how much quoted
> time turned into unbilled work last month, and it is usually five figures. This gives
> {{companyName}} the number in about 2 minutes, no sign-up: {{health_check_link}}
>
> If email is easier, happy to send the {{industry}} benchmark there instead. Either
> way, keep your number.
>
> Sina

(For Denzel-owned leads the sending seat is Denzel's, so sign-off follows the seat.)

---

## Scoring hooks (cockpit → HubSpot, once engagement polling is wired)
- Connection accepted: +8 volcano_lead_score
- LinkedIn reply: +30
Bands unchanged: Cold 0–24 · Warm 25–64 · Hot 65–99 · Eruption 100+.
