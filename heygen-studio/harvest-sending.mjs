// Attaches sending mailboxes and a daily limit to the four Harvest Instantly campaigns.
//
//   node harvest-sending.mjs            dry run
//   node harvest-sending.mjs --commit   applies
//
// MAILBOXES follow the owner, same as the calendar and the walkthrough video: a reply has to
// land with whoever the prospect thinks they are talking to. Only warmed, connected accounts
// are used. sina.zarei@workflowmax.com, denzel.kereama@workflowmax2.com and
// leonardo.xavier@workflowmax.com are deliberately excluded: the first two report status -1 and
// warmup 0, and the third belongs to neither AE.
//
// THE DAILY LIMIT IS DELIBERATELY LOW, and the reason matters. These are the SAME four
// mailboxes the Volcano campaigns send from, and Volcano is still mid-flight: 31 contacts are
// part way through its email arc and 247 have not started it. Each mailbox caps at 20 a day, so
// an owner has 40 a day in total across every campaign they run, Volcano and Harvest together.
//
// Harvest needs roughly 16 a day per owner at a steady rate (80 contacts x 4 emails spread over
// four weeks), so 15 per campaign leaves Volcano real headroom rather than starving it. Raise
// it only once Volcano's email arc has finished, or the two campaigns will compete for the same
// send capacity and both will slow down.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const K = g('INSTANTLY_API_KEY');
if (!K) { console.error('missing INSTANTLY_API_KEY'); process.exit(1); }
const H = { authorization: `Bearer ${K}`, 'content-type': 'application/json' };
const COMMIT = process.argv.includes('--commit');

const MAILBOXES = {
  sina: ['sina.zarei@cloudworkflowmax.com', 'sina.zarei@teamworkflowmax.com'],
  denzel: ['denzel.kereama@cloudworkflowmax.com', 'denzel.kereama@teamworkflowmax.com'],
};
const DAILY_LIMIT = 15;

const state = JSON.parse(fs.readFileSync(p('harvest-instantly-campaigns.json'), 'utf8'));

// Never attach a mailbox that is disconnected or unwarmed. Volcano lost weeks to cold domains;
// a campaign launched on one of those burns the domain and the audience at the same time.
const accounts = (await (await fetch('https://api.instantly.ai/api/v2/accounts?limit=100', { headers: H })).json()).items || [];
const byEmail = Object.fromEntries(accounts.map((a) => [String(a.email).toLowerCase(), a]));
const problems = [];
for (const [owner, list] of Object.entries(MAILBOXES)) {
  for (const m of list) {
    const a = byEmail[m.toLowerCase()];
    if (!a) problems.push(`${m} does not exist in Instantly`);
    else if (a.status !== 1) problems.push(`${m} has status ${a.status} (not connected)`);
    else if (a.warmup_status !== 1) problems.push(`${m} is not warmed (warmup_status ${a.warmup_status})`);
  }
}
if (problems.length) {
  console.error('REFUSING: a mailbox is not safe to send from.');
  problems.forEach((x) => console.error('  ' + x));
  process.exit(1);
}
console.log('all four mailboxes are connected and warmed\n');

console.log('campaign            mailboxes                                            daily');
for (const [key, s] of Object.entries(state)) {
  const owner = key.endsWith('denzel') ? 'denzel' : 'sina';
  console.log(`  ${key.padEnd(18)} ${MAILBOXES[owner].join(', ').padEnd(52)} ${DAILY_LIMIT}`);
}

const perOwner = {};
Object.keys(state).forEach((k) => { const o = k.endsWith('denzel') ? 'denzel' : 'sina'; perOwner[o] = (perOwner[o] || 0) + DAILY_LIMIT; });
console.log(`\nper owner this adds up to ${Object.values(perOwner)[0]} sends a day against a mailbox ceiling of 40,`);
console.log('leaving the rest for Volcano, which still shares these mailboxes.');

if (!COMMIT) { console.log('\nDRY RUN. Re-run with --commit to apply.'); process.exit(0); }

let ok = 0, fail = 0;
for (const [key, s] of Object.entries(state)) {
  const owner = key.endsWith('denzel') ? 'denzel' : 'sina';
  const r = await fetch(`https://api.instantly.ai/api/v2/campaigns/${s.id}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ email_list: MAILBOXES[owner], daily_limit: DAILY_LIMIT }),
  });
  if (r.status < 300) { ok++; console.log(`+ ${key}: ${MAILBOXES[owner].length} mailboxes, daily limit ${DAILY_LIMIT}`); }
  else { fail++; console.error(`! ${key} FAILED HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`); }
}
console.log(`\n${ok} updated, ${fail} failed.`);
console.log('Campaigns remain draft. Attaching a mailbox does not send anything.');
if (fail) process.exitCode = 1;
