// Pulls HubSpot's verified human activity for every Volcano contact, gated to the
// campaign window, so a real visit can be scored as a click in the heat model.
//
// A page view is worth scoring where a short-link fetch is not: it needs JavaScript to
// execute and, since the identify block shipped 2026-08-29, carries the email of the
// contact, so HubSpot attributes it to a person. Scanners and unfurl crawlers produce
// fetches but never page views.
//
// THE CUTOFF (2026-08-26). Everything before it is our own testing, not prospects.
// Alex Kibble's 33 views and 18 visits were Sina exercising the tools in July, and his
// health check completed 2026-07-02 confirms it. Counting those would have crowned a
// test session as the hottest lead in the pipeline.
//
// HOW EACH SIGNAL IS DATED:
//  - Completions are dated exactly, from property history, which needs no extra scope.
//  - Visits cannot be. hs_analytics_num_page_views is a lifetime cumulative counter and
//    per-view timestamps need the web-analytics-api-access scope, which returns 403
//    today. So visits are counted conservatively as the number of DISTINCT DATES at or
//    after the cutoff that we can actually evidence: the last-seen date, plus any
//    completion dates. Never more than the lifetime visit count. A contact last seen
//    before the cutoff contributes nothing at all.
//
// Also worth knowing: hs_analytics_* counts every HubSpot-tracked page, so a view could
// be workflowmax.com rather than a Volcano tool. Still a real human on our web presence,
// but not proof they followed a campaign link. Resolvable once the analytics scope lands.
//
// Run: node verified-visits.mjs   ->  _verifiedvisits.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const T = (env.match(/^HUBSPOT_TOKEN=(.+)$/m) || [])[1].trim();
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const p = (f) => path.join(__dirname, f);

const CUTOFF = '2026-08-26';

// Individual events after the cutoff that we know were internal, confirmed by Sina.
// The cutoff alone cannot catch these: a prospect's tool completion can turn out to be
// our own team reviewing the tool on their record, while a later visit by the actual
// person is genuine and must still count.
//
// Kept in a local, gitignored file rather than inline because it is keyed by prospect
// email and this repo is public. Shape: { "someone@firm.com": ["2026-08-27"] } —
// dates to ignore per contact. Missing file just means no exclusions.
const INTERNAL_EVENTS = fs.existsSync(p('_internal-events.json'))
  ? JSON.parse(fs.readFileSync(p('_internal-events.json'), 'utf8'))
  : {};
const COMPLETION_PROPS = ['wfm_completed_health_check', 'wfm_completed_calculator', 'wfm_completed_benchmark'];

const viz = JSON.parse(fs.readFileSync(p('_viz.json'), 'utf8'));
const ids = [...new Set((viz.rows || []).map(r => r.id).filter(Boolean))];
console.log('volcano contacts:', ids.length, '| cutoff:', CUTOFF);

const PROPS = ['email', 'hs_analytics_num_page_views', 'hs_analytics_num_visits',
               'hs_analytics_last_timestamp', 'hs_analytics_first_timestamp', ...COMPLETION_PROPS];
const got = [];
for (let i = 0; i < ids.length; i += 100) {
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
    method: 'POST', headers: H,
    body: JSON.stringify({ properties: PROPS, inputs: ids.slice(i, i + 100).map(id => ({ id: String(id) })) }),
  });
  const b = await r.json();
  if (!r.ok) { console.error('batch read failed', r.status, JSON.stringify(b).slice(0, 200)); process.exit(1); }
  got.push(...(b.results || []));
}
console.log('fetched:', got.length);

const truthy = (v) => v && v !== 'false';

// Exact completion dates, only for the few contacts that completed anything.
const completedIds = got.filter(g => COMPLETION_PROPS.some(k => truthy(g.properties[k]))).map(g => g.id);
const completionDates = {};
for (const id of completedIds) {
  const r = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}?propertiesWithHistory=${COMPLETION_PROPS.join(',')}`, { headers: H });
  const b = await r.json();
  const dates = [];
  for (const arr of Object.values(b.propertiesWithHistory || {})) {
    (arr || []).forEach(h => { if (truthy(h.value)) dates.push(h.timestamp.slice(0, 10)); });
  }
  completionDates[id] = [...new Set(dates)].sort();
}
console.log('contacts with a completion:', completedIds.length);

const out = {};
for (const g of got) {
  const q = g.properties || {};
  const email = (q.email || '').toLowerCase();
  if (!email) continue;
  const lastSeen = (q.hs_analytics_last_timestamp || '').slice(0, 10);
  const comps = completionDates[g.id] || [];
  const internalDates = INTERNAL_EVENTS[email] || [];
  const compsInWindow = comps.filter(d => d >= CUTOFF && !internalDates.includes(d));

  // distinct dates at or after the cutoff that we can actually evidence
  const evidenced = new Set();
  if (lastSeen && lastSeen >= CUTOFF && !internalDates.includes(lastSeen)) evidenced.add(lastSeen);
  compsInWindow.forEach(d => evidenced.add(d));
  const lifetimeVisits = Number(q.hs_analytics_num_visits) || 0;

  out[g.id] = {
    email,
    internal: /@workflowmax\.com$/i.test(email),
    lifetimeViews: Number(q.hs_analytics_num_page_views) || 0,
    lifetimeVisits,
    firstSeen: (q.hs_analytics_first_timestamp || '').slice(0, 10),
    lastSeen,
    completionDates: comps,
    // the gated numbers the heat model actually uses
    visits: Math.min(evidenced.size, Math.max(lifetimeVisits, evidenced.size ? 1 : 0)),
    completedTool: compsInWindow.length > 0,
    // true only when the contact had activity and NONE of it counted, so a contact with
    // one genuine visit plus one internal completion is not mislabelled as pure testing
    excludedAsPreCutoff: evidenced.size === 0 && compsInWindow.length === 0 && !!(lastSeen || comps.length),
  };
}
fs.writeFileSync(p('_verifiedvisits.json'), JSON.stringify({ generated: new Date().toISOString(), cutoff: CUTOFF, byId: out }, null, 1));

const ext = Object.values(out).filter(v => !v.internal);
console.log('\nCounted (at or after ' + CUTOFF + '):');
ext.filter(v => v.visits > 0 || v.completedTool).sort((a, b) => b.visits - a.visits).forEach(v =>
  console.log(`  ${v.visits} visit(s)${v.completedTool ? ' + completed ' + v.completionDates.filter(d => d >= CUTOFF).join(',') : ''}  ${v.email}`));
console.log('\nExcluded as pre-cutoff testing:');
ext.filter(v => v.excludedAsPreCutoff).forEach(v =>
  console.log(`  ${v.email}  lifetime ${v.lifetimeViews} views / ${v.lifetimeVisits} visits, last ${v.lastSeen || 'never'}${v.completionDates.length ? ', completed ' + v.completionDates.join(',') : ''}`));
