// End-to-end check of what is actually sitting in the campaigns, read back from the platforms.
//
// NOTE ON FIELD NAMES, which cost a false alarm on 2026-10-01: both platforms return custom
// data under a DIFFERENT key from the one you send it under.
//   HeyReach   send customUserFields  ->  read customFields
//   Instantly  send custom_variables  ->  read payload
// Reading the send-side name gives an empty result that looks exactly like a failed push.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const env = fs.readFileSync(p('.env'), 'utf8');
const g = (k) => (env.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const HK = g('HEYREACH_API_KEY'), IK = g('INSTANTLY_API_KEY');

const hrS = JSON.parse(fs.readFileSync(p('harvest-campaigns.json'), 'utf8'));
const inS = JSON.parse(fs.readFileSync(p('harvest-instantly-campaigns.json'), 'utf8'));
const EXPECT = {
  sina: { book: 'szarei', presenter: 'presenter=sina' },
  denzel: { book: 'denzel-kereama', presenter: 'presenter=denzel' },
};
const ownerOf = (k) => (k.endsWith('denzel') ? 'denzel' : 'sina');

let bad = 0;
console.log('=== HeyReach: every lead in every list ===');
for (const [key, v] of Object.entries(hrS)) {
  const owner = ownerOf(key), e = EXPECT[owner], other = EXPECT[owner === 'sina' ? 'denzel' : 'sina'];
  const leads = [];
  for (let offset = 0; ;) {
    const b = await (await fetch('https://api.heyreach.io/api/public/list/GetLeadsFromList', {
      method: 'POST', headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ listId: v.listId, offset, limit: 100 }),
    })).json();
    const items = b.items || [];
    leads.push(...items);
    if (items.length < 100) break;
    offset += 100;
  }
  const demo = (l) => (l.customFields || []).find((f) => f.name === 'demo_link')?.value || '';
  const missing = leads.filter((l) => !demo(l));
  const wrongOwner = leads.filter((l) => demo(l) && (!demo(l).includes(e.presenter) || !demo(l).includes(e.book)));
  const leaked = leads.filter((l) => demo(l).includes(other.book) || demo(l).includes(other.presenter));
  const tracked = leads.filter((l) => demo(l).includes('email=')).length;
  // the email in the link must be THAT lead's email, not somebody else's
  const mismatched = leads.filter((l) => {
    const m = demo(l).match(/[?&]email=([^&]+)/);
    return m && decodeURIComponent(m[1]).toLowerCase() !== String(l.emailAddress || '').toLowerCase();
  });
  bad += missing.length + wrongOwner.length + leaked.length + mismatched.length;
  console.log(`  ${key.padEnd(15)} ${String(leads.length).padStart(3)} leads | demo_link missing ${missing.length}`
    + ` | wrong owner ${wrongOwner.length} | other-owner leak ${leaked.length}`
    + ` | email mismatch ${mismatched.length} | tracked ${tracked}`);
}

console.log('\n=== Instantly: every lead in every campaign ===');
for (const [key, v] of Object.entries(inS)) {
  const owner = ownerOf(key), e = EXPECT[owner], other = EXPECT[owner === 'sina' ? 'denzel' : 'sina'];
  const leads = [];
  let starting;
  for (let guard = 0; guard < 20; guard++) {
    const b = await (await fetch('https://api.instantly.ai/api/v2/leads/list', {
      method: 'POST', headers: { authorization: `Bearer ${IK}`, 'content-type': 'application/json' },
      body: JSON.stringify({ campaign: v.id, limit: 100, ...(starting ? { starting_after: starting } : {}) }),
    })).json();
    leads.push(...(b.items || []));
    starting = b.next_starting_after;
    if (!starting || !(b.items || []).length) break;
  }
  const demo = (l) => l.payload?.demo_link || '';
  const missing = leads.filter((l) => !demo(l));
  const wrongOwner = leads.filter((l) => demo(l) && (!demo(l).includes(e.presenter) || !demo(l).includes(e.book)));
  const leaked = leads.filter((l) => demo(l).includes(other.book) || demo(l).includes(other.presenter));
  const mismatched = leads.filter((l) => {
    const m = demo(l).match(/[?&]email=([^&]+)/);
    return m && decodeURIComponent(m[1]).toLowerCase() !== String(l.email || '').toLowerCase();
  });
  const c = await (await fetch(`https://api.instantly.ai/api/v2/campaigns/${v.id}`, { headers: { authorization: `Bearer ${IK}` } })).json();
  bad += missing.length + wrongOwner.length + leaked.length + mismatched.length;
  console.log(`  ${key.padEnd(15)} ${String(leads.length).padStart(3)} leads | demo_link missing ${missing.length}`
    + ` | wrong owner ${wrongOwner.length} | other-owner leak ${leaked.length}`
    + ` | email mismatch ${mismatched.length} | mailboxes ${(c.email_list || []).length} | daily ${c.daily_limit} | status ${c.status}`);
  if (c.status !== 0) { console.error(`    !! ${key} is NOT draft (status ${c.status})`); bad++; }
}

console.log(bad === 0
  ? '\nAll clean: every lead carries its own tracked demo link, routed to the right owner.'
  : `\n${bad} problems found above.`);
if (bad) process.exitCode = 1;
