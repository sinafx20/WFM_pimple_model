// Pulls the associated Company record for each contact, and answers the one question that
// decides whether we are allowed to write to them at all: is this firm actually a Harvest user?
//
// WHY THIS IS A HARD GATE. Every piece of Act 1 copy is built on the Harvest price rise. Sent
// to a lookalike that never used Harvest, the opening line is not weak, it is wrong, and it is
// wrong in a way the recipient can see immediately. The list was built partly from lookalikes,
// so "is a confirmed Harvest user" has to be checked before enrolment rather than trusted.
//
// WHY IT DISCOVERS THE PROPERTY NAME. The flag lives on the Company object and its internal
// name is not knowable from here (the token could not read the company schema when this was
// written). Rather than hardcode a guess that silently matches nothing, this finds the property
// by label and reports exactly which one it used, so a wrong match is visible instead of quiet.
//
// Requires crm.objects.companies.read and crm.schemas.companies.read on the private app token.

const CONFIRM_HINT = /harvest/i;
const CONFIRM_STRONG = /confirm|verified|is a|current/i;

export class ScopeError extends Error {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retries rate limits and THROWS on anything else.
//
// The first version of this returned whatever came back and let callers do `b.results || []`.
// Firing 25 association lookups at once tripped HubSpot's rate limit, every 429 became an empty
// result, and the audit reported 4 confirmed Harvest users out of 225. The real number is 160.
// A swallowed error here does not look like an error, it looks like an unverified audience, so
// it would have silently excluded 156 people we are allowed to contact.
async function api(url, H, opts = {}, label = '') {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch(url, { headers: H, ...opts });
    if (r.status === 429) { await sleep(2000 * (attempt + 1)); continue; }
    const b = await r.json().catch(() => null);
    if (r.status === 403) {
      throw new ScopeError('the HubSpot token cannot read Company records. Add '
        + 'crm.objects.companies.read and crm.schemas.companies.read to the private app, '
        + 'then re-run. Without it we cannot tell a confirmed Harvest user from a lookalike.');
    }
    if (r.status >= 300 || !b) {
      throw new Error(`${label || url} failed HTTP ${r.status}: ${JSON.stringify(b).slice(0, 200)}`);
    }
    return { status: r.status, body: b };
  }
  throw new Error(`${label || url}: still rate limited after 5 attempts`);
}

// Find the "confirmed Harvest user" property without knowing its internal name.
export async function findConfirmProperty(H) {
  const { status, body } = await api('https://api.hubapi.com/crm/v3/properties/companies', H);
  if (status !== 200) throw new Error(`company properties read failed: ${JSON.stringify(body).slice(0, 200)}`);
  const all = body.results || [];
  const named = all.filter((p) => CONFIRM_HINT.test(`${p.name} ${p.label || ''}`));
  if (!named.length) {
    throw new Error('no Company property mentioning "Harvest" exists. Check the property name '
      + 'in HubSpot and pass it explicitly as HARVEST_CONFIRM_PROP.');
  }
  // Prefer one that also reads like a confirmation, and prefer a boolean/enum over free text.
  const score = (p) => (CONFIRM_STRONG.test(`${p.name} ${p.label || ''}`) ? 2 : 0)
    + (p.type === 'bool' || p.type === 'enumeration' ? 1 : 0);
  named.sort((a, b) => score(b) - score(a));
  return { chosen: named[0], candidates: named };
}

const YES = new Set(['true', 'yes', 'y', '1', 'confirmed', 'confirmed harvest user']);
const NO = new Set(['false', 'no', 'n', '0', 'not confirmed', 'lookalike', 'unconfirmed']);

// Tri-state on purpose. A blank flag is NOT a yes: it means nobody has checked this firm, which
// is a different problem from a firm we know is a lookalike, and both must stay out of a
// campaign whose first line asserts they use Harvest.
export function readConfirm(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return 'unknown';
  if (YES.has(v)) return 'yes';
  if (NO.has(v)) return 'no';
  return 'unknown';
}

// contactIds -> { [contactId]: { companyId, name, domain, confirm } }
export async function enrich(contactIds, H, propName) {
  const out = {};
  const pairs = [];
  // Ten at a time with a pause, not twenty-five at once. The wider fan-out is what tripped the
  // rate limit, and being slightly slower here is free compared to getting the audience wrong.
  for (let i = 0; i < contactIds.length; i += 10) {
    const batch = contactIds.slice(i, i + 10);
    const res = await Promise.all(batch.map(async (id) => {
      const { body } = await api(
        `https://api.hubapi.com/crm/v4/objects/contacts/${id}/associations/companies?limit=1`, H, {}, `assoc ${id}`);
      return { id, companyId: body.results?.[0]?.toObjectId ?? null };
    }));
    res.forEach((r) => { out[r.id] = { companyId: r.companyId, name: '', domain: '', confirm: 'unknown' }; if (r.companyId) pairs.push(r); });
    await sleep(120);
  }

  const wanted = [...new Set(pairs.map((p) => String(p.companyId)))];
  const byCompany = {};
  for (let i = 0; i < wanted.length; i += 50) {
    const { body } = await api('https://api.hubapi.com/crm/v3/objects/companies/batch/read', H, {
      method: 'POST',
      body: JSON.stringify({ properties: ['name', 'domain', propName], inputs: wanted.slice(i, i + 50).map((id) => ({ id })) }),
    }, 'company batch read');
    if (!Array.isArray(body.results)) throw new Error(`company batch read returned no results: ${JSON.stringify(body).slice(0, 200)}`);
    body.results.forEach((c) => {
      byCompany[c.id] = {
        name: c.properties?.name || '',
        domain: c.properties?.domain || '',
        confirm: readConfirm(c.properties?.[propName]),
      };
    });
    await sleep(120);
  }

  // Every company we asked about must have come back. A partial read would quietly demote real
  // Harvest users to "unknown" and drop them from the campaign.
  const missed = wanted.filter((id) => !byCompany[id]);
  if (missed.length) throw new Error(`read ${wanted.length - missed.length} of ${wanted.length} companies; refusing a partial audience`);

  pairs.forEach((p) => { if (byCompany[p.companyId]) out[p.id] = { companyId: p.companyId, ...byCompany[p.companyId] }; });
  return out;
}
