// Every outreach campaign that exists, discovered from the platforms themselves.
//
// WHY NOT THE JSON MAPS. heyreach-real-campaigns.json and instantly-real-campaigns.json were
// written by the scripts that created the Volcano campaigns, so they only ever listed those.
// Harvest, Harvest AU and the two AIA Brisbane campaigns are all absent, which meant none of
// that activity reached a HubSpot timeline and nobody could tell, because a sync that reads a
// short list still reports success. Asking the platform instead makes a new campaign covered
// the moment it exists, including one built by hand in the UI.
//
// OWNER comes from the campaign name, which is the only owner signal a discovered campaign
// carries. Both platforms name every campaign "... - Sina" or "... - Denzel"; anything that
// matches neither is returned with owner null and the caller decides, because guessing would
// put a prospect's activity under the wrong AE.
//
// Campaigns that never sent anything are still included. A DRAFT has no activity to write, so
// it costs one cheap call and keeps the registry honest about what exists.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Names are data from the platform, so match defensively rather than assuming the shape.
export function ownerFromName(name) {
  const s = String(name || '').toLowerCase();
  if (/\bsina\b/.test(s)) return 'sina';
  if (/\bdenzel\b/.test(s)) return 'denzel';
  return null;
}

// A campaign nobody should sync. Kept as explicit ids rather than a name pattern so that
// renaming a campaign in the UI cannot silently change what gets written to HubSpot.
export const EXCLUDE_HEYREACH = new Set([
  629069, 629070, 629071, 629072, 629073, 629074,  // abandoned lane x owner structure, never sent
  // Internal tests and demos. These ran against real colleagues and a handful of real
  // prospects, so syncing them would put "we sent you a LinkedIn request" on the timeline of
  // people who were being used to check a video rendered. Discovery finds them precisely
  // because it is thorough, which is why the exclusions have to be explicit.
  497592,  // Volcano DEMO - fire now (Jo)
  497484,  // Volcano LI TEST - known contacts (20)
  495434,  // Volcano - AI video test (Ryan)
  495416,  // Volcano - AI video test
  495358,  // test pimple
]);
// The Volcano MVP email campaigns. Excluded on Sina's call of 2026-10-22: those contacts have
// been worked already, and filling their timelines with months of backdated email buys nothing.
//
// This is a LIST and the date cutoff is not, which looks inconsistent until you see why both
// are needed. The cutoff alone cannot do this job: Volcano is not finished, and one of these
// campaigns was still sending ~180 emails in October, so any date that lets Harvest AU and AIA
// through lets those in too. Excluding by id says "not this campaign, ever" without touching
// the default, so a campaign created tomorrow is still picked up by the cutoff with nobody
// editing anything. Delete an id from here to start syncing that campaign again.
export const EXCLUDE_INSTANTLY = new Set([
  'fe4daa0f-23a7-446d-9f9d-ea8a4f452a54',  // Volcano MVP - Construction - Sina
  'fa3e7591-734e-4afc-b73e-aa1de4d06f64',  // Volcano MVP - Architecture - Denzel
  'e623d78a-b3ef-452d-a0c1-654580f3ee9f',  // Volcano MVP - Consulting - Denzel
  'daf00323-da01-428b-85a2-b5b000ff9989',  // Volcano MVP - Consulting - Sina
  'd8a34f04-44db-4360-954f-40ad7f31ab41',  // Volcano MVP - Construction - Denzel
  'bd4874c8-4e85-491d-a875-72064f9ac8d7',  // Volcano MVP - Creative - Sina
  '592ec354-570f-4211-aaa5-640fefd224fa',  // Volcano MVP - Engineering - Denzel
  '188f4f4a-33b7-4f85-b59f-9777a1c5f4f0',  // Volcano MVP - Creative - Denzel
  '0c9b9727-5c10-4b24-ad75-b76f5780d3fd',  // Volcano MVP - Engineering - Sina
  '0b5e3547-8d1b-4366-85d5-af9a14638e76',  // Volcano MVP - Architecture - Sina
]);

// Seat id -> AE. The same mapping heyreach-to-hubspot uses for inbox conversations, kept here
// so a campaign whose NAME names no AE can still be attributed. The AIA Brisbane campaigns are
// exactly that case: nothing in "AIA Brisbane 2026 - 20+ seats" says who runs it, but it sends
// from seat 223029, which is Denzel. Without this their LinkedIn activity lands on timelines
// owned by nobody, and an unowned note is one no AE ever gets told about.
export const SEAT_OWNER = { 221310: 'sina', 223029: 'denzel' };

async function seatOwner(apiKey, campaignId) {
  try {
    const r = await fetch(`https://api.heyreach.io/api/public/campaign/GetById?campaignId=${campaignId}`,
      { headers: { 'X-API-KEY': apiKey, accept: 'application/json' } });
    if (!r.ok) return null;
    const d = await r.json();
    // A campaign can run from several seats. One seat means one owner; more than one is
    // ambiguous and is left unowned rather than guessed.
    const ids = (d.campaignAccountIds || []).map(Number);
    const owners = [...new Set(ids.map((i) => SEAT_OWNER[i]).filter(Boolean))];
    return owners.length === 1 ? owners[0] : null;
  } catch { return null; }
}

export async function heyreachCampaigns(apiKey, { includeExcluded = false } = {}) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const r = await fetch('https://api.heyreach.io/api/public/campaign/GetAll', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ offset, limit: 100 }),
    });
    // A failure here must not read as "no campaigns". That is how a sync reports success
    // while writing nothing.
    if (!r.ok) throw new Error(`HeyReach campaign/GetAll HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const b = await r.json();
    const items = b.items || [];
    out.push(...items);
    if (items.length < 100) break;
    await sleep(300);
  }
  const kept = out.filter((c) => includeExcluded || !EXCLUDE_HEYREACH.has(c.id));
  const mapped = kept.map((c) => ({
    platform: 'heyreach',
    campaignId: c.id,
    key: c.name,
    name: c.name,
    status: c.status,
    owner: ownerFromName(c.name),
  }));
  // Only the ones the name could not answer, so this costs one extra call per unnamed campaign
  // rather than one per campaign.
  for (const c of mapped) {
    if (c.owner) continue;
    c.owner = await seatOwner(apiKey, c.campaignId);
    if (c.owner) c.ownerFrom = 'seat';
    await sleep(250);
  }
  return mapped;
}

export async function instantlyCampaigns(apiKey, { includeExcluded = false } = {}) {
  const headers = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
  const out = [];
  let after;
  for (let i = 0; i < 20; i++) {
    const u = new URL('https://api.instantly.ai/api/v2/campaigns');
    u.searchParams.set('limit', '100');
    if (after) u.searchParams.set('starting_after', after);
    const r = await fetch(u, { headers });
    if (!r.ok) throw new Error(`Instantly campaigns HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const b = await r.json();
    const items = b.items || [];
    out.push(...items);
    if (!b.next_starting_after || !items.length) break;
    after = b.next_starting_after;
    await sleep(250);
  }
  return out
    .filter((c) => includeExcluded || !EXCLUDE_INSTANTLY.has(c.id))
    .map((c) => ({
      platform: 'instantly',
      id: c.id,
      key: c.name,
      name: c.name,
      status: c.status,
      owner: ownerFromName(c.name),
    }));
}

// Run directly to see what a sync would cover.
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`
    || process.argv[1]?.endsWith('campaign-registry.mjs')) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const env = fs.readFileSync(path.join(dir, '.env'), 'utf8');
  const g = (k) => (env.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+)\\s*$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
  const hr = await heyreachCampaigns(g('HEYREACH_API_KEY'));
  const inst = await instantlyCampaigns(g('INSTANTLY_API_KEY'));
  const ST = { 0: 'draft', 1: 'ACTIVE', 2: 'paused', 3: 'completed' };
  console.log(`HeyReach: ${hr.length} campaigns in scope`);
  hr.forEach((c) => console.log(`  ${String(c.campaignId).padEnd(8)} ${String(c.status).padEnd(12)} ${(c.owner || 'NO OWNER').padEnd(9)} ${c.name}`));
  console.log(`\nInstantly: ${inst.length} campaigns in scope`);
  inst.forEach((c) => console.log(`  ${String(c.id).slice(0, 8)} ${String(ST[c.status] ?? c.status).padEnd(10)} ${(c.owner || 'NO OWNER').padEnd(9)} ${c.name}`));
  // Only HeyReach needs a campaign-level owner. instantly-to-hubspot reads the sending address
  // on each message, which is strictly better: the AIA campaigns send from both AEs' mailboxes,
  // so a single campaign-level owner would mislabel half of them.
  const orphans = hr.filter((c) => !c.owner);
  console.log(`\n${orphans.length} HeyReach campaign(s) with no owner from name or seat; their notes carry no owner:`);
  orphans.forEach((c) => console.log(`  ${c.name}`));
  const instNoName = inst.filter((c) => !c.owner).length;
  if (instNoName) console.log(`${instNoName} Instantly campaign(s) name no AE, which is fine: owner is read per message from the sending address.`);
}
