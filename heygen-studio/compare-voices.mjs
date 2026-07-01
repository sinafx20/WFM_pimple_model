// A/B voice comparison: same script + same avatar, different voices. No write-back.
// Run: node compare-voices.mjs
import fs from 'node:fs';
const env = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8');
const HEYGEN = (env.match(/HEYGEN_API_KEY\s*=\s*(.+)/) || [])[1].trim();
const AVATAR = 'b8f33c1ab4cd48dbb356d9d38871703a'; // Sina - new avatar

const VOICES = [
  { id: '3de45a1db930474dba4547f14132e7b7', label: "Sina's main voice" },
  { id: '7415834bc7f2415e95687b564b9c8708', label: "Sina's new voice" },
  { id: '89f452119de44f099a253af3c9d83df7', label: 'Sina Voice Test 3' },
];

// Same script for every voice so the ONLY variable is the voice (services template, sample contact).
const f = 'Andrew', co = 'Project Urban', word = 'architecture';
const SCRIPT = `Hey ${f}, I'm Sina from WorkflowMAX. I record a few of these for ${word} firms each week. I wanted to send ${co} one, because there's a pattern I keep seeing with firms your size. The work gets done. The clients are happy. But a slice of the time behind it never quite makes it onto an invoice. A few unbilled minutes here. Some scope that creeps past the fee there. On its own, that's nothing. But across a year, for a firm your size, it often adds up to well into five figures. And the tricky part is this. You can't win back what you can't see. So I've put together a quick Workflow Health Check for you. It's just below this video. It only takes about two minutes. It shows you where ${co} sits today, and the one area most likely to be quietly leaking margin. Even if WorkflowMAX is never the right fit for you, you'll walk away knowing your number. Have a look. And if it's useful, I'd genuinely love to compare notes. Thanks ${f}. Have a great day.`;

const hg = (p, o = {}) => fetch(`https://api.heygen.com${p}`, { ...o, headers: { 'X-Api-Key': HEYGEN, 'content-type': 'application/json', accept: 'application/json', ...(o.headers || {}) } });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gen(voice_id) {
  const payload = { video_inputs: [{ character: { type: 'avatar', avatar_id: AVATAR, avatar_style: 'normal' }, voice: { type: 'text', input_text: SCRIPT, voice_id }, background: { type: 'color', value: '#FFFFFF' } }], dimension: { width: 1280, height: 720 } };
  const r = await hg('/v2/video/generate', { method: 'POST', body: JSON.stringify(payload) });
  const b = await r.json();
  if (!b?.data?.video_id) throw new Error(JSON.stringify(b?.error || b));
  return b.data.video_id;
}
async function poll(id) {
  for (let i = 0; i < 90; i++) {
    const d = (await (await hg(`/v1/video_status.get?video_id=${id}`)).json())?.data || {};
    if (d.status === 'completed') return d.video_url;
    if (d.status === 'failed') throw new Error(JSON.stringify(d.error));
    await sleep(8000);
  }
  throw new Error('timeout');
}

const out = [['label', 'voice_id', 'url']];
for (const v of VOICES) {
  try {
    process.stdout.write(`Generating with ${v.label}... `);
    const url = await poll(await gen(v.id));
    console.log('done');
    out.push([v.label, v.id, url]);
  } catch (e) { console.log('ERROR ' + e.message); out.push([v.label, v.id, 'ERROR ' + e.message]); }
}
fs.mkdirSync(new URL('./output', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./output/voice-compare.csv', import.meta.url), out.map(r => r.map(x => `"${x}"`).join(',')).join('\n'));
console.log('\nWrote output/voice-compare.csv');
