// Branded short links, so LinkedIn clicks become countable.
//
// WHY THIS IS NEEDED AT ALL. LinkedIn reports nothing about link clicks: there is no open
// rate, no click event, no read receipt for a third-party tool. A raw URL in a DM is
// invisible. A wfmax.info short link is not: TinyURL's /alias endpoint returns a `hits`
// counter, and because the destination carries our own email= parameter, tinyurl-clicks.mjs
// can rebuild alias -> contact without us having logged anything at push time.
//
// WHAT `hits` ACTUALLY COUNTS, stated rather than buried: every fetch. LinkedIn's own unfurl
// crawler previews links in the message composer, security appliances follow them, and so does
// anyone testing. It overstates real clicks and is directional, not exact.
//
// This is why the demo link still points at our landing page rather than straight at YouTube.
// A short-link hit with no matching page view is a crawler; a hit WITH one is a person. That
// pair is what exposed the Volcano problem, where 11 clicks produced no page views at all.
//
// Same create call and the same cache file as server.mjs's shorten(), so an alias is never
// bought twice for the same URL and tinyurl-clicks.mjs sees one consistent alias space.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^\\s*' + k + '\\s*=\\s*(.+)\\s*$', 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');

const CACHE_PATH = p('tinyurl-cache.json');
const loadCache = () => (fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) : {});
let cache = loadCache();
const saveCache = () => fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));

export const cacheSize = () => Object.keys(cache).length;

// Returns the short URL, or the original if every attempt fails. Never throws: a long link
// still works, and failing the whole push over a shortener would be the wrong trade.
export async function shorten(url) {
  if (cache[url]) return cache[url];

  const token = g('TINYURL_API_TOKEN');
  const create = async (domain) => {
    const r = await fetch('https://api.tinyurl.com/create', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(domain ? { url, domain } : { url }),
    });
    const b = await r.json().catch(() => null);
    return r.ok && b?.data?.tiny_url ? b.data.tiny_url : null;
  };

  if (token) {
    try {
      // The branded domain has to be verified in the TinyURL dashboard; if the account does not
      // recognise it, take an unbranded tinyurl.com link rather than lose the tracking.
      const domain = g('TINYURL_DOMAIN');
      const short = (domain && await create(domain)) || await create(null);
      if (short) { cache[url] = short; saveCache(); return short; }
    } catch { /* fall through */ }
  }
  try {
    const r = await fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(url));
    if (r.ok) {
      const t = (await r.text()).trim();
      if (/^https?:\/\//.test(t)) { cache[url] = t; saveCache(); return t; }
    }
  } catch { /* fall through */ }
  return url;
}

// True when the value came back shortened rather than passed through unchanged.
export const isShort = (original, result) => result !== original;
