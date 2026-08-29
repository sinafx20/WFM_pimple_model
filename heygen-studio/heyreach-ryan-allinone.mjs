// One-off: a dedicated HeyReach campaign for Ryan Kagan (internal, CRO/leadership
// approver — see CLAUDE.md) that delivers all 7 Volcano resources (intro video,
// health check, calculator, benchmark, demo, firms-like-yours, resource hub) as
// separate LinkedIn DMs back-to-back, instead of the normal 18-day cadence used
// for real prospects. Lets Ryan review the whole message set in one sitting.
//
// Ryan is already connected on LinkedIn (see heyreach-sequence.mjs's testSequence
// note), so the sequence skips the CONNECTION_REQUEST/InMail branches entirely and
// just gates on CHECK_IS_CONNECTION -> straight DM chain. 3 HOUR is HeyReach's
// enforced minimum delay between action nodes (confirmed in heyreach-sequence.mjs),
// so 7 messages land across ~21 hours from send, not spread over weeks.
//
// Reuses the real "consulting" copy from copy-heyreach.json (Ryan's HubSpot
// volcano_icp_vertical is "Consulting") so the message text matches what a real
// consulting-vertical prospect would see.
//
//   node heyreach-ryan-allinone.mjs create   -> create list + campaign (DRAFT)
//   node heyreach-ryan-allinone.mjs push     -> push Ryan's HubSpot contact into it
//                                                (studio server must be running: node server.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const HR = (env.match(/^HEYREACH_API_KEY=(.+)$/m) || [])[1]?.trim();
if (!HR) { console.error('missing HEYREACH_API_KEY in .env'); process.exit(1); }

const hr = (p, body, method = 'POST') => fetch(`https://api.heyreach.io/api/public${p}`, {
  method, headers: { 'X-API-KEY': HR, 'content-type': 'application/json' },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

const SEAT_SINA = 221310; // Sina's HeyReach seat. NB 80127259 is Denzel, not Sina (fixed 2026-08-29)
const RYAN_HUBSPOT_ID = '126495762477';
const STATE_PATH = path.join(__dirname, 'heyreach-ryan-allinone.json');

const END = { nodeType: 'END', actionDelay: 3, actionDelayUnit: 'HOUR' };
const DM = (ref, msg, fb, next) => ({
  nodeType: 'MESSAGE', actionDelay: 3, actionDelayUnit: 'HOUR', externalReference: ref,
  payload: { messages: [msg], fallbackMessage: fb }, unconditionalNode: next,
});

function buildAllInOneSequence() {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'copy-heyreach.json'), 'utf8')).consulting;
  const chain =
    DM('ryan-allinone-dm1-intro',      c.dm1.message, c.dm1.fallback,
    DM('ryan-allinone-dm2-healthcheck', c.dm2.message, c.dm2.fallback,
    DM('ryan-allinone-dm3-calculator',  c.dm3.message, c.dm3.fallback,
    DM('ryan-allinone-dm4-benchmark',   c.dm4.message, c.dm4.fallback,
    DM('ryan-allinone-dm5-demo',        c.dm5.message, c.dm5.fallback,
    DM('ryan-allinone-dm6-firms',       c.dm6.message, c.dm6.fallback,
    DM('ryan-allinone-dm7-hub',         c.dm7.message, c.dm7.fallback,
    END)))))));
  return {
    nodeType: 'CHECK_IS_CONNECTION', actionDelay: 0, actionDelayUnit: 'DAY', externalReference: 'ryan-allinone-conn-gate',
    conditionalNode: chain, // already connected -> full 7-message chain
    unconditionalNode: END, // not connected (shouldn't happen for Ryan) -> do nothing
  };
}

async function create() {
  const listR = await hr('/list/CreateEmptyList', { name: 'Ryan Kagan - All Resources Review' });
  const list = await listR.json();
  if (!list?.id) { console.error('FAILED to create list:', JSON.stringify(list).slice(0, 300)); process.exit(1); }

  const sequence = buildAllInOneSequence();
  const createR = await hr('/campaign/Create', {
    name: 'Ryan Kagan - All Resources (Review)',
    linkedInUserListId: list.id,
    linkedInAccountIds: [SEAT_SINA],
    sequence,
  });
  const camp = await createR.json();
  if (!camp?.campaignId) { console.error('FAILED to create campaign:', JSON.stringify(camp).slice(0, 300)); process.exit(1); }

  const state = { campaignId: camp.campaignId, listId: list.id };
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  console.log(`created campaign: campaignId=${camp.campaignId} listId=${list.id}`);
  console.log('DRAFT — not started. Run `node heyreach-ryan-allinone.mjs push` next, then start it manually in HeyReach.');
}

async function push() {
  if (!fs.existsSync(STATE_PATH)) { console.error('no state file — run `create` first'); process.exit(1); }
  const { campaignId } = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  const r = await fetch('http://localhost:5178/api/heyreach/push', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contactId: RYAN_HUBSPOT_ID, campaignId }),
  });
  const b = await r.json().catch(() => null);
  console.log('push result:', JSON.stringify(b, null, 2));
}

const [, , cmd] = process.argv;
if (cmd === 'create') await create();
else if (cmd === 'push') await push();
else { console.log('usage: node heyreach-ryan-allinone.mjs create | push'); process.exit(1); }
