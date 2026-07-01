// Read-only: owner split on the Volcano list + Denzel avatar/voice availability.
import fs from 'node:fs';
const env = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8');
const TOKEN = (env.match(/HUBSPOT_TOKEN\s*=\s*(.+)/) || [])[1].trim();
const HEYGEN = (env.match(/HEYGEN_API_KEY\s*=\s*(.+)/) || [])[1].trim();
const hs = (p, o = {}) => fetch(`https://api.hubapi.com${p}`, { ...o, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(o.headers || {}) } });
const LIST_ID = 3698;

// 1) owners
const or = await hs('/crm/v3/owners?limit=200');
const owners = (await or.json()).results || [];
const ownerName = {};
owners.forEach(o => ownerName[o.id] = `${o.firstName || ''} ${o.lastName || ''}`.trim() + ` <${o.email}>`);
console.log('Owners matching sina/denzel:');
owners.filter(o => /sina|denzel/i.test(`${o.firstName} ${o.lastName} ${o.email}`)).forEach(o => console.log(`  id ${o.id}  ${o.firstName} ${o.lastName}  ${o.email}`));

// 2) list members -> owner tally
let after, ids = [];
do { const r = await hs(`/crm/v3/lists/${LIST_ID}/memberships?limit=100${after ? `&after=${after}` : ''}`); const b = await r.json(); ids.push(...(b.results || []).map(x => x.recordId)); after = b.paging?.next?.after; } while (after);
const tally = {};
for (let i = 0; i < ids.length; i += 100) {
  const r = await hs('/crm/v3/objects/contacts/batch/read', { method: 'POST', body: JSON.stringify({ properties: ['hubspot_owner_id'], inputs: ids.slice(i, i + 100).map(id => ({ id })) }) });
  (await r.json()).results.forEach(c => { const o = c.properties.hubspot_owner_id || '(none)'; tally[o] = (tally[o] || 0) + 1; });
}
console.log(`\nOwner split across ${ids.length} contacts:`);
Object.entries(tally).sort((a, b) => b[1] - a[1]).forEach(([id, n]) => console.log(`  ${n}  ${ownerName[id] || id}`));

// 3) HeyGen denzel voice + avatar
const vr = await fetch('https://api.heygen.com/v2/voices', { headers: { 'X-Api-Key': HEYGEN, accept: 'application/json' } });
const voices = (await vr.json())?.data?.voices || [];
console.log('\nHeyGen voices matching denzel:');
voices.filter(v => /denzel/i.test(v.name || '')).forEach(v => console.log(`  ${v.voice_id}  ${v.name}`));
const ar = await fetch('https://api.heygen.com/v2/avatars', { headers: { 'X-Api-Key': HEYGEN, accept: 'application/json' } });
const avs = (await ar.json())?.data?.avatars || [];
console.log('HeyGen avatars matching denzel:');
avs.filter(a => /denzel/i.test(a.avatar_name || '')).forEach(a => console.log(`  ${a.avatar_id}  ${a.avatar_name}`));
