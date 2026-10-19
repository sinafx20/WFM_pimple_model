// Prepares the Australia launch audience for the cockpit.
//
//   node harvest-au-stamp.mjs            dry run
//   node harvest-au-stamp.mjs --commit   writes
//
// TWO FIXES, both needed before the volcano can show this campaign at all.
//
// 1. THE COMPANY NAME. The cockpit groups by association id but LABELS each company from the
//    contact's `company` property, and 148 of these 150 contacts have it blank: the name lives
//    on the company record, which the page never fetches. Rather than teach the page a second
//    HubSpot round trip through an MCP tool this session cannot test, the name is copied onto
//    the contact, which is what that standard property is for.
//
// 2. THE CAMPAIGN STAMP. The rollup and the cockpit both select on volcano_campaign. 52 of
//    these contacts carry nothing at all, so they are invisible to both no matter which toggle
//    is chosen. They are stamped harvest-au, which is deliberately its own value rather than
//    reusing `harvest`: that one holds the paused APAC and US-West audience, and merging the
//    two would make it impossible to read the live launch on its own.
//
// Anyone already stamped `volcano` keeps it unless --restamp is passed. A contact can be in the
// AU company list and still belong to the earlier campaign, and silently moving them rewrites
// history that the Volcano numbers still depend on.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const env = fs.readFileSync(p('.env'), 'utf8');
const g = (k) => (env.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+)\\s*$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');
const H = { authorization: `Bearer ${g('HUBSPOT_TOKEN')}`, 'content-type': 'application/json' };

const COMMIT = process.argv.includes('--commit');
const RESTAMP = process.argv.includes('--restamp');
const LIST = 4111;
const CAMPAIGN = 'harvest-au';
const OWNER_OF = { 80406430: 'sina', 80127259: 'denzel' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Every read retries a 429 and throws on anything else. A partial read here would quietly
// stamp a fraction of the audience and report success.
async function hs(url, init, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, { headers: H, ...init });
    if (r.status === 429) { await sleep(1200 * (i + 1)); continue; }
    const b = await r.json().catch(() => null);
    if (!r.ok || b?.status === 'error') throw new Error(`HTTP ${r.status} ${String(url).slice(0, 60)} :: ${b?.message || ''}`);
    return b;
  }
  throw new Error('rate limited after ' + tries + ' tries');
}

// ---- companies in the list, with their real names
const companyIds = [];
for (let after = 0; ;) {
  const u = new URL(`https://api.hubapi.com/crm/v3/lists/${LIST}/memberships`);
  u.searchParams.set('limit', '250');
  if (after) u.searchParams.set('after', String(after));
  const b = await hs(u.toString());
  (b.results || []).forEach((m) => companyIds.push(String(m.recordId)));
  if (!b.paging?.next?.after) break;
  after = b.paging.next.after;
  await sleep(150);
}
const nameOf = new Map();
for (let i = 0; i < companyIds.length; i += 100) {
  const b = await hs('https://api.hubapi.com/crm/v3/objects/companies/batch/read', {
    method: 'POST',
    body: JSON.stringify({ inputs: companyIds.slice(i, i + 100).map((id) => ({ id })), properties: ['name', 'domain'] }),
  });
  for (const c of b.results || []) nameOf.set(String(c.id), c.properties.name || c.properties.domain || '');
  await sleep(200);
}
const unnamed = companyIds.filter((id) => !nameOf.get(id));
console.log(`list ${LIST}: ${companyIds.length} companies, ${unnamed.length} with no name or domain`);

// ---- their contacts
const assoc = new Map();
for (let i = 0; i < companyIds.length; i += 10) {
  const b = await hs('https://api.hubapi.com/crm/v4/associations/companies/contacts/batch/read', {
    method: 'POST', body: JSON.stringify({ inputs: companyIds.slice(i, i + 10).map((id) => ({ id })) }),
  });
  for (const r of b.results || []) for (const t of r.to || []) assoc.set(String(t.toObjectId), String(r.from.id));
  await sleep(220);
}
const ids = [...assoc.keys()];
const contacts = [];
for (let i = 0; i < ids.length; i += 100) {
  const b = await hs('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
    method: 'POST',
    body: JSON.stringify({ inputs: ids.slice(i, i + 100).map((id) => ({ id })),
      properties: ['email', 'company', 'volcano_campaign', 'hubspot_owner_id'] }),
  });
  (b.results || []).forEach((c) => contacts.push({ id: c.id, ...c.properties }));
  await sleep(200);
}
const owned = contacts.filter((c) => OWNER_OF[c.hubspot_owner_id]);
console.log(`${contacts.length} contacts associated, ${owned.length} owned by Sina or Denzel`);
console.log(`companies that actually have a contact: ${new Set(owned.map((c) => assoc.get(c.id))).size}`);

// ---- what would change
const updates = [];
for (const c of owned) {
  const props = {};
  const realName = nameOf.get(assoc.get(c.id)) || '';
  if (realName && String(c.company || '').trim() !== realName) props.company = realName;
  const camp = String(c.volcano_campaign || '');
  if (camp !== CAMPAIGN && (RESTAMP || camp === '' || camp === 'harvest')) props.volcano_campaign = CAMPAIGN;
  if (Object.keys(props).length) updates.push({ id: c.id, properties: props });
}
const named = updates.filter((u) => u.properties.company).length;
const stamped = updates.filter((u) => u.properties.volcano_campaign).length;
const keptVolcano = owned.filter((c) => String(c.volcano_campaign || '') === 'volcano').length;
console.log(`\nwould set a company name on ${named} contacts`);
console.log(`would stamp volcano_campaign=${CAMPAIGN} on ${stamped}`);
console.log(`${keptVolcano} stay on the volcano campaign (pass --restamp to move them too)`);
console.log(`${updates.length} contacts need a write in total`);

if (!COMMIT) { console.log('\nDRY RUN. Re-run with --commit to write.'); process.exit(0); }

let ok = 0;
for (let i = 0; i < updates.length; i += 100) {
  const b = await hs('https://api.hubapi.com/crm/v3/objects/contacts/batch/update', {
    method: 'POST', body: JSON.stringify({ inputs: updates.slice(i, i + 100) }),
  });
  ok += (b.results || []).length;
  console.log(`  updated ${ok}/${updates.length}`);
  await sleep(300);
}
console.log(`\n${ok} contacts updated.`);
console.log('The cockpit reads volcano_campaign, so add harvest-au to its campaign selector.');
