// How many of our recorded "opens" are plausibly people?
//
// An open is a 1x1 pixel fetch. Apple Mail Privacy Protection prefetches every image for
// every Mail user before anyone reads anything; Gmail proxies images; Defender and
// Proofpoint fetch them while scanning. All of those register as opens.
//
// Machine prefetch happens within seconds of delivery. A person takes minutes to days.
// So the gap between when we last contacted a lead and when the open fired is the tell.
//
// CAVEAT, stated rather than buried: timestamp_last_open and timestamp_last_contact can
// refer to different messages in a sequence, so a negative gap means the recorded open
// belongs to an earlier email, not that something is broken. Those are reported
// separately rather than folded into the human count.
import fs from 'node:fs';
const K = (fs.readFileSync('.env', 'utf8').match(/^INSTANTLY_API_KEY=(.+)$/m) || [])[1].trim();
const map = JSON.parse(fs.readFileSync('instantly-real-campaigns.json', 'utf8'));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let last = 0;
async function api(body) {
  const wait = 3300 - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  for (let a = 1; a <= 5; a++) {
    last = Date.now();
    const r = await fetch('https://api.instantly.ai/api/v2/leads/list', {
      method: 'POST', headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) return r.json();
    if (r.status === 429) { await sleep(15000 * a); continue; }
    throw new Error('Instantly ' + r.status + ': ' + (await r.text()).slice(0, 150));
  }
  throw new Error('rate limited after 5 attempts');
}

const leads = [];
for (const [vert, byAe] of Object.entries(map)) {
  for (const [ae, id] of Object.entries(byAe)) {
    let cur = null;
    do {
      const b = await api({ campaign: id, limit: 100, ...(cur ? { starting_after: cur } : {}) });
      (b.items || []).forEach(l => leads.push({ ...l, vert, ae }));
      cur = b.next_starting_after || null;
    } while (cur);
  }
}
if (!leads.length) { console.error('no leads returned - API fault, not an empty pipeline'); process.exit(1); }
console.log('leads scanned:', leads.length);

const opened = leads.filter(l => (l.email_open_count || 0) > 0);
console.log('leads with at least one open:', opened.length);

const buckets = { 'open predates last send': 0, 'under 60s': 0, '1-5 min': 0, '5-60 min': 0, '1-24 h': 0, 'over 24 h': 0, 'no send time': 0 };
const counts = {};
for (const l of opened) {
  counts[l.email_open_count] = (counts[l.email_open_count] || 0) + 1;
  const openAt = l.timestamp_last_open ? new Date(l.timestamp_last_open).getTime() : null;
  const sentAt = l.timestamp_last_contact ? new Date(l.timestamp_last_contact).getTime() : null;
  if (!openAt || !sentAt) { buckets['no send time']++; continue; }
  const g = (openAt - sentAt) / 1000;
  if (g < 0) buckets['open predates last send']++;
  else if (g < 60) buckets['under 60s']++;
  else if (g < 300) buckets['1-5 min']++;
  else if (g < 3600) buckets['5-60 min']++;
  else if (g < 86400) buckets['1-24 h']++;
  else buckets['over 24 h']++;
}
console.log('\ngap between last send and the recorded open:');
Object.entries(buckets).forEach(([k, n]) => { if (n) console.log('  ' + String(n).padStart(4) + '  ' + k); });

console.log('\nhow many times each opener "opened":');
Object.keys(counts).map(Number).sort((a, b) => a - b).forEach(n => console.log('  ' + String(counts[n]).padStart(4) + ' leads opened ' + n + 'x'));

const clickers = opened.filter(l => (l.email_click_count || 0) > 0).length;
const repliers = opened.filter(l => (l.email_reply_count || 0) > 0).length;
console.log('\nof the ' + opened.length + ' who "opened": ' + clickers + ' clicked, ' + repliers + ' replied');
fs.writeFileSync('_opens-check.json', JSON.stringify({ generated: new Date().toISOString(), scanned: leads.length, opened: opened.length, buckets, counts, clickers, repliers }, null, 1));
