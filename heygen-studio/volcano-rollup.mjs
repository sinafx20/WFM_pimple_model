// Rolls the campaign's engagement signals up onto each HubSpot contact, so that HubSpot
// is the single source of truth for the Volcano heat model.
//
// WHY THIS EXISTS. The heat model used to live as JavaScript inside a published dashboard,
// LinkedIn activity lived only as timeline Notes, and genuine-reply classification lived in
// a local JSON file. None of those can be queried per contact, which meant the dashboard had
// to be rebuilt by hand from local dumps and HubSpot workflows had nothing to fire on. Once
// the same signals are contact properties, a page can read them live and a workflow can
// trigger on a contact crossing a band boundary.
//
// WHY IT READS EVERYTHING FROM HUBSPOT AND HEYREACH. This runs on a GitHub runner from a
// clean checkout, so it cannot depend on _viz.json or any other local dump.
//
// WHY NOT LIST 3698. The daily batch works from that list, but the list is dynamic and its
// filters were last updated 2026-07-06, so it now holds only 124 of the audience while 356
// contacts carry volcano_icp_vertical. Scoring off the list would silently ignore two
// thirds of the campaign, which is exactly the "offList: 210" figure the dashboard reports.
//
// Run: node volcano-rollup.mjs            (dry run, prints what would change)
//      node volcano-rollup.mjs --commit   (writes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const T = g('HUBSPOT_TOKEN'), HK = g('HEYREACH_API_KEY');
if (!T) { console.error('missing HUBSPOT_TOKEN'); process.exit(1); }
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const COMMIT = process.argv.includes('--commit');
// Kept for reference: the daily batch still works from this list.
const LIST_ID = '3698';

// Everything before this is our own testing, not prospects. Same cutoff verified-visits.mjs
// uses: counting July activity once crowned a test session as the hottest lead in the pipeline.
const CUTOFF = '2026-08-26';

// Teammates and test records sit in the same audience but must never generate heat, or an
// AE gets sent after their own colleague. Domains cover the team; the local override file
// exists because personal addresses used for testing (a gmail account exercising the tools)
// look exactly like a prospect and cannot be recognised by domain. Kept out of the repo
// because it is a list of real addresses and this repo is public.
const INTERNAL_DOMAINS = ['workflowmax.com', 'bluerock.com.au', 'example.com'];
const INTERNAL_EMAILS = new Set(
  (fs.existsSync(p('_internal-contacts.json'))
    ? JSON.parse(fs.readFileSync(p('_internal-contacts.json'), 'utf8'))
    : []).map((e) => String(e).toLowerCase())
);
const isInternal = (email) => {
  const e = String(email || '').toLowerCase();
  return INTERNAL_EMAILS.has(e) || INTERNAL_DOMAINS.some((d) => e.endsWith('@' + d));
};

const jget = async (url) => (await fetch(url, { headers: H })).json();
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch { out[k] = null; } }
  }));
  return out;
}

// ---------------------------------------------------------------- contact set
const READ = ['email', 'firstname', 'lastname', 'company', 'jobtitle', 'hubspot_owner_id',
  'volcano_icp_vertical', 'volcano_interaction_log', 'volcano_interaction_depth',
  'wfm_completed_health_check', 'wfm_completed_calculator', 'wfm_completed_benchmark',
  'hs_analytics_last_timestamp', 'volcano_heat', 'volcano_li_stage',
  'volcano_genuine_reply', 'volcano_verified_visits', 'volcano_email_clicks'];
const contacts = [];
for (let after = 0; ;) {
  const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'volcano_icp_vertical', operator: 'HAS_PROPERTY' }] }],
      properties: READ, limit: 100, after: String(after),
    }),
  })).json();
  (b.results || []).forEach((c) => contacts.push({ id: c.id, ...c.properties }));
  if (!b.paging?.next?.after) break;
  after = b.paging.next.after;
}
console.log(`campaign audience: ${contacts.length} contacts`);

// ---------------------------------------------------------------- LinkedIn stage
// HeyReach has no webhooks (three endpoint shapes probed 2026-09-01, all 404), so the only
// way to know a stage is to ask. A missing key is not fatal: the other signals still roll up.
const liStage = {};
const RANK = { sent: 1, accepted: 2, replied: 3 };
if (HK) {
  const map = JSON.parse(fs.readFileSync(p('heyreach-real-campaigns.json'), 'utf8'));
  const hr = (path_, body) => fetch('https://api.heyreach.io/api/public' + path_, {
    method: 'POST', headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let leads = 0;
  for (const m of Object.values(map)) {
    for (let offset = 0; ;) {
      const r = await hr('/campaign/GetLeadsFromCampaign', { campaignId: m.campaignId, offset, limit: 100 });
      if (!r.ok) { console.error(`heyreach campaign ${m.campaignId}: HTTP ${r.status}`); break; }
      const b = await r.json();
      const items = b.items || [];
      for (const l of items) {
        const email = (l.linkedInUserProfile?.emailAddress || l.linkedInUserProfile?.enrichedEmailAddress || '').toLowerCase();
        if (!email) continue;
        leads++;
        // Stage only ever climbs. The same person can appear in more than one campaign row,
        // and a later row still reading ConnectionSent must not demote someone who connected.
        const s = l.leadConnectionStatus === 'ConnectionAccepted' ? 'accepted'
          : l.leadConnectionStatus === 'ConnectionSent' ? 'sent' : null;
        if (s && (!liStage[email] || RANK[s] > RANK[liStage[email]])) liStage[email] = s;
      }
      offset += items.length;
      if (items.length < 100 || offset >= (b.totalCount || 0)) break;
    }
  }
  console.log(`heyreach: ${leads} leads with an email, ${Object.keys(liStage).length} distinct`);
} else {
  console.log('heyreach: no HEYREACH_API_KEY, skipping LinkedIn stage');
}

// ---------------------------------------------------------------- genuine replies
// Instantly counts every inbound message including out-of-office, and a reply is the
// heaviest signal in the model. Both of the first replies this campaign recorded were
// auto-responders, one of which briefly sat at the top of the volcano. Erring toward
// "automatic" is the safe direction: a missed real reply still lands in the AE's inbox,
// whereas a scored out-of-office sends someone chasing a prospect who never wrote.
const AUTO = [
  /^\s*automatic reply\s*:/i, /^\s*auto(matic)?[-\s]?reply\b/i, /^\s*out of (the )?office\b/i,
  /\bout of office\b.*\bre\s*:/i, /^\s*re\s*:\s*out of (the )?office\b/i, /^\s*auto\s*:/i,
  /^\s*undeliverable\s*:/i, /^\s*delivery status notification/i,
  /^\s*(re\s*:\s*)?vacation\b/i, /\bon (annual )?leave\b/i, /\bi am currently (away|out)\b/i,
];
const isAuto = (s) => AUTO.some((r) => r.test(String(s || '')));

// ---------------------------------------------------------------- completion dates
// wfm_completed_* is a bare boolean with no date on it, so a completion from our own July
// testing looks identical to a prospect completing the tool yesterday. Property history is
// the only place the date exists, so ask for it, but only for the contacts that actually
// carry a completion flag: that is a handful of records, not the whole audience.
const COMPLETION_PROPS = ['wfm_completed_health_check', 'wfm_completed_calculator', 'wfm_completed_benchmark'];
const flagged = contacts.filter((c) => COMPLETION_PROPS.some((k) => String(c[k] || '').toLowerCase() === 'true'));
const completedAfterCutoff = new Set();
for (let i = 0; i < flagged.length; i += 50) {
  const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
    method: 'POST', headers: H,
    body: JSON.stringify({ properties: ['email'], propertiesWithHistory: COMPLETION_PROPS, inputs: flagged.slice(i, i + 50).map((c) => ({ id: c.id })) }),
  })).json();
  (b.results || []).forEach((c) => {
    const hist = Object.values(c.propertiesWithHistory || {}).flat();
    const setTrue = hist.filter((h) => String(h.value).toLowerCase() === 'true').map((h) => String(h.timestamp || ''));
    if (setTrue.some((t) => t >= CUTOFF)) completedAfterCutoff.add(c.id);
  });
}
console.log(`completions: ${flagged.length} contacts flagged, ${completedAfterCutoff.size} of them after the ${CUTOFF} cutoff`);

const replies = await pool(contacts, 4, async (c) => {
  const a = await jget(`https://api.hubapi.com/crm/v4/objects/contacts/${c.id}/associations/emails`);
  const eids = (a.results || []).map((x) => x.toObjectId);
  if (!eids.length) return 0;
  let genuine = 0;
  for (let i = 0; i < eids.length; i += 100) {
    const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/emails/batch/read', {
      method: 'POST', headers: H,
      body: JSON.stringify({ properties: ['hs_email_subject', 'hs_email_direction', 'hs_timestamp'], inputs: eids.slice(i, i + 100).map((id) => ({ id })) }),
    })).json();
    (b.results || []).forEach((e) => {
      const pr = e.properties || {};
      // Walking a contact's whole association list reaches back years, so the campaign
      // window matters as much as the auto-reply test does: one prospect's February
      // "not interested" to a manual email briefly looked like the campaign's first reply.
      if (pr.hs_email_direction !== 'INCOMING_EMAIL') return;
      if (String(pr.hs_timestamp || '') < CUTOFF) return;
      if (!isAuto(pr.hs_email_subject)) genuine++;
    });
  }
  return genuine;
});
console.log(`replies: ${replies.filter(Boolean).length} contacts with at least one genuine reply`);

// ---------------------------------------------------------------- heat
// The interaction log is written live by the on-page beacon (src/pages/api/track.js) and by
// the Instantly click webhook, one line per verified action. Distinct days in it are the
// closest thing we have to "a real person came back", and unlike hs_analytics_num_page_views
// it is dated per event rather than being a lifetime cumulative counter.
const dates = (log) => new Set(String(log || '').split('\n')
  .map((l) => (l.match(/\d{4}-\d{2}-\d{2}/) || [])[0]).filter((d) => d && d >= CUTOFF));

// The beacon only started writing that log on 2026-08-31, so on its own it would erase every
// visit that happened earlier in the campaign. hs_analytics_last_timestamp fills the gap, but
// only conservatively: it is a single last-seen moment, not a per-view history (those need the
// web-analytics-api-access scope, which still returns 403), so it can evidence exactly one
// day. Union rather than sum, so a visit already in the log is never counted twice.
const visitDays = (c) => {
  const s = dates(c.volcano_interaction_log);
  const seen = String(c.hs_analytics_last_timestamp || '').slice(0, 10);
  if (seen && seen >= CUTOFF) s.add(seen);
  return s.size;
};
const clicksIn = (log) => (String(log || '').match(/instantly\/link-click/g) || []).length;

// Opens and short-link fetches are deliberately absent from this sum. Measured 2026-09-01
// across 107 openers, 84% of the opens whose timing could be resolved fired within five
// minutes of delivery and none of the 107 clicked anything: that is Apple Mail prefetching,
// Gmail proxying and security appliances scanning, not people reading.
//
// The LinkedIn numbers below are ours to choose. A reply is set at 30 so it matches an email
// reply and lands a contact in Warm on its own; a connection is worth noticing but not
// chasing. Change them here, not in the dashboard, so every consumer agrees.
const LI_HEAT = { sent: 5, accepted: 15, replied: 30 };

const changes = [];
const heatById = {};
for (let i = 0; i < contacts.length; i++) {
  const c = contacts[i];
  const email = (c.email || '').toLowerCase();
  const stage = liStage[email] || null;
  const gr = replies[i] || 0;
  const vv = visitDays(c);
  const completed = completedAfterCutoff.has(c.id);
  // The first verified visit is worth more than an unverified click and lands the contact in
  // Warm on its own: if a real person reached our content, an AE should be looking at them.
  // Repeat visits add less and cap, so one person browsing repeatedly cannot outrank the
  // rest of the pipeline. Completing a tool is a form submission, so it scores like a reply.
  const visitHeat = (vv > 0 ? 25 + Math.min(50, (vv - 1) * 10) : 0) + (completed ? 30 : 0);
  const clicks = clicksIn(c.volcano_interaction_log);
  const heat = isInternal(email) ? 0
    : clicks * 10 + gr * 30 + (stage ? LI_HEAT[stage] : 0) + visitHeat;
  heatById[c.id] = heat;

  const next = {
    volcano_heat: String(heat),
    volcano_email_clicks: String(clicks),
    volcano_verified_visits: String(vv),
    volcano_genuine_reply: gr > 0 ? 'true' : 'false',
    ...(stage ? { volcano_li_stage: stage } : {}),
  };
  // Only write what actually moved. A no-op PATCH still stamps lastmodifieddate, which would
  // make every contact look freshly touched every two hours and ruin any "recently active"
  // view an AE relies on.
  const diff = Object.fromEntries(Object.entries(next).filter(([k, v]) => String(c[k] ?? '') !== v));
  if (Object.keys(diff).length) changes.push({ id: c.id, email, heat, properties: diff });
}

const band = (h) => h >= 100 ? 'Eruption' : h >= 65 ? 'Hot' : h >= 25 ? 'Warm' : 'Cold';
const bands = {};
contacts.forEach((c) => { const b = band(heatById[c.id] || 0); bands[b] = (bands[b] || 0) + 1; });
console.log('\nbands:', JSON.stringify(bands));
console.log(`${COMMIT ? 'WRITING' : 'DRY RUN'}: ${changes.length} contacts changed of ${contacts.length}`);
changes.slice(0, 8).forEach((c) => console.log(`  ${c.email.padEnd(38)} heat ${String(c.heat).padStart(4)}  ${JSON.stringify(c.properties)}`));
if (!COMMIT) { console.log('\nRe-run with --commit to write.'); process.exit(0); }

let ok = 0, fail = 0;
for (let i = 0; i < changes.length; i += 100) {
  const slice = changes.slice(i, i + 100);
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/update', {
    method: 'POST', headers: H,
    body: JSON.stringify({ inputs: slice.map((c) => ({ id: c.id, properties: c.properties })) }),
  });
  if (r.ok) ok += slice.length;
  else { fail++; console.log('  FAILED', r.status, (await r.text()).slice(0, 300)); }
}
console.log(`\ndone: ${ok} contacts updated, ${fail} batches failed`);
