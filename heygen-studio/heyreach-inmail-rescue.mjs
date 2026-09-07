// Builds InMail-only rescue campaigns for the leads whose LinkedIn sequence never ran.
//
// THE PROBLEM. 31 leads failed with ConnectionRequestAlreadySent: a connection request was
// already outstanding to them from outside every HeyReach campaign, LinkedIn refused to queue a
// second one, and the lead stopped at the first node. They received NOTHING on LinkedIn. No
// request, no DM, no InMail. They are still getting email, which is the only reason they are not
// completely dark.
//
// WHY INMAIL. It is the one channel that does not need the connection, which is exactly the
// situation these leads are in: a request they never accepted is already sitting in their inbox.
//
// WHY NO OPEN-PROFILE GATE. The real sequence puts CHECK_IS_OPEN_PROFILE in front of its InMail
// chain and ends the arc when the profile is not open, on the assumption that InMail is only
// usable on open profiles. Both seats show isValidNavigator true, so Sales Navigator credits are
// available and that assumption costs reach. Here the InMail is attempted directly. Some will
// fail with NoInMailPermission and that failure is visible; silently skipping them was not.
//
// EVERYTHING IS CREATED AS DRAFT. Nothing sends until someone presses Start in HeyReach. That is
// the same deliberate pattern create-missing-campaigns.mjs uses, and it matters more here because
// these are real prospects who have already been contacted once.
//
// Run: node heyreach-inmail-rescue.mjs            (dry run, shows what it would build)
//      node heyreach-inmail-rescue.mjs --commit   (creates the drafts and seeds them)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inmailChain, loadCopy } from './heyreach-real-sequences.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const HK = g('HEYREACH_API_KEY');
if (!HK) { console.error('missing HEYREACH_API_KEY'); process.exit(1); }
const COMMIT = process.argv.includes('--commit');
const hr = (path_, body, method = 'POST') => fetch('https://api.heyreach.io/api/public' + path_, {
  method, headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

const SEAT = { sina: 221310, denzel: 223029 };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
// Only this one. The other failure reasons are not fixable by changing channel: a profile that
// does not resolve stays unresolvable, and a lead that could not be matched has no profile to
// InMail. Re-attempting those would just manufacture more failures.
const RESCUABLE = 'ConnectionRequestAlreadySent';

const map = JSON.parse(fs.readFileSync(p('heyreach-real-campaigns.json'), 'utf8'));
const groups = {};
for (const [key, m] of Object.entries(map)) {
  for (let offset = 0; ;) {
    const r = await hr('/campaign/GetLeadsFromCampaign', { campaignId: m.campaignId, offset, limit: 100 });
    if (!r.ok) { console.error(`${key}: HTTP ${r.status}`); break; }
    const b = await r.json();
    const items = b.items || [];
    for (const l of items) {
      if (l.errorCode !== RESCUABLE) continue;
      const pr = l.linkedInUserProfile || {};
      if (!pr.profileUrl) continue;
      (groups[key] ||= { vertical: m.vertical, owner: m.owner, leads: [] }).leads.push({
        profileUrl: pr.profileUrl,
        firstName: pr.firstName || '',
        lastName: pr.lastName || '',
        companyName: pr.companyName || '',
        emailAddress: (pr.emailAddress || pr.enrichedEmailAddress || '').toLowerCase(),
        // Filled in below from HubSpot. GetLeadsFromCampaign returns no customFields at all,
        // not even for leads that ran, so the personalisation cannot be read back off the lead.
        customUserFields: [],
      });
    }
    offset += items.length;
    if (items.length < 100 || offset >= (b.totalCount || 0)) break;
  }
}

// ---------------------------------------------------------------- personalisation
// The InMail copy is written around {company} and a per-touchpoint link. Sending it without
// those fields would put a literal "a 2-minute video for {company}" in front of 31 prospects,
// which the dry run caught before anything went out.
//
// Short links come from the local cache first. These contacts were pushed once already, so their
// links exist; minting new ones would hand the same person two different URLs for the same page
// and split their click data. Only genuinely missing links are created.
const T = g('HUBSPOT_TOKEN');
const HH = { authorization: 'Bearer ' + T, 'content-type': 'application/json' };
// NOTE THE SPELLING. Two properties exist: volcano_personalisation with an s, created by an
// earlier setup and empty on all 356 contacts, and volcano_personalization with a z, which is the
// one server.mjs actually writes and where every blob lives. Reading the wrong one silently
// yields no links, which is exactly what the first dry run of this script did.
const TOOLS = ['intro', 'tp1', 'tp2', 'tp3', 'tp4', 'tp5', 'tp6'];
const FIELD = ['intro_link', 'health_check_link', 'calculator_link', 'benchmark_link', 'demo_link', 'firms_like_yours_link', 'resource_hub_link'];

const cachePath = p('tinyurl-cache.json');
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const domain = g('TINYURL_DOMAIN') || 'tinyurl.com';
const byLong = new Map(Object.entries(cache).map(([code, url]) => [url, 'https://' + domain + '/' + code]));
let reused = 0, minted = 0;
const shorten = async (url) => {
  const hit = byLong.get(url);
  if (hit) { reused++; return hit; }
  const token = g('TINYURL_API_TOKEN');
  if (!token) return url;
  try {
    const r = await fetch('https://api.tinyurl.com/create', {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify(g('TINYURL_DOMAIN') ? { url, domain: g('TINYURL_DOMAIN') } : { url }),
    });
    const b = await r.json().catch(() => null);
    if (r.ok && b?.data?.tiny_url) { minted++; return b.data.tiny_url; }
  } catch {}
  return url;
};

const allLeads = Object.values(groups).flatMap((gp) => gp.leads);
const emails = [...new Set(allLeads.map((l) => l.emailAddress).filter(Boolean))];
const hsByEmail = {};
for (let i = 0; i < emails.length; i += 100) {
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
    method: 'POST', headers: HH,
    body: JSON.stringify({ idProperty: 'email', properties: ['email', 'company', 'volcano_personalization'], inputs: emails.slice(i, i + 100).map((e) => ({ id: e })) }),
  });
  const b = await r.json().catch(() => null);
  (b?.results || []).forEach((c) => { hsByEmail[(c.properties.email || '').toLowerCase()] = c.properties; });
}

let noBlob = 0;
for (const lead of allLeads) {
  const hp = hsByEmail[lead.emailAddress] || {};
  const company = hp.company || lead.companyName || '';
  const blob = hp.volcano_personalization || '';
  if (!blob) { noBlob++; lead.customUserFields = company ? [{ name: 'company', value: company }] : []; continue; }
  const links = await Promise.all(TOOLS.map((t) => shorten('https://lp.workflowmax.com/app?tool=' + t + '&' + blob)));
  lead.customUserFields = [{ name: 'company', value: company }]
    .concat(FIELD.map((n, i) => ({ name: n, value: links[i] })))
    .filter((f) => f.value);
}
console.log('personalisation rebuilt from HubSpot: ' + reused + ' short links reused from cache, ' + minted + ' newly created'
  + (noBlob ? ', ' + noBlob + ' leads have no personalisation blob and get company only' : ''));

const total = Object.values(groups).reduce((a, gp) => a + gp.leads.length, 0);
console.log(`${RESCUABLE}: ${total} leads across ${Object.keys(groups).length} campaigns\n`);
for (const [key, gp] of Object.entries(groups)) {
  const withLinks = gp.leads.filter((l) => (l.customUserFields || []).some((f) => f.name.endsWith('_link'))).length;
  console.log(`  ${key.padEnd(24)} ${String(gp.leads.length).padStart(2)} leads  (${withLinks} with full personalisation)`);
}
if (!total) { console.log('\nnothing to rescue'); process.exit(0); }

if (!COMMIT) {
  const [k0, g0] = Object.entries(groups)[0];
  const copy = loadCopy();
  const seq = inmailChain(g0.vertical, cap(g0.owner), copy);
  console.log(`\nEach campaign gets an InMail-only sequence, three InMails, using that vertical's own copy.`);
  console.log(`Example, ${k0}, first InMail subject:`);
  console.log(`   "${String(seq.payload?.messages?.[0]?.subject || '').slice(0, 90)}"`);
  console.log(`\nSample leads from ${k0}:`);
  g0.leads.slice(0, 3).forEach((l) => console.log(`   ${(l.firstName + ' ' + l.lastName).trim().padEnd(24)} ${String(l.companyName || '').slice(0, 30)}`));
  console.log('\nDRY RUN. Re-run with --commit to create the DRAFT campaigns and seed them.');
  console.log('Nothing sends until someone presses Start in HeyReach.');
  process.exit(0);
}

const copy = loadCopy();
const built = {};
for (const [key, gp] of Object.entries(groups)) {
  const name = `Volcano InMail rescue - ${cap(gp.vertical)} - ${cap(gp.owner)}`;
  const listR = await hr('/list/CreateEmptyList', { name });
  const list = await listR.json().catch(() => null);
  if (!list?.id) { console.error(`${key}: list create failed`, JSON.stringify(list).slice(0, 200)); continue; }

  const campR = await hr('/campaign/Create', {
    name, linkedInUserListId: list.id, linkedInAccountIds: [SEAT[gp.owner]],
    sequence: inmailChain(gp.vertical, cap(gp.owner), copy),
  });
  const camp = await campR.json().catch(() => null);
  if (!camp?.campaignId) { console.error(`${key}: campaign create failed`, JSON.stringify(camp).slice(0, 200)); continue; }

  // Seed the LIST, not the campaign. AddLeadsToCampaignV2 only works on a running campaign, and
  // starting a campaign with an empty list makes HeyReach mark it FINISHED forever.
  let seeded = 0, failed = 0;
  for (const lead of gp.leads) {
    const r = await hr('/list/AddLeadsToListV2', { listId: list.id, leads: [lead] });
    if (r.ok) seeded++; else { failed++; if (failed <= 2) console.error(`   seed failed ${r.status}: ${(await r.text()).slice(0, 140)}`); }
  }
  built[key] = { campaignId: camp.campaignId, listId: list.id, vertical: gp.vertical, owner: gp.owner, seeded };
  console.log(`${key}: campaign ${camp.campaignId} "${name}" seeded ${seeded}/${gp.leads.length}${failed ? ` (${failed} failed)` : ''}`);
}

fs.writeFileSync(p('heyreach-inmail-rescue.json'), JSON.stringify(built, null, 2));
console.log('\nwrote heyreach-inmail-rescue.json');
console.log('All campaigns are DRAFT. Press Start on each in HeyReach to send.');
