// Builds a standalone, openable copy of the Volcano cockpit with today's data baked in.
//
// WHY THIS EXISTS. volcano-cockpit.html is deliberately empty: it reads HubSpot through the
// artifact runtime at open time, which is what keeps it honest and keeps 348 real prospects
// out of a public repo. Opened as a plain file it therefore shows nothing. This produces the
// other thing people sometimes need: one file, no connector, no network, that renders.
//
// It reuses the page's own toRow/merge/render path rather than reimplementing any of it, so
// a snapshot cannot drift from what the live page would draw. Only the data source changes.
//
// THE OUTPUT CONTAINS REAL PROSPECT NAMES AND COMPANIES. It is written as _*.html, which is
// gitignored, and must never be committed to this public repo or posted anywhere open.
//
// Run: node make-cockpit-snapshot.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const T = g('HUBSPOT_TOKEN');
if (!T) { console.error('missing HUBSPOT_TOKEN'); process.exit(1); }
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };

const OWNERS = { '80406430': 'sina', '80127259': 'denzel' };
const PROPS = ['firstname', 'lastname', 'jobtitle', 'company', 'hubspot_owner_id',
  'volcano_icp_vertical', 'volcano_heat', 'volcano_li_stage', 'volcano_genuine_reply',
  'volcano_verified_visits', 'volcano_email_clicks', 'volcano_interaction_depth',
  'volcano_last_interaction_at', 'volcano_genuine_opens', 'volcano_inmail_track',
  'volcano_inmail_sent', 'volcano_email_opens', 'volcano_emails_sent', 'volcano_li_messages',
  'hs_analytics_last_timestamp'];

// --- contacts: the same filter the live page uses, so the two agree ---------------------
const results = [];
for (let after = 0; ;) {
  const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      filterGroups: [{ filters: [
        { propertyName: 'volcano_icp_vertical', operator: 'HAS_PROPERTY' },
        { propertyName: 'volcano_internal', operator: 'NOT_HAS_PROPERTY' },
      ] }],
      properties: PROPS, limit: 100, after: String(after),
      sorts: [{ propertyName: 'volcano_heat', direction: 'DESCENDING' }],
    }),
  })).json();
  (b.results || []).forEach((c) => results.push({ id: c.id, properties: c.properties }));
  if (!b.paging?.next?.after) break;
  after = b.paging.next.after;
}
console.log('contacts:', results.length);

// --- weekly activity: the page asks HubSpot for this with grouped SQL, which is an MCP
// tool we cannot call from here. Counting per week per owner per type gives the identical
// numbers, just in more requests, and a snapshot is built once so the cost does not matter.
function buildWeeks() {
  const x = new Date(); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  const out = [];
  for (let i = 7; i >= 0; i--) {
    const s = new Date(x); s.setDate(s.getDate() - i * 7);
    const e = new Date(s); e.setDate(e.getDate() + 7);
    out.push({ key: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`, start: s.getTime(), end: e.getTime() });
  }
  return out;
}
const weeks = buildWeeks();
const TYPES = [['calls', 'calls'], ['meetings', 'meetings'], ['emails', 'emails'], ['tasks', 'tasks'], ['notes', 'notes']];

async function count(obj, ownerId, w, extra) {
  const filters = [
    { propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId },
    { propertyName: 'hs_timestamp', operator: 'GTE', value: String(w.start) },
    { propertyName: 'hs_timestamp', operator: 'LT', value: String(w.end) },
    ...(extra || []),
  ];
  const r = await fetch(`https://api.hubapi.com/crm/v3/objects/${obj}/search`, {
    method: 'POST', headers: H, body: JSON.stringify({ filterGroups: [{ filters }], limit: 1 }),
  });
  if (!r.ok) return 0;
  return (await r.json()).total || 0;
}

const jobs = [];
for (const [ownerId, ae] of Object.entries(OWNERS)) {
  for (const [obj, series] of TYPES) for (const w of weeks) jobs.push({ obj, series, ae, ownerId, w });
  // The campaign's own LinkedIn outreach, matched by the marker the HeyReach sync writes.
  for (const w of weeks) jobs.push({ obj: 'notes', series: 'volcano', ae, ownerId, w, extra: [{ propertyName: 'hs_note_body', operator: 'CONTAINS_TOKEN', value: '*volcano:li-*' }] });
}
const act = {};
let done = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  for (;;) {
    const j = jobs.shift();
    if (!j) return;
    const n = await count(j.obj, j.ownerId, j.w, j.extra);
    if (n) (act[j.series] ||= []).push({ ae: j.ae, week: j.w.key, n });
    if (++done % 30 === 0) process.stdout.write(`  ...${done} activity queries\n`);
  }
}));
console.log('activity series:', Object.keys(act).join(', ') || '(none)');

// --- graft the data into the page, replacing only its data source ------------------------
let h = fs.readFileSync(p('volcano-cockpit.html'), 'utf8');
const must = (c, w) => { if (!c) { console.error('MISSING: ' + w); process.exit(1); } };

const bootStart = h.indexOf('(async function boot() {');
must(bootStart > 0, 'boot');
const bootEnd = h.indexOf('})();', bootStart) + 5;
const stamp = new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });

h = h.slice(0, bootStart) + `// ---- OFFLINE SNAPSHOT ----------------------------------------------------------------
// Data frozen at build time and fed through the same toRow/merge path the live page uses,
// so this renders exactly what the live page rendered at that moment and nothing here can
// drift from it. Rebuild with: node make-cockpit-snapshot.mjs
const SNAPSHOT_ROWS = ${JSON.stringify(results)};
const SNAPSHOT_ACT = ${JSON.stringify(act)};
(function bootSnapshot() {
  pageRows[0] = SNAPSHOT_ROWS.map(toRow);
  Object.assign(actRaw, SNAPSHOT_ACT);
  applyActivity();
  merge();
  document.getElementById('livechip').textContent = 'Snapshot';
  document.getElementById('snap').textContent = 'Frozen ${stamp}, not live';
})();` + h.slice(bootEnd);

// stamp() would otherwise relabel the header as live on every merge
h = h.replace("  chip.textContent = 'Live';", "  chip.textContent = 'Snapshot';");
h = h.replace(`  snap.textContent = at`, `  snap.textContent = '${'Frozen ' + stamp + ', not live'}' || at`);
h = h.replace('<title>Volcano Engagement Cockpit</title>', '<title>Volcano Engagement Cockpit (snapshot)</title>');

// a plain file has no artifact wrapper, so give it the document skeleton the runtime adds
const OUT = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
  + '<style>:root{color-scheme:dark}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>\n'
  + '</head>\n<body>\n' + h + '\n</body>\n</html>\n';

fs.writeFileSync(p('_volcano-cockpit-snapshot.html'), OUT);
console.log('\nwrote heygen-studio/_volcano-cockpit-snapshot.html');
console.log('size:', (OUT.length / 1024).toFixed(0) + 'KB');
console.log('CONTAINS REAL PROSPECT DATA: gitignored, do not commit or post publicly.');
