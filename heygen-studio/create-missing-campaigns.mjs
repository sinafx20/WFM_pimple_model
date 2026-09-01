// One-off: create the two HeyReach campaigns that were never built.
//
// Only 8 of the 10 vertical x AE combinations existed. Before the owner map was
// corrected on 2026-08-29 these contacts were mislabelled and routed to the opposite
// AE's campaign, which did exist, so the gap stayed hidden. Fixing the mapping exposed
// it: 15 pushes failed on 2026-08-31 with "no HeyReach campaign found matching ...".
//
// Campaigns are created as DRAFT on purpose. /api/heyreach/push seeds a DRAFT
// campaign's LIST rather than the campaign itself, which is the required order —
// starting a campaign with an empty list makes HeyReach mark it FINISHED forever.
// Nothing sends until someone presses Start in the HeyReach UI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRealSequence, loadCopy } from './heyreach-real-sequences.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envGet = (k) => {
  if (process.env[k]) return process.env[k];
  const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)\\s*$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};
const HK = envGet('HEYREACH_API_KEY');
const hr = (p, body, method = 'POST') => fetch(`https://api.heyreach.io/api/public${p}`, {
  method, headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

// seat ids verified against the live linkedInAccount records, not the HubSpot owner map
const SEAT = { sina: 221310, denzel: 223029 };
const HS_LIST = { architecture: 3693, construction: 3694, engineering: 3695, consulting: 3696, creative: 3697 };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const MISSING = [
  { vertical: 'creative', owner: 'sina' },
  { vertical: 'engineering', owner: 'denzel' },
];

const MAP_PATH = path.join(__dirname, 'heyreach-real-campaigns.json');
const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
const copy = loadCopy();

for (const { vertical, owner } of MISSING) {
  const key = `${vertical}-${owner}`;
  if (map[key]) { console.log(`${key}: already in the map (campaign ${map[key].campaignId}) — skipping`); continue; }

  const name = `Volcano LI - ${cap(vertical)} - ${cap(owner)}`;
  const listR = await hr('/list/CreateEmptyList', { name: `Volcano LI - ${vertical} - ${owner}` });
  const list = await listR.json();
  if (!list?.id) { console.error(`${key}: list create failed`, JSON.stringify(list).slice(0, 300)); continue; }

  const sequence = buildRealSequence(vertical, cap(owner), copy);
  const campR = await hr('/campaign/Create', {
    name, linkedInUserListId: list.id, linkedInAccountIds: [SEAT[owner]], sequence,
  });
  const camp = await campR.json();
  if (!camp?.campaignId) { console.error(`${key}: campaign create failed`, JSON.stringify(camp).slice(0, 300)); continue; }

  map[key] = { campaignId: camp.campaignId, listId: list.id, vertical, owner, hubspotListId: HS_LIST[vertical] };
  console.log(`${key}: created campaign ${camp.campaignId} "${name}" with list ${list.id}, ${sequence.length} sequence nodes`);
}

fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
console.log('\ncampaign map now covers:', Object.keys(map).sort().join(', '));
