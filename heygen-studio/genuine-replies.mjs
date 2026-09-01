// Separates real replies from auto-responders, for Volcano contacts only.
//
// WHY: a reply is the heaviest signal in the heat model at +30, and Instantly's
// email_reply_count counts anything that arrives back, including out-of-office. On
// 2026-09-01 that put Kim Stoddart at the top of the volcano on heat 32, of which 30 was
// an out-of-office and 2 was a pixel prefetch.
//
// SCOPING MATTERS MORE THAN IT LOOKS. The first version of this searched all inbound
// email created since the campaign start and returned 138 messages, nearly all of them
// unrelated: customer success threads from other reps, TestFlight invites, Figma renewal
// notices, Microsoft quarantine digests. The portal holds 20,405 inbound emails. Only
// mail associated with a Volcano contact can say anything about Volcano engagement, so
// this walks the contact list and reads each one's associations instead.
//
// The detector is subject-based because that is what we have. Mail headers would be
// better (auto-submitted, x-autoreply) but the engagement object does not carry them.
// Erring toward calling something automatic is the safe direction: a missed real reply
// still shows up in the AE's inbox, whereas a scored out-of-office sends someone chasing
// a prospect who never wrote to them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const T = (fs.readFileSync(p('.env'), 'utf8').match(/^HUBSPOT_TOKEN=(.+)$/m) || [])[1].trim();
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };

// Only mail from the campaign window counts. Walking a contact's whole association list
// reaches back years: Jenna Plant at Resn replied 'we're not interested' in February 2026
// to a manual email, which briefly looked like the campaign's first genuine reply.
const CAMPAIGN_START = '2026-08-26';

const AUTO = [
  /^\s*automatic reply\s*:/i,
  /^\s*auto(matic)?[-\s]?reply\b/i,
  /^\s*out of (the )?office\b/i,
  /\bout of office\b.*\bre\s*:/i,
  /^\s*re\s*:\s*out of (the )?office\b/i,
  /^\s*auto\s*:/i,
  /^\s*undeliverable\s*:/i,
  /^\s*delivery status notification/i,
  /^\s*(re\s*:\s*)?vacation\b/i,
  /\bon (annual )?leave\b/i,
  /\bi am currently (away|out)\b/i,
];
const isAuto = (subject) => AUTO.some((r) => r.test(String(subject || '')));

const viz = JSON.parse(fs.readFileSync(p('_viz.json'), 'utf8'));
const contacts = (viz.rows || []).filter((r) => r.id);
console.log('Volcano contacts to check:', contacts.length);

const byContact = {};
let genuine = 0, auto = 0, checked = 0, withInbound = 0;

for (const c of contacts) {
  checked++;
  if (checked % 50 === 0) process.stdout.write(`  ...${checked}\n`);
  const a = await (await fetch(`https://api.hubapi.com/crm/v4/objects/contacts/${c.id}/associations/emails`, { headers: H })).json();
  const ids = (a.results || []).map((x) => x.toObjectId);
  if (!ids.length) continue;

  const emails = [];
  for (let i = 0; i < ids.length; i += 100) {
    const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/emails/batch/read', {
      method: 'POST', headers: H,
      body: JSON.stringify({ properties: ['hs_email_subject', 'hs_email_direction', 'hs_email_from_email', 'hs_timestamp'], inputs: ids.slice(i, i + 100).map((id) => ({ id })) }),
    })).json();
    emails.push(...(b.results || []));
  }

  const inbound = emails.filter((e) => e.properties?.hs_email_direction === 'INCOMING_EMAIL'
    && String(e.properties?.hs_timestamp || '') >= CAMPAIGN_START);
  if (!inbound.length) continue;
  withInbound++;

  const rec = { email: c.email, genuine: 0, auto: 0, subjects: [] };
  for (const e of inbound) {
    const subject = e.properties?.hs_email_subject || '';
    const a2 = isAuto(subject);
    if (a2) { rec.auto++; auto++; } else { rec.genuine++; genuine++; }
    rec.subjects.push({ subject: subject.slice(0, 80), auto: a2, from: e.properties?.hs_email_from_email || '', at: String(e.properties?.hs_timestamp || '').slice(0, 10) });
  }
  byContact[c.id] = rec;
}

fs.writeFileSync(p('_genuine-replies.json'), JSON.stringify({ generated: new Date().toISOString(), genuine, auto, byContact }, null, 1));

console.log(`\ncontacts with any inbound email: ${withInbound}`);
console.log(`classified: ${genuine} genuine, ${auto} automatic\n`);
Object.entries(byContact).forEach(([id, r]) => {
  console.log(`${r.email}  (${r.genuine} genuine, ${r.auto} auto)`);
  r.subjects.forEach((s) => console.log(`   ${s.auto ? 'AUTO   ' : 'GENUINE'}  ${String(s.from || '(no from)').padEnd(28)} ${s.subject}`));
});
console.log('\nwritten _genuine-replies.json');
