// Creates the 8 real vertical x owner HeyReach campaigns for the Volcano cold run and
// (as a separate, explicit step) seeds each with its HubSpot contacts.
//
//   node heyreach-seed-real-campaigns.mjs create            -> create all campaigns whose
//                                                                sender seat is known (DRAFT, sequence attached)
//   node heyreach-seed-real-campaigns.mjs seed <key>         -> seed one campaign's leads
//                                                                (key = e.g. "architecture-sina")
//   node heyreach-seed-real-campaigns.mjs seed all           -> seed every already-created campaign
//
// Campaigns are created in DRAFT and NEVER started/resumed by this script — that is a
// separate, explicit decision after Sina reviews copy and the 20-contact test results.
//
// Lead seeding reuses the existing /api/heyreach/push endpoint in server.mjs (HubSpot
// lookup + TinyURL shortening + list-vs-campaign-add routing) via the local studio server
// (must be running: `node server.mjs`, http://localhost:5178) rather than duplicating that
// logic here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRealSequence } from './heyreach-real-sequences.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const HR = (env.match(/^HEYREACH_API_KEY=(.+)$/m) || [])[1]?.trim();
const HUB = (env.match(/^HUBSPOT_TOKEN=(.+)$/m) || [])[1]?.trim();
if (!HR || !HUB) { console.error('missing HEYREACH_API_KEY or HUBSPOT_TOKEN in .env'); process.exit(1); }

const hr = (p, body) => fetch(`https://api.heyreach.io/api/public${p}`, {
  method: 'POST', headers: { 'X-API-KEY': HR, 'content-type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

// owner ids confirmed from real HubSpot contact data on list 3698, 2026-07-09
const OWNER = { sina: '80406430', denzel: '80127259' }; // verified 2026-08-29 via email senders
// Sina's HeyReach seat. Denzel's seat is not connected yet -> his 4 campaigns are
// defined here but `sender: null` blocks `create` from running them until it exists.
// Denzel's seat connected 2026-07-09 (li_account/GetAll -> id 223029, denzel.kereama@workflowmax.com).
const SEAT = { sina: 221310, denzel: 223029 };

// hubspotListId = the VolcanoV1_<vertical> list (source of truth for audience membership).
// Previously had 2 "stray" contacts (1 Architecture contact under a third owner id, 1
// Denzel-owned Engineering contact with no matching Denzel campaign) folded into Sina's
// campaign via foldStray. Resolved 2026-07-10 by reassigning both contacts to Sina in
// HubSpot directly (owner=presenter=sender now consistent with no special-casing needed) —
// see MARK_EDEN (197698832812) and LEIGH_SQUARCI (203044887138) in HubSpot for history.
export const CAMPAIGNS = {
  'architecture-sina':   { vertical: 'architecture', owner: 'sina',   hubspotListId: 3693 },
  'architecture-denzel': { vertical: 'architecture', owner: 'denzel', hubspotListId: 3693 },
  'construction-sina':   { vertical: 'construction', owner: 'sina',   hubspotListId: 3694 },
  'construction-denzel': { vertical: 'construction', owner: 'denzel', hubspotListId: 3694 },
  'consulting-sina':     { vertical: 'consulting',   owner: 'sina',   hubspotListId: 3696 },
  'consulting-denzel':   { vertical: 'consulting',   owner: 'denzel', hubspotListId: 3696 },
  'creative-denzel':     { vertical: 'creative',     owner: 'denzel', hubspotListId: 3697 },
  'engineering-sina':    { vertical: 'engineering',  owner: 'sina',   hubspotListId: 3695 },
};

const campaignName = (key) => {
  const c = CAMPAIGNS[key];
  const label = c.vertical[0].toUpperCase() + c.vertical.slice(1);
  const owner = c.owner[0].toUpperCase() + c.owner.slice(1);
  return `Volcano LI - ${label} - ${owner}`;
};

// State file so `seed` can find campaign ids created by `create` without re-querying.
const STATE_PATH = path.join(__dirname, 'heyreach-real-campaigns.json');
const loadState = () => (fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : {});
const saveState = (s) => fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));

async function createOne(key) {
  const c = CAMPAIGNS[key];
  const seat = SEAT[c.owner];
  if (!seat) { console.log(`SKIP ${key}: no HeyReach seat for ${c.owner} yet`); return null; }

  const listR = await hr('/list/CreateEmptyList', { name: `Volcano LI - ${c.vertical} - ${c.owner}` });
  const list = await listR.json();
  if (!list?.id) { console.log(`FAILED to create list for ${key}:`, JSON.stringify(list).slice(0, 200)); return null; }

  const sequence = buildRealSequence(c.vertical, c.owner === 'sina' ? 'Sina' : 'Denzel');
  const createR = await hr('/campaign/Create', {
    name: campaignName(key),
    linkedInUserListId: list.id,
    linkedInAccountIds: [seat],
    sequence,
  });
  const camp = await createR.json();
  if (!camp?.campaignId) { console.log(`FAILED to create campaign ${key}:`, JSON.stringify(camp).slice(0, 300)); return null; }

  console.log(`created ${key}: campaignId=${camp.campaignId} listId=${list.id}`);
  return { campaignId: camp.campaignId, listId: list.id, ...c };
}

async function create() {
  const state = loadState();
  for (const key of Object.keys(CAMPAIGNS)) {
    if (state[key]?.campaignId) { console.log(`already created ${key} (campaignId=${state[key].campaignId}), skipping`); continue; }
    const result = await createOne(key);
    if (result) state[key] = result;
    saveState(state);
  }
}

// Pull the vertical's HubSpot list, filter to this campaign's owner, push each contact
// with a LinkedIn URL through the local studio's existing /api/heyreach/push.
async function seedOne(key) {
  const state = loadState();
  const entry = state[key];
  if (!entry?.campaignId) { console.log(`${key}: not created yet, run 'create' first`); return; }
  const c = CAMPAIGNS[key];
  const hsb = (p) => fetch(`https://api.hubapi.com${p}`, { headers: { authorization: `Bearer ${HUB}` } });

  let after, ids = [];
  do {
    const r = await hsb(`/crm/v3/lists/${c.hubspotListId}/memberships?limit=100${after ? `&after=${after}` : ''}`);
    const b = await r.json();
    ids.push(...(b.results || []).map(x => x.recordId));
    after = b.paging?.next?.after;
  } while (after);

  const targetOwner = OWNER[c.owner];
  const contacts = [];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
      method: 'POST', headers: { authorization: `Bearer ${HUB}`, 'content-type': 'application/json' },
      body: JSON.stringify({ properties: ['hubspot_owner_id', 'hs_linkedin_url', 'firstname', 'email'], inputs: ids.slice(i, i + 100).map(id => ({ id })) }),
    });
    (await r.json()).results?.forEach(x => contacts.push(x));
  }

  const toSeed = contacts.filter(x => x.properties.hubspot_owner_id === targetOwner);
  const noLinkedIn = toSeed.filter(x => !x.properties.hs_linkedin_url);
  const withLinkedIn = toSeed.filter(x => x.properties.hs_linkedin_url);

  console.log(`${key}: ${toSeed.length} contacts, ${withLinkedIn.length} have LinkedIn URL, ${noLinkedIn.length} skipped (no LinkedIn URL)`);

  let ok = 0, fail = 0;
  for (const contact of withLinkedIn) {
    const r = await fetch('http://localhost:5178/api/heyreach/push', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contactId: contact.id, campaignId: entry.campaignId }),
    });
    const b = await r.json().catch(() => null);
    if (b?.ok) ok++; else { fail++; console.log(`  FAILED ${contact.properties.email}: ${b?.error || r.status}`); }
  }
  console.log(`${key}: seeded ${ok}, failed ${fail}`);
}

const [, , cmd, arg] = process.argv;
if (cmd === 'create') await create();
else if (cmd === 'seed' && arg === 'all') { for (const key of Object.keys(CAMPAIGNS)) await seedOne(key); }
else if (cmd === 'seed' && arg) await seedOne(arg);
else { console.log('usage: node heyreach-seed-real-campaigns.mjs create | seed <key> | seed all'); process.exit(1); }
