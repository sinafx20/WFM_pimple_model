import fs from 'node:fs';
const env = fs.readFileSync('.env', 'utf8');
const g = (k) => (env.match(new RegExp('^\s*' + k + '\s*=\s*(.+)\s*$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const IK = g('INSTANTLY_API_KEY'), HK = g('HEYREACH_API_KEY'), T = g('HUBSPOT_TOKEN');
const IH = { authorization: `Bearer ${IK}`, 'content-type': 'application/json' };
const HH = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const inS = JSON.parse(fs.readFileSync('harvest-instantly-campaigns.json', 'utf8'));
const hrS = JSON.parse(fs.readFileSync('harvest-campaigns.json', 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ST = { 0: 'draft', 1: 'ACTIVE', 2: 'paused', 3: 'completed' };
let block = 0, warn = 0;
const B = (m) => { block++; console.log('  BLOCKER  ' + m); };
const W = (m) => { warn++; console.log('  warn     ' + m); };
const K = (m) => console.log('  ok       ' + m);

console.log('1. THE THREE SIGNALS YOU ASKED ABOUT');
// opens + clicks are per Instantly campaign; visits depend on the demo link carrying an email
const accounts = ((await (await fetch('https://api.instantly.ai/api/v2/accounts?limit=100', { headers: IH })).json()).items) || [];
const byEmail = Object.fromEntries(accounts.map((a) => [String(a.email).toLowerCase(), a]));
for (const [key, v] of Object.entries(inS)) {
  if (!key.startsWith('AU-')) continue;
  const c = await (await fetch(`https://api.instantly.ai/api/v2/campaigns/${v.id}`, { headers: IH })).json();
  const boxes = c.email_list || [];
  const bad = boxes.filter((m) => { const a = byEmail[m.toLowerCase()]; return !a || a.status !== 1 || a.warmup_status !== 1; });
  const line = `${key.padEnd(12)} opens=${c.open_tracking} clicks=${c.link_tracking} ${boxes.length} mailbox(es) daily=${c.daily_limit}`;
  if (!c.open_tracking) B(`${line}  <- open tracking OFF`);
  else if (!c.link_tracking) B(`${line}  <- link tracking OFF`);
  else if (!boxes.length) B(`${line}  <- no mailbox`);
  else if (bad.length) B(`${line}  <- unhealthy mailbox ${bad.join(', ')}`);
  else K(line);
  if (c.status === 1) B(`${key} is ACTIVE already`);
}

console.log('\n2. READY TO START');
for (const [key, v] of Object.entries(inS)) {
  if (!key.startsWith('AU-')) continue;
  const c = await (await fetch(`https://api.instantly.ai/api/v2/campaigns/${v.id}`, { headers: IH })).json();
  const steps = c.sequences?.[0]?.steps || [];
  const zero = steps.slice(0, -1).filter((s) => !(s.delay >= 1));
  const ph = JSON.stringify(steps).includes('PLACEHOLDER');
  if (zero.length) B(`${key} has a zero gap on step(s) ${zero.map((_, i) => i + 1).join(',')}`);
  else if (ph) B(`${key} still has placeholder copy`);
  else K(`${key.padEnd(12)} ${ST[c.status]}  ${steps.length} steps, delays [${steps.map((s) => s.delay).join(',')}]`);
}
const seats = ((await (await fetch('https://api.heyreach.io/api/public/li_account/GetAll',
  { method: 'POST', headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ offset: 0, limit: 50 }) })).json()).items) || [];
for (const [key, v] of Object.entries(hrS)) {
  if (!key.startsWith('AU-')) continue;
  const c = await (await fetch(`https://api.heyreach.io/api/public/campaign/GetById?campaignId=${v.campaignId}`,
    { headers: { 'X-API-KEY': HK, accept: 'application/json' } })).json();
  const lr = await (await fetch('https://api.heyreach.io/api/public/list/GetLeadsFromList', {
    method: 'POST', headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ listId: v.listId, offset: 0, limit: 1 }) })).json();
  const n = lr.totalCount ?? 0;
  const seat = seats.find((s) => s.id === v.seat);
  const seq = await (await fetch(`https://api.heyreach.io/api/public/campaign/GetCampaignSequence?campaignId=${v.campaignId}`,
    { headers: { 'X-API-KEY': HK, accept: 'application/json' } })).json();
  const line = `${key.padEnd(12)} ${c.status}  ${n} leads in list ${v.listId}  seat ${seat ? (seat.emailAddress || seat.username) : 'MISSING'}`;
  if (!n) B(`${line}  <- empty list: starting an empty HeyReach campaign marks it FINISHED for good`);
  else if (!seat) B(`${line}  <- sending seat gone`);
  else if (JSON.stringify(seq).includes('PLACEHOLDER')) B(`${line}  <- placeholder copy`);
  else K(line);
  await sleep(300);
}

console.log('\n3. AUDIENCE');
const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', { method: 'POST', headers: HH,
  body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: 'volcano_campaign', operator: 'EQ', value: 'harvest-au' }] }],
    properties: ['email', 'volcano_disposition'], limit: 100 }) });
const b = await r.json();
const total = b.total ?? 0;
const RULED = ['not_interested', 'opted_out', 'disqualified', 'bad_fit', 'do_not_contact'];
const ruled = (b.results || []).filter((c) => RULED.includes(String(c.properties.volcano_disposition || '')));
total === 148 ? K(`${total} contacts stamped harvest-au`) : W(`expected 148, found ${total}`);
ruled.length ? B(`${ruled.length} are marked as a no and must come out first`) : K('nobody is marked as a no');

console.log(`\n${'='.repeat(60)}`);
console.log(block ? `${block} BLOCKER(S), ${warn} warning(s)` : `No blockers. ${warn} warning(s).`);
