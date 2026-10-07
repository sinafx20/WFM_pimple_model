// Pre-launch check. Everything that could have moved since the campaigns were built, and
// everything that has to be true before 160 real people get a real message.
//
// Read-only. Starts nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const env = fs.readFileSync(p('.env'), 'utf8');
const g = (k) => (env.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+)\\s*$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const T = g('HUBSPOT_TOKEN'), HK = g('HEYREACH_API_KEY'), IK = g('INSTANTLY_API_KEY');
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };

const hrS = JSON.parse(fs.readFileSync(p('harvest-campaigns.json'), 'utf8'));
const inS = JSON.parse(fs.readFileSync(p('harvest-instantly-campaigns.json'), 'utf8'));
const LISTS = { 4012: 'sina/AU', 4006: 'sina/US-West', 4009: 'denzel/AU', 4003: 'denzel/US-West' };
const RULED = ['not_interested', 'opted_out', 'disqualified', 'bad_fit', 'do_not_contact'];

let blockers = 0, warnings = 0;
const block = (m) => { blockers++; console.log('  BLOCKER  ' + m); };
const warn = (m) => { warnings++; console.log('  warn     ' + m); };
const ok = (m) => console.log('  ok       ' + m);

// ---------------------------------------------------------------- 1. the audience
console.log('\n1. AUDIENCE');
const enrolled = [];
for (let after = 0; ;) {
  const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'volcano_campaign', operator: 'EQ', value: 'harvest' }] }],
      properties: ['email', 'hs_linkedin_url', 'hubspot_owner_id', 'volcano_disposition', 'country'],
      limit: 100, after: String(after),
    }),
  })).json();
  (b.results || []).forEach((c) => enrolled.push({ id: c.id, ...c.properties }));
  if (!b.paging?.next?.after) break;
  after = b.paging.next.after;
}
console.log(`  enrolled in harvest: ${enrolled.length}`);
enrolled.length === 160 ? ok('still 160, unchanged') : warn(`was 160, now ${enrolled.length}`);

// Someone marked as a no since the leads were pushed is still sitting in the campaigns.
const ruledNow = enrolled.filter((c) => RULED.includes(String(c.volcano_disposition || '')));
ruledNow.length
  ? block(`${ruledNow.length} enrolled contacts are now marked as a no and must be removed before launch: `
      + ruledNow.slice(0, 5).map((c) => `${c.email || c.id} (${c.volcano_disposition})`).join(', '))
  : ok('nobody enrolled has been marked as a no');

// Has anyone been added to the source lists since enrolment?
let listTotal = 0;
for (const id of Object.keys(LISTS)) {
  const u = new URL(`https://api.hubapi.com/crm/v3/lists/${id}/memberships`);
  u.searchParams.set('limit', '250');
  const b = await (await fetch(u, { headers: H })).json();
  listTotal += (b.results || []).length;
}
console.log(`  source lists hold ${listTotal} contacts (225 at enrolment, 160 of them confirmed Harvest users)`);
listTotal === 225 ? ok('source lists unchanged') : warn(`source lists moved from 225 to ${listTotal}; re-run harvest-enrol.mjs if new people should be included`);

// ---------------------------------------------------------------- 2. HeyReach
console.log('\n2. HEYREACH');
const hr = (path_, body, method = 'POST') => fetch(`https://api.heyreach.io/api/public${path_}`, {
  method, headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
const seats = ((await (await hr('/li_account/GetAll', { offset: 0, limit: 50 })).json()).items) || [];
for (const [key, v] of Object.entries(hrS)) {
  const c = await (await hr(`/campaign/GetById?campaignId=${v.campaignId}`, undefined, 'GET')).json();
  const seat = seats.find((s) => s.id === v.seat);
  const line = `${key.padEnd(15)} ${String(c.status).padEnd(12)} seat ${v.seat} ${seat ? seat.emailAddress || seat.username || '' : 'NOT FOUND'}`;
  if (c.status !== 'DRAFT') block(`${line}  <- expected DRAFT`);
  else if (!seat) block(`${line}  <- the sending seat no longer exists`);
  else ok(line);
}
// Campaigns from the abandoned first structure, which have to go from the UI.
const ORPHANS = [629069, 629070, 629071, 629072, 629073, 629074];
const alive = [];
for (const id of ORPHANS) {
  const c = await (await hr(`/campaign/GetById?campaignId=${id}`, undefined, 'GET')).json().catch(() => null);
  if (c && c.id) alive.push(id);
}
alive.length ? warn(`${alive.length} orphan campaigns still present, delete in the UI: ${alive.join(', ')}`)
             : ok('orphan campaigns are gone');

// ---------------------------------------------------------------- 3. Instantly
console.log('\n3. INSTANTLY');
const IH = { authorization: `Bearer ${IK}`, 'content-type': 'application/json' };
const accounts = ((await (await fetch('https://api.instantly.ai/api/v2/accounts?limit=100', { headers: IH })).json()).items) || [];
const byEmail = Object.fromEntries(accounts.map((a) => [String(a.email).toLowerCase(), a]));
const ST = { 0: 'draft', 1: 'ACTIVE', 2: 'paused', 3: 'completed', 4: 'subsequences' };
for (const [key, v] of Object.entries(inS)) {
  const c = await (await fetch(`https://api.instantly.ai/api/v2/campaigns/${v.id}`, { headers: IH })).json();
  const boxes = c.email_list || [];
  const bad = boxes.filter((m) => { const a = byEmail[m.toLowerCase()]; return !a || a.status !== 1 || a.warmup_status !== 1; });
  const line = `${key.padEnd(15)} ${String(ST[c.status] ?? c.status).padEnd(7)} ${boxes.length} mailboxes, daily ${c.daily_limit}, link_tracking ${c.link_tracking}`;
  if (c.status !== 0) block(`${line}  <- expected draft`);
  else if (!boxes.length) block(`${line}  <- no sending mailbox attached`);
  else if (bad.length) block(`${line}  <- unhealthy mailbox: ${bad.join(', ')}`);
  else if (!c.link_tracking) warn(`${line}  <- link tracking is off`);
  else ok(line);
}

// ---------------------------------------------------------------- 4. copy
console.log('\n4. COPY');
const { copyComplete, hasInmailCopy } = await import('./harvest-sequences.mjs');
const copy = JSON.parse(fs.readFileSync(p('copy-harvest.json'), 'utf8'));
const cc = copyComplete(copy);
cc.ok ? ok('every required step has copy') : block(`missing copy: ${cc.missing.join(', ')}`);
hasInmailCopy(copy) ? ok('InMail arc present, so non-accepters are reached')
                    : warn('no InMail copy: anyone who does not accept gets nothing after the request');
for (const [k, v] of Object.entries(hrS)) {
  const s = await (await hr(`/campaign/GetCampaignSequence?campaignId=${v.campaignId}`, undefined, 'GET')).json();
  const J = JSON.stringify(s);
  if (/PLACEHOLDER/.test(J)) block(`${k} still contains placeholder copy`);
}
if (!blockers) ok('no placeholder copy in any live sequence');

// ---------------------------------------------------------------- verdict
console.log(`\n${'='.repeat(64)}`);
console.log(blockers ? `${blockers} BLOCKER(S) and ${warnings} warning(s). Do not launch yet.`
                     : `No blockers. ${warnings} warning(s) to read before launching.`);
console.log(`${'='.repeat(64)}`);
if (blockers) process.exitCode = 1;
