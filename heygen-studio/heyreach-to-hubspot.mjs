// Writes LinkedIn outreach onto the HubSpot contact timeline as Notes.
//
// COVERS: connection requests sent, connections accepted, and the messages themselves in
// both directions. The messages were invisible for a while because the campaign endpoint
// only reports a leadMessageStatus flag; the actual conversation lives behind
// /inbox/GetConversationsV2, which returns each message with its own timestamp and body.
//
// WHY: HubSpot only ever saw the accepted connections, and only then because a reply
// created something to look at. An AE opening a record could not tell whether we had
// even approached someone on LinkedIn. Connection requests sent are the majority of the
// activity and were invisible.
//
// WHY NOTES: HubSpot has no native object for a LinkedIn touch. Notes sit chronologically
// in the same column as emails, so the record reads as one story rather than an email
// timeline with a separate LinkedIn story living in HeyReach.
//
// WHY POLLING: HeyReach has no webhooks. Three endpoint shapes were probed on 2026-09-01
// and all returned 404, so unlike Instantly this cannot push to us. That is also why this
// belongs in GitHub Actions rather than on a laptop, which sleeps: the 7am scheduled task
// has missed 4 of the last 5 weekdays.
//
// IDEMPOTENCY: state lives in HubSpot, not in a local ledger, because a scheduled runner
// starts from a clean checkout every time. Each note carries a marker like
// [volcano:li-sent:<leadId>] and we read the contact's existing notes before writing.
//
// Run: node heyreach-to-hubspot.mjs            (dry run)
//      node heyreach-to-hubspot.mjs --commit   (writes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();

const HK = g('HEYREACH_API_KEY');
const T = g('HUBSPOT_TOKEN');
if (!HK || !T) { console.error('missing HEYREACH_API_KEY or HUBSPOT_TOKEN'); process.exit(1); }
const COMMIT = process.argv.includes('--commit');
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const hr = (path_, body) => fetch('https://api.heyreach.io/api/public' + path_, {
  method: 'POST', headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const OWNER = { sina: '80406430', denzel: '80127259' };
const map = JSON.parse(fs.readFileSync(p('heyreach-real-campaigns.json'), 'utf8'));

// --- pull every lead across the real campaigns ---
const leads = [];
for (const [key, m] of Object.entries(map)) {
  let offset = 0;
  for (;;) {
    const r = await hr('/campaign/GetLeadsFromCampaign', { campaignId: m.campaignId, offset, limit: 100 });
    if (!r.ok) { console.error(`${key}: HTTP ${r.status}`); break; }
    const b = await r.json();
    const items = b.items || [];
    items.forEach(l => leads.push({ ...l, key, owner: m.owner }));
    offset += items.length;
    if (items.length < 100 || offset >= (b.totalCount || 0)) break;
  }
}
if (!leads.length) { console.error('no leads returned from HeyReach - treat as a fault, not an empty pipeline'); process.exit(1); }
console.log('leads across all campaigns:', leads.length);

// what is worth putting on a timeline
const EVENTS = [
  { kind: 'li-sent', when: (l) => ['ConnectionSent', 'ConnectionAccepted'].includes(l.leadConnectionStatus),
    text: (l) => `LinkedIn connection request sent by ${l.linkedInSenderFullName || 'the AE'}.` },
  { kind: 'li-accepted', when: (l) => l.leadConnectionStatus === 'ConnectionAccepted',
    text: (l) => `LinkedIn connection accepted. ${l.linkedInSenderFullName || 'The AE'} is now connected.` },
];

const wanted = [];
for (const l of leads) {
  const email = (l.linkedInUserProfile?.emailAddress || l.linkedInUserProfile?.enrichedEmailAddress || '').toLowerCase();
  if (!email) continue;
  for (const e of EVENTS) if (e.when(l)) wanted.push({ email, leadId: l.id, kind: e.kind, text: e.text(l), at: l.lastActionTime, owner: l.owner, campaign: l.key, profile: l.linkedInUserProfile?.profileUrl });
}
// --- LinkedIn messages, from the inbox rather than the campaign ---
// The campaign endpoint only says leadMessageStatus: 'MessageSent', one flag per lead no
// matter how many messages went out, and with no timestamp or text. The inbox has the real
// thing. 218 outbound messages and 24 inbound replies existed before this ran, none of them
// on any timeline: an AE opening a record could see we connected and nothing we then said.
//
// The inbox is the SEAT's inbox, not the campaign's, so it also holds the AE's own personal
// LinkedIn conversations. Those must never be written onto a prospect record, which is why
// a conversation only counts when its profile URL matches a lead in one of our campaigns.
// About a third do not match, and that is the safeguard working, not a failure.
const SEATS = { 221310: 'sina', 223029: 'denzel' };
const emailByProfile = {};
for (const l of leads) {
  const pr = l.linkedInUserProfile || {};
  const em = (pr.emailAddress || pr.enrichedEmailAddress || '').toLowerCase();
  if (em && pr.profileUrl) emailByProfile[pr.profileUrl] = em;
}

const conversations = [];
for (let offset = 0; ;) {
  const r = await fetch('https://api.heyreach.io/api/public/inbox/GetConversationsV2', {
    method: 'POST', headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ filters: {}, offset, limit: 50 }),
  });
  if (!r.ok) { console.error('inbox: HTTP ' + r.status + ' - messages will be missing from this run'); break; }
  const b = await r.json();
  const items = b.items || [];
  conversations.push(...items);
  offset += items.length;
  if (items.length < 50 || offset >= (b.totalCount || 0)) break;
}

let convMatched = 0, convSkipped = 0;
for (const c of conversations) {
  const pr = c.correspondentProfile || {};
  const email = emailByProfile[pr.profileUrl];
  if (!email) { convSkipped++; continue; }
  convMatched++;
  const owner = SEATS[c.linkedInAccountId] || null;
  for (const m of c.messages || []) {
    const at = m.createdAt;
    const ms = new Date(at).getTime();
    if (!Number.isFinite(ms)) continue;
    const mine = m.sender === 'ME';
    const text = String(m.body || '').replace(/\s+/g, ' ').trim();
    const excerpt = text.length > 600 ? text.slice(0, 600) + '...' : text;
    // Outbound stays under the li- prefix, which is what the cockpit's activity chart counts
    // as our LinkedIn outreach. An inbound reply is the prospect acting, not AE activity, so
    // it is deliberately named differently and stays out of that series.
    wanted.push({
      email,
      leadId: ms,
      kind: mine ? 'li-msg' : 'in-reply',
      text: mine
        ? (m.isInMail ? 'InMail sent' : 'LinkedIn message sent')
          + ' by ' + (c.linkedInAccount?.firstName ? c.linkedInAccount.firstName + ' ' + (c.linkedInAccount.lastName || '') : 'the AE').trim()
          + '.' + (m.subject ? '\nSubject: ' + m.subject : '') + (excerpt ? '\n\n' + excerpt : '')
        : 'LinkedIn reply received.' + (excerpt ? '\n\n' + excerpt : ''),
      at,
      owner,
      campaign: 'linkedin-inbox',
      profile: pr.profileUrl,
    });
  }
}
console.log('conversations:', conversations.length, '| matched to campaign leads:', convMatched,
  '| skipped as not ours:', convSkipped);

console.log('timeline-worthy events:', wanted.length,
  '| requests sent:', wanted.filter(w => w.kind === 'li-sent').length,
  '| accepted:', wanted.filter(w => w.kind === 'li-accepted').length,
  '| messages out:', wanted.filter(w => w.kind === 'li-msg').length,
  '| replies in:', wanted.filter(w => w.kind === 'in-reply').length);

// --- resolve contacts ---
const emails = [...new Set(wanted.map(w => w.email))];
const byEmail = {};
for (let i = 0; i < emails.length; i += 100) {
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
    method: 'POST', headers: H,
    body: JSON.stringify({ idProperty: 'email', properties: ['email'], inputs: emails.slice(i, i + 100).map(e => ({ id: e })) }),
  });
  const b = await r.json();
  (b.results || []).forEach(c => { byEmail[(c.properties.email || '').toLowerCase()] = c.id; });
}
const resolved = wanted.filter(w => byEmail[w.email]);
console.log('contacts resolved:', Object.keys(byEmail).length, '| events on known contacts:', resolved.length);

// --- what already exists on each timeline ---
const existing = {};
for (const id of new Set(resolved.map(w => byEmail[w.email]))) {
  const a = await (await fetch(`https://api.hubapi.com/crm/v4/objects/contacts/${id}/associations/notes`, { headers: H })).json();
  const ids = (a.results || []).map(x => x.toObjectId);
  const markers = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/notes/batch/read', {
      method: 'POST', headers: H, body: JSON.stringify({ properties: ['hs_note_body'], inputs: ids.slice(i, i + 100).map(x => ({ id: x })) }),
    })).json();
    (b.results || []).forEach(n => {
      const m = String(n.properties?.hs_note_body || '').match(/\[volcano:([a-z-]+):(\d+)\]/g) || [];
      m.forEach(x => markers.add(x));
    });
  }
  existing[id] = markers;
}

const todo = resolved.filter(w => !existing[byEmail[w.email]]?.has(`[volcano:${w.kind}:${w.leadId}]`));
console.log(`\n${COMMIT ? 'WRITING' : 'DRY RUN'} ${todo.length} notes (${resolved.length - todo.length} already on timelines)`);
const byKind = {};
todo.forEach(w => { byKind[w.kind] = (byKind[w.kind] || 0) + 1; });
Object.entries(byKind).forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`));

if (!COMMIT) {
  todo.slice(0, 5).forEach(w => console.log(`\n  example: ${w.email}\n    ${w.text}\n    marker [volcano:${w.kind}:${w.leadId}], owner ${OWNER[w.owner] || '?'}, ${String(w.at || '').slice(0, 10)}`));
  console.log('\nRe-run with --commit to write these.');
  process.exit(0);
}

let ok = 0, fail = 0;
for (const w of todo) {
  const contactId = byEmail[w.email];
  const body = `${w.text}\n\nCampaign: ${w.campaign}${w.profile ? `\nProfile: ${w.profile}` : ''}\n[volcano:${w.kind}:${w.leadId}]`;
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/notes', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      properties: {
        hs_timestamp: new Date(w.at || Date.now()).toISOString(),
        hs_note_body: body,
        ...(OWNER[w.owner] ? { hubspot_owner_id: OWNER[w.owner] } : {}),
      },
      associations: [{ to: { id: contactId }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 202 }] }],
    }),
  });
  if (r.ok) { ok++; if (ok % 25 === 0) console.log('  ...' + ok + ' written'); }
  else { fail++; if (fail <= 3) console.log('  FAILED', r.status, (await r.text()).slice(0, 160)); }
}
console.log(`\ndone: ${ok} written, ${fail} failed`);
