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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const env = fs.readFileSync(p('.env'), 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const K = g('INSTANTLY_API_KEY'), T = g('HUBSPOT_TOKEN');
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const COMMIT = process.argv.includes('--commit');

// Sending address decides the owner. Verified 2026-08-29 against real senders; do not
// infer ownership from vertical, which was the bug that mis-assigned 153 contacts.
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
const ownerOf = (m) => isOutbound(m)
  ? OWNER_BY_SENDER(m.from_address_email)
  : OWNER_BY_SENDER(String(m.to_address_email_list || '').split(',')[0]);

const LEDGER = p('instantly-hubspot-ledger.json');
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : { synced: {} };

const map = JSON.parse(fs.readFileSync(p('instantly-real-campaigns.json'), 'utf8'));

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
    throw new Error(`Instantly ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  throw new Error('Instantly still rate limiting after 5 attempts');
}

// --- pull every message ---
const msgs = [];
for (const [vert, byAe] of Object.entries(map)) {
  for (const [ae, id] of Object.entries(byAe)) {
    let cur = null;
    do {
      const u = `https://api.instantly.ai/api/v2/emails?campaign_id=${id}&limit=100` + (cur ? `&starting_after=${cur}` : '');
      const b = await instantly(u);
      (b.items || []).forEach(e => msgs.push({ ...e, vert, ae }));
      cur = b.next_starting_after || null;
    } while (cur);
  }
}
console.log('Instantly messages found:', msgs.length);
// A genuine zero here would mean every campaign is empty, which contradicts the lead
// counts. Treat it as a fault rather than quietly syncing nothing.
if (!msgs.length) { console.error('No messages returned. That is almost certainly an API fault, not an empty pipeline. Aborting.'); process.exit(1); }

const pending = msgs.filter(m => !ledger.synced[m.id]);
console.log('already synced:', msgs.length - pending.length, '| to sync:', pending.length);
if (!pending.length) { console.log('\nNothing to do.'); process.exit(0); }

// --- resolve contacts by email ---
const emails = [...new Set(pending.map(m => (m.lead || '').toLowerCase()).filter(Boolean))];
const byEmail = {};
for (let i = 0; i < emails.length; i += 100) {
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
    method: 'POST', headers: H,
    body: JSON.stringify({ idProperty: 'email', properties: ['email'], inputs: emails.slice(i, i + 100).map(e => ({ id: e })) }),
  });
  const b = await r.json();
  (b.results || []).forEach(c => { byEmail[(c.properties.email || '').toLowerCase()] = c.id; });
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
    body: JSON.stringify({ properties: props, associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 198 }] }] }),
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
