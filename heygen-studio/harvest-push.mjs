// Pushes the enrolled Harvest contacts into their campaigns on both channels.
//
//   node harvest-push.mjs            dry run: who goes where, and what would be sent
//   node harvest-push.mjs --commit   actually pushes
//   node harvest-push.mjs --only=heyreach|instantly   one channel at a time
//
// ROUTING is region x owner, read from the contact, never from the list it came from: list 3997
// was named for one AE and held three. Region comes from `country`, owner from
// hubspot_owner_id, and a contact whose owner is not Sina or Denzel stops the run.
//
// WHAT IT SUPPLIES. {demo_link} is the only live merge field in the copy and it carries the
// contact's email so the landing-page visit is attributed (src/layouts/Layout.astro skips
// tracking entirely without an email parameter). The whole URL is built here per contact rather
// than assembled from a template on the platform, because a half-resolved URL is worse than a
// plain one: in HeyReach a missing merge field triggers the fallback and the message loses its
// walkthrough link altogether.
//
// HEYREACH CAMPAIGNS ARE DRAFT, so leads are seeded into each campaign's LIST rather than the
// campaign. AddLeadsToCampaignV2 only works on a running campaign, and starting a campaign with
// an empty list makes HeyReach mark it FINISHED for good. Seeding the list works in any state,
// and pressing Start then enrols everyone in it.
//
// SAFETY. Dry run by default. Anyone marked not_interested/opted_out is skipped even though
// enrolment already excluded them, because a disposition can land between the two runs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoLinkFor, BOOKING } from './harvest-tokens.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const T = g('HUBSPOT_TOKEN'), HK = g('HEYREACH_API_KEY'), IK = g('INSTANTLY_API_KEY');
if (!T) { console.error('missing HUBSPOT_TOKEN'); process.exit(1); }
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const COMMIT = process.argv.includes('--commit');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;

const OWNER_OF = { '80406430': 'sina', '80127259': 'denzel' };
const APAC = ['Australia', 'New Zealand', 'Singapore'];
const regionOf = (c) => (APAC.includes(String(c.country || '')) ? 'APAC' : 'US-West');
const RULED = ['not_interested', 'opted_out', 'disqualified', 'bad_fit', 'do_not_contact'];

const hrCamps = JSON.parse(fs.readFileSync(p('harvest-campaigns.json'), 'utf8'));
const inCamps = JSON.parse(fs.readFileSync(p('harvest-instantly-campaigns.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(url, opts = {}, label = '') {
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, opts);
    if (r.status === 429) { await sleep(2000 * (i + 1)); continue; }
    const b = await r.json().catch(() => null);
    if (r.status >= 300) throw new Error(`${label} HTTP ${r.status}: ${JSON.stringify(b).slice(0, 220)}`);
    return b;
  }
  throw new Error(`${label}: rate limited after 5 attempts`);
}

// ---------------------------------------------------------------- audience
const READ = ['email', 'firstname', 'lastname', 'company', 'jobtitle', 'country',
  'hs_linkedin_url', 'hubspot_owner_id', 'volcano_campaign', 'volcano_disposition'];
const contacts = [];
for (let after = 0; ;) {
  const b = await api('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'volcano_campaign', operator: 'EQ', value: 'harvest' }] }],
      properties: READ, limit: 100, after: String(after),
    }),
  }, 'contact search');
  (b.results || []).forEach((c) => contacts.push({ id: c.id, ...c.properties }));
  if (!b.paging?.next?.after) break;
  after = b.paging.next.after;
}
console.log(`enrolled in harvest: ${contacts.length} contacts`);
if (!contacts.length) {
  console.error('Nobody is enrolled yet. Run: node harvest-enrol.mjs --commit');
  process.exit(1);
}

const stray = contacts.filter((c) => !OWNER_OF[c.hubspot_owner_id]);
if (stray.length) {
  console.error(`REFUSING: ${stray.length} contacts are owned by someone other than Sina or Denzel.`);
  stray.slice(0, 5).forEach((c) => console.error(`   ${c.email || c.id} owner ${c.hubspot_owner_id}`));
  process.exit(1);
}
const ruled = contacts.filter((c) => RULED.includes(String(c.volcano_disposition || '')));
const live = contacts.filter((c) => !RULED.includes(String(c.volcano_disposition || '')));
if (ruled.length) console.log(`skipping ${ruled.length} marked as a no since enrolment`);

// ---------------------------------------------------------------- plan
const plan = {};
for (const c of live) {
  const owner = OWNER_OF[c.hubspot_owner_id];
  const key = `${regionOf(c)}-${owner}`;
  (plan[key] = plan[key] || []).push({ ...c, _owner: owner, _key: key });
}
console.log('\ncampaign            contacts  linkedin  email  tracked');
for (const [key, list] of Object.entries(plan).sort()) {
  const li = list.filter((c) => String(c.hs_linkedin_url || '').trim()).length;
  const em = list.filter((c) => String(c.email || '').trim()).length;
  console.log(`  ${key.padEnd(18)} ${String(list.length).padStart(6)} ${String(li).padStart(9)} ${String(em).padStart(6)} ${String(em).padStart(8)}`);
}
const noEmail = live.filter((c) => !String(c.email || '').trim()).length;
if (noEmail) console.log(`\n${noEmail} contacts have no email: they get a working demo link, but the visit cannot be attributed.`);

console.log('\nexample demo link:');
const sample = live.find((c) => c.email);
if (sample) console.log('  ' + demoLinkFor(OWNER_OF[sample.hubspot_owner_id], sample.email));

if (!COMMIT) { console.log('\nDRY RUN. Re-run with --commit to push.'); process.exit(0); }

// ---------------------------------------------------------------- push
const results = { heyreach: { ok: 0, skip: 0, fail: 0 }, instantly: { ok: 0, skip: 0, fail: 0 } };
const failures = [];

const hr = (path_, body) => fetch(`https://api.heyreach.io/api/public${path_}`, {
  method: 'POST', headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

for (const [key, list] of Object.entries(plan).sort()) {
  const owner = list[0]._owner;

  // ---- HeyReach: seed the campaign's list
  if (ONLY !== 'instantly') {
    const camp = hrCamps[key];
    if (!camp?.listId) { console.error(`! ${key}: no HeyReach list in harvest-campaigns.json`); }
    else {
      for (const c of list) {
        if (!String(c.hs_linkedin_url || '').trim()) { results.heyreach.skip++; continue; }
        const lead = {
          profileUrl: c.hs_linkedin_url,
          firstName: c.firstname || '', lastName: c.lastname || '',
          companyName: c.company || '', emailAddress: (c.email || '').toLowerCase(),
          customUserFields: [{ name: 'demo_link', value: demoLinkFor(owner, c.email) }],
        };
        try {
          const r = await hr('/list/AddLeadsToListV2', { listId: camp.listId, leads: [lead] });
          if (r.status >= 300) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`);
          results.heyreach.ok++;
        } catch (e) { results.heyreach.fail++; failures.push(`HR ${c.email || c.id}: ${e.message}`); }
        await sleep(120);
      }
      console.log(`HeyReach ${key}: seeded into list ${camp.listId}`);
    }
  }

  // ---- Instantly: create the lead with its merge variables
  if (ONLY !== 'heyreach') {
    const camp = inCamps[key];
    if (!camp?.id) { console.error(`! ${key}: no Instantly campaign in harvest-instantly-campaigns.json`); }
    else {
      for (const c of list) {
        if (!String(c.email || '').trim()) { results.instantly.skip++; continue; }
        const body = {
          campaign: camp.id,
          email: c.email.toLowerCase(),
          first_name: c.firstname || '',
          last_name: c.lastname || '',
          company_name: c.company || '',
          custom_variables: { demo_link: demoLinkFor(owner, c.email), campaign: 'harvest' },
        };
        try {
          const r = await fetch('https://api.instantly.ai/api/v2/leads', {
            method: 'POST', headers: { authorization: `Bearer ${IK}`, 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (r.status >= 300) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 150)}`);
          results.instantly.ok++;
        } catch (e) { results.instantly.fail++; failures.push(`IN ${c.email}: ${e.message}`); }
        await sleep(120);
      }
      console.log(`Instantly ${key}: leads created in ${camp.id}`);
    }
  }
}

console.log(`\nHeyReach : ${results.heyreach.ok} pushed, ${results.heyreach.skip} skipped (no LinkedIn URL), ${results.heyreach.fail} failed`);
console.log(`Instantly: ${results.instantly.ok} pushed, ${results.instantly.skip} skipped (no email), ${results.instantly.fail} failed`);
if (failures.length) {
  console.error(`\n${failures.length} failures:`);
  failures.slice(0, 20).forEach((f) => console.error('  ' + f));
  process.exitCode = 1;
}
console.log('\nHeyReach campaigns are DRAFT and leads sit in their lists; pressing Start enrols them.');
console.log('Instantly campaigns are draft; they send nothing until launched.');
