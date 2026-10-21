// Populates the custom intent_* properties on companies that only carry HubSpot's native
// intent signals, so one set of fields reads the same way across every list.
//
//   node intent-backfill.mjs            dry run
//   node intent-backfill.mjs --commit   writes
//   node intent-backfill.mjs --list=4137
//
// WHY. List 4157 has intent_summary on every company and list 4137 on none, because 4157 was
// populated from research topics and 4137 only ever had HubSpot's native fields. Anything
// ranking companies by intent has to read two different shapes depending on which list a
// company landed in, which is the kind of split that quietly produces wrong answers.
//
// WHAT THE NATIVE FIELDS ACTUALLY SAY. hs_recent_intent_signals holds signal TYPE ids, not
// topics. Its own description says so: "a rolling list of unique intent signal types ...
// (e.g., Visitor intent, Research intent)". The ids are opaque and the property carries
// externalOptions:true, so nothing in the API names them. They were resolved by correlation
// instead: of the 15 companies carrying 4-5470329 every single one also has a de-anonymised
// visit, against 27 of 211 for 4-5470332. That is visitor intent and research intent
// respectively, and the mapping below is that inference, not a documented constant.
//
// WHAT CANNOT BE FILLED, and why it is left empty rather than guessed:
//   intent_research_topics  no topic appears anywhere in the native fields. The 16-option
//                           vocabulary exists but nothing in 4137's data says which applies.
//   intent_pages_viewed     needs page-level events, which require the event-detail-read or
//                           web-analytics-api-access scope that this token does not hold.
// Writing a plausible topic would be inventing research that may not have happened, which is
// worse than a blank field on a record an AE is about to call from.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const env = fs.readFileSync(p('.env'), 'utf8');
const g = (k) => (env.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+)\\s*$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const H = { authorization: `Bearer ${g('HUBSPOT_TOKEN')}`, 'content-type': 'application/json' };

const COMMIT = process.argv.includes('--commit');
const LIST = (process.argv.find((a) => a.startsWith('--list=')) || '').split('=')[1] || '4137';
const OVERWRITE = process.argv.includes('--overwrite');

// Signal type ids, resolved by correlation with de-anonymised visits. See the header.
const VISITOR_SIGNAL = '4-5470329';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function hs(url, init, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: H, ...init });
    if (r.status === 429) { await sleep(1200 * (i + 1)); continue; }
    const b = await r.json().catch(() => null);
    if (!r.ok || b?.status === 'error') throw new Error(`HTTP ${r.status} :: ${b?.message || ''}`);
    return b;
  }
  throw new Error('rate limited after ' + tries + ' tries');
}

// Dates are resolved in Melbourne time and nowhere else. The signal timestamps are UTC
// instants, and reading one half in UTC and the other half locally put "17 Sept" in a summary
// whose intent_last_seen said 2026-09-16. en-AU also renders September as "Sept", where list
// 4157 writes "Sep", so the month names are fixed here rather than left to the locale.
const TZ = 'Australia/Melbourne';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parts = (d) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, day] = f.format(d).split('-').map(Number);
  return { y, m, d: day };
};
const DAY = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(+d) ? null : d;
};
const human = (d) => { const p = parts(d); return `${p.d} ${MONTHS[p.m - 1]}`; };
const isoDay = (d) => { const p = parts(d); return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; };

// ---- the companies
const ids = [];
for (let after = 0; ;) {
  const u = new URL(`https://api.hubapi.com/crm/v3/lists/${LIST}/memberships`);
  u.searchParams.set('limit', '250');
  if (after) u.searchParams.set('after', String(after));
  const b = await hs(u.toString());
  (b.results || []).forEach((m) => ids.push(String(m.recordId)));
  if (!b.paging?.next?.after) break;
  after = b.paging.next.after;
  await sleep(150);
}
console.log(`list ${LIST}: ${ids.length} companies`);

const READ = ['name', 'hs_recent_intent_signals', 'hs_latest_intent_signal_occurred_at',
  'hs_intent_page_views_last_30_days', 'hs_intent_visitors_last_30_days',
  'hs_count_intent_signals_created_last_30_days', 'hs_most_recent_de_anonymized_visit',
  'intent_summary', 'intent_source', 'intent_last_seen', 'intent_page_views',
  'intent_unique_visitors', 'intent_captured_on'];
const rows = [];
for (let i = 0; i < ids.length; i += 100) {
  const b = await hs('https://api.hubapi.com/crm/v3/objects/companies/batch/read', {
    method: 'POST',
    body: JSON.stringify({ inputs: ids.slice(i, i + 100).map((id) => ({ id })), properties: READ }),
  });
  (b.results || []).forEach((c) => rows.push({ id: c.id, ...c.properties }));
  await sleep(200);
}

// ---- compose
const today = isoDay(new Date());
const WINDOW_DAYS = 30;
const updates = [];
const skipped = { noSignal: 0, alreadyFilled: 0 };

for (const c of rows) {
  if (c.intent_summary && !OVERWRITE) { skipped.alreadyFilled++; continue; }

  const types = String(c.hs_recent_intent_signals || '').split(';').filter(Boolean);
  const visitor = types.includes(VISITOR_SIGNAL);
  const research = types.some((t) => t !== VISITOR_SIGNAL);
  const last = DAY(c.hs_latest_intent_signal_occurred_at);
  const views = Number(c.hs_intent_page_views_last_30_days) || 0;
  const visitors = Number(c.hs_intent_visitors_last_30_days) || 0;

  if (!last && !types.length) { skipped.noSignal++; continue; }

  // The rolling signal field only covers 30 days. A company whose latest signal predates that
  // has a date but no type, and saying "research intent" about it would be made up. Say what
  // is actually known instead: that there was a signal, and when.
  const stale = last && (Date.now() - +last) > WINDOW_DAYS * 864e5;
  const source = [research ? 'research' : null, visitor ? 'website_visit' : null].filter(Boolean).join(';');

  let summary;
  if (!types.length && last) {
    summary = `Earlier intent signal, last seen ${human(last)}. Outside the 30 day window.`;
  } else if (visitor && research) {
    summary = `Research intent and website visits${views ? `, ${views} page view${views > 1 ? 's' : ''} in 30 days` : ''}`
      + (last ? `, last seen ${human(last)}.` : '.');
  } else if (visitor) {
    summary = `Website visits${views ? `, ${views} page view${views > 1 ? 's' : ''} in 30 days` : ''}`
      + (visitors > 1 ? ` from ${visitors} visitors` : '') + (last ? `, last seen ${human(last)}.` : '.');
  } else {
    summary = `Research intent${last ? `, last seen ${human(last)}` : ''}${stale ? ' (outside the 30 day window)' : ''}.`;
  }

  const props = { intent_summary: summary, intent_captured_on: today };
  if (source) props.intent_source = source;
  if (last) props.intent_last_seen = isoDay(last);
  if (views) props.intent_page_views = String(views);
  if (visitors) props.intent_unique_visitors = String(visitors);
  updates.push({ id: c.id, name: c.name, properties: props });
}

console.log(`\nwould write to ${updates.length} companies`);
console.log(`  skipped: ${skipped.alreadyFilled} already have a summary (--overwrite to replace), `
  + `${skipped.noSignal} have no intent signal at all`);
const bySummaryShape = {};
updates.forEach((u) => {
  const k = u.properties.intent_summary.replace(/\d+/g, 'N').replace(/ last seen .*/, ' last seen ...');
  bySummaryShape[k] = (bySummaryShape[k] || 0) + 1;
});
console.log('\nsummary shapes:');
Object.entries(bySummaryShape).sort((a, b) => b[1] - a[1])
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));
console.log('\nexamples:');
updates.slice(0, 5).forEach((u) => {
  console.log(`  ${u.name}`);
  Object.entries(u.properties).forEach(([k, v]) => console.log(`     ${k.padEnd(22)} ${v}`));
});
console.log('\nintent_research_topics and intent_pages_viewed are deliberately left empty: no topic');
console.log('appears in the native data, and page detail needs a scope this token does not have.');

if (!COMMIT) { console.log('\nDRY RUN. Re-run with --commit to write.'); process.exit(0); }

let ok = 0;
for (let i = 0; i < updates.length; i += 100) {
  const b = await hs('https://api.hubapi.com/crm/v3/objects/companies/batch/update', {
    method: 'POST',
    body: JSON.stringify({ inputs: updates.slice(i, i + 100).map((u) => ({ id: u.id, properties: u.properties })) }),
  });
  ok += (b.results || []).length;
  console.log(`  updated ${ok}/${updates.length}`);
  await sleep(300);
}
console.log(`\n${ok} companies updated.`);
