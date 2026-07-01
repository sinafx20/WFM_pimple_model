// Validates the HeyGen API key and lists your avatars.
// Reads HEYGEN_API_KEY from the environment or from ./.env (gitignored).
// Run: node validate.mjs
import fs from 'fs';

let key = process.env.HEYGEN_API_KEY;
try {
  const t = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8');
  const m = t.match(/^\s*HEYGEN_API_KEY\s*=\s*(.+)\s*$/m);
  if (m && !key) key = m[1].trim().replace(/^["']|["']$/g, '');
} catch {}

if (!key) {
  console.error('No HEYGEN_API_KEY found (env or .env). Copy .env.example to .env and paste your key.');
  process.exit(1);
}
console.log(`Key loaded (length ${key.length}). Not printing the key itself.`);

const tryCall = async (header) => {
  const r = await fetch('https://api.heygen.com/v2/avatars', { headers: { ...header, accept: 'application/json' } });
  const body = await r.json().catch(() => null);
  return { status: r.status, body, header: Object.keys(header)[0] };
};

// HeyGen v2 uses X-Api-Key; fall back to Bearer just in case.
let res = await tryCall({ 'X-Api-Key': key });
if (res.status === 401 || res.status === 403) {
  const alt = await tryCall({ Authorization: `Bearer ${key}` });
  if (alt.status === 200) res = alt;
}

console.log(`\nGET /v2/avatars -> HTTP ${res.status} (auth header tried: ${res.header})`);

if (res.status !== 200) {
  console.log('Response:', JSON.stringify(res.body)?.slice(0, 600));
  console.log('\n>> Key was NOT accepted by HeyGen directly. If 401/403, the key/account is the problem (NOT Clay).');
  process.exit(0);
}

const avatars = res.body?.data?.avatars || res.body?.data || [];
const photos  = res.body?.data?.talking_photos || [];
console.log(`Avatars: ${avatars.length}${photos.length ? `, talking photos: ${photos.length}` : ''}`);
avatars.slice(0, 12).forEach(a => console.log(`  - ${a.avatar_id || a.id}  |  ${a.avatar_name || a.name || ''}  ${a.gender || ''}`));
console.log('\n>> Key IS valid against HeyGen. If Clay still rejects it, the bug is Clay-side — solid evidence for your ticket.');
