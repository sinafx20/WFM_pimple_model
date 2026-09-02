// Creates the four contact properties the live cockpit and the HubSpot routing
// workflows both need. Idempotent: an existing property is left exactly as it is.
//
// WHY THESE EXIST. Until now the heat model lived only as JavaScript inside a published
// dashboard, and LinkedIn activity lived only as timeline Notes. Neither can be queried
// per contact, so the dashboard had to be rebuilt by hand from local JSON and HubSpot
// workflows had nothing to trigger on. Writing the same signals as properties makes
// HubSpot the single source of truth: the page reads them live and a workflow can fire
// on volcano_heat crossing a band boundary.
//
// Group is contactinformation to match the existing volcano_* properties.
//
// Run: node create-volcano-props.mjs           (dry run, shows what is missing)
//      node create-volcano-props.mjs --commit  (creates)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = fs.existsSync(path.join(__dirname, '.env')) ? fs.readFileSync(path.join(__dirname, '.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const T = g('HUBSPOT_TOKEN');
if (!T) { console.error('missing HUBSPOT_TOKEN'); process.exit(1); }
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const COMMIT = process.argv.includes('--commit');

const PROPS = [
  {
    name: 'volcano_li_stage',
    label: 'Volcano LinkedIn stage',
    description: 'Furthest LinkedIn stage reached in the outreach sequence. Written every 2 hours '
      + 'by the HeyReach sync, which polls because HeyReach has no webhooks.',
    type: 'enumeration', fieldType: 'select',
    options: [
      { label: 'Request sent', value: 'sent',     displayOrder: 0 },
      { label: 'Connected',    value: 'accepted', displayOrder: 1 },
      { label: 'Replied',      value: 'replied',  displayOrder: 2 },
    ],
  },
  {
    name: 'volcano_genuine_reply',
    label: 'Volcano genuine reply',
    description: 'True only for a reply a person actually wrote. Instantly counts every inbound '
      + 'message including out-of-office, and the first two replies this campaign recorded were '
      + 'auto-responders, so auto-replies are deliberately excluded from this and from heat.',
    type: 'bool', fieldType: 'booleancheckbox',
    options: [
      { label: 'Yes', value: 'true',  displayOrder: 0 },
      { label: 'No',  value: 'false', displayOrder: 1 },
    ],
  },
  {
    name: 'volcano_verified_visits',
    label: 'Volcano verified visits',
    description: 'Count of distinct dates on or after the 2026-08-26 campaign cutoff on which this '
      + 'contact is evidenced to have visited as a real human. Page views need JavaScript and carry '
      + 'the contact identity, so unlike short-link fetches they are not scanners.',
    type: 'number', fieldType: 'number',
  },
  {
    name: 'volcano_internal',
    label: 'Volcano internal tester',
    description: 'Set by hand for teammates and internal testers who sit in the campaign audience '
      + 'but must never be treated as prospects. Deliberately curated rather than derived: some '
      + 'testers used partner or personal domains that look exactly like a real firm, so no rule '
      + 'catches them. Only ever set to true; a contact without it is a prospect.',
    type: 'bool', fieldType: 'booleancheckbox',
    options: [
      { label: 'Yes', value: 'true',  displayOrder: 0 },
      { label: 'No',  value: 'false', displayOrder: 1 },
    ],
  },
  {
    name: 'volcano_email_clicks',
    label: 'Volcano email clicks',
    description: 'Verified link clicks from the campaign email, reported by the Instantly webhook. '
      + 'Link tracking went on across all 10 campaigns on 2026-08-31, so unlike a short-link fetch '
      + 'this is a real click by a real person. Opens are deliberately not tracked here: measured '
      + 'across 107 openers, none of them clicked anything, which is prefetching rather than reading.',
    type: 'number', fieldType: 'number',
  },
  {
    name: 'volcano_heat',
    label: 'Volcano heat',
    description: 'Engagement score driving the Cold 0-24 / Warm 25-64 / Hot 65-99 / Eruption 100+ '
      + 'bands. Verified clicks, genuine replies, LinkedIn progress and verified visits count; opens '
      + 'and short-link fetches deliberately do not, because measurement showed both are mostly '
      + 'machines. Recomputed every 2 hours.',
    type: 'number', fieldType: 'number',
  },
];

const exists = async (name) =>
  (await fetch(`https://api.hubapi.com/crm/v3/properties/contacts/${name}`, { headers: H })).status === 200;

for (const p of PROPS) {
  if (await exists(p.name)) { console.log(`= ${p.name} already exists, leaving alone`); continue; }
  if (!COMMIT) { console.log(`+ ${p.name} would be created (${p.type}/${p.fieldType})`); continue; }
  const r = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', {
    method: 'POST', headers: H,
    body: JSON.stringify({ ...p, groupName: 'contactinformation', formField: false }),
  });
  console.log(r.ok ? `+ ${p.name} created` : `! ${p.name} FAILED ${r.status} ${(await r.text()).slice(0, 300)}`);
}
