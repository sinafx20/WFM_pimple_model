// Receives interaction milestones from the Volcano tools and records the ones that
// pass as human on the HubSpot contact.
//
// The classification lives here rather than in the browser because a client can lie
// about its own evidence, and because the rule should be changeable in one place.
// What arrives is raw evidence; what gets written is a verdict.
//
// Needs HUBSPOT_TOKEN on the DEPLOYED environment (Webflow Cloud project settings),
// same private app token as send-results.js, with crm.objects.contacts.read/.write.
// Without it this responds { ok: false, skipped: true } and the client's virtual
// pageview is still the fallback record, so nothing silently breaks.
export const prerender = false;

const DEPTH_LABEL = { 1: "started", 2: "engaged", 3: "completed", 4: "booking" };

/* Is this evidence consistent with a person?
 *
 * Deliberately not a scanner blocklist: those change constantly and we would be
 * chasing them forever. Instead we require positive proof of behaviour that
 * automated fetchers do not produce. Bots that render JS still do not spend twelve
 * seconds making several sequential choices with a mouse.
 *
 * Returns { human, reasons } so a rejection is explainable rather than a silent drop. */
function classify(depth, e = {}) {
  const reasons = [];
  const dwell = Number(e.dwellMs) || 0;
  const steps = Number(e.steps) || 0;
  const gap = e.minGapMs == null ? null : Number(e.minGapMs);

  if (e.trusted === false) reasons.push("synthetic event (isTrusted false)");
  if (depth >= 2 && steps < 2) reasons.push(`depth ${depth} claimed with only ${steps} interaction(s)`);
  if (dwell < 1500) reasons.push(`page dwell ${dwell}ms is too fast to have read anything`);
  if (gap !== null && gap < 120) reasons.push(`${gap}ms between choices is faster than a human hand`);
  if (!e.pointer && !e.keyboard) reasons.push("no pointer or keyboard input observed");

  return { human: reasons.length === 0, reasons };
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export async function POST({ request, locals }) {
  const env = locals.runtime?.env || {};
  const token = env.HUBSPOT_TOKEN;

  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid json" }, 400); }

  const { email, tool, milestone, depth, evidence } = body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "invalid email" }, 400);
  const d = Number(depth);
  if (!DEPTH_LABEL[d]) return json({ ok: false, error: "invalid depth" }, 400);

  const verdict = classify(d, evidence);

  // Rejected evidence is still worth returning to the caller for debugging, but it
  // never touches the CRM. An unverified interaction is exactly the thing we are
  // trying to stop counting.
  if (!verdict.human) return json({ ok: true, recorded: false, reasons: verdict.reasons });
  if (!token) return json({ ok: false, skipped: true, reason: "HUBSPOT_TOKEN not configured" });

  const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const now = new Date().toISOString();

  try {
    const search = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
        properties: ["volcano_interaction_depth", "volcano_interaction_log"],
        limit: 1,
      }),
    });
    const found = await search.json();
    const contact = found?.results?.[0];
    if (!contact) return json({ ok: false, error: "contact not found" }, 404);

    // Depth only ever climbs. Someone who completed the calculator last week and
    // merely starts the benchmark today has not become less engaged.
    const prevDepth = Number(contact.properties?.volcano_interaction_depth) || 0;
    const prevLog = contact.properties?.volcano_interaction_log || "";
    const entry = `${now} ${tool}/${DEPTH_LABEL[d]} steps=${evidence?.steps} dwell=${evidence?.dwellMs}ms`;

    const properties = {
      volcano_verified_interaction: "true",
      volcano_last_interaction_at: now,
      volcano_interaction_depth: String(Math.max(prevDepth, d)),
      // Keep the trail bounded; HubSpot textarea limits are generous but not infinite.
      volcano_interaction_log: `${entry}\n${prevLog}`.split("\n").slice(0, 40).join("\n"),
    };

    const patch = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}`, {
      method: "PATCH", headers: H, body: JSON.stringify({ properties }),
    });
    if (!patch.ok) return json({ ok: false, error: `hubspot ${patch.status}` }, 502);

    return json({ ok: true, recorded: true, contactId: contact.id, depth: Math.max(prevDepth, d) });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 502);
  }
}
