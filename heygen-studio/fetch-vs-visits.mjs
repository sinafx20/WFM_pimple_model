// Builds the evidence that link fetches are not people, for the cockpit.
//
// Pairs each contact's TinyURL fetch count against the page views HubSpot actually
// attributed to them. A page view needs JavaScript to execute and, since the identify
// block shipped 2026-08-29, carries the contact's own email, so an attributed view is
// a person. A fetch is any HTTP GET, including mail security appliances and unfurl
// crawlers.
//
// The honest window is fetches gained AFTER the 2026-08-28 snapshot: before identify
// shipped, visits were logged anonymously and never tied to a contact, so a zero there
// is absence of evidence rather than evidence of absence.
//
// Run: node fetch-vs-visits.mjs   ->  _fetchvsviews.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const T = (env.match(/^HUBSPOT_TOKEN=(.+)$/m) || [])[1].trim();
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const p = (f) => path.join(__dirname, f);

const now = JSON.parse(fs.readFileSync(p('tinyurl-clicks.json'), 'utf8'));
const base = fs.existsSync(p('tinyurl-clicks-aug28.json'))
  ? JSON.parse(fs.readFileSync(p('tinyurl-clicks-aug28.json'), 'utf8')) : { contacts: {} };
const INTERNAL = /@workflowmax\.com$/i;
const ATTRIBUTION_LIVE = '2026-08-29';

const rows = [];
for (const [k, c] of Object.entries(now.contacts || {})) {
  if (!c.email || INTERNAL.test(c.email)) continue;          // our own testing is not evidence
  const before = base.contacts?.[k]?.total ?? 0;
  rows.push({ email: c.email, company: c.company || '', presenter: c.presenter || '',
              fetches: c.total || 0, windowFetches: Math.max(0, (c.total || 0) - before) });
}

// batch-read the page views HubSpot attributed to each of them
const emails = rows.map(r => r.email);
const props = [];
for (let i = 0; i < emails.length; i += 100) {
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
    method: 'POST', headers: H,
    body: JSON.stringify({ idProperty: 'email',
      properties: ['email', 'hs_analytics_num_page_views', 'hs_analytics_num_visits', 'hs_analytics_last_timestamp'],
      inputs: emails.slice(i, i + 100).map(e => ({ id: e })) }),
  });
  const b = await r.json();
  props.push(...(b.results || []));
}
const by = {};
props.forEach(x => { by[(x.properties.email || '').toLowerCase()] = x.properties; });

for (const r of rows) {
  const q = by[r.email.toLowerCase()] || {};
  r.views = Number(q.hs_analytics_num_page_views) || 0;
  r.visits = Number(q.hs_analytics_num_visits) || 0;
  r.lastSeen = (q.hs_analytics_last_timestamp || '').slice(0, 10);
  r.visitedInWindow = !!r.lastSeen && r.lastSeen >= ATTRIBUTION_LIVE;
}
rows.sort((a, b) => b.fetches - a.fetches);

const withFetch = rows.filter(r => r.fetches > 0);
const inWindow = rows.filter(r => r.windowFetches > 0);
const out = {
  generated: new Date().toISOString(),
  attributionLive: ATTRIBUTION_LIVE,
  totals: {
    contactsWithFetches: withFetch.length,
    totalFetches: withFetch.reduce((s, r) => s + r.fetches, 0),
    windowContacts: inWindow.length,
    windowFetches: inWindow.reduce((s, r) => s + r.windowFetches, 0),
    windowVisitors: inWindow.filter(r => r.visitedInWindow).length,
    everVisited: withFetch.filter(r => r.views > 0).length,
  },
  rows: withFetch,
};
fs.writeFileSync(p('_fetchvsviews.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.totals, null, 1));
console.log('written _fetchvsviews.json with', out.rows.length, 'contacts');
