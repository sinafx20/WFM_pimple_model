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
//   open       -> deliberately ignored. Opens are inflated by image proxies and would
//                 bury the timeline in noise for no decision value.
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
  if (!isSent(e.type) && !isReply(e.type) && !isClick(e.type)) {
    return json({ ok: true, ignored: "event type not handled", type: e.type });
  }

  const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const found = await (await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST", headers: H,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: e.to }] }],
      properties: ["email", "volcano_interaction_depth", "hubspot_owner_id"], limit: 1,
    }),
  })).json();
  const contact = found && found.results && found.results[0];
  if (!contact) return json({ ok: false, error: "contact not found", email: e.to }, 404);

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
  const created = await r.json();
  return json({ ok: true, recorded: outbound ? "sent" : "reply", emailId: created.id, contactId: contact.id });
}
