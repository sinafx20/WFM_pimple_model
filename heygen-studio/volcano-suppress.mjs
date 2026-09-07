// Stops contacting the people who told us to stop.
//
// THE GAP THIS CLOSES. Ruling a contact out of the volcano zeroed their heat and took them off
// the chart, which fixed the dashboard and nothing else. Three contacts who had explicitly
// declined were still sitting at status 1 in a live Instantly campaign, queued for the next
// send, and hs_email_optout was false on every one of them including the person who wrote
// "Unsubscribe me". A score is not a suppression.
//
// THE THREE CASES ARE NOT THE SAME, and treating them identically is the mistake to avoid:
//
//   opted_out       A legal obligation, not a preference. Stop every channel, set the HubSpot
//                   opt-out so no marketing email can reach them either, and never re-enter
//                   them into any audience. Under the Spam Act this must be honoured within 5
//                   working days and it binds the whole organisation, not one campaign.
//
//   not_interested  They said no to this, now. Stop the sequence, because continuing after a no
//                   is what makes people report you as spam. Keep them in the CRM with their
//                   peak heat recorded so long-tail nurture can pick them up later. Do NOT set
//                   the HubSpot opt-out: they declined an offer, they did not withdraw consent,
//                   and conflating the two throws away a contact you are allowed to talk to.
//
//   disqualified    Wrong ICP, established by a human. Stop the sequence and keep them out of
//                   future audience builds, but this is our judgement about fit, not their
//                   wish, so again no opt-out flag.
//
// Run: node volcano-suppress.mjs            (dry run)
//      node volcano-suppress.mjs --commit   (acts)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const T = g('HUBSPOT_TOKEN'), IK = g('INSTANTLY_API_KEY'), HK = g('HEYREACH_API_KEY');
if (!T) { console.error('missing HUBSPOT_TOKEN'); process.exit(1); }
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const IH = { authorization: `Bearer ${IK}`, 'content-type': 'application/json' };
const COMMIT = process.argv.includes('--commit');

const RULED = ['opted_out', 'not_interested', 'disqualified'];
// Only a withdrawal of consent sets the CRM opt-out. See the header for why the other two must
// not: they are a "no thanks" and a "not our market", neither of which is a legal opt-out.
const OPTOUT_DISPOSITIONS = ['opted_out'];

const search = await (await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
  method: 'POST', headers: H,
  body: JSON.stringify({
    filterGroups: [{ filters: [{ propertyName: 'volcano_disposition', operator: 'IN', values: RULED }] }],
    properties: ['email', 'firstname', 'lastname', 'company', 'volcano_disposition',
      'volcano_disposition_note', 'volcano_peak_heat', 'hs_email_optout', 'volcano_suppressed_at'],
    limit: 100,
  }),
})).json();
const ruled = (search.results || []).map((c) => ({ id: c.id, ...c.properties }));
console.log(`ruled out in HubSpot: ${ruled.length}\n`);

const plan = [];
for (const c of ruled) {
  const email = String(c.email || '').toLowerCase();
  if (!email) continue;
  const actions = [];

  // still queued to be emailed?
  let leads = [];
  if (IK) {
    const l = await (await fetch('https://api.instantly.ai/api/v2/leads/list', {
      method: 'POST', headers: IH, body: JSON.stringify({ search: email, limit: 10 }),
    })).json();
    leads = (l.items || []).filter((x) => String(x.email || '').toLowerCase() === email);
  }
  // status 1 is active in sequence. Anything else has already stopped of its own accord.
  const active = leads.filter((x) => Number(x.status) === 1);
  if (active.length) actions.push({ kind: 'instantly-remove', leads: active });

  if (OPTOUT_DISPOSITIONS.includes(c.volcano_disposition) && String(c.hs_email_optout) !== 'true') {
    actions.push({ kind: 'hubspot-optout' });
  }
  if (!c.volcano_suppressed_at) actions.push({ kind: 'stamp' });

  plan.push({ c, email, actions, leads });
  const name = `${c.firstname || ''} ${c.lastname || ''}`.trim() || email;
  console.log(`${name.padEnd(22)} ${String(c.volcano_disposition).padEnd(15)} peak ${String(c.volcano_peak_heat || 0).padStart(3)}`);
  console.log(`   ${email}`);
  console.log(`   instantly: ${leads.length ? leads.map((x) => 'status ' + x.status).join(', ') : 'not in any campaign'}`
    + `   hubspot optout: ${c.hs_email_optout || 'false'}`);
  if (!actions.length) console.log('   nothing to do');
  else actions.forEach((a) => console.log('   -> ' + (
    a.kind === 'instantly-remove' ? `remove from ${a.leads.length} live Instantly campaign(s), stopping further sends`
      : a.kind === 'hubspot-optout' ? 'set hs_email_optout, so no HubSpot marketing email can reach them either'
      : 'stamp volcano_suppressed_at so this is not repeated')));
  console.log('');
}

const failures = [];
const toDo = plan.filter((x) => x.actions.length);
if (!toDo.length) { console.log('everyone ruled out is already suppressed'); process.exit(0); }

if (!COMMIT) {
  console.log(`DRY RUN. ${toDo.length} contact(s) need action. Re-run with --commit.`);
  console.log('Removing an Instantly lead deletes it from that campaign and cannot be undone;');
  console.log('their engagement history is already on the HubSpot timeline, so nothing is lost.');
  process.exit(0);
}

for (const item of toDo) {
  for (const a of item.actions) {
    if (a.kind === 'instantly-remove') {
      for (const lead of a.leads) {
        // No content-type on a bodyless DELETE. Sending application/json with an empty body
        // makes Instantly reject it with FST_ERR_CTP_EMPTY_JSON_BODY.
        const r = await fetch('https://api.instantly.ai/api/v2/leads/' + lead.id, {
          method: 'DELETE', headers: { authorization: 'Bearer ' + IK },
        });
        if (!r.ok) failures.push(`${item.email}: instantly remove ${r.status} ${(await r.text()).slice(0, 120)}`);
        console.log(`${item.email}: instantly remove ${lead.id} -> ${r.status}${r.ok ? '' : '  FAILED'}`);
      }
    }
    if (a.kind === 'hubspot-optout') {
      // hs_email_optout is READ ONLY and HubSpot rejects a PATCH of it outright. A real opt-out
      // goes through the subscriptions API, which sets it portal-wide across every subscription
      // type rather than flipping one property on one record.
      const r = await fetch('https://api.hubapi.com/email/public/v1/subscriptions/' + encodeURIComponent(item.email), {
        method: 'PUT', headers: H, body: JSON.stringify({ unsubscribeFromAll: true }),
      });
      if (!r.ok) failures.push(`${item.email}: hubspot unsubscribe ${r.status} ${(await r.text()).slice(0, 120)}`);
      console.log(`${item.email}: hubspot unsubscribe -> ${r.status}${r.ok ? '' : '  FAILED'}`);
    }
  }
  // A note on the record, because the next person to open it should see that we stopped and why,
  // without having to infer it from an absence of activity.
  const why = item.c.volcano_disposition_note || item.c.volcano_disposition;
  await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date().toISOString(),
        hs_note_body: `Volcano outreach stopped. Disposition: ${item.c.volcano_disposition}.\n${why}\n`
          + `${item.actions.map((a) => a.kind).join(', ')}\n[volcano:suppressed:${item.c.id}]`,
      },
      associations: [{ to: { id: item.c.id }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
    }),
  }).catch(() => {});
  // Only stamp when nothing failed for this contact, so a retry still picks them up rather
  // than the record claiming it was handled.
  if (!failures.some((f) => f.startsWith(item.email))) {
    await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${item.c.id}`, {
      method: 'PATCH', headers: H,
      body: JSON.stringify({ properties: { volcano_suppressed_at: new Date().toISOString() } }),
    });
  }
}

if (failures.length) {
  // The first version of this printed "done: 6 contacts suppressed" while every call had
  // returned 400. Reporting a suppression that did not happen is worse than failing loudly,
  // because nobody goes back to check on a success.
  console.error(`\nFAILED on ${failures.length} action(s):`);
  failures.forEach((f) => console.error('  ' + f));
  process.exitCode = 1;
} else {
  console.log(`\ndone: ${toDo.length} contact(s) suppressed, no failures`);
}
