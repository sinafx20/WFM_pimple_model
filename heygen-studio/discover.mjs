// Discovery only (no writes, no video). Finds the "Volcano All targets" list,
// reports its size, samples a few contacts, and detects which industry/vertical
// property is populated. Reads HUBSPOT_TOKEN from ./.env.
import fs from 'node:fs';

const env = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8');
const TOKEN = (env.match(/^\s*HUBSPOT_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
if (!TOKEN) { console.error('No HUBSPOT_TOKEN in .env'); process.exit(1); }

const hs = (path, opts = {}) => fetch(`https://api.hubapi.com${path}`, {
  ...opts,
  headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(opts.headers || {}) },
});

// 1) Find the list by name
const listName = 'Volcano All targets';
const sr = await hs('/crm/v3/lists/search', { method: 'POST', body: JSON.stringify({ query: listName, count: 25 }) });
console.log('lists/search ->', sr.status);
const sb = await sr.json();
const lists = sb?.lists || sb?.results || [];
console.log('matches:', lists.map(l => `${l.name} (id ${l.listId}, size ${l.size ?? '?'})`).join(' | ') || JSON.stringify(sb).slice(0, 400));

const list = lists.find(l => l.name?.toLowerCase() === listName.toLowerCase()) || lists[0];
if (!list) { console.log('No list found. Adjust the name.'); process.exit(0); }
console.log(`\nUsing list: ${list.name}  id=${list.listId}  size=${list.size}`);

// 2) First few memberships
const mr = await hs(`/crm/v3/lists/${list.listId}/memberships?limit=5`);
const mb = await mr.json();
const ids = (mb?.results || []).map(r => r.recordId);
console.log('sample member ids:', ids.join(', ') || '(none)');

// 3) Which industry/vertical property exists?
const pr = await hs('/crm/v3/properties/contacts');
const pb = await pr.json();
const cand = (pb?.results || []).filter(p => /vertical|industry|icp|segment/i.test(p.name) || /vertical|industry|icp|segment/i.test(p.label || ''));
console.log('\ncandidate industry/vertical properties:');
cand.forEach(p => console.log(`  ${p.name}  (${p.type}/${p.fieldType})  "${p.label}"  ${p.options?.length ? '[' + p.options.map(o => o.value).join(',') + ']' : ''}`));

// 4) Sample contact values
if (ids.length) {
  const props = ['firstname', 'company', 'email', ...new Set(cand.map(p => p.name))];
  const br = await hs('/crm/v3/objects/contacts/batch/read', { method: 'POST', body: JSON.stringify({ properties: props, inputs: ids.map(id => ({ id })) }) });
  const bb = await br.json();
  console.log('\nsample contacts:');
  (bb?.results || []).forEach(c => {
    const p = c.properties;
    console.log(`  ${c.id}: ${p.firstname || '(no first)'} @ ${p.company || '(no company)'}  ` + cand.map(cp => `${cp.name}=${p[cp.name] || ''}`).join(' '));
  });
}
console.log('\n(Also checking whether volcano_heygen_video_url exists for write-back...)');
const wr = await hs('/crm/v3/properties/contacts/volcano_heygen_video_url');
console.log('volcano_heygen_video_url ->', wr.status === 200 ? 'EXISTS' : `MISSING (${wr.status})`);
