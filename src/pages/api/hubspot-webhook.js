// Receives HubSpot note and call events and moves the volcano immediately.
//
// WHY: an AE finishes a call, logs "they make products, not a fit", and until now that contact
// kept sitting in Warm for up to two hours because the rollup only looks every two hours. The
// strongest signal in the pipeline is a person talking to a person, and it was the slowest one
// to land. This closes that to seconds.
//
// WHAT IT DOES NOT DO: recompute heat from scratch. That belongs to volcano-rollup.mjs, which
// owns the model and has all the inputs. This endpoint only writes the disposition, and zeroes
// heat when that disposition rules the contact out, because leaving a ruled-out contact warm
// until the next rollup is the exact problem it exists to solve. Everything else is left for the
// rollup to settle, so there is still one owner of the score.
//
// SECURITY: HubSpot signs every request. v3 is verified against the private app's client secret
// when HUBSPOT_WEBHOOK_SECRET is set. A shared ?key= is also accepted, because HubSpot preserves
// the query string on the target URL and it is the simpler thing to configure; with neither
// configured the endpoint refuses everything rather than running open.
//
// SUBSCRIBE TO: note.creation and call.creation.
import { classifyNote, RULED_OUT } from '../../lib/volcano-classify.js';

export const prerender = false;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* HubSpot's v3 signature: base64(hmac-sha256(clientSecret, method + uri + body + timestamp)).
 * Rejects anything older than five minutes, which is HubSpot's own replay window. */
async function validSignature(request, rawBody, secret) {
  const sig = request.headers.get('x-hubspot-signature-v3');
  const ts = request.headers.get('x-hubspot-request-timestamp');
  if (!sig || !ts) return false;
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) return false;
  const base = 'POST' + request.url + rawBody + ts;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(base));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return safeEqual(sig, expected);
}

export async function POST({ request, locals }) {
  const env = locals.runtime?.env || {};
  const token = env.HUBSPOT_TOKEN;
  const shared = env.HUBSPOT_WEBHOOK_KEY;
  const signing = env.HUBSPOT_WEBHOOK_SECRET;

  if (!shared && !signing) return json({ ok: false, error: 'endpoint not configured' }, 503);

  const rawBody = await request.text();
  let authed = false;
  if (shared) {
    const supplied = new URL(request.url).searchParams.get('key') || '';
    authed = safeEqual(supplied, shared);
  }
  if (!authed && signing) authed = await validSignature(request, rawBody, signing);
  if (!authed) return json({ ok: false, error: 'unauthorized' }, 401);
  if (!token) return json({ ok: false, skipped: true, reason: 'HUBSPOT_TOKEN not configured' });

  let events;
  try { events = JSON.parse(rawBody); } catch { return json({ ok: false, error: 'invalid json' }, 400); }
  if (!Array.isArray(events)) events = [events];

  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const results = [];

  for (const e of events) {
    const type = String(e.subscriptionType || '');
    const kind = type.startsWith('note') ? 'notes' : type.startsWith('call') ? 'calls' : null;
    if (!kind || !e.objectId) { results.push({ type, skipped: 'not a note or call' }); continue; }

    try {
      const props = kind === 'notes'
        ? 'hs_note_body,hs_timestamp'
        : 'hs_call_body,hs_call_title,hs_timestamp';
      const obj = await (await fetch(
        `https://api.hubapi.com/crm/v3/objects/${kind}/${e.objectId}?properties=${props}&associations=contacts`,
        { headers: H })).json();
      const p = obj.properties || {};
      const verdict = classifyNote([p.hs_note_body, p.hs_call_title, p.hs_call_body].filter(Boolean).join(' '));
      if (!verdict) { results.push({ id: e.objectId, kind, recorded: false, reason: 'nothing decisive in it' }); continue; }

      const contactIds = (obj.associations?.contacts?.results || []).map((r) => r.id);
      if (!contactIds.length) { results.push({ id: e.objectId, kind, recorded: false, reason: 'no associated contact' }); continue; }

      for (const cid of contactIds) {
        const c = await (await fetch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${cid}?properties=volcano_disposition,volcano_icp_vertical,volcano_internal`,
          { headers: H })).json();
        const cp = c.properties || {};
        // Not our audience, or a teammate, so not ours to judge.
        if (!cp.volcano_icp_vertical || String(cp.volcano_internal).toLowerCase() === 'true') {
          results.push({ id: e.objectId, contactId: cid, recorded: false, reason: 'outside the campaign audience' });
          continue;
        }
        // A disposition already on the record wins. It was either set by a person, or set
        // earlier from the prospect's own words, and both outrank a fresh guess at a note.
        if (cp.volcano_disposition) {
          results.push({ id: e.objectId, contactId: cid, recorded: false, reason: `already ${cp.volcano_disposition}` });
          continue;
        }

        const ruled = RULED_OUT.includes(verdict.d);
        const patch = { volcano_disposition: verdict.d, ...(ruled ? { volcano_heat: '0' } : {}) };
        const r = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${cid}`, {
          method: 'PATCH', headers: H, body: JSON.stringify({ properties: patch }),
        });
        results.push({ id: e.objectId, contactId: cid, recorded: r.ok ? verdict.d : false, http: r.status });
      }
    } catch (err) {
      results.push({ id: e.objectId, error: String(err).slice(0, 120) });
    }
  }

  return json({ ok: true, handled: results.length, results });
}
