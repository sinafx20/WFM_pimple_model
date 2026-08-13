// Preview what the shortened LinkedIn DM links will actually look like for a contact,
// WITHOUT pushing anything to HeyReach. Read-only: fetches the contact's existing
// volcano_personalization blob from HubSpot, builds each touchpoint URL exactly like
// /api/heyreach/push does, and shortens via TinyURL. Nothing is written anywhere.
//
//   node preview-shortened-links.mjs <hubspotContactId>
//
// The contact must already have volcano_personalization set (i.e. a video has been
// generated + written back for them) — this only previews the link step, it does not
// generate anything.
import fs from 'node:fs';

const HUB = fs.readFileSync('.env', 'utf8').match(/^HUBSPOT_TOKEN=(.+)$/m)[1].trim();
const contactId = process.argv[2];
if (!contactId) { console.error('usage: node preview-shortened-links.mjs <hubspotContactId>'); process.exit(1); }

const r = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,company,volcano_personalization`, {
  headers: { authorization: `Bearer ${HUB}` },
});
const p = (await r.json())?.properties || {};
const blob = p.volcano_personalization || '';
if (!blob) { console.error(`contact ${contactId} (${p.firstname || '?'}) has no volcano_personalization yet — generate + write back a video first.`); process.exit(1); }

console.log(`Previewing for ${p.firstname} @ ${p.company} (contact ${contactId})\n`);

const shorten = async (url) => {
  try { const r = await fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(url)); if (r.ok) { const t = (await r.text()).trim(); if (/^https?:\/\//.test(t)) return t; } } catch {}
  return url;
};
const mk = (tool) => `https://lp.workflowmax.com/app?tool=${tool}&${blob}`;

const TOOLS = [
  ['intro_link', 'intro'], ['health_check_link', 'tp1'], ['calculator_link', 'tp2'],
  ['benchmark_link', 'tp3'], ['demo_link', 'tp4'], ['firms_like_yours_link', 'tp5'], ['resource_hub_link', 'tp6'],
];
for (const [field, tool] of TOOLS) {
  const long = mk(tool);
  const short = await shorten(long);
  console.log(`{${field}}`);
  console.log(`  long:  ${long.length} chars — ${long}`);
  console.log(`  short: ${short}\n`);
}
