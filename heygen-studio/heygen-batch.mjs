// Volcano batch video runner.
//   node heygen-batch.mjs                       -> DRY RUN: pull contacts, render scripts, write output/volcano-scripts.csv (no video, no writes)
//   node heygen-batch.mjs --generate --limit 3  -> generate videos for N contacts, write URLs back to HubSpot
//   node heygen-batch.mjs --generate --limit all -> the whole list (costs credits + time)
// Reads HEYGEN_API_KEY + HUBSPOT_TOKEN from ./.env.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const get = (k) => (env.match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)\\s*$`, 'm')) || [])[1]?.trim();
const HEYGEN = get('HEYGEN_API_KEY'), TOKEN = get('HUBSPOT_TOKEN');

// ---- config ----
const LIST_ID = 3698;                                         // "Volcano Model MVP_all targets"
const AVATAR_ID = 'b8f33c1ab4cd48dbb356d9d38871703a';         // Sina - new avatar
const VOICE_ID  = '2ef6edfd75494239bc22093fb671b7b3';         // new voice with mic
const DIM = { width: 1280, height: 720 };
const VIDEO_URL_PROP = 'volcano_heygen_video_url';
const PROP_GROUP = 'wfm_content_tools';

const args = process.argv.slice(2);
const GENERATE = args.includes('--generate');
const NOWRITE = args.includes('--no-writeback');   // preview: generate + poll, but do NOT touch HubSpot
const limArg = (args[args.indexOf('--limit') + 1]) || (GENERATE ? '3' : 'all');
const LIMIT = limArg === 'all' ? Infinity : parseInt(limArg, 10);

const hs = (p, o = {}) => fetch(`https://api.hubapi.com${p}`, { ...o, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(o.headers || {}) } });
const LEGAL = /[\s,]+(?:pty\.?\s*ltd\.?|pte\.?\s*ltd\.?|p\/l|proprietary\s+limited|limited|ltd\.?|l\.?l\.?c\.?|incorporated|inc\.?|corporation|corp\.?|gmbh|plc|pty\.?|s\.?a\.?|s\.?r\.?l\.?|b\.?v\.?)\.?\s*$/i;
const cleanCompany = n => { let s = (n || '').trim(); for (let i = 0; i < 3; i++) { const x = s.replace(LEGAL, '').replace(/[,\s]+$/, '').trim(); if (x === s) break; s = x; } return s || (n || '').trim(); };
const cleanFirst = n => { const s = (n || '').trim(); const r = s.replace(/^(?:[A-Za-z]\.?\s+)+/, '').trim(); return r || s; };
const hg = (p, o = {}) => fetch(`https://api.heygen.com${p}`, { ...o, headers: { 'X-Api-Key': HEYGEN, 'content-type': 'application/json', accept: 'application/json', ...(o.headers || {}) } });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// vertical value -> {model, word}
const MAP = {
  architecture: ['services', 'architecture'], engineering: ['services', 'engineering'],
  consulting: ['services', 'consulting'], creative: ['services', 'creative'],
  construction: ['project', 'construction'], civil: ['project', 'civil'],
};
function classify(vertical) {
  const key = (vertical || '').toLowerCase().trim();
  for (const k of Object.keys(MAP)) if (key.includes(k)) return { model: MAP[k][0], word: MAP[k][1], known: true };
  return { model: 'services', word: 'professional services', known: false };
}
function renderScript(c) {
  const { model, word } = classify(c.vertical);
  const f = c.firstName || 'there', co = c.company || 'your firm';
  if (model === 'project') return `Hey ${f}, I'm Sina from WorkflowMAX. I record a few of these each week for ${word} firms, and I wanted to send ${co} one, because there's a pattern I keep seeing on jobs your size. The work gets delivered and the client's happy, but the final margin often comes in under the one you quoted. Sometimes it's variations that got done but never invoiced. Sometimes it's costs that crept in before anyone caught them. On a single job that's easy to absorb, but over a year of jobs it adds up fast. The hard part is that you can't recover margin you can't see. So I've put together a short Workflow Health Check for you, just below this video. It takes about two minutes, and it shows you where ${co} sits today, and the biggest gap between the margin you quote and the margin you deliver. Even if WorkflowMAX is never the right fit for you, you'll walk away knowing your number. Have a look, and if it's useful, I'd genuinely love to compare notes. Thanks ${f}, and have a great day.`;
  return `Hey ${f}, I'm Sina from WorkflowMAX. I record a few of these each week for ${word} firms, and I wanted to send ${co} one, because there's a pattern I keep seeing with firms your size. The work gets done and the clients are happy, but a slice of the time behind it never quite makes it onto an invoice. Sometimes it's a few unbilled minutes a day. Sometimes it's scope that quietly creeps past the fee. On its own that's nothing, but over a year, for a firm your size, it can add up to tens of thousands. The hard part is that you can't win back what you can't see. So I've put together a short Workflow Health Check for you, just below this video. It takes about two minutes, and it shows you where ${co} sits today, and the one area most likely to be leaking margin. Even if WorkflowMAX is never the right fit for you, you'll walk away knowing your number. Have a look, and if it's useful, I'd genuinely love to compare notes. Thanks ${f}, and have a great day.`;
}

async function members(listId) {
  let after, ids = [];
  do {
    const r = await hs(`/crm/v3/lists/${listId}/memberships?limit=100${after ? `&after=${after}` : ''}`);
    const b = await r.json();
    ids.push(...(b.results || []).map(x => x.recordId));
    after = b.paging?.next?.after;
  } while (after);
  return ids;
}
async function readContacts(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const r = await hs('/crm/v3/objects/contacts/batch/read', { method: 'POST', body: JSON.stringify({ properties: ['firstname', 'company', 'email', 'volcano_icp_vertical'], inputs: ids.slice(i, i + 100).map(id => ({ id })) }) });
    const b = await r.json();
    out.push(...(b.results || []).map(c => ({ id: c.id, firstName: cleanFirst(c.properties.firstname), company: cleanCompany(c.properties.company), email: c.properties.email, vertical: c.properties.volcano_icp_vertical })));
  }
  return out;
}
async function ensureVideoProp() {
  const r = await hs(`/crm/v3/properties/contacts/${VIDEO_URL_PROP}`);
  if (r.status === 200) return 'exists';
  const create = await hs('/crm/v3/properties/contacts', { method: 'POST', body: JSON.stringify({ name: VIDEO_URL_PROP, label: 'Volcano HeyGen video URL', type: 'string', fieldType: 'text', groupName: PROP_GROUP }) });
  if (create.status >= 400) { // fall back to default group
    const retry = await hs('/crm/v3/properties/contacts', { method: 'POST', body: JSON.stringify({ name: VIDEO_URL_PROP, label: 'Volcano HeyGen video URL', type: 'string', fieldType: 'text', groupName: 'contactinformation' }) });
    return retry.status < 400 ? 'created' : `FAILED ${await retry.text()}`;
  }
  return 'created';
}
async function genVideo(script) {
  const payload = { caption: true, video_inputs: [{ character: { type: 'avatar', avatar_id: AVATAR_ID, avatar_style: 'normal' }, voice: { type: 'text', input_text: script, voice_id: VOICE_ID }, background: { type: 'color', value: '#FFFFFF' } }], dimension: DIM };
  const r = await hg('/v2/video/generate', { method: 'POST', body: JSON.stringify(payload) });
  const b = await r.json();
  if (!b?.data?.video_id) throw new Error('generate failed: ' + JSON.stringify(b?.error || b));
  return b.data.video_id;
}
async function poll(id, maxMin = 12) {
  const until = Date.now() + maxMin * 60000;
  while (Date.now() < until) {
    const r = await hg(`/v1/video_status.get?video_id=${id}`);
    const d = (await r.json())?.data || {};
    if (d.status === 'completed') return d.video_url_caption || d.video_url;
    if (d.status === 'failed') throw new Error('video failed: ' + JSON.stringify(d.error));
    await sleep(8000);
  }
  throw new Error('timed out');
}
async function writeBack(id, url) {
  await hs(`/crm/v3/objects/contacts/${id}`, { method: 'PATCH', body: JSON.stringify({ properties: { [VIDEO_URL_PROP]: url } }) });
}

// ---- run ----
if (!HEYGEN || !TOKEN) { console.error('Missing HEYGEN_API_KEY or HUBSPOT_TOKEN in .env'); process.exit(1); }
console.log(`Mode: ${GENERATE ? 'GENERATE (limit ' + limArg + ')' : 'DRY RUN (no video, no writes)'}`);
const ids = await members(LIST_ID);
console.log(`List ${LIST_ID}: ${ids.length} contacts`);
let contacts = await readContacts(ids);
const unknown = contacts.filter(c => !classify(c.vertical).known);
if (unknown.length) console.log(`Note: ${unknown.length} contacts have a missing/unmapped vertical -> generic services script. (e.g. ${unknown.slice(0,3).map(c=>c.company+':'+(c.vertical||'blank')).join(', ')})`);

fs.mkdirSync(path.join(__dirname, 'output'), { recursive: true });

if (!GENERATE) {
  const rows = [['id','firstName','company','vertical','model','script']];
  for (const c of contacts) rows.push([c.id, c.firstName||'', c.company||'', c.vertical||'', classify(c.vertical).model, renderScript(c).replace(/"/g,'""')]);
  const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n');
  fs.writeFileSync(path.join(__dirname, 'output', 'volcano-scripts.csv'), csv);
  console.log(`\nWrote output/volcano-scripts.csv (${contacts.length} scripts).\n--- first 3 previews ---`);
  contacts.slice(0, 3).forEach(c => console.log(`\n[${c.firstName} @ ${c.company} | ${c.vertical||'?'}]\n${renderScript(c)}`));
  console.log('\nReview the CSV. To generate videos for a few: node heygen-batch.mjs --generate --limit 3');
  process.exit(0);
}

// GENERATE
if (NOWRITE) console.log('PREVIEW mode: generating videos for review, NOT writing back to HubSpot.');
else console.log('Ensuring write-back property...', await ensureVideoProp());
const targets = contacts.slice(0, LIMIT);
console.log(`Generating ${targets.length} video(s) sequentially...`);
const results = [['id','company','status','video_url']];
for (const c of targets) {
  try {
    process.stdout.write(`- ${c.firstName} @ ${c.company}: generating... `);
    const vid = await genVideo(renderScript(c));
    const url = await poll(vid);
    if (!NOWRITE) { await writeBack(c.id, url); console.log('done -> written back'); }
    else console.log('done (preview, not written back)');
    results.push([c.id, c.company||'', 'completed', url]);
  } catch (e) {
    console.log('ERROR ' + e.message);
    results.push([c.id, c.company||'', 'error', String(e.message)]);
  }
}
const outName = NOWRITE ? 'preview.csv' : 'results.csv';
fs.writeFileSync(path.join(__dirname, 'output', outName), results.map(r => r.map(x => `"${x}"`).join(',')).join('\n'));
console.log(`\nWrote output/${outName}`);
if (NOWRITE) console.log('Review the video(s). If the pacing is right: node heygen-batch.mjs --generate --limit 3');
