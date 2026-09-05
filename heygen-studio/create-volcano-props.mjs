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
    name: 'volcano_disposition',
    label: 'Volcano disposition',
    description: 'Why a contact is out of play, when they are. Ruled-out dispositions zero the heat '
      + 'and remove the contact from the volcano entirely, because a prospect who asked us to stop, '
      + 'or who an AE has established is not a fit, should never sit in a queue of people to chase. '
      + 'Set by hand by an AE, or automatically for opt-out language. A value set by a person is '
      + 'never overwritten by the rollup.',
    type: 'enumeration', fieldType: 'select',
    options: [
      { label: 'Engaged',           value: 'engaged',        displayOrder: 0 },
      { label: 'Not interested',    value: 'not_interested', displayOrder: 1 },
      { label: 'Asked to opt out',  value: 'opted_out',      displayOrder: 2 },
      { label: 'Disqualified',      value: 'disqualified',   displayOrder: 3 },
    ],
  },
  {
    name: 'volcano_disposition_note',
    label: 'Volcano disposition reason',
    description: 'Why, in a sentence. Matters most for Disqualified, where the reason is something '
      + 'only the AE who spoke to them knows and no signal can recover.',
    type: 'string', fieldType: 'text',
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
    name: 'volcano_inmail_track',
    label: 'Volcano on InMail track',
    description: 'True when the sequence has moved this prospect onto the InMail fallback arc: the '
      + 'connection request was sent, never accepted, and HeyReach reports messaging started. InMail '
      + 'is the only way to reach someone who has not connected, so this is the cohort the fallback '
      + 'exists for.',
    type: 'bool', fieldType: 'booleancheckbox',
    options: [
      { label: 'Yes', value: 'true',  displayOrder: 0 },
      { label: 'No',  value: 'false', displayOrder: 1 },
    ],
  },
  {
    name: 'volcano_inmail_sent',
    label: 'Volcano InMails delivered',
    description: 'Count of messages to this prospect that LinkedIn actually recorded as an InMail. '
      + 'Separate from the track flag on purpose: being on the InMail arc is not the same as an '
      + 'InMail having been delivered, and the gap between the two is the thing worth watching.',
    type: 'number', fieldType: 'number',
  },
  {
    name: 'volcano_emails_sent',
    label: 'Volcano campaign emails sent',
    description: 'Outbound campaign emails on this contact timeline since the 2026-08-26 cutoff. '
      + 'Counted from the engagements the Instantly webhook writes, so it reflects what actually '
      + 'reached HubSpot rather than what the sequence intended to send.',
    type: 'number', fieldType: 'number',
  },
  {
    name: 'volcano_li_messages',
    label: 'Volcano LinkedIn messages sent',
    description: 'Outbound LinkedIn messages sent to this prospect, counted from the HeyReach inbox. '
      + 'Separate from the connection request, which is not a message.',
    type: 'number', fieldType: 'number',
  },
  {
    name: 'volcano_email_opens',
    label: 'Volcano email opens (all)',
    description: 'Every open Instantly reports, machines included. Kept alongside the genuine count '
      + 'so the dashboard can show what the raw number would have claimed next to what survives '
      + 'scrutiny. Counting began 2026-09-02, when the email_opened subscription was added.',
    type: 'number', fieldType: 'number',
  },
  {
    name: 'volcano_genuine_opens',
    label: 'Volcano genuine opens',
    description: 'Opens that arrived more than 30 minutes after the send, counted at most once '
      + 'per day. Opens inside the delivery burst are excluded: measured across 107 openers, 84% '
      + 'of resolvable opens fired within five minutes and none of them clicked anything, which is '
      + 'image prefetching and scanning rather than reading.',
    type: 'number', fieldType: 'number',
  },
  {
    name: 'volcano_last_send_at',
    label: 'Volcano last campaign send',
    description: 'When the most recent campaign email went out. Exists so a later open can be '
      + 'measured against it; without a known send there is no way to tell a person from a proxy.',
    type: 'datetime', fieldType: 'date',
  },
  {
    name: 'volcano_last_open_at',
    label: 'Volcano last counted open',
    description: 'Timestamp of the most recent open that counted, used to keep it to one per day '
      + 'so one person re-opening a thread cannot inflate the score.',
    type: 'datetime', fieldType: 'date',
  },
  {
    name: 'volcano_peak_heat',
    label: 'Volcano peak heat',
    description: 'The highest heat this contact has ever reached. Only ever climbs. Heat itself is a '
      + 'current reading with no memory, so when someone cools the fact they were ever Hot vanishes; '
      + 'this is what lets the volcano answer "who has ever been in this band" and what travels with '
      + 'a contact into nurture so a lead who reached 60 and went quiet stays distinguishable from '
      + 'one who never moved.',
    type: 'number', fieldType: 'number',
  },
  {
    name: 'volcano_peak_band',
    label: 'Volcano peak band',
    description: 'The band volcano_peak_heat falls in. Stored rather than derived so it can be used '
      + 'directly in a list, a workflow trigger or a report without recomputing thresholds in three '
      + 'places.',
    type: 'enumeration', fieldType: 'select',
    options: [
      { label: 'Cold',     value: 'cold',     displayOrder: 0 },
      { label: 'Warm',     value: 'warm',     displayOrder: 1 },
      { label: 'Hot',      value: 'hot',      displayOrder: 2 },
      { label: 'Eruption', value: 'eruption', displayOrder: 3 },
    ],
  },
  {
    name: 'volcano_first_warm_at',
    label: 'Volcano first reached Warm',
    description: 'When this contact first crossed 25. Set once and never moved, so the ever-reached '
      + 'view can be scoped to a period instead of all time, which it will need as the campaign ages.',
    type: 'datetime', fieldType: 'date',
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
