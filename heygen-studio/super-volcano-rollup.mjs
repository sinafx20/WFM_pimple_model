// Builds the super volcano: every company across the outbound segments, scored by how close
// it is to a booked meeting, written as one compact JSON the page reads.
//
//   node super-volcano-rollup.mjs            build and report, writes the JSON
//   node super-volcano-rollup.mjs --quiet    no per-band listing
//
// WHY A FILE AND NOT LIVE QUERIES. The campaign cockpit queries HubSpot from the browser and
// tops out around 700 contacts. This covers ~3,000 companies across seven segments, so the
// work moves to a scheduled job and the page just reads the result. Same spine as the campaign
// rollup, inverted: compute server side, render client side.
//
// WHY COMPANY ROLLUPS AND NOT ASSOCIATIONS. Walking calls, meetings and notes per company is
// ~5 requests each, 15,000 for this audience. HubSpot already maintains the aggregates on the
// company record (hs_last_logged_call_date, num_notes, hs_last_booked_meeting_date and the
// rest), so the whole build is batch reads: about 30 calls instead of 15,000.
//
// THE MODEL. Eruption is a BOOKED MEETING, not a reply. Everything below it is ranked by
// proximity to one, which is why a dormant trial with a live conversation outranks a fresh
// company with a page view. Four components, each visible in the output so the weighting can
// be argued with rather than reverse-engineered:
//
//   FIT     0-25   employee count x industry. Static, so it breaks ties rather than drives.
//   SIGNAL  0-30   intent recency and type, plus campaign engagement already on the contacts.
//   MOTION  0-45   two-way activity: how recently a real conversation happened, and whether a
//                  next step is scheduled. This is the one that should dominate.
//   SEMANTIC 0-40  left for the daily Claude run to write back. Reading "still interested but
//                  no meeting booked" out of a call summary is not something a score can do,
//                  and pretending otherwise would bury exactly the accounts worth calling.
//
// A company with a FUTURE booked meeting is at the summit and drops out of the queue: the work
// is done until the meeting happens. That makes the volcano self-clearing rather than a
// scoreboard that only ever climbs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const env = fs.readFileSync(p('.env'), 'utf8');
const g = (k) => (env.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+)\\s*$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const H = { authorization: `Bearer ${g('HUBSPOT_TOKEN')}`, 'content-type': 'application/json' };
const QUIET = process.argv.includes('--quiet');

// The segments in play, and what being in one means. `weight` nudges fit: a confirmed Harvest
// user is a better prospect than a cold warm-outbound record at the same headcount.
const SEGMENTS = {
  4165: { key: 'warm', label: 'Warm outbound', weight: 0 },
  4137: { key: 'intent-crm', label: 'CRM broad intent', weight: 4 },
  4039: { key: 'trial', label: 'Unconverted trial', weight: 6 },
  4048: { key: 'harvest', label: 'Confirmed Harvest', weight: 6 },
  4075: { key: 'closed-lost', label: 'Closed lost', weight: 4 },
  4157: { key: 'intent-new', label: 'New, intent ICP', weight: 4 },
  4111: { key: 'harvest-au', label: 'Harvest AU campaign', weight: 2 },
};

// Industries we actually sell into, from the six verticals the campaign content is built for.
const ICP_INDUSTRY = /ARCHITECT|ENGINEER|CONSULT|CONSTRUCTION|DESIGN|MARKETING|ADVERTIS|CIVIL|BUILDING|PROFESSIONAL/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hs(url, init, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: H, ...init });
    if (r.status === 429) { await sleep(1200 * (i + 1)); continue; }
    const b = await r.json().catch(() => null);
    // A failed read must not look like an empty segment. Everything downstream treats this
    // file as the whole audience.
    if (!r.ok || b?.status === 'error') throw new Error(`HTTP ${r.status} ${String(url).slice(0, 60)} :: ${b?.message || ''}`);
    return b;
  }
  throw new Error('rate limited after ' + tries + ' tries');
}

const DAYS = (iso) => {
  if (!iso) return null;
  const t = new Date(iso);
  return Number.isNaN(+t) ? null : Math.floor((Date.now() - +t) / 864e5);
};
const future = (iso) => !!iso && new Date(iso) > new Date();

// ---------------------------------------------------------------- membership
const memberOf = new Map();   // companyId -> Set of segment keys
for (const [listId, seg] of Object.entries(SEGMENTS)) {
  let n = 0;
  for (let after = 0; ;) {
    const u = new URL(`https://api.hubapi.com/crm/v3/lists/${listId}/memberships`);
    u.searchParams.set('limit', '250');
    if (after) u.searchParams.set('after', String(after));
    const b = await hs(u.toString());
    for (const m of b.results || []) {
      const id = String(m.recordId);
      if (!memberOf.has(id)) memberOf.set(id, new Set());
      memberOf.get(id).add(seg.key);
      n++;
    }
    if (!b.paging?.next?.after) break;
    after = b.paging.next.after;
    await sleep(150);
  }
  console.log(`  ${String(listId).padEnd(6)} ${String(n).padStart(5)}  ${seg.label}`);
}
const ids = [...memberOf.keys()];
console.log(`\n${ids.length} distinct companies across ${Object.keys(SEGMENTS).length} segments`);

// ---------------------------------------------------------------- the data
const READ = [
  'name', 'domain', 'industry', 'numberofemployees', 'state', 'country', 'lifecyclestage',
  'hubspot_owner_id', 'num_associated_contacts', 'num_associated_deals', 'num_notes',
  'num_contacted_notes', 'notes_last_contacted', 'notes_next_activity_date',
  'hs_last_booked_meeting_date', 'hs_last_logged_call_date', 'hs_last_logged_outgoing_email_date',
  'hs_last_sales_activity_date', 'hs_last_sales_activity_type', 'hs_latest_meeting_activity',
  'hs_latest_intent_signal_occurred_at', 'hs_count_intent_signals_created_last_30_days',
  'intent_summary', 'intent_source', 'intent_last_seen', 'intent_research_topics',
  // Written by the daily Claude run. Absent for now, read anyway so the slot is real.
  'volcano_motion_score', 'volcano_motion_note', 'volcano_next_action',
];
const companies = [];
for (let i = 0; i < ids.length; i += 100) {
  const b = await hs('https://api.hubapi.com/crm/v3/objects/companies/batch/read', {
    method: 'POST',
    body: JSON.stringify({ inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: READ }),
  });
  (b.results || []).forEach((c) => companies.push({ id: c.id, ...c.properties }));
  if (i % 500 === 0) process.stdout.write(`\r  read ${companies.length}/${ids.length}`);
  await sleep(180);
}
console.log(`\r  read ${companies.length}/${ids.length} company records`);

// ---------------------------------------------------------------- score
const OWNER = { 80406430: 'Sina', 80127259: 'Denzel', 80127257: 'Mark' };
const staffBand = (n) => {
  const v = Number(n) || 0;
  if (v >= 200) return 6;        // above the sweet spot, still worth having
  if (v >= 80) return 14;
  if (v >= 20) return 15;        // the core: 20-200 staff professional services
  if (v >= 5) return 9;
  return 3;
};

const rows = companies.map((c) => {
  const segs = [...(memberOf.get(String(c.id)) || [])];
  const segWeight = Math.max(0, ...segs.map((k) => Object.values(SEGMENTS).find((s) => s.key === k)?.weight || 0));

  // FIT: who they are. Static, so it is capped low enough to break ties rather than lead.
  const fit = Math.min(25, staffBand(c.numberofemployees) + (ICP_INDUSTRY.test(c.industry || '') ? 4 : 0) + segWeight);

  // SIGNAL: that they are looking. Intent decays fast; a signal from six weeks ago is history.
  const intentAge = DAYS(c.intent_last_seen || c.hs_latest_intent_signal_occurred_at);
  let signal = 0;
  if (intentAge !== null) {
    if (intentAge <= 7) signal += 18;
    else if (intentAge <= 14) signal += 13;
    else if (intentAge <= 30) signal += 8;
    else if (intentAge <= 60) signal += 3;
  }
  if (/website_visit/.test(c.intent_source || '')) signal += 6;   // first-party beats inferred
  if (Number(c.hs_count_intent_signals_created_last_30_days) > 1) signal += 4;
  signal = Math.min(30, signal);

  // MOTION: that a conversation is alive. Calls and meetings outrank a sent email, because one
  // is two-way and the other is only us talking.
  const callAge = DAYS(c.hs_last_logged_call_date);
  const meetAge = DAYS(c.hs_latest_meeting_activity || c.hs_last_booked_meeting_date);
  const touchAge = DAYS(c.notes_last_contacted);
  let motion = 0;
  const best = [callAge, meetAge].filter((x) => x !== null).sort((a, b) => a - b)[0] ?? null;
  if (best !== null) {
    if (best <= 14) motion += 28;
    else if (best <= 45) motion += 20;
    else if (best <= 120) motion += 12;
    else if (best <= 365) motion += 6;
  } else if (touchAge !== null && touchAge <= 60) motion += 5;
  if (future(c.notes_next_activity_date)) motion += 12;          // somebody already owes a step
  if (Number(c.num_contacted_notes) > 2) motion += 5;
  motion = Math.min(45, motion);

  // SEMANTIC: the daily Claude run's reading of the call summaries. Zero until it writes.
  const semantic = Math.min(40, Number(c.volcano_motion_score) || 0);

  // The summit, and only this. A future task or next-activity date is a reminder, not a
  // meeting, so it earns motion points above but never the summit.
  const booked = future(c.hs_last_booked_meeting_date);
  const heat = booked ? 100 : Math.min(99, fit + signal + motion + semantic);

  return {
    // Some records carry a domain and no name. Showing "(no name)" on the hottest account on
    // the board helps nobody; the domain is what an AE would recognise anyway.
    id: c.id, name: c.name || c.domain || `company ${c.id}`, domain: c.domain || '',
    industry: c.industry || '', staff: Number(c.numberofemployees) || 0,
    owner: OWNER[c.hubspot_owner_id] || null, segments: segs,
    lifecycle: c.lifecyclestage || '',
    heat, booked, fit, signal, motion, semantic,
    intent: c.intent_summary || '', intentSource: c.intent_source || '',
    intentAge, callAge, meetAge, touchAge,
    nextActivity: c.notes_next_activity_date || null,
    contacts: Number(c.num_associated_contacts) || 0,
    deals: Number(c.num_associated_deals) || 0,
    note: c.volcano_motion_note || '', nextAction: c.volcano_next_action || '',
  };
});

const band = (h) => (h >= 100 ? 'eruption' : h >= 65 ? 'hot' : h >= 25 ? 'warm' : 'cold');
rows.forEach((r) => { r.band = band(r.heat); });
rows.sort((a, b) => b.heat - a.heat);

const bands = { eruption: 0, hot: 0, warm: 0, cold: 0 };
rows.forEach((r) => { bands[r.band]++; });
console.log(`\nbands: ${Object.entries(bands).map(([k, v]) => `${k} ${v}`).join('  ·  ')}`);
const semanticFilled = rows.filter((r) => r.semantic > 0).length;
console.log(`semantic score present on ${semanticFilled} companies `
  + `(${semanticFilled ? '' : 'nothing has written volcano_motion_score yet, so motion is mechanical only'})`);

if (!QUIET) {
  console.log('\ntop 15 by heat:');
  rows.slice(0, 15).forEach((r) => console.log(
    `  ${String(r.heat).padStart(3)} ${r.band.padEnd(8)} ${r.name.slice(0, 30).padEnd(32)}`
    + `${String(r.staff).padStart(4)} staff  f${r.fit} s${r.signal} m${r.motion}  ${r.segments.join(',')}`));
}

const out = {
  builtAt: new Date().toISOString(),
  segments: Object.fromEntries(Object.entries(SEGMENTS).map(([id, s]) => [s.key, s.label])),
  weights: { fit: 25, signal: 30, motion: 45, semantic: 40, note: 'eruption is a future booked meeting' },
  bands, companies: rows,
};
fs.writeFileSync(p('super-volcano.json'), JSON.stringify(out));
console.log(`\nwrote super-volcano.json  (${(fs.statSync(p('super-volcano.json')).size / 1024).toFixed(0)} KB, ${rows.length} companies)`);
