// Creates the four Harvest email campaigns in Instantly (region x owner), mirroring the
// LinkedIn campaigns, with the three angles as A/B variants inside each angled step.
//
//   node harvest-instantly.mjs plan     -> what would be created, writes nothing
//   node harvest-instantly.mjs create   -> creates them as draft, with placeholder copy
//   node harvest-instantly.mjs status   -> what exists now, and whether copy is loaded
//   node harvest-instantly.mjs copy     -> loads copy-harvest.json email steps into them
//
// NOTHING IS EVER ACTIVATED BY THIS SCRIPT. Campaigns are created at status 0 (draft).
//
// NO SENDING ACCOUNTS ARE ATTACHED. email_list is left empty on purpose: which mailboxes send
// which campaign is a deliverability decision, and the Volcano run lost weeks to cold domains
// that were never warmed. Attaching one here would let a campaign go out from an unwarmed
// domain the moment somebody pressed Launch.
//
// REGION IS A CAMPAIGN DIMENSION BECAUSE THE SCHEDULE IS PER CAMPAIGN. APAC spans UTC+8 to +13
// and US-West is UTC-8; one schedule cannot serve both without mailing somebody at 3am.
//
// TRACKING IS OFF. The Volcano run measured 11 clicks that produced no page view, no form and
// no other browser activity, and opens that were 84% machines. Both are noise that scored heat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANGLES, ANGLE_KEYS, REGION_KEYS } from './harvest-sequences.mjs';
// Instantly's built-in is {{firstName}} and its custom variables are double-braced too, so the
// neutral tokens in copy-harvest.json have to be translated here exactly as they are for
// HeyReach. An untranslated token does not fail at push time, it arrives in somebody's inbox.
import { forInstantly, resolveConstants } from './harvest-tokens.mjs';
// Bodies are authored as plain text with blank lines between paragraphs. Instantly renders
// HTML and discards newlines, so without this every email arrives as one unbroken block.
// Applied AFTER forInstantly, because the linkifier needs the translated {{demo_link}} form.
import { toHtml } from './harvest-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const K = g('INSTANTLY_API_KEY');
if (!K) { console.error('missing INSTANTLY_API_KEY'); process.exit(1); }
const H = { authorization: `Bearer ${K}`, 'content-type': 'application/json' };

const OWNERS = ['sina', 'denzel'];
const NAME = { sina: 'Sina', denzel: 'Denzel' };

// `delay` is days to wait before this step; the first step sends on enrolment.
export const EMAIL_STEPS = [
  { key: 'em1', week: 1, angled: false, delay: 0, label: 'Act 1, the pricing message' },
  { key: 'em2', week: 2, angled: true,  delay: 4, label: 'The angle, plus the demo video' },
  { key: 'em3', week: 3, angled: false, delay: 6, label: 'Trial and the Harvest migration tool' },
  { key: 'em4', week: 4, angled: false, delay: 6, label: 'Close' },
];

const SCHEDULE = {
  APAC: {
    schedules: [{
      name: 'APAC business hours',
      timing: { from: '08:00', to: '17:00' },
      days: { 1: true, 2: true, 3: true, 4: true, 5: true },
      timezone: 'Australia/Melbourne',
    }],
    start_date: null, end_date: null,
  },
  // Instantly only accepts a short, idiosyncratic timezone list and there is NO US Pacific
  // option: America/Los_Angeles, US/Pacific, America/Denver, America/Phoenix and even
  // America/New_York are all rejected. Probed 2026-09-30; accepted were America/Chicago,
  // America/Detroit, Australia/Melbourne and Pacific/Auckland.
  //
  // So the window is set in Central and shifted two hours later to land on Pacific business
  // hours, which Central leads by two all year: 10:00-19:00 Chicago is 08:00-17:00 Pacific.
  // If these contacts turn out not to be Pacific, change the offset rather than the timezone.
  'US-West': {
    schedules: [{
      name: 'US Pacific business hours (set in Central, +2)',
      timing: { from: '10:00', to: '19:00' },
      days: { 1: true, 2: true, 3: true, 4: true, 5: true },
      timezone: 'America/Chicago',
    }],
    start_date: null, end_date: null,
  },
};

const PH_SUBJ = (key, angle) => `[PLACEHOLDER ${key}${angle ? '/' + angle : ''}] do not launch`;
const PH_BODY = (key, angle) =>
  `[PLACEHOLDER ${key}${angle ? '/' + angle : ''}] Copy has not been loaded into this campaign yet. `
  + 'Do not launch it. Load copy with: node harvest-instantly.mjs copy';

const STATE_PATH = p('harvest-instantly-campaigns.json');
const COPY_PATH = p('copy-harvest.json');
const loadState = () => (fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : {});
const saveState = (s) => fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));

const campaignName = (region, owner) => `Harvest Email - ${region} - ${NAME[owner]}`;

const ALL = [];
for (const region of REGION_KEYS) for (const owner of OWNERS) ALL.push({ region, owner, key: `${region}-${owner}` });

function variantsFor(step, copy) {
  const c = copy?.[step.key];
  if (!step.angled) {
    return [{ subject: forInstantly(c?.subject || PH_SUBJ(step.key)), body: toHtml(forInstantly(c?.body ?? c?.message ?? PH_BODY(step.key))) }];
  }
  return ANGLE_KEYS.map((a) => ({
    subject: forInstantly(c?.[a]?.subject || PH_SUBJ(step.key, a)),
    body: toHtml(forInstantly(c?.[a]?.body ?? c?.[a]?.message ?? PH_BODY(step.key, a))),
  }));
}
const buildSequence = (copy = null) => [{
  steps: EMAIL_STEPS.map((s) => ({ type: 'email', delay: s.delay, variants: variantsFor(s, copy) })),
}];

function emailCopyComplete(copy) {
  const missing = [];
  const bad = (t) => !t || !String(t).trim() || /^\[PLACEHOLDER/.test(String(t));
  for (const s of EMAIL_STEPS) {
    const c = copy?.[s.key];
    if (!s.angled) {
      if (bad(c?.body ?? c?.message ?? c)) missing.push(s.key);
      if (bad(c?.subject)) missing.push(`${s.key}.subject`);
    } else {
      for (const a of ANGLE_KEYS) {
        if (bad(c?.[a]?.body ?? c?.[a]?.message ?? c?.[a])) missing.push(`${s.key}.${a}`);
        if (bad(c?.[a]?.subject)) missing.push(`${s.key}.${a}.subject`);
      }
    }
  }
  return { ok: missing.length === 0, missing };
}

function plan() {
  console.log('Four Instantly campaigns would be created, draft, no sending accounts:\n');
  ALL.forEach(({ region, owner, key }) => console.log(`  ${key.padEnd(16)} "${campaignName(region, owner)}"  ${SCHEDULE[region].schedules[0].timezone}`));
  console.log('\nAngles as A/B variants:');
  ANGLE_KEYS.forEach((k) => console.log(`  ${k}  ${ANGLES[k]}`));
  console.log(`\n${EMAIL_STEPS.length} email steps, ${EMAIL_STEPS.filter((s) => s.angled).length} carrying all three angles:`);
  EMAIL_STEPS.forEach((s) => console.log(`  wk${s.week}  ${s.key}  ${s.angled ? 'A/B/C ' : 'shared'}  +${s.delay}d  ${s.label}`));
  const need = EMAIL_STEPS.reduce((n, s) => n + (s.angled ? ANGLE_KEYS.length : 1), 0);
  console.log(`\ncopy needed: ${need} subject+body pairs (the same set is used by all four).`);
}

async function create() {
  const state = loadState();
  Object.keys(state).filter((k) => !ALL.some((c) => c.key === k)).forEach((k) => delete state[k]);
  let made = 0, failed = 0, skipped = 0;
  for (const { region, owner, key } of ALL) {
    if (state[key]?.id) { console.log(`= ${key} exists (${state[key].id}), leaving alone`); skipped++; continue; }
    const body = {
      name: campaignName(region, owner),
      campaign_schedule: SCHEDULE[region],
      sequences: buildSequence(null),
      email_list: [],
      link_tracking: false,
      open_tracking: false,
      stop_on_reply: true,
      daily_limit: 0,
    };
    const r = await fetch('https://api.instantly.ai/api/v2/campaigns', { method: 'POST', headers: H, body: JSON.stringify(body) });
    const b = await r.json().catch(() => null);
    if (r.status >= 300 || !b?.id) { console.error(`! ${key} FAILED HTTP ${r.status}: ${JSON.stringify(b).slice(0, 300)}`); failed++; continue; }
    state[key] = { id: b.id, region, owner, status: b.status, copyLoaded: false, createdAt: new Date().toISOString() };
    saveState(state);
    made++;
    console.log(`+ ${key} created: ${b.id}  (status ${b.status}, ${SCHEDULE[region].schedules[0].timezone}, no mailboxes)`);
  }
  saveState(state);
  console.log(`\n${made} created, ${skipped} already existed, ${failed} failed.`);
  if (failed) { console.error('Some campaigns were NOT created.'); process.exitCode = 1; }
  if (made || skipped) console.log('No sending accounts and no copy, so nothing can send.');
}

async function status() {
  const state = loadState();
  if (!ALL.some((c) => state[c.key])) return console.log('None created yet. Run: node harvest-instantly.mjs create');
  const copy = fs.existsSync(COPY_PATH) ? JSON.parse(fs.readFileSync(COPY_PATH, 'utf8')) : null;
  const cc = emailCopyComplete(copy);
  const ST = { 0: 'draft', 1: 'ACTIVE', 2: 'paused', 3: 'completed', 4: 'subsequences' };
  console.log('key              campaign id                            status  mailboxes  variants  copy');
  for (const { key } of ALL) {
    const s = state[key];
    if (!s) { console.log(`${key.padEnd(16)} (not created)`); continue; }
    const b = await (await fetch(`https://api.instantly.ai/api/v2/campaigns/${s.id}`, { headers: H })).json().catch(() => null);
    const vmax = Math.max(...((b?.sequences?.[0]?.steps || []).map((st) => (st.variants || []).length)), 0);
    console.log(`${key.padEnd(16)} ${s.id}  ${String(ST[b?.status] ?? '?').padEnd(7)} ${String((b?.email_list || []).length).padEnd(10)} `
      + `${String(vmax).padEnd(9)} ${cc.ok ? 'loaded' : `MISSING ${cc.missing.length}`}`);
  }
  if (!cc.ok) console.log(`\nmissing copy: ${cc.missing.slice(0, 12).join(', ')}${cc.missing.length > 12 ? ` and ${cc.missing.length - 12} more` : ''}`);
}

async function loadCopy() {
  const state = loadState();
  if (!fs.existsSync(COPY_PATH)) {
    const shape = {};
    EMAIL_STEPS.forEach((s) => {
      shape[s.key] = s.angled
        ? Object.fromEntries(ANGLE_KEYS.map((a) => [a, { subject: '', body: '' }]))
        : { subject: '', body: '' };
    });
    console.error(`no ${path.basename(COPY_PATH)}. Email steps expect:\n${JSON.stringify(shape, null, 2)}`);
    process.exit(1);
  }
  const copy = JSON.parse(fs.readFileSync(COPY_PATH, 'utf8'));
  const cc = emailCopyComplete(copy);
  if (!cc.ok) {
    console.error('REFUSING: email copy is incomplete. A half-filled campaign looks ready and is not.');
    console.error(`  missing: ${cc.missing.join(', ')}`);
    process.exit(1);
  }
  for (const { owner, key } of ALL) {
    const s = state[key];
    if (!s?.id) { console.log(`- ${key} not created yet, skipping`); continue; }
    const sequences = buildSequence(resolveConstants(copy, owner));
    const r = await fetch(`https://api.instantly.ai/api/v2/campaigns/${s.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ sequences }),
    });
    const ok = r.status < 300;
    console.log(`${ok ? '+' : '!'} ${key} sequence updated: HTTP ${r.status}${ok ? '' : ' ' + (await r.text()).slice(0, 200)}`);
    if (ok) { state[key].copyLoaded = true; state[key].copyLoadedAt = new Date().toISOString(); saveState(state); }
  }
  console.log('\nStill draft, still no mailboxes attached. Nothing will send.');
}

const cmd = process.argv[2];
if (cmd === 'plan') plan();
else if (cmd === 'create') await create();
else if (cmd === 'status') await status();
else if (cmd === 'copy') await loadCopy();
else { console.log('usage: node harvest-instantly.mjs plan | create | status | copy'); process.exit(1); }
