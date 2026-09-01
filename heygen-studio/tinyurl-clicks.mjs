// Harvests per-link click counts from TinyURL and attributes them back to a contact
// and touchpoint, so LinkedIn resource clicks become a real metric.
//
// Why this exists: LinkedIn reports nothing about link clicks, and the DM/InMail copy
// sends branded wfmax.info short links. TinyURL's /alias endpoint returns both `hits`
// (a click counter) and the destination URL — and the destination carries our own blob
// (email=, tool=), so the alias -> (contact, touchpoint) mapping can be rebuilt from
// TinyURL's own data without us having logged it at push time.
//
// Two caveats, deliberately surfaced rather than hidden in the numbers:
//  - `hits` counts every fetch, including LinkedIn's unfurl crawler, email/security
//    scanners and any manual testing. It overstates real human clicks, so treat it as
//    directional and comparative, not exact.
//  - TinyURL's /urls list ignores its `page` param (verified 2026-08-29: every page
//    returns the identical 1172 rows), so the alias list is one flat fetch, not paged.
//
// Run: node tinyurl-clicks.mjs        -> writes tinyurl-clicks.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envGet = (k) => {
  if (process.env[k]) return process.env[k];
  try { const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)\\s*$`, 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined; } catch { return undefined; }
};
const TK = envGet('TINYURL_API_TOKEN');
const DOMAIN = envGet('TINYURL_DOMAIN') || 'wfmax.info';
const CACHE = path.join(__dirname, 'tinyurl-cache.json');   // alias -> destination (immutable)
const OUT = path.join(__dirname, 'tinyurl-clicks.json');

const TOOL_LABEL = { intro: 'Intro video', tp1: 'Health check', tp2: 'Calculator', tp3: 'Benchmark', tp4: 'Demo', tp5: 'Firms like yours', tp6: 'Resource hub' };

const api = (p) => fetch('https://api.tinyurl.com' + p, { headers: { authorization: `Bearer ${TK}`, accept: 'application/json' } });

async function listAliases() {
  const r = await api('/urls?page=1');
  if (r.status !== 200) throw new Error(`/urls -> ${r.status}`);
  const b = await r.json();
  return (b.data || []).filter((x) => x.domain === DOMAIN && !x.deleted).map((x) => x.alias);
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); }
  }));
  return out;
}

async function main() {
  if (!TK) { console.error('No TINYURL_API_TOKEN in .env'); process.exit(1); }
  const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};

  const aliases = await listAliases();
  console.log(`aliases on ${DOMAIN}: ${aliases.length}`);

  let fetched = 0, failed = 0;
  const rows = await pool(aliases, 8, async (a) => {
    try {
      const r = await api(`/alias/${DOMAIN}/${a}`);
      if (r.status !== 200) { failed++; return null; }
      const d = (await r.json()).data || {};
      fetched++;
      // destination is immutable once created — cache it so future runs only need hits
      if (d.url) cache[a] = d.url;
      return { alias: a, hits: d.hits || 0, url: d.url || cache[a] || '', created: d.created_at || '' };
    } catch { failed++; return null; }
  });
  fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2));

  // attribute each alias to a contact + touchpoint by parsing our own blob out of the destination
  const links = [];
  for (const row of rows.filter(Boolean)) {
    if (!row.url) continue;
    let q;
    try { q = new URL(row.url).searchParams; } catch { continue; }
    const email = (q.get('email') || '').toLowerCase();
    const tool = q.get('tool') || '';
    if (!email || !tool) continue;              // not one of our personalised links
    links.push({ alias: row.alias, email, tool, toolLabel: TOOL_LABEL[tool] || tool, hits: row.hits, created: row.created, company: q.get('company') || '', presenter: q.get('presenter') || '' });
  }

  // roll up per contact and per touchpoint
  const byContact = {};
  const byTool = {};
  for (const l of links) {
    (byContact[l.email] ||= { email: l.email, company: l.company, presenter: l.presenter, total: 0, tools: {} });
    byContact[l.email].total += l.hits;
    byContact[l.email].tools[l.tool] = (byContact[l.email].tools[l.tool] || 0) + l.hits;
    byTool[l.tool] = (byTool[l.tool] || 0) + l.hits;
  }

  const out = {
    generated: new Date().toISOString(),
    aliasesSeen: aliases.length,
    aliasesFetched: fetched,
    aliasesFailed: failed,
    personalisedLinks: links.length,
    contacts: Object.values(byContact).sort((a, b) => b.total - a.total),
    byTool,
    note: 'hits include unfurl crawlers, link scanners and manual testing - directional, not exact',
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  console.log(`fetched ${fetched}, failed ${failed}`);
  console.log(`personalised links attributed: ${links.length} across ${out.contacts.length} contacts`);
  console.log('clicks by touchpoint:', JSON.stringify(byTool));
  console.log('top contacts by clicks:');
  out.contacts.slice(0, 12).forEach((c) => console.log('  ', String(c.total).padStart(4), c.email, '|', c.company, '|', Object.entries(c.tools).map(([t, n]) => `${t}:${n}`).join(' ')));
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
