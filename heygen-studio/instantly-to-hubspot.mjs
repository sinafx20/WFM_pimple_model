// Logs Instantly campaign emails onto the HubSpot contact timeline.
//
// WHY: Instantly sends from our own custom domains (teamworkflowmax.com and friends),
// so HubSpot never sees those messages. A prospect who has had four campaign emails
// shows an empty timeline, which makes the AE look uninformed on a call and makes
// activity reporting understate what the pipeline actually did.
//
// WHAT IT WRITES: one HubSpot email engagement per Instantly message, associated to the
// contact, owned by whichever AE actually sent it (read from the sending address, never
// assumed). Direction EMAIL, status SENT, with the real subject and body.
//
// SAFETY:
//  - Dry run by default. Pass --commit to actually write.
//  - A ledger (instantly-hubspot-ledger.json) records every Instantly message id already
//    synced, so re-running never duplicates a timeline entry.
//  - Contacts that do not exist in HubSpot are skipped and reported, not created.
//
// Run: node instantly-to-hubspot.mjs            (dry run, shows what would happen)
//      node instantly-to-hubspot.mjs --commit   (writes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { instantlyCampaigns } from './campaign-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const env = fs.readFileSync(p('.env'), 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const K = g('INSTANTLY_API_KEY'), T = g('HUBSPOT_TOKEN');
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const COMMIT = process.argv.includes('--commit');

// Sending address decides the owner. Verified 2026-08-29 against real senders; do not
// infer ownership from vertical, which was the bug that mis-assigned 153 contacts.
// 'sina' | 'denzel' as the registry derives them from a campaign name, to the HubSpot owner id.
const OWNER_ID = { sina: '80406430', denzel: '80127259' };

const OWNER_BY_SENDER = (from) => {
  const local = String(from || '').split('@')[0].toLowerCase();
  if (local.startsWith('sina')) return '80406430';
  if (local.startsWith('denzel')) return '80127259';
  return null;
};

// Our own sending domains. Anything arriving from another domain is the prospect
// replying, not us sending, and must be logged INCOMING or the timeline reads as though
// we emailed ourselves and the reply disappears from reporting.
const OUR_DOMAINS = /@(cloud|team)?workflowmax.com$/i;
const isOutbound = (m) => OUR_DOMAINS.test(String(m.from_address_email || ''));
// On an inbound reply the AE is whoever it was sent TO.
// Outbound: the sending mailbox names the AE. Inbound: the mailbox it was sent TO does, but
// Instantly does not always populate to_address_email_list on a reply, which left six replies
// owned by nobody. The campaign the reply belongs to is the fallback, since a reply to a
// campaign is a reply to whoever runs it. AE_BY_CAMPAIGN is the name-derived owner carried on
// each message as `ae`; a campaign naming no AE still yields null, which is honest.
const ownerOf = (m) => (isOutbound(m)
  ? OWNER_BY_SENDER(m.from_address_email)
  : OWNER_BY_SENDER(String(m.to_address_email_list || '').split(',')[0]))
  || OWNER_ID[m.ae] || null;

// HOW FAR BACK TO GO.
//
// The Volcano MVP emails from September are deliberately NOT backfilled. Sina's call on
// 2026-10-22: those contacts have been worked already and filling their timelines with dozens
// of backdated emails buys nothing, while the campaigns that matter are the ones running now.
//
// A DATE, NOT A LIST OF CAMPAIGNS, because the requirement is "everything from here every time
// I set up a campaign". A campaign list would need editing every time one is created, which is
// the maintenance burden that left Harvest invisible for a month in the first place. A cutoff
// needs nothing: anything sent after it syncs, whoever made the campaign and whenever.
//
// It also means a still-running older campaign keeps reporting. daf00323 is an ACTIVE Volcano
// campaign, and its NEW sends are current activity worth seeing even though its history is not.
//
// 9 October is chosen, not rounded: Harvest APAC sent on the 8th, Harvest AU on the 19th and
// 20th, AIA Brisbane on the 21st. Sina asked for AU and AIA only, and that date is the one
// boundary that separates them from the APAC batch without naming a single campaign.
//
// Override for a one-off backfill with SYNC_FROM=2026-01-01.
const SYNC_FROM = new Date(process.env.SYNC_FROM || '2026-10-09T00:00:00Z');

const LEDGER = p('instantly-hubspot-ledger.json');
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { synced: {} };

// Every campaign Instantly has, not the five verticals a file recorded months ago. Harvest,
// Harvest AU and AIA Brisbane were all missing from that file, so their emails never reached a
// timeline and the script still exited reporting success.
const discovered = await instantlyCampaigns(K);
console.log(`campaigns discovered: ${discovered.length}`);

// Instantly allows 20 requests a minute and answers 429 past that. Left unthrottled this
// pulls ~40 pages in seconds, gets refused, and — before this was added — reported
// "0 messages found" as though the campaigns were empty. Never let a rate limit look
// like an absence of data.
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let lastCall = 0;
async function instantly(url) {
  const wait = 3200 - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  for (let attempt = 1; attempt <= 5; attempt++) {
    lastCall = Date.now();
    const r = await fetch(url, { headers: { authorization: `Bearer ${K}`, accept: 'application/json' } });
    if (r.ok) return r.json();
    if (r.status === 429) {
      const back = 15000 * attempt;
      console.log(`  rate limited, waiting ${back / 1000}s (attempt ${attempt}/5)`);
      await sleep(back);
      continue;
    }
    // 5xx is transient here. Discovery multiplied the number of campaigns this walks from 10
    // to 20 and Instantly began returning the occasional 500, which aborted the entire sync
    // over one bad response; every campaign answered fine when retried. Still throws once the
    // attempts are spent, because a persistent 500 is a real fault and must not read as
    // "no messages".
    if (r.status >= 500) {
      const back = 4000 * attempt;
      console.log(`  Instantly ${r.status}, retrying in ${back / 1000}s (attempt ${attempt}/5)`);
      await sleep(back);
      continue;
    }
    throw new Error(`Instantly ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  throw new Error('Instantly kept failing after 5 attempts (429 or 5xx)');
}

// --- pull every message ---
const msgs = [];
// One campaign that will not answer must not stop the other nineteen from reaching a
// timeline, but it must not pass silently either: a sync that skips a campaign and still
// prints success is exactly how Harvest went unnoticed for weeks. Failures are collected,
// named, and turned into a non-zero exit at the end.
const failedCampaigns = [];
// PAGE SIZE IS ADAPTIVE. "Volcano MVP - Consulting - Sina" answers 500 at limit=100 and 200 at
// limit=25, every time, so this is a page-size fault on Instantly's side and not a wobble:
// retrying the same request could never have worked. Each campaign starts at 100 and halves
// after a failed pass, which costs nothing for the campaigns that are fine.
for (const c of discovered) {
  let got = false;
  for (const limit of [100, 50, 25, 10]) {
    const batch = [];
    let cur = null;
    try {
      do {
        const u = `https://api.instantly.ai/api/v2/emails?campaign_id=${c.id}&limit=${limit}`
          + (cur ? `&starting_after=${cur}` : '');
        const b = await instantly(u);
        (b.items || []).forEach(e => batch.push({ ...e, vert: c.name, ae: c.owner }));
        cur = b.next_starting_after || null;
      } while (cur);
    } catch (e) {
      console.error(`  ! ${c.name} at limit=${limit}: ${e.message.slice(0, 90)}`);
      continue;   // same campaign, smaller page
    }
    // Only commit the campaign's messages once a pass completed, so a partial read never
    // looks like the whole campaign and leaves half its emails off the timeline for good.
    msgs.push(...batch);
    if (limit !== 100) console.log(`  ${c.name}: read at limit=${limit} (${batch.length} messages)`);
    got = true;
    break;
  }
  if (!got) failedCampaigns.push(c.name);
}
if (failedCampaigns.length) console.error(`
${failedCampaigns.length} campaign(s) could not be read: ${failedCampaigns.join(', ')}`);
console.log('Instantly messages found:', msgs.length);
// A genuine zero here would mean every campaign is empty, which contradicts the lead
// counts. Treat it as a fault rather than quietly syncing nothing.
if (!msgs.length) { console.error('No messages returned. That is almost certainly an API fault, not an empty pipeline. Aborting.'); process.exit(1); }

// --- what is already on a timeline -------------------------------------------------------
//
// THE LEDGER IS A CACHE, NOT THE TRUTH. instantly-hubspot-ledger.json is gitignored, so a
// GitHub runner starts with an empty one and would happily rewrite every message it has ever
// written: within a day a contact would carry the same email a dozen times. It also
// under-reports locally, because runs whose ledger was lost still wrote real engagements. It
// knew about 384 of 2601 while most of the Volcano emails were already in HubSpot.
//
// So the real check is HubSpot itself, the same principle heyreach-to-hubspot already uses.
// Each email we write carries hs_email_message_id, Instantly's own id for that message, and
// that property is exactly searchable. State lives where the writes do.
const dated = (m) => new Date(m.timestamp_email || m.timestamp_created || 0);
const tooOld = msgs.filter(m => dated(m) < SYNC_FROM);
const inWindow = msgs.filter(m => dated(m) >= SYNC_FROM);
console.log(`cutoff ${SYNC_FROM.toISOString().slice(0, 10)}: ${inWindow.length} in window, ${tooOld.length} older and left alone`);
const ledgerKnown = inWindow.filter(m => ledger.synced[m.id]).length;
const candidates = inWindow.filter(m => !ledger.synced[m.id]);

const already = new Set();
const withKey = candidates.filter(m => m.message_id);
const noKey = candidates.filter(m => !m.message_id);
for (let i = 0; i < withKey.length; i += 100) {
  const values = withKey.slice(i, i + 100).map(m => String(m.message_id));
  let b = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const r = await fetch('https://api.hubapi.com/crm/v3/objects/emails/search', {
      method: 'POST', headers: H,
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'hs_email_message_id', operator: 'IN', values }] }],
        properties: ['hs_email_message_id'], limit: 100,
      }),
    });
    if (r.status === 429) { await sleep(2000 * attempt); continue; }
    b = await r.json();
    break;
  }
  // A failed lookup must stop the run. Treating it as "nothing found" is what turns a
  // transient error into a timeline full of duplicates.
  if (!b || b.status === 'error') {
    console.error(`REFUSING: could not check HubSpot for existing emails: ${b?.message || 'no response'}`);
    console.error('Writing blind here duplicates every message already on a timeline.');
    process.exit(1);
  }
  (b.results || []).forEach(e => already.add(String(e.properties.hs_email_message_id)));
  await sleep(250);
}
const pending = candidates.filter(m => !m.message_id || !already.has(String(m.message_id)));
console.log(`already synced: ${ledgerKnown} known to the local ledger, `
  + `${already.size} more already on a HubSpot timeline`);
if (noKey.length) console.log(`  ${noKey.length} message(s) carry no message_id and cannot be checked; they are treated as new`);
console.log('to sync:', pending.length);
// Which campaigns that actually is. Asserting "only the new ones" is worth nothing next to
// printing them, and this is the last checkpoint before real timeline writes.
const perCampaign = {};
pending.forEach((m) => { perCampaign[m.vert] = (perCampaign[m.vert] || 0) + 1; });
Object.entries(perCampaign).sort((a, b) => b[1] - a[1])
  .forEach(([name, n]) => console.log(`    ${String(n).padStart(5)}  ${name}`));
if (!pending.length) { console.log('\nNothing to do.'); process.exit(0); }

// --- resolve contacts by email ---
const emails = [...new Set(pending.map(m => (m.lead || '').toLowerCase()).filter(Boolean))];
const byEmail = {};
// Associating the email to the company as well as the contact is what puts it on the COMPANY
// timeline, which is the view that matters once several people at one firm are being worked.
const companyOf = {};
for (let i = 0; i < emails.length; i += 100) {
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
    method: 'POST', headers: H,
    body: JSON.stringify({ idProperty: 'email', properties: ['email', 'associatedcompanyid'], inputs: emails.slice(i, i + 100).map(e => ({ id: e })) }),
  });
  const b = await r.json();
  (b.results || []).forEach(c => {
    byEmail[(c.properties.email || '').toLowerCase()] = c.id;
    if (c.properties.associatedcompanyid) companyOf[c.id] = String(c.properties.associatedcompanyid);
  });
}
const missing = emails.filter(e => !byEmail[e]);
console.log('contacts resolved:', Object.keys(byEmail).length, '| not in HubSpot:', missing.length);
if (missing.length) missing.slice(0, 8).forEach(e => console.log('   skip (no contact):', e));

const bodyText = (b) => {
  if (!b) return '';
  if (typeof b === 'string') return b;
  return b.text || String(b.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

const work = pending.filter(m => byEmail[(m.lead || '').toLowerCase()]);
const inbound = work.filter(m => !isOutbound(m));
console.log('outbound:', work.length - inbound.length, '| inbound replies:', inbound.length);
inbound.forEach(m => console.log('   reply from', m.from_address_email, '->', m.to_address_email_list, '| owner', ownerOf(m) || 'UNKNOWN'));
const noOwner = work.filter(m => !ownerOf(m));
if (noOwner.length) console.log('NO OWNER RESOLVED on', noOwner.length, 'messages');

console.log(`\n${COMMIT ? 'WRITING' : 'DRY RUN'} ${work.length} timeline emails`);
const bySender = {};
work.forEach(m => { bySender[m.from_address_email] = (bySender[m.from_address_email] || 0) + 1; });
Object.entries(bySender).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`  ${String(n).padStart(4)}  from ${s}  -> owner ${OWNER_BY_SENDER(s) || 'UNKNOWN'}`));

if (!COMMIT) {
  const s = work[0];
  console.log('\nexample of what would be written:');
  console.log('  to      :', s.lead);
  console.log('  from    :', s.from_address_email);
  console.log('  when    :', s.timestamp_email || s.timestamp_created);
  console.log('  subject :', s.subject);
  console.log('  body    :', bodyText(s.body).slice(0, 120) + '...');
  console.log('\nRe-run with --commit to write these to HubSpot.');
  process.exit(0);
}

let ok = 0, fail = 0;
for (const m of work) {
  const contactId = byEmail[(m.lead || '').toLowerCase()];
  const owner = ownerOf(m);
  const props = {
    hs_timestamp: new Date(m.timestamp_email || m.timestamp_created).toISOString(),
    hs_email_direction: isOutbound(m) ? 'EMAIL' : 'INCOMING_EMAIL',
    hs_email_status: 'SENT',
    hs_email_subject: m.subject || '(no subject)',
    hs_email_text: bodyText(m.body).slice(0, 65000),
    hs_email_from_email: m.from_address_email,
    hs_email_to_email: m.lead,
    // Stamp the Instantly message id so the live webhook can recognise a message this
    // backfill already logged. Without it the two mechanisms would both write the same
    // email onto a timeline, which is the duplicate failure we hit on HeyReach today.
    ...(m.message_id ? { hs_email_message_id: String(m.message_id) } : {}),
    ...(owner ? { hubspot_owner_id: owner } : {}),
  };
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/emails', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      properties: props,
      associations: [
        { to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }] },
        // 186 is email -> company. Omitted when the contact has no company rather than failing
        // the write, which would lose the contact timeline entry over a missing association.
        ...(companyOf[contactId]
          ? [{ to: { id: companyOf[contactId] }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 186 }] }]
          : []),
      ],
    }),
  });
  if (r.ok) {
    const b = await r.json();
    ledger.synced[m.id] = { hubspotEmailId: b.id, contactId, at: new Date().toISOString() };
    ok++;
    if (ok % 25 === 0) { fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1)); console.log('  ...', ok, 'written'); }
  } else {
    fail++;
    if (fail <= 3) console.log('  FAILED', r.status, (await r.text()).slice(0, 200));
  }
}
fs.writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));
console.log(`\ndone: ${ok} written, ${fail} failed. Ledger has ${Object.keys(ledger.synced).length} synced messages.`);
// A campaign that could not be read at all is a bigger problem than a message that failed to
// write, and it has to surface as a red run rather than a line nobody scrolls back to.
if (failedCampaigns.length) {
  console.error(`${failedCampaigns.length} campaign(s) were skipped entirely: ${failedCampaigns.join(', ')}`);
  process.exitCode = 1;
}
