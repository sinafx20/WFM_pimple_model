// Receives Instantly campaign events and writes them to HubSpot as they happen.
//
// WHY: Instantly sends from our own domains, so HubSpot never sees those messages. A
// prospect with four campaign emails shows an empty timeline. Polling for this needs a
// machine that is awake, and ours sleeps: the 7am batch has missed 4 of the last 5
// weekdays. A webhook has no such dependency.
//
// WHAT IT DOES with each event type:
//   sent       -> an EMAIL engagement on the contact timeline
//   reply      -> an INCOMING_EMAIL engagement (direction matters: a reply logged
//                 outbound makes it look like we emailed ourselves)
//   link click -> a verified interaction, because link tracking is now on across all
//                 10 campaigns and an Instantly click is a real human click
//   open       -> judged, not logged. An open more than 30 minutes after the send counts
//                 once per day toward volcano_genuine_opens and never reaches the
//                 timeline, because the delivery burst is machines and the timeline would
//                 drown in it. See OPEN_GENUINE_AFTER_MS below for the reasoning.
//
// SECURITY: this endpoint is public and writes to the CRM, so it requires a shared
// secret (INSTANTLY_WEBHOOK_SECRET) supplied as ?key= or an x-webhook-secret header.
// With no secret configured it refuses everything rather than running open.
//
// IDEMPOTENCY: webhooks retry. Before creating an engagement we search for one already
// carrying the same Instantly message id. Duplicate entries on a prospect record are
// exactly the failure we hit with HeyReach.
export const prerender = false;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

// Constant-time-ish compare so the secret cannot be probed a character at a time.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Our own sending domains. Anything from elsewhere is the prospect writing to us.
const OURS = /@(cloud|team)?workflowmax\.com$/i;
const ownerFor = (addr) => {
  const local = String(addr || "").split("@")[0].toLowerCase();
  if (local.startsWith("sina")) return "80406430";
  if (local.startsWith("denzel")) return "80127259";
  return null;
};

/* Instantly's event field names are not guaranteed stable across versions, so read
   defensively rather than assuming one shape. */
function normalise(e) {
  const src = e || {};
  const type = String(src.event_type || src.eventType || src.type || src.event || "").toLowerCase();
  const from = src.from_address_email || src.from_email || src.email_account || src.eaccount
    || src.sending_account || src.account_email || src.from || "";
  const to = src.lead_email || src.lead || src.to_address_email_list || src.to_email || src.email || "";
  const bodyRaw = src.body;
  const body = typeof bodyRaw === "string" ? bodyRaw : (bodyRaw && (bodyRaw.text || bodyRaw.html)) || src.email_body || "";
  return {
    type,
    from,
    to: String(to).split(",")[0].trim(),
    subject: src.subject || src.email_subject || "",
    body,
    // The webhook sends a bare uuid while the backfill stored <uuid@domain>. Reduce both
    // to the uuid so a message logged by one is recognised by the other.
    messageId: String(src.message_id || src.messageId || src.id || src.email_id || "")
      .replace(/^</, "").replace(/@.*$/, "").replace(/>$/, ""),
    timestamp: src.timestamp_email || src.timestamp || src.timestamp_created || new Date().toISOString(),
    campaignId: src.campaign_id || src.campaignId || src.campaign || "",
  };
}

const isReply = (t) => t.includes("reply") || t.includes("replied");
const isClick = (t) => t.includes("click");
const isSent = (t) => t.includes("sent");
const isOpen = (t) => t.includes("open");

/* How long after a send an open has to arrive before we treat it as a person.
 *
 * Opens as a class carry no signal: measured on 2026-09-01 across 107 openers, 84% of the
 * opens whose timing could be resolved fired within five minutes of delivery, and not one
 * of the 107 clicked anything. That is Apple Mail prefetching, Gmail proxying images and
 * security appliances fetching during a scan.
 *
 * What that measurement does NOT say is that every open is a machine. It says the burst at
 * delivery is. So instead of scoring opens or ignoring them, we keep only the ones that
 * fall well outside that burst. Thirty minutes is deliberately stricter than the five the
 * data showed, so we are not just catching its tail.
 *
 * This is a hypothesis, not a proven signal, which is why the weight in volcano-rollup.mjs
 * is capped below the Warm threshold: a contact who only ever opens can never raise an
 * alert on its own, it can only tip someone who has done something else as well. */
const OPEN_GENUINE_AFTER_MS = 30 * 60 * 1000;

export async function POST({ request, locals }) {
  const env = locals.runtime?.env || {};
  const secret = env.INSTANTLY_WEBHOOK_SECRET;
  const token = env.HUBSPOT_TOKEN;

  // Refuse rather than run open: an unauthenticated CRM-writing endpoint is worse than
  // a broken one, because nothing would look wrong.
  if (!secret) return json({ ok: false, error: "endpoint not configured" }, 503);
  const url = new URL(request.url);
  const supplied = url.searchParams.get("key") || request.headers.get("x-webhook-secret") || "";
  if (!safeEqual(supplied, secret)) return json({ ok: false, error: "unauthorized" }, 401);
  if (!token) return json({ ok: false, skipped: true, reason: "HUBSPOT_TOKEN not configured" });

  let raw;
  try { raw = await request.json(); } catch { return json({ ok: false, error: "invalid json" }, 400); }

  const e = normalise(raw);
  if (!e.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.to)) {
    return json({ ok: true, ignored: "no usable lead email", type: e.type });
  }
  if (!isSent(e.type) && !isReply(e.type) && !isClick(e.type) && !isOpen(e.type)) {
    return json({ ok: true, ignored: "event type not handled", type: e.type });
  }

  const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const found = await (await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST", headers: H,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: e.to }] }],
      properties: ["email", "volcano_interaction_depth", "hubspot_owner_id",
        "volcano_last_send_at", "volcano_last_open_at", "volcano_genuine_opens"], limit: 1,
    }),
  })).json();
  const contact = found && found.results && found.results[0];
  if (!contact) return json({ ok: false, error: "contact not found", email: e.to }, 404);

  // An open is judged, not recorded. Only the ones arriving well after the send are kept,
  // and at most one per day, so a single person re-opening cannot inflate the count.
  //
  // Note what this deliberately does NOT write: volcano_interaction_log and
  // volcano_verified_interaction. Those drive verified visits, which are worth 25 and land a
  // contact in Warm on their own. An open is not a visit, and quietly feeding one into the
  // other would put every opener in front of an AE.
  if (isOpen(e.type)) {
    const cp = contact.properties || {};
    const openAt = new Date(e.timestamp);
    const sentAt = cp.volcano_last_send_at ? new Date(cp.volcano_last_send_at) : null;
    const known = sentAt && !isNaN(sentAt.getTime()) && !isNaN(openAt.getTime());
    const delayMs = known ? openAt.getTime() - sentAt.getTime() : null;
    const day = isNaN(openAt.getTime()) ? "" : openAt.toISOString().slice(0, 10);
    const lastDay = String(cp.volcano_last_open_at || "").slice(0, 10);

    // No known send means no way to judge the delay, so it does not count. Silence is the
    // right default: the alternative is crediting an open we cannot explain.
    if (delayMs === null) return json({ ok: true, recorded: false, reason: "no known send to compare against" });
    if (delayMs < OPEN_GENUINE_AFTER_MS) return json({ ok: true, recorded: false, reason: "within the delivery burst", delayMs: delayMs });
    if (day && day === lastDay) return json({ ok: true, recorded: false, reason: "already counted an open today" });

    const n = (Number(cp.volcano_genuine_opens) || 0) + 1;
    const up = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/" + contact.id, {
      method: "PATCH", headers: H,
      body: JSON.stringify({ properties: { volcano_genuine_opens: String(n), volcano_last_open_at: openAt.toISOString() } }),
    });
    if (!up.ok) return json({ ok: false, error: "hubspot " + up.status }, 502);
    return json({ ok: true, recorded: "genuine-open", opens: n, delayMs: delayMs, contactId: contact.id });
  }

  // A click is a verified human action, so it feeds the same properties the on-page
  // beacon writes. Link tracking went on across all 10 campaigns on 2026-08-31, so
  // unlike a short-link fetch this is a real click by a real person.
  if (isClick(e.type)) {
    const prev = Number(contact.properties && contact.properties.volcano_interaction_depth) || 0;
    const now = new Date().toISOString();
    await fetch("https://api.hubapi.com/crm/v3/objects/contacts/" + contact.id, {
      method: "PATCH", headers: H,
      body: JSON.stringify({ properties: {
        volcano_verified_interaction: "true",
        volcano_last_interaction_at: now,
        volcano_interaction_depth: String(Math.max(prev, 1)),
        volcano_interaction_log: (now + " instantly/link-click " + (e.subject || "")).trim(),
      } }),
    });
    // Also drop a Note on the timeline. The contact properties above drive scoring and
    // lists, but they are invisible in the activity column: an AE reading the record sees
    // the email and needs the click to sit directly under it. HubSpot's native click
    // badges only work for mail sent through HubSpot, so a Note is the way to show it.
    const marker = "[volcano:click:" + (e.messageId || now) + "]";
    try {
      const body = "Clicked a link in: " + (e.subject || "(no subject)")
        + "\n\nVerified click reported by Instantly. Link tracking is on across all campaigns, "
        + "so unlike a short-link fetch this is a real click by a real person.\n" + marker;
      await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
        method: "POST", headers: H,
        body: JSON.stringify({
          properties: {
            hs_timestamp: now,
            hs_note_body: body,
            ...(contact.properties && contact.properties.hubspot_owner_id
              ? { hubspot_owner_id: contact.properties.hubspot_owner_id } : {}),
          },
          associations: [{ to: { id: contact.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
        }),
      });
    } catch { /* the property write above is the signal that matters; the note is a bonus */ }

    return json({ ok: true, recorded: "click", contactId: contact.id });
  }

  // Retries are normal, so never create a second copy of the same message.
  if (e.messageId) {
    let dupe = null;
    try {
      dupe = await (await fetch("https://api.hubapi.com/crm/v3/objects/emails/search", {
        method: "POST", headers: H,
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "hs_email_message_id", operator: "EQ", value: String(e.messageId) }] }],
          properties: ["hs_email_message_id"], limit: 1,
        }),
      })).json();
    } catch { dupe = null; }
    if (dupe && dupe.results && dupe.results.length) {
      return json({ ok: true, duplicate: true, messageId: e.messageId });
    }
  }

  // Direction comes from the event, not the sender address. The first live deliveries
  // carried no sender under any name we tried, so the domain test said "not ours" and
  // logged our own campaign sends as INCOMING_EMAIL. The event type cannot be ambiguous:
  // email_sent is us, reply_received is them. The address test only breaks a tie.
  const outbound = isSent(e.type) ? true : isReply(e.type) ? false : OURS.test(e.from);
  // Fall back to whoever owns the contact. The sending address is the better source
  // because owner must equal presenter must equal sender, but the payload does not always
  // carry it, and an engagement with no owner is invisible in AE activity reporting.
  const owner = (outbound ? ownerFor(e.from) : ownerFor(e.to))
    || (contact.properties && contact.properties.hubspot_owner_id) || null;
  const props = {
    hs_timestamp: new Date(e.timestamp).toISOString(),
    hs_email_direction: outbound ? "EMAIL" : "INCOMING_EMAIL",
    hs_email_status: "SENT",
    hs_email_subject: e.subject || "(no subject)",
    hs_email_text: String(e.body).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 65000),
    hs_email_from_email: e.from,
    hs_email_to_email: e.to,
  };
  if (e.messageId) props.hs_email_message_id = String(e.messageId);
  if (owner) props.hubspot_owner_id = owner;

  const r = await fetch("https://api.hubapi.com/crm/v3/objects/emails", {
    method: "POST", headers: H,
    body: JSON.stringify({
      properties: props,
      associations: [{ to: { id: contact.id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 198 }] }],
    }),
  });
  if (!r.ok) return json({ ok: false, error: "hubspot " + r.status, detail: (await r.text()).slice(0, 200) }, 502);
  // The send time is what makes a later open judgeable at all. Written after the engagement
  // so that a failed email log never leaves a send time pointing at nothing.
  if (outbound && isSent(e.type)) {
    try {
      await fetch("https://api.hubapi.com/crm/v3/objects/contacts/" + contact.id, {
        method: "PATCH", headers: H,
        body: JSON.stringify({ properties: { volcano_last_send_at: props.hs_timestamp } }),
      });
    } catch { /* the engagement is the record that matters; this only sharpens open scoring */ }
  }
  const created = await r.json();
  return json({ ok: true, recorded: outbound ? "sent" : "reply", emailId: created.id, contactId: contact.id });
}
