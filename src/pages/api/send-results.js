// Fires the "your results" email via HubSpot's Single-Send Transactional API
// the moment a prospect completes a tool with a known email (see
// src/lib/hubspot.js's sendResultsEmail(), called from each tool's
// frictionless-completion effect).
//
// Needs two things configured on the DEPLOYED environment (Webflow Cloud's
// project settings, not this repo) before it does anything:
//   - HUBSPOT_TOKEN: a private app token with marketing.email.write + content
//     scopes (same portal as heygen-studio/.env's HUBSPOT_TOKEN — different
//     copy of the secret since this runs on Cloudflare, not this repo's env).
//   - HUBSPOT_RESULTS_EMAIL_ID: the numeric id of the HubSpot marketing email
//     built for this (Marketing > Email in HubSpot). See the setup doc for
//     the template copy and required merge tokens.
// Until both are set, this responds { ok: false, skipped: true } and the
// caller should treat that as "not wired up yet", not an error.
export const prerender = false;

export async function POST({ request, locals }) {
  const env = locals.runtime?.env || {};
  const token = env.HUBSPOT_TOKEN;
  const emailId = env.HUBSPOT_RESULTS_EMAIL_ID;

  if (!token || !emailId) {
    return new Response(JSON.stringify({ ok: false, skipped: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const { email, firstName, company, toolName, resultsSummary, aeName, aeTitle, aeBookingLink, aeEmail } = body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid email" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Passed inline as contactProperties (rather than relying on a prior
  // property PATCH having already propagated) so personalization is
  // guaranteed correct for this exact send, no race with HubSpot's ingestion.
  const contactProperties = {};
  if (firstName) contactProperties.firstname = firstName;
  if (company) contactProperties.company = company;
  if (toolName) contactProperties.wfm_tool_name = toolName;
  if (resultsSummary) contactProperties.wfm_results_summary = resultsSummary;
  if (aeName) contactProperties.volcano_ae_name = aeName;
  if (aeTitle) contactProperties.volcano_ae_title = aeTitle;
  if (aeBookingLink) contactProperties.volcano_ae_booking_link = aeBookingLink;

  // Reply-to is fixed on the email template itself, so override it per-send
  // to whichever AE actually owns this contact — otherwise every reply from
  // every prospect lands in whoever's address is hardcoded on the template.
  const message = { to: email };
  if (aeEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(aeEmail)) message.replyTo = [aeEmail];

  try {
    const r = await fetch("https://api.hubapi.com/marketing/v3/transactional/single-email/send", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ emailId: Number(emailId), message, contactProperties }),
    });
    const data = await r.json().catch(() => ({}));
    return new Response(JSON.stringify({ ok: r.ok, status: r.status, data }), {
      status: r.ok ? 200 : 502,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
