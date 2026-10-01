// Enrols the Harvest audience: reads the four in-scope HubSpot lists, assigns a lane per
// filters it to confirmed Harvest users, and writes volcano_campaign onto each one.
//
// This is the gate. Nothing sends until a contact carries volcano_campaign=harvest, because
// that property is what the rollup uses to decide who is in which campaign (volcano-rollup.mjs)
// and what the cockpit filters on. Writing it here, once, from the lists, means the audience is
// decided in one place rather than implied by whoever happens to be in a HeyReach campaign.
//
// SCOPE, set 2026-09-30: Sina and Denzel only, AU and US-West only. Mark Dempsey's two lists
// (4000 UK, 3997 US-East) are deliberately excluded. Note that 3997 also contained 17 Denzel
// and 19 Sina contacts; excluding the list excludes those too, which is the intent.
//
// Run: node harvest-enrol.mjs            (dry run, prints the split and what would be written)
//      node harvest-enrol.mjs --commit   (writes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firmKey } from './harvest-lanes.mjs';
import { extractQuote } from './harvest-review-quote.mjs';
import { findConfirmProperty, enrich, ScopeError } from './harvest-company.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const T = g('HUBSPOT_TOKEN');
if (!T) { console.error('missing HUBSPOT_TOKEN'); process.exit(1); }
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const COMMIT = process.argv.includes('--commit');

const CAMPAIGN = 'harvest';
const LISTS = {
  4012: { owner: 'sina',   region: 'AU' },
  4006: { owner: 'sina',   region: 'US-West' },
  4009: { owner: 'denzel', region: 'AU' },
  4003: { owner: 'denzel', region: 'US-West' },
};
// Verified against hs_email_from_email on real logged emails, 2026-08-29. These were inverted
// in code once and sent 153 contacts the wrong AE's details, so they are asserted, not assumed.
const OWNER_ID = { sina: '80406430', denzel: '80127259' };
const OWNER_OF = Object.fromEntries(Object.entries(OWNER_ID).map(([k, v]) => [v, k]));

const READ = ['email', 'firstname', 'lastname', 'company', 'jobtitle', 'country',
  'hs_linkedin_url', 'hubspot_owner_id', 'volcano_campaign',
  'volcano_disposition', 'volcano_harvest_review', 'volcano_entry'];

// Set this if the auto-discovered property is the wrong one.
const CONFIRM_PROP = process.env.HARVEST_CONFIRM_PROP || null;
// Only with --allow-unconfirmed, which exists so a deliberate decision to include lookalikes
// is visible in the command rather than buried in a config file. It is never the default.
const ALLOW_UNCONFIRMED = process.argv.includes('--allow-unconfirmed');

async function members(listId) {
  const ids = [];
  let after;
  for (;;) {
    const u = new URL(`https://api.hubapi.com/crm/v3/lists/${listId}/memberships`);
    u.searchParams.set('limit', '250');
    if (after) u.searchParams.set('after', after);
    const b = await (await fetch(u, { headers: H })).json();
    if (!Array.isArray(b.results)) throw new Error(`list ${listId} read failed: ${JSON.stringify(b).slice(0, 200)}`);
    b.results.forEach((r) => ids.push(r.recordId));
    if (!b.paging?.next?.after) break;
    after = b.paging.next.after;
  }
  return ids;
}
async function batchRead(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
      method: 'POST', headers: H,
      body: JSON.stringify({ properties: READ, inputs: ids.slice(i, i + 100).map((id) => ({ id })) }),
    })).json();
    if (!Array.isArray(b.results)) throw new Error(`batch read failed: ${JSON.stringify(b).slice(0, 200)}`);
    b.results.forEach((c) => out.push({ id: c.id, ...c.properties }));
  }
  return out;
}

// ---------------------------------------------------------------- gather
const seen = new Map();
for (const [listId, meta] of Object.entries(LISTS)) {
  const rows = await batchRead(await members(listId));
  rows.forEach((r) => { if (!seen.has(r.id)) seen.set(r.id, { ...r, _list: listId, ...meta }); });
  console.log(`list ${listId}  ${meta.owner}/${meta.region}`.padEnd(34) + `${rows.length} contacts`);
}
const audience = [...seen.values()];
console.log(`\naudience: ${audience.length} distinct contacts`);

// A contact owned by somebody outside the scope would be approached by an AE who is not their
// owner. Volcano's owner=presenter=sender rule exists because breaking it sent 153 people the
// wrong AE's video and booking link.
const stray = audience.filter((c) => !OWNER_OF[c.hubspot_owner_id]);
if (stray.length) {
  console.error(`\nREFUSING: ${stray.length} contacts are owned by someone other than Sina or Denzel.`);
  stray.slice(0, 10).forEach((c) => console.error(`   ${c.email || c.id}  owner ${c.hubspot_owner_id}`));
  console.error('Reassign them in HubSpot or drop them from the list, then re-run.');
  process.exit(1);
}

// Someone already marked as a no is not a cold prospect. Suppression would remove them two
// hours later anyway, so never enrol them in the first place.
const RULED = ['not_interested', 'opted_out', 'disqualified', 'bad_fit', 'do_not_contact'];
const ruledOut = audience.filter((c) => RULED.includes(String(c.volcano_disposition || '')));
const live = audience.filter((c) => !RULED.includes(String(c.volcano_disposition || '')));
if (ruledOut.length) console.log(`excluded, already ruled out: ${ruledOut.length}`);

// A contact already in the other campaign would run two unrelated sequences at once.
const clash = live.filter((c) => c.volcano_campaign && c.volcano_campaign !== CAMPAIGN);
if (clash.length) {
  console.error(`\nREFUSING: ${clash.length} contacts are already in campaign "${clash[0].volcano_campaign}".`);
  clash.slice(0, 10).forEach((c) => console.error(`   ${c.email || c.id}`));
  process.exit(1);
}

// ------------------------------------------------- confirmed Harvest users only
// The list was built partly from lookalikes. Every line of Act 1 asserts the reader is living
// through the Harvest price rise, so sending it to a firm that never used Harvest is not a
// weak message, it is a visibly wrong one. A blank flag counts as not confirmed: it means
// nobody has checked, which is not the same as a yes.
let confirmed = live;
let companyInfo = {};
try {
  const propName = CONFIRM_PROP || (await findConfirmProperty(H)).chosen.name;
  if (!CONFIRM_PROP) {
    const { chosen, candidates } = await findConfirmProperty(H);
    console.log(`\nHarvest confirmation property: "${chosen.name}" (${chosen.label})`);
    if (candidates.length > 1) {
      console.log(`  ${candidates.length} properties mention Harvest; override with HARVEST_CONFIRM_PROP if this is the wrong one:`);
      candidates.slice(0, 5).forEach((c) => console.log(`    ${c.name}  |  ${c.label}`));
    }
  }
  companyInfo = await enrich(live.map((c) => c.id), H, propName);

  // The company record is also where the company NAME lives; it is blank on the contacts.
  live.forEach((c) => { const ci = companyInfo[c.id]; if (ci?.name && !c.company) c.company = ci.name; });

  const tally = { yes: 0, no: 0, unknown: 0, 'no company record': 0 };
  live.forEach((c) => {
    const ci = companyInfo[c.id];
    tally[!ci?.companyId ? 'no company record' : ci.confirm]++;
  });
  console.log('confirmed Harvest user:', JSON.stringify(tally));

  confirmed = live.filter((c) => companyInfo[c.id]?.confirm === 'yes');
  const dropped = live.length - confirmed.length;
  if (dropped) {
    console.log(`excluded, not a confirmed Harvest user: ${dropped}`);
    if (ALLOW_UNCONFIRMED) {
      console.log('  --allow-unconfirmed given, so they are being kept anyway.');
      confirmed = live;
    }
  }
} catch (e) {
  if (e instanceof ScopeError) {
    console.error(`\nREFUSING TO ENROL: ${e.message}`);
    console.error('Every line of Act 1 asserts the reader uses Harvest. Until the lookalikes can');
    console.error('be identified, enrolling would send that claim to firms it is false about.');
    process.exit(1);
  }
  throw e;
}
if (!confirmed.length) { console.error('\nnobody left after the confirmed-Harvest-user filter.'); process.exit(1); }

// ------------------------------------------------- which opener each contact gets
// 'review' only where we hold a quote we are willing to put in their mouth. A positive review
// yields no quote and falls through to the pricing opener, which is true for every contact.
const entryOf = new Map(confirmed.map((c) => {
  const { quote } = extractQuote(c.volcano_harvest_review);
  return [c.id, { entry: quote ? 'review' : 'pricing', quote: quote || '' }];
}));
const nReview = [...entryOf.values()].filter((v) => v.entry === 'review').length;
console.log(`${nReview} contacts have a quotable review on file (reference only: the opener is a`
  + ` shared step, not a per-contact variant)`);

// -------------------------------------------------------- which campaign each contact enters
// Region x owner. Region because the send window differs (APAC spans UTC+8 to +13, US-West is
// UTC-8) and Instantly schedules are per campaign; owner because owner = sender, always.
//
// The three angles are NOT a dimension here: they run as A/B variants inside each step and the
// platform chooses per send, so no contact can be said to be "in" an angle.
const APAC_COUNTRIES = ['Australia', 'New Zealand', 'Singapore'];
const regionOf = (c) => (APAC_COUNTRIES.includes(String(c.country || '')) ? 'APAC' : 'US-West');

const grid = {};
confirmed.forEach((c) => {
  const k = `${regionOf(c)}-${OWNER_OF[c.hubspot_owner_id]}`;
  grid[k] = (grid[k] || 0) + 1;
});
const firms = new Set(confirmed.map(firmKey)).size;
console.log(`\nfirms: ${firms}`);
console.log('\ncampaign (region x owner):');
Object.entries(grid).sort().forEach(([k, v]) => console.log(`  ${k.padEnd(18)} ${String(v).padStart(4)}`));

const countries = {};
confirmed.forEach((c) => { const k = `${regionOf(c)} / ${c.country}`; countries[k] = (countries[k] || 0) + 1; });
console.log('\ncountries behind each region:');
Object.entries(countries).sort().forEach(([k, v]) => console.log(`  ${k.padEnd(28)} ${String(v).padStart(4)}`));

const noEmail = confirmed.filter((c) => !String(c.email || '').trim()).length;
const noLi = confirmed.filter((c) => !String(c.hs_linkedin_url || '').trim()).length;
const noCo = confirmed.filter((c) => !String(c.company || '').trim()).length;
console.log(`\nreachability: ${confirmed.length - noLi} can run the LinkedIn arc, ${confirmed.length - noEmail} can run email`);
if (noCo) console.log(`  ${noCo} have no company name, so lanes fall back to the email domain`);

// ---------------------------------------------------------------- write
const changes = confirmed.map((c) => {
  const e = entryOf.get(c.id);
  // No volcano_lane: the angle is chosen by the platform at send time, so storing one here
  // would be a claim we cannot stand behind. volcano_review_quote is kept as reference for
  // whoever handles the reply, not as routing.
  const next = { volcano_campaign: CAMPAIGN, volcano_entry: e.entry, volcano_review_quote: e.quote };
  const diff = Object.fromEntries(Object.entries(next).filter(([k, v]) => String(c[k] ?? '') !== v));
  return Object.keys(diff).length ? { id: c.id, properties: diff } : null;
}).filter(Boolean);

console.log(`\n${changes.length} contacts would be updated (${confirmed.length - changes.length} already correct)`);
if (!COMMIT) { console.log('\nDRY RUN. Re-run with --commit to write.'); process.exit(0); }

let written = 0;
for (let i = 0; i < changes.length; i += 100) {
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/update', {
    method: 'POST', headers: H, body: JSON.stringify({ inputs: changes.slice(i, i + 100) }),
  });
  const b = await r.json().catch(() => ({}));
  if (r.status >= 300) { console.error(`batch ${i / 100} failed ${r.status}: ${JSON.stringify(b).slice(0, 300)}`); process.exit(1); }
  written += (b.results || []).length;
}
console.log(`written: ${written} contacts now carry volcano_campaign=${CAMPAIGN} and a lane`);
