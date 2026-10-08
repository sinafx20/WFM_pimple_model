// Creates the four Harvest LinkedIn campaigns (region x owner) and, separately and later,
// loads copy into them.
//
//   node harvest-campaigns.mjs plan     -> what would be created, writes nothing
//   node harvest-campaigns.mjs create   -> creates them in DRAFT, with placeholder copy
//   node harvest-campaigns.mjs status   -> what exists now, and whether copy is loaded
//   node harvest-campaigns.mjs copy     -> loads copy-harvest.json into the sequences
//
// FOUR CAMPAIGNS, NOT TWELVE. The three angles live as A/B variants inside each step, so the
// platform distributes them. Region is a campaign dimension because the send window differs
// (APAC spans UTC+8 to +13, US-West is UTC-8); owner is one because owner = sender always.
//
// NOTHING IS EVER STARTED BY THIS SCRIPT. Campaigns are created DRAFT and stay DRAFT until a
// person presses Start in HeyReach.
//
// BEFORE TRUSTING THE A/B SPLIT: open one campaign in the HeyReach UI and check that a step
// with three entries renders as three VARIANTS, not three messages sent in sequence. No Volcano
// sequence ever used more than one entry, so this is not established by anything in this repo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHarvestSequence, copyComplete, STEPS, ANGLES, ANGLE_KEYS, REGION_KEYS, requiredCustomFields } from './harvest-sequences.mjs';
import { resolveConstants, shortenCopy } from './harvest-tokens.mjs';
import { shorten } from './harvest-shorten.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const HK = g('HEYREACH_API_KEY');
if (!HK) { console.error('missing HEYREACH_API_KEY'); process.exit(1); }

const hr = (path_, body, method = 'POST') => fetch(`https://api.heyreach.io/api/public${path_}`, {
  method, headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

// Seat ids verified against live li_account records, a different id space from HubSpot owners.
const SEAT = { sina: 221310, denzel: 223029 };
const OWNERS = ['sina', 'denzel'];
const NAME = { sina: 'Sina', denzel: 'Denzel' };

const STATE_PATH = p('harvest-campaigns.json');
const COPY_PATH = p('copy-harvest.json');
const loadState = () => (fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : {});
const saveState = (s) => fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));

const campaignName = (region, owner) => `Harvest LI - ${region} - ${NAME[owner]}`;


const ALL = [];
for (const region of REGION_KEYS) for (const owner of OWNERS) ALL.push({ region, owner, key: `${region}-${owner}` });

// Campaigns from the abandoned lane x owner pass. HeyReach exposes no delete or rename in its
// public API, so these have to go from the UI; naming them here stops them being mistaken for
// part of the live setup.
const ORPHANS = [629069, 629070, 629071, 629072, 629073, 629074];

function plan() {
  console.log('Four campaigns would be created, all DRAFT, all with placeholder copy:\n');
  ALL.forEach(({ region, owner, key }) => console.log(`  ${key.padEnd(16)} "${campaignName(region, owner)}"  seat ${SEAT[owner]}`));
  console.log('\nThe three angles run as A/B variants inside each angled step:');
  ANGLE_KEYS.forEach((k) => console.log(`  ${k}  ${ANGLES[k]}`));
  console.log(`\n${STEPS.length} steps, of which ${STEPS.filter((s) => s.angled).length} carry all three angles:`);
  STEPS.forEach((s) => console.log(`  wk${s.week}  ${s.key.padEnd(8)} ${s.angled ? 'A/B/C ' : 'shared'}  ${s.label}`));
  const need = STEPS.reduce((n, s) => n + (s.angled ? ANGLE_KEYS.length : 1), 0);
  console.log(`\ncopy needed: ${need} bodies per campaign (the same set is used by all four).`);
  const state = loadState();
  const existing = ALL.filter((c) => state[c.key]?.campaignId);
  if (existing.length) console.log(`\n${existing.length} already exist and would be skipped.`);
}

async function create() {
  const state = loadState();
  // Drop stale lane x owner keys so `status` does not report a structure that no longer exists.
  Object.keys(state).filter((k) => !ALL.some((c) => c.key === k)).forEach((k) => delete state[k]);

  let made = 0, failed = 0, skipped = 0;
  for (const { region, owner, key } of ALL) {
    if (state[key]?.campaignId) { console.log(`= ${key} exists (campaign ${state[key].campaignId}), leaving alone`); skipped++; continue; }

    const list = await (await hr('/list/CreateEmptyList', { name: campaignName(region, owner) })).json().catch(() => null);
    if (!list?.id) { console.error(`! ${key} list creation FAILED: ${JSON.stringify(list).slice(0, 200)}`); failed++; continue; }

    const camp = await (await hr('/campaign/Create', {
      name: campaignName(region, owner),
      linkedInUserListId: list.id,
      linkedInAccountIds: [SEAT[owner]],
      sequence: buildHarvestSequence(null),
    })).json().catch(() => null);
    if (!camp?.campaignId) { console.error(`! ${key} campaign creation FAILED: ${JSON.stringify(camp).slice(0, 300)}`); failed++; continue; }

    state[key] = {
      campaignId: camp.campaignId, listId: list.id, region, owner,
      seat: SEAT[owner], copyLoaded: false, createdAt: new Date().toISOString(),
    };
    saveState(state);
    made++;
    console.log(`+ ${key} created: campaign ${camp.campaignId}, list ${list.id}  (DRAFT, placeholder copy)`);
  }
  saveState(state);
  console.log(`\n${made} created, ${skipped} already existed, ${failed} failed.`);
  if (failed) { console.error('Some campaigns were NOT created. Fix the errors above and re-run.'); process.exitCode = 1; }
  if (made || skipped) {
    console.log('All DRAFT with placeholder copy. Nothing will send.');
    console.log(`Orphans from the earlier structure, delete in the HeyReach UI: ${ORPHANS.join(', ')}`);
  }
}

async function status() {
  const state = loadState();
  if (!ALL.some((c) => state[c.key])) return console.log('None created yet. Run: node harvest-campaigns.mjs create');
  const copy = fs.existsSync(COPY_PATH) ? JSON.parse(fs.readFileSync(COPY_PATH, 'utf8')) : null;
  const cc = copyComplete(copy);
  console.log('key              campaign   list      seat    status     copy');
  for (const { region, owner, key } of ALL) {
    const s = state[key];
    if (!s) { console.log(`${key.padEnd(16)} (not created)`); continue; }
    const c = await (await hr(`/campaign/GetById?campaignId=${s.campaignId}`, undefined, 'GET')).json().catch(() => null);
    console.log(`${key.padEnd(16)} ${String(s.campaignId).padEnd(10)} ${String(s.listId).padEnd(9)} ${String(s.seat).padEnd(7)} `
      + `${String(c?.status || '?').padEnd(10)} ${cc.ok ? 'loaded' : `MISSING ${cc.missing.length}`}`);
  }
  if (!cc.ok) console.log(`\nmissing copy: ${cc.missing.slice(0, 14).join(', ')}${cc.missing.length > 14 ? ` and ${cc.missing.length - 14} more` : ''}`);
  console.log(`\nOrphans to delete in the HeyReach UI: ${ORPHANS.join(', ')}`);
}

// Act 1 is the only step whose LinkedIn preview card matters, and LinkedIn previews exactly one
// URL per message. Two URLs make it a coin flip over which card appears, and the booking link
// winning is the one outcome we specifically do not want. This is one careless copy edit away at
// all times, so refuse the push rather than discover it in someone's inbox.
const UNFURL_LINK = 'https://wfmax.info/2wvwsza6';

function checkAct1(copy) {
  const bad = [];
  for (const [key, text] of [['dm1', copy.dm1], ['inmail1', copy.inmail1?.message]]) {
    if (typeof text !== 'string') { bad.push(`${key} is missing`); continue; }
    const urls = text.match(/https:\/\/\S+/g) || [];
    if (urls.length !== 1) bad.push(`${key} holds ${urls.length} urls, expected 1: ${urls.join(' ') || 'none'}`);
    else if (urls[0] !== UNFURL_LINK) bad.push(`${key} links ${urls[0]}, expected the verified alias ${UNFURL_LINK}`);
    if (/\{booking_link\}/.test(text)) bad.push(`${key} has the booking link back, which would compete for the unfurl`);
  }
  return bad;
}

async function loadCopy() {
  const state = loadState();
  if (!fs.existsSync(COPY_PATH)) {
    console.error(`no ${path.basename(COPY_PATH)}. Expected shape:`);
    const shape = {};
    STEPS.forEach((s) => {
      shape[s.key] = s.angled
        ? Object.fromEntries(ANGLE_KEYS.map((a) => [a, s.kind === 'inmail' ? { subject: '', message: '' } : '']))
        : (s.kind === 'inmail' ? { subject: '', message: '' } : '');
    });
    console.error(JSON.stringify(shape, null, 2));
    process.exit(1);
  }
  const copy = JSON.parse(fs.readFileSync(COPY_PATH, 'utf8'));
  const cc = copyComplete(copy);
  if (!cc.ok) {
    console.error('REFUSING: copy is incomplete. A half-filled campaign looks ready and is not.');
    console.error(`  missing: ${cc.missing.join(', ')}`);
    process.exit(1);
  }
  const act1 = checkAct1(copy);
  if (act1.length) {
    console.error('REFUSING: Act 1 would not unfurl predictably on LinkedIn.');
    act1.forEach((m) => console.error(`  ${m}`));
    process.exit(1);
  }
  for (const { owner, key } of ALL) {
    const s = state[key];
    if (!s?.campaignId) { console.log(`- ${key} not created yet, skipping`); continue; }
    const sequence = buildHarvestSequence(await shortenCopy(resolveConstants(copy, owner), shorten));
    const r = await hr('/campaign/UpdateSequence', { campaignId: s.campaignId, sequence });
    const ok = r.status < 300;
    console.log(`${ok ? '+' : '!'} ${key} sequence updated: HTTP ${r.status}${ok ? '' : ' ' + (await r.text()).slice(0, 200)}`);
    if (ok) { state[key].copyLoaded = true; state[key].copyLoadedAt = new Date().toISOString(); saveState(state); }
  }
  const live = requiredCustomFields(resolveConstants(copy, 'sina'));
  console.log('\nCampaigns still DRAFT.');
  if (live.length) {
    console.log(`LIVE MERGE FIELDS, these must be pushed per lead or the fallback sends instead: ${live.join(', ')}`);
    console.log('  {demo_link} carries the contact email for attribution, so the push must supply it per lead.');
  } else {
    console.log('No live merge fields beyond {FIRST_NAME}: nothing extra has to be pushed per lead.');
  }
}

const cmd = process.argv[2];
if (cmd === 'plan') plan();
else if (cmd === 'create') await create();
else if (cmd === 'status') await status();
else if (cmd === 'copy') await loadCopy();
else { console.log('usage: node harvest-campaigns.mjs plan | create | status | copy'); process.exit(1); }
