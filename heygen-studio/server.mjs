// Local HeyGen studio server. The API key stays here (server-side); the browser
// only talks to these local endpoints. Run: node server.mjs  ->  http://localhost:5178
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { buildRealSequence, loadCopy as loadHeyreachCopy, VERTICALS as HEYREACH_VERTICALS } from './heyreach-real-sequences.mjs';
import { buildCompactSequence, loadCompactCopy } from './heyreach-sequence.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// hubspot_owner_id -> presenter/sender key. Same two real owners used throughout
// (public/index.html's KNOWN_OWNERS, heyreach-seed-real-campaigns.mjs's OWNER map).
const OWNER_NAME = { '80127259': 'sina', '80406430': 'denzel' };
const PORT = 5178;

// Read .env fresh each call so added tokens (files scope, logo.dev) are picked up without restart.
const envGet = (k) => {
  if (process.env[k]) return process.env[k];
  try { const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)\\s*$`, 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined; } catch { return undefined; }
};
const KEY = envGet('HEYGEN_API_KEY');
const HUB = () => envGet('HUBSPOT_TOKEN');
const LOGODEV = () => envGet('LOGODEV_TOKEN');
const INSTANTLY = () => envGet('INSTANTLY_API_KEY');
const HEYREACH = () => envGet('HEYREACH_API_KEY'); // add to .env to activate LinkedIn dispatch
// First run on a new machine: .env is gitignored, so guide the user to create it.
if (!fs.existsSync(path.join(__dirname, '.env'))) {
  console.error('\n  No heygen-studio/.env found (it is gitignored, so it did not clone).');
  console.error('  Create it and paste your keys:');
  console.error('    cp heygen-studio/.env.example heygen-studio/.env');
  console.error('  Keys: HEYGEN_API_KEY, HUBSPOT_TOKEN, LOGODEV_TOKEN, INSTANTLY_API_KEY, HEYREACH_API_KEY');
  console.error('  (Rotate any key that was shared in chat.)\n');
  process.exit(1);
}
if (!KEY) { console.error('.env found but HEYGEN_API_KEY is empty — fill in the keys in heygen-studio/.env'); process.exit(1); }

// Clean names for natural pronunciation + no legal suffixes (applied everywhere: script, thumbnail, blob, email, LinkedIn).
const LEGAL = /[\s,]+(?:pty\.?\s*ltd\.?|pte\.?\s*ltd\.?|p\/l|proprietary\s+limited|limited|ltd\.?|l\.?l\.?c\.?|incorporated|inc\.?|corporation|corp\.?|gmbh|plc|pty\.?|s\.?a\.?|s\.?r\.?l\.?|b\.?v\.?)\.?\s*$/i;
function cleanCompany(name) { let s = (name || '').trim(); for (let i = 0; i < 3; i++) { const n = s.replace(LEGAL, '').replace(/[,\s]+$/, '').trim(); if (n === s) break; s = n; } return s || (name || '').trim(); }
// Some HubSpot/Clay records store first names as all-lowercase or all-caps
// (e.g. "vince" instead of "Vince"), which leaked into a LinkedIn DM verbatim
// during test feedback. Only fix names with NO case signal at all — a name
// that's already mixed case (McDonald, DeSouza) is left untouched since that's
// presumably intentional.
function properCase(s) { return s === s.toLowerCase() || s === s.toUpperCase()
  ? s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, sep, c) => sep + c.toUpperCase())
  : s; }
function cleanFirst(name) { const s = (name || '').trim(); const r = s.replace(/^(?:[A-Za-z]\.?\s+)+/, '').trim(); return properCase(r || s); }

const hg = (p, opts = {}) => fetch(`https://api.heygen.com${p}`, {
  ...opts,
  headers: { 'X-Api-Key': KEY, 'accept': 'application/json', 'content-type': 'application/json', ...(opts.headers || {}) },
});

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
// Malformed JSON must not throw inside the 'end' callback — that escapes the
// route try/catch and kills the whole process.
const readBody = (req) => new Promise((r) => { let d = ''; req.on('data', c => d += c); req.on('end', () => { try { r(d ? JSON.parse(d) : {}); } catch { r({}); } }); });

// --- co-branded thumbnail compositor ---
const FACE = { sina: path.join(__dirname, 'face-sina.png'), denzel: path.join(__dirname, 'face-denzel.png') };
// Per-presenter routing: booking link (rides in the blob so the LP books the
// actual sender) and the product-demo recording (YouTube ID) for tp4 + the
// demo-email thumbnail. Mirrors PRESENTERS in public/index.html.
const PRESENTER_META = {
  sina: { booking: 'https://meetings.hubspot.com/szarei', demoVideo: 'X7RX3Bzz0sk', fullName: 'Sina Zarei', title: 'Account Executive' },
  denzel: { booking: 'https://meetings.hubspot.com/denzel-kereama', demoVideo: '699el1Gba3M', fullName: 'Denzel Kereama', title: 'Account Executive' },
};
// Hand-picked product-demo frames (Sina chose these) for the demo-email thumbnail's
// left half. Drop demo-frame-<presenter>.png next to server.mjs; the presenter's
// YouTube maxres frame is the fallback when the file is missing.
const DEMO_FRAME = { sina: path.join(__dirname, 'demo-frame-sina.png'), denzel: path.join(__dirname, 'demo-frame-denzel.png') };
const demoFrameBuf = async (pKey, meta) => {
  try { return fs.readFileSync(DEMO_FRAME[pKey]); } catch {}
  return Buffer.from(await (await fetch(`https://img.youtube.com/vi/${meta.demoVideo}/maxresdefault.jpg`)).arrayBuffer());
};
// fallback=404 is load-bearing: without it logo.dev silently returns a 200 + a
// generated single-letter monogram (a dark rounded square with a big initial) for any
// domain it doesn't recognize. That monogram is indistinguishable from a real simple
// logo by pixel analysis alone (confirmed 2026-07-09: a nonexistent test domain and
// Stripe's real logo have the same "solid bg + centered mark" structure) — so without
// this param, sanitizeLogo's content check can't catch it and a fake domain silently
// gets a plausible-looking wrong "logo". With fallback=404, no-match is an actual
// non-200 response, which getLogoBuffer treats the same as a network failure.
const logoImgUrl = (domain) => `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGODEV()}&size=300&format=png&retina=true&fallback=404`;

// logo.dev is unreliable for the small/niche B2B firms this campaign actually targets
// (verified 2026-07-09: wrong company entirely for jhc.consulting, a near-blank image
// for refindable.com, an unverifiable generic mark for setupmysystem.com.au). Known-
// good sources checked by hand win outright; every other domain still goes through
// logo.dev but gets sanity-checked before use (see sanitizeLogo below).
const LOGO_OVERRIDE = {
  'bluerock.com.au': path.join(__dirname, 'logo-overrides', 'bluerock.svg'),
  'jhc.consulting': path.join(__dirname, 'logo-overrides', 'jhc.png'),
  'refindable.com': path.join(__dirname, 'logo-overrides', 'refindable.png'),
  'setupmysystem.com.au': path.join(__dirname, 'logo-overrides', 'setupmysystem.png'),
};

const rgbHex = ({ r, g, b }) => '#' + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
// LinkedIn DMs show the raw URL as text (rarely auto-unfurls automated messages),
// so the giant blob link looks terrible. Shortening resolves to the same co-branded
// page. Shared by /api/heyreach/push and /api/contact-preview (bulletproof check).
const shorten = async (url) => {
  try { const r = await fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(url)); if (r.ok) { const t = (await r.text()).trim(); if (/^https?:\/\//.test(t)) return t; } } catch {}
  return url; // fall back to the full URL if the shortener is unavailable
};

// A logo built for a dark background (white/light mark) is invisible on our white
// thumbnail card and looks blank in the white-background email header. Recolor
// near-white, low-saturation pixels to dark; leave already-saturated brand-color
// pixels untouched. Also flags near-empty images (logo.dev sometimes returns an
// almost-blank result) as unusable so the caller can fall back to a text card.
async function sanitizeLogo(buf) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  let contentPx = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 10) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    if (sat < 0.15 && mx > 140) { data[i] = 26; data[i + 1] = 26; data[i + 2] = 26; contentPx++; } // near-white/gray -> dark
    else if (a >= 128) contentPx++; // saturated or dark content
  }
  const totalPx = info.width * info.height;
  const usable = contentPx / totalPx > 0.02; // >2% real content, else treat as blank
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
  return { buf: png, usable };
}
// Clean typographic fallback when no usable logo image exists at all. Picks a
// font-size from the label length, then only pins textLength (force-fitting the
// glyphs to the safe width) if that size would still overflow — short names render
// at natural size/spacing instead of getting stretched to fill the card.
async function textFallbackCard(companyName, cardW, cardH) {
  const label = (companyName || 'this firm').trim().slice(0, 28);
  const safeW = cardW - 32;
  const size = Math.min(36, Math.max(16, Math.round(280 / Math.max(label.length, 6))));
  const estWidth = label.length * size * 0.58; // rough bold-sans average glyph width
  const fitAttr = estWidth > safeW ? ` textLength="${safeW}" lengthAdjust="spacingAndGlyphs"` : '';
  const esc = label.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}">
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-weight="700" font-size="${size}"${fitAttr} fill="#0A2F28">${esc}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
// Single entry point: override -> logo.dev -> sanitize -> usable or text-fallback.
// Returns a PNG buffer only (compositing use); callers that also need a stable
// public URL should upload it themselves (see /api/writeback).
async function getLogoBuffer(domain, companyName, cardW = 274, cardH = 154) {
  const override = LOGO_OVERRIDE[(domain || '').toLowerCase()];
  try {
    let raw = null;
    if (override) raw = await sharp(override).png().toBuffer();
    else if (LOGODEV() && domain) {
      const r = await fetch(logoImgUrl(domain));
      if (r.ok) raw = Buffer.from(await r.arrayBuffer()); // non-200 (incl. fallback=404) -> no real logo, fall through
    }
    if (raw) {
      const { buf, usable } = await sanitizeLogo(raw);
      if (usable) return { buf, fellBack: false };
    }
  } catch { /* bad/unparseable image data -> fall through to text card */ }
  return { buf: await textFallbackCard(companyName, cardW, cardH), fellBack: true };
}
async function vibrant(buf) {
  const { data, info } = await sharp(buf).resize(72, 72, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let best = null, bs = -1;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = info.channels > 3 ? data[i + 3] : 255; if (a < 128) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, lum = (r + g + b) / 3;
    if (lum > 238 || lum < 16) continue; const sc = sat * (mx - mn);
    if (sat > 0.22 && sc > bs) { bs = sc; best = { r, g, b }; }
  }
  return best || { r: 10, g: 47, b: 40 };
}
async function composeThumb(presenterKey, logoBuf, rgb, leftBuf = null) {
  // leftBuf overrides the presenter face frame (e.g. a product-demo video frame
  // for the demo-email thumbnail); layout is otherwise identical.
  const W = 1088, H = 612, faceW = 653, panelW = W - faceW;
  const facePath = FACE[presenterKey] || FACE.sina;
  const face = await sharp(leftBuf || facePath).resize({ width: faceW, height: H, fit: 'cover', position: 'attention' }).toBuffer();
  const cardW = 330, cardH = 210;
  const card = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}"><rect rx="18" width="${cardW}" height="${cardH}" fill="#ffffff"/></svg>`))
    .composite([{ input: await sharp(logoBuf).resize({ width: cardW - 56, height: cardH - 56, fit: 'inside' }).toBuffer(), gravity: 'center' }]).png().toBuffer();
  const play = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><circle cx="75" cy="75" r="75" fill="#0A2F28" fill-opacity="0.78"/><path d="M60 46 L60 104 L106 75 Z" fill="#fff"/></svg>`);
  return await sharp({ create: { width: W, height: H, channels: 4, background: { ...rgb, alpha: 1 } } }).composite([
    { input: face, left: 0, top: 0 },
    { input: card, left: faceW + Math.round((panelW - cardW) / 2), top: Math.round((H - cardH) / 2) },
    { input: play, left: Math.round(W / 2 - 75), top: Math.round(H / 2 - 75) },
  ]).png().toBuffer();
}
async function uploadPublic(buf, name, type = 'image/png') {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type }), name);
  fd.append('options', JSON.stringify({ access: 'PUBLIC_INDEXABLE', overwrite: true }));
  fd.append('folderPath', '/volcano-assets');
  const r = await fetch('https://api.hubapi.com/files/v3/files', { method: 'POST', headers: { authorization: `Bearer ${HUB()}` }, body: fd });
  return (await r.json()).url || '';
}

// Disk cache: HeyGen's /v2/avatars can take ~60s, so cache the result (24h TTL).
async function cached(name, ttlMs, producer) {
  const f = path.join(__dirname, name);
  try { if (Date.now() - fs.statSync(f).mtimeMs < ttlMs) return JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  const data = await producer();
  try { fs.writeFileSync(f, JSON.stringify(data)); } catch {}
  return data;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (u.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
    }
    if (u.pathname === '/dashboard') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(fs.readFileSync(path.join(__dirname, 'public', 'dashboard.html')));
    }

    // --- Engagement cockpit: join HubSpot contacts with Instantly engagement, rank ---
    if (u.pathname === '/api/dashboard') {
      const T = HUB(), K = INSTANTLY();
      const LIST = u.searchParams.get('list') || '3698';
      const hs = (p, o = {}) => fetch(`https://api.hubapi.com${p}`, { ...o, headers: { authorization: `Bearer ${T}`, 'content-type': 'application/json', ...(o.headers || {}) } });
      // 1) contacts
      let after, ids = [];
      do { const r = await hs(`/crm/v3/lists/${LIST}/memberships?limit=100${after ? `&after=${after}` : ''}`); const b = await r.json(); ids.push(...(b.results || []).map(x => x.recordId)); after = b.paging?.next?.after; } while (after);
      const props = ['firstname', 'company', 'email', 'volcano_icp_vertical', 'hubspot_owner_id', 'volcano_heygen_video_url', 'volcano_thumb_url', 'volcano_lead_score', 'hs_linkedin_url'];
      const contacts = [];
      for (let i = 0; i < ids.length; i += 100) {
        const r = await hs('/crm/v3/objects/contacts/batch/read', { method: 'POST', body: JSON.stringify({ properties: props, inputs: ids.slice(i, i + 100).map(id => ({ id })) }) });
        (await r.json()).results?.forEach(c => { const p = c.properties; contacts.push({ id: c.id, firstName: cleanFirst(p.firstname), company: cleanCompany(p.company), email: (p.email || '').toLowerCase(), vertical: p.volcano_icp_vertical || '', owner: p.hubspot_owner_id || '', hasAssets: !!(p.volcano_thumb_url || p.volcano_heygen_video_url), hsScore: +(p.volcano_lead_score || 0), linkedin: !!p.hs_linkedin_url, linkedinUrl: p.hs_linkedin_url || '' }); });
      }
      // 2) Instantly engagement across Pimple (real) + Volcano TEST campaigns
      const camps = ((await (await fetch('https://api.instantly.ai/api/v2/campaigns?limit=100', { headers: { authorization: `Bearer ${K}` } })).json()).items || []).filter(c => /pimple|volcano/i.test(c.name));
      const eng = {};
      for (const camp of camps) {
        let starting, guard = 0;
        do {
          const r = await fetch('https://api.instantly.ai/api/v2/leads/list', { method: 'POST', headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json' }, body: JSON.stringify({ campaign: camp.id, limit: 100, ...(starting ? { starting_after: starting } : {}) }) });
          const b = await r.json(); const items = b.items || [];
          items.forEach(l => { if (l.email) eng[l.email.toLowerCase()] = { opens: l.email_open_count || 0, clicks: l.email_click_count || 0, replies: l.email_reply_count || 0, campaign: camp.name }; });
          starting = b.next_starting_after; guard++;
        } while (starting && guard < 20);
      }
      // 2b) HeyReach LinkedIn engagement (best effort; lead-status fields read defensively)
      const li = {};
      const HK = HEYREACH();
      if (HK) {
        try {
          const hrq = (p, body) => fetch(`https://api.heyreach.io/api/public${p}`, { method: 'POST', headers: { 'X-API-KEY': HK, 'content-type': 'application/json' }, body: JSON.stringify(body) });
          const cs = (await (await hrq('/campaign/GetAll', { offset: 0, limit: 100 })).json())?.items || [];
          for (const camp of cs) {
            let offset = 0, guard = 0;
            while (guard++ < 20) {
              const b = await (await hrq('/campaign/GetLeadsFromCampaign', { campaignId: camp.id, offset, limit: 100 })).json();
              const items = b?.items || [];
              items.forEach(it => {
                const prof = it.linkedInUserProfile || {};
                const status = String(it.status || it.leadStatus || it.state || '');
                const rec = { inCampaign: true, status, accepted: /accept|connected/i.test(status), replied: /repl/i.test(status) };
                const em = (prof.emailAddress || it.emailAddress || '').toLowerCase();
                if (em) li[em] = rec;
                if (prof.profileUrl) li[prof.profileUrl.replace(/\/+$/, '').toLowerCase()] = rec;
              });
              if (items.length < 100) break;
              offset += 100;
            }
          }
        } catch (e) { /* LinkedIn engagement is additive; ignore failures */ }
      }
      // 3) join + rank
      const rows = contacts.map(c => {
        const e = eng[c.email] || { opens: 0, clicks: 0, replies: 0, campaign: '' };
        const hubEng = e.opens * 2 + e.clicks * 10 + e.replies * 30;
        const l = li[c.email] || li[(c.linkedinUrl || '').replace(/\/+$/, '').toLowerCase()] || null;
        const liEng = l ? (l.accepted ? 8 : 0) + (l.replied ? 30 : 0) : 0;
        return { ...c, opens: e.opens, clicks: e.clicks, replies: e.replies, emailLive: !!eng[c.email], hubEng, liIn: !!l, liStatus: l ? l.status : '', liEng, total: hubEng + liEng + c.hsScore };
      }).sort((a, b) => b.total - a.total);
      return json(res, 200, { count: rows.length, emailLive: rows.filter(r => r.emailLive).length, liLive: rows.filter(r => r.liIn).length, rows });
    }

    if (u.pathname === '/api/avatars') {
      const data = await cached('avatars.cache.json', 864e5, async () => {
        const r = await hg('/v2/avatars');
        const b = await r.json();
        const avatars = (b?.data?.avatars || []).map(a => ({
          id: a.avatar_id, name: a.avatar_name || '', gender: a.gender || '',
          preview: a.preview_image_url || '', premium: !!a.premium,
        }));
        const photos = (b?.data?.talking_photos || []).map(p => ({
          id: p.talking_photo_id, name: p.talking_photo_name || 'Talking photo', gender: '',
          preview: p.preview_image_url || '', talkingPhoto: true,
        }));
        return { avatars, photos };
      });
      return json(res, 200, data);
    }

    if (u.pathname === '/api/voices') {
      const data = await cached('voices.cache.json', 864e5, async () => {
        const r = await hg('/v2/voices');
        const b = await r.json();
        const voices = (b?.data?.voices || []).map(v => ({
          id: v.voice_id, name: v.name || '', language: v.language || '', gender: v.gender || '',
          preview: v.preview_audio || '',
        }));
        return { voices };
      });
      return json(res, 200, data);
    }

    if (u.pathname === '/api/lists') {
      const q = u.searchParams.get('q') || '';
      const r = await fetch('https://api.hubapi.com/crm/v3/lists/search', { method: 'POST', headers: { authorization: `Bearer ${HUB()}`, 'content-type': 'application/json' }, body: JSON.stringify({ query: q, count: 40 }) });
      const b = await r.json();
      const lists = (b.lists || []).map(l => ({ id: l.listId, name: l.name, size: +(l.additionalProperties?.hs_list_size || 0) }));
      return json(res, 200, { lists });
    }

    if (u.pathname === '/api/contacts') {
      const TOKEN = (fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/HUBSPOT_TOKEN\s*=\s*(.+)/) || [])[1]?.trim();
      const hsb = (p, o = {}) => fetch(`https://api.hubapi.com${p}`, { ...o, headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(o.headers || {}) } });
      const LIST = u.searchParams.get('list') || '3698';
      let after, ids = [];
      do { const r = await hsb(`/crm/v3/lists/${LIST}/memberships?limit=100${after ? `&after=${after}` : ''}`); const b = await r.json(); ids.push(...(b.results || []).map(x => x.recordId)); after = b.paging?.next?.after; } while (after);
      const props = ['firstname', 'lastname', 'jobtitle', 'company', 'email', 'website', 'domain', 'country', 'volcano_icp_vertical', 'hubspot_owner_id', 'volcano_heygen_video_url', 'volcano_personalization', 'hs_linkedin_url'];
      const contacts = [];
      for (let i = 0; i < ids.length; i += 100) {
        const r = await hsb('/crm/v3/objects/contacts/batch/read', { method: 'POST', body: JSON.stringify({ properties: props, inputs: ids.slice(i, i + 100).map(id => ({ id })) }) });
        (await r.json()).results?.forEach(c => {
          const p = c.properties;
          const domain = (p.domain || p.website || (p.email || '').split('@')[1] || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
          contacts.push({ id: c.id, firstName: cleanFirst(p.firstname), lastName: p.lastname || '', jobtitle: p.jobtitle || '', company: cleanCompany(p.company), email: p.email || '', domain, country: p.country || '', vertical: p.volcano_icp_vertical || '', owner: p.hubspot_owner_id || '', hasVideo: !!p.volcano_heygen_video_url, videoUrl: p.volcano_heygen_video_url || '', blob: p.volcano_personalization || '', linkedin: !!p.hs_linkedin_url, linkedinUrl: p.hs_linkedin_url || '' });
        });
      }
      // Join sequence membership so the pipeline board lands every card in its
      // true stage on every pull (not just for pushes made this session).
      try {
        const K = INSTANTLY();
        if (K) {
          const camps = ((await (await fetch('https://api.instantly.ai/api/v2/campaigns?limit=100', { headers: { authorization: `Bearer ${K}` } })).json())?.items || []).filter(x => /pimple|volcano/i.test(x.name));
          const inInst = {};
          for (const camp of camps) {
            let starting, guard = 0;
            do {
              const b = await (await fetch('https://api.instantly.ai/api/v2/leads/list', { method: 'POST', headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json' }, body: JSON.stringify({ campaign: camp.id, limit: 100, ...(starting ? { starting_after: starting } : {}) }) })).json();
              (b.items || []).forEach(l => { if (l.email) inInst[l.email.toLowerCase()] = camp.id; });
              starting = b.next_starting_after; guard++;
            } while (starting && guard < 20);
          }
          contacts.forEach(c => { const id = inInst[(c.email || '').toLowerCase()]; if (id) { c.inInstantly = true; c.instCampId = id; } });
        }
      } catch (e) { /* membership join is additive */ }
      try {
        const HK = HEYREACH();
        if (HK) {
          const hrq = (p, body) => fetch(`https://api.heyreach.io/api/public${p}`, { method: 'POST', headers: { 'X-API-KEY': HK, 'content-type': 'application/json' }, body: JSON.stringify(body) });
          const cs = (await (await hrq('/campaign/GetAll', { offset: 0, limit: 100 })).json())?.items || [];
          const inLi = {};
          for (const camp of cs) {
            let offset = 0, guard = 0;
            while (guard++ < 20) {
              const b = await (await hrq('/campaign/GetLeadsFromCampaign', { campaignId: camp.id, offset, limit: 100 })).json();
              const items = b?.items || [];
              items.forEach(it => {
                const prof = it.linkedInUserProfile || {};
                const em = (prof.emailAddress || it.emailAddress || '').toLowerCase();
                if (em) inLi[em] = camp.id;
                if (prof.profileUrl) inLi[prof.profileUrl.replace(/\/+$/, '').toLowerCase()] = camp.id;
              });
              if (items.length < 100) break;
              offset += 100;
            }
          }
          contacts.forEach(c => { const id = inLi[(c.email || '').toLowerCase()] || inLi[(c.linkedinUrl || '').replace(/\/+$/, '').toLowerCase()]; if (id) { c.inHeyReach = true; c.liCampId = id; } });
        }
      } catch (e) { /* membership join is additive */ }
      return json(res, 200, { list: LIST, count: contacts.length, contacts });
    }

    if (u.pathname === '/api/generate' && req.method === 'POST') {
      const body = await readBody(req);
      const character = body.talkingPhoto
        ? { type: 'talking_photo', talking_photo_id: body.avatar_id }
        : { type: 'avatar', avatar_id: body.avatar_id, avatar_style: 'normal' };
      const payload = {
        caption: true, // burn-in subtitles
        video_inputs: [{
          character,
          voice: { type: 'text', input_text: body.script, voice_id: body.voice_id },
          background: { type: 'color', value: body.background || '#FFFFFF' },
        }],
        dimension: { width: body.width || 1280, height: body.height || 720 },
      };
      const r = await hg('/v2/video/generate', { method: 'POST', body: JSON.stringify(payload) });
      const b = await r.json();
      return json(res, r.status, { video_id: b?.data?.video_id || null, error: b?.error || null, raw: b });
    }

    if (u.pathname === '/api/status') {
      const id = u.searchParams.get('video_id');
      const r = await hg(`/v1/video_status.get?video_id=${encodeURIComponent(id)}`);
      const b = await r.json();
      const d = b?.data || {};
      return json(res, r.status, { status: d.status, video_url: d.video_url_caption || d.video_url, thumbnail_url: d.thumbnail_url, duration: d.duration, error: d.error });
    }

    // --- Phase 2: host video durably on HubSpot CDN ---
    if (u.pathname === '/api/host' && req.method === 'POST') {
      const { video_url, name } = await readBody(req);
      const T = HUB();
      const vid = await fetch(video_url);
      const buf = Buffer.from(await vid.arrayBuffer());
      const fd = new FormData();
      fd.append('file', new Blob([buf], { type: 'video/mp4' }), `${(name || 'volcano').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.mp4`);
      fd.append('options', JSON.stringify({ access: 'PUBLIC_INDEXABLE', overwrite: true }));
      fd.append('folderPath', '/volcano-videos');
      const r = await fetch('https://api.hubapi.com/files/v3/files', { method: 'POST', headers: { authorization: `Bearer ${T}` }, body: fd });
      const b = await r.json();
      // Filename is stable per contact (overwrite:true), so a regenerated video reuses the
      // same CDN URL — same cache-busting reasoning as thumb/logo/demo_thumb in /api/writeback,
      // otherwise a browser/CDN could keep serving the old video after a regenerate.
      const url = b.url ? `${b.url}?v=${Date.now()}` : null;
      return json(res, r.status < 300 ? 200 : r.status, { url, id: b.id || null, error: r.status >= 300 ? b : null });
    }

    // --- Phase 2: build personalization blob + write back to HubSpot ---
    if (u.pathname === '/api/writeback' && req.method === 'POST') {
      const c = await readBody(req); // {contactId, video, firstName, company, vertical, email, domain}
      c.firstName = cleanFirst(c.firstName); c.company = cleanCompany(c.company);
      const T = HUB();
      const IMAP = ['architecture', 'engineering', 'consulting', 'creative', 'construction', 'civil'];
      const industry = IMAP.find(x => (c.vertical || '').toLowerCase().includes(x)) || '';
      // Country -> currency, mirrors src/lib/currency.js's detectCurrency() so the
      // landing pages and this blob agree. Fetched fresh by contactId rather than
      // trusting whatever (if anything) the frontend passed in c.country.
      let country = '';
      try {
        const g = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${c.contactId}?properties=country`, { headers: { authorization: `Bearer ${T}` } });
        country = (await g.json())?.properties?.country || '';
      } catch (e) { /* leave country blank, tools fall back to AUD */ }
      const pKey = (c.presenter || 'sina').toLowerCase();
      const pMeta = PRESENTER_META[pKey] || PRESENTER_META.sina;
      // composite the co-branded thumbnails + extract brand colour (before the blob, so thumb= can ride in it)
      let thumb = '', demoThumb = '', brand = '#0A2F28', logo = '';
      if (c.domain || c.company) {
        try {
          const { buf: logoBuf, fellBack } = await getLogoBuffer(c.domain, c.company);
          const rgb = fellBack ? { r: 10, g: 47, b: 40 } : await vibrant(logoBuf); brand = rgbHex(rgb);
          // The filename is stable per contact (overwrite:true), so a rebuild
          // reuses the same URL — browsers, the HubSpot CDN and LinkedIn's OG
          // cache would keep serving the old image. Append a version so every
          // rebuild is a fresh URL that nothing can serve stale.
          const v = Date.now();
          // Re-host the SANITIZED logo (not the raw logo.dev URL) so the same fixed
          // version also shows up as {{logo}} in the cold email header, not just the
          // composited thumbnail.
          logo = (await uploadPublic(logoBuf, `logo-${c.contactId}.png`)) + `?v=${v}`;
          const img = await composeThumb(pKey, logoBuf, rgb);
          thumb = (await uploadPublic(img, `thumb-${c.contactId}.png`)) + `?v=${v}`;
          try { // demo-email thumbnail: hand-picked product-demo frame | firm logo
            const frame = await demoFrameBuf(pKey, pMeta);
            const dimg = await composeThumb(pKey, logoBuf, rgb, frame);
            demoThumb = (await uploadPublic(dimg, `demo-thumb-${c.contactId}.png`)) + `?v=${v}`;
          } catch (e) { /* leave demo thumb blank on failure */ }
        } catch (e) { /* leave thumb/logo blank on failure */ }
      }
      const parts = [
        `firstname=${encodeURIComponent(c.firstName || '')}`,
        `company=${encodeURIComponent(c.company || '')}`,
        `industry=${encodeURIComponent(industry)}`,
        `email=${encodeURIComponent(c.email || '')}`,
        `video=${encodeURIComponent(c.video || '')}`,
        `presenter=${encodeURIComponent(pKey)}`,
        `ae_name=${encodeURIComponent(pMeta.fullName)}`,
        `ae_title=${encodeURIComponent(pMeta.title)}`,
      ];
      if (country) parts.push(`country=${encodeURIComponent(country)}`);
      if (logo) parts.push(`logo=${encodeURIComponent(logo)}`);
      if (thumb) parts.push(`thumb=${encodeURIComponent(thumb)}`);
      if (demoThumb) parts.push(`demo_thumb=${encodeURIComponent(demoThumb)}`);
      // booking last: astro DEV 500s when a URL's final characters are an image
      // extension (vite-plugin-assets misreads it as an image request), so keep
      // the .png thumb params away from the end of campaign links.
      parts.push(`booking=${encodeURIComponent(pMeta.booking)}`);
      const blob = parts.join('&');
      const ensure = async (name, label) => {
        const g = await fetch(`https://api.hubapi.com/crm/v3/properties/contacts/${name}`, { headers: { authorization: `Bearer ${T}` } });
        if (g.status === 200) return;
        for (const grp of ['wfm_content_tools', 'contactinformation']) {
          const cr = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', { method: 'POST', headers: { authorization: `Bearer ${T}`, 'content-type': 'application/json' }, body: JSON.stringify({ name, label, type: 'string', fieldType: 'text', groupName: grp }) });
          if (cr.status < 400) return;
        }
      };
      await ensure('volcano_personalization', 'Volcano personalization blob');
      await ensure('volcano_thumb_url', 'Volcano thumbnail URL');
      await ensure('volcano_brand_color', 'Volcano brand colour');
      await ensure('volcano_demo_thumb_url', 'Volcano demo thumbnail URL');
      // AE identity as real contact properties (not just the URL blob), so a
      // HubSpot email template can merge-field {{contact.volcano_ae_name}} etc.
      // directly rather than needing the blob parsed apart.
      await ensure('volcano_ae_name', 'Volcano AE name');
      await ensure('volcano_ae_title', 'Volcano AE title');
      await ensure('volcano_ae_booking_link', 'Volcano AE booking link');
      const patch = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${c.contactId}`, { method: 'PATCH', headers: { authorization: `Bearer ${T}`, 'content-type': 'application/json' }, body: JSON.stringify({ properties: { volcano_heygen_video_url: c.video || '', volcano_personalization: blob, volcano_thumb_url: thumb, volcano_brand_color: brand, volcano_demo_thumb_url: demoThumb, volcano_ae_name: pMeta.fullName, volcano_ae_title: pMeta.title, volcano_ae_booking_link: pMeta.booking } }) });
      const pb = await patch.json();
      return json(res, patch.status < 300 ? 200 : patch.status, { ok: patch.status < 300, blob, logo, thumb, demo_thumb: demoThumb, brand_color: brand, error: patch.status >= 300 ? pb : null });
    }

    // --- Instantly: list campaigns ---
    if (u.pathname === '/api/instantly/campaigns') {
      const r = await fetch('https://api.instantly.ai/api/v2/campaigns?limit=100', { headers: { authorization: `Bearer ${INSTANTLY()}` } });
      const b = await r.json();
      const campaigns = (b.items || b.data || []).map(c => ({ id: c.id, name: c.name }));
      return json(res, 200, { campaigns });
    }

    // --- Instantly: push one contact as a lead into its matching Pimple campaign ---
    if (u.pathname === '/api/instantly/push' && req.method === 'POST') {
      const c = await readBody(req); // {contactId, email, firstName, company, vertical, domain, blob?, video?, thumb?, brand_color?}
      c.firstName = cleanFirst(c.firstName); c.company = cleanCompany(c.company);
      if (!c.email) return json(res, 200, { ok: false, error: 'no email' });
      let blob = c.blob, video = c.video, thumb = c.thumb, brand = c.brand_color, demoThumb = c.demo_thumb;
      if (!blob || !thumb || !brand || !demoThumb) { // fall back to HubSpot-stored values
        const g = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${c.contactId}?properties=volcano_personalization,volcano_heygen_video_url,volcano_thumb_url,volcano_brand_color,volcano_demo_thumb_url`, { headers: { authorization: `Bearer ${HUB()}` } });
        const gp = (await g.json())?.properties || {};
        blob = blob || gp.volcano_personalization; video = video || gp.volcano_heygen_video_url;
        thumb = thumb || gp.volcano_thumb_url; brand = brand || gp.volcano_brand_color;
        demoThumb = demoThumb || gp.volcano_demo_thumb_url;
      }
      // Prefer the sanitized+re-hosted logo URL already carried in the blob (written back
      // by /api/writeback) over a fresh raw logo.dev call, which skips the sanity checks.
      const blobLogoMatch = (blob || '').match(/logo=([^&]+)/);
      const logo = c.logo || (blobLogoMatch ? decodeURIComponent(blobLogoMatch[1]) : '');
      const K = INSTANTLY();
      const cr = await fetch('https://api.instantly.ai/api/v2/campaigns?limit=100', { headers: { authorization: `Bearer ${K}` } });
      const camps = (await cr.json())?.items || [];
      const IMAP = ['architecture', 'engineering', 'consulting', 'creative', 'construction', 'civil'];
      const word = IMAP.find(x => (c.vertical || '').toLowerCase().includes(x)) || '';
      // explicit campaign override from the dispatch module wins; otherwise vertical -> "Pimple - {vertical}"
      const camp = c.campaignId
        ? camps.find(x => String(x.id) === String(c.campaignId))
        : camps.find(x => /pimple/i.test(x.name) && word && x.name.toLowerCase().includes(word));
      if (!camp) return json(res, 200, { ok: false, error: c.campaignId ? `campaign ${c.campaignId} not found` : `no Pimple campaign for vertical "${c.vertical || '?'}"` });
      const body = { campaign: camp.id, email: c.email, first_name: c.firstName || '', company_name: c.company || '', custom_variables: { volcano_blob: blob || '', industry: word, video: video || '', thumb: thumb || '', demo_thumb: demoThumb || '', logo, brand_color: brand || '#0A2F28', presenter: c.presenter || 'Sina Zarei', presenter_title: c.presenter_title || 'Account Executive', booking: c.booking || '' } };
      const r = await fetch('https://api.instantly.ai/api/v2/leads', { method: 'POST', headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const rb = await r.json().catch(() => null);
      return json(res, r.status < 300 ? 200 : r.status, { ok: r.status < 300, campaign: camp.name, campaignId: camp.id, leadId: rb?.id || null, error: r.status >= 300 ? rb : null });
    }

    // --- Instantly: refresh an EXISTING lead's merge vars (after a blob/thumbnail rebuild).
    //     Finds the lead by email across Pimple campaigns and PATCHes custom_variables. ---
    if (u.pathname === '/api/instantly/update' && req.method === 'POST') {
      const c = await readBody(req); // same shape as /api/instantly/push
      c.firstName = cleanFirst(c.firstName); c.company = cleanCompany(c.company);
      if (!c.email) return json(res, 200, { ok: false, error: 'no email' });
      let blob = c.blob, video = c.video, thumb = c.thumb, brand = c.brand_color, demoThumb = c.demo_thumb;
      if (!blob || !thumb || !brand || !demoThumb) {
        const g = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${c.contactId}?properties=volcano_personalization,volcano_heygen_video_url,volcano_thumb_url,volcano_brand_color,volcano_demo_thumb_url`, { headers: { authorization: `Bearer ${HUB()}` } });
        const gp = (await g.json())?.properties || {};
        blob = blob || gp.volcano_personalization; video = video || gp.volcano_heygen_video_url;
        thumb = thumb || gp.volcano_thumb_url; brand = brand || gp.volcano_brand_color;
        demoThumb = demoThumb || gp.volcano_demo_thumb_url;
      }
      // Prefer the sanitized+re-hosted logo URL already carried in the blob (written back
      // by /api/writeback) over a fresh raw logo.dev call, which skips the sanity checks.
      const blobLogoMatch = (blob || '').match(/logo=([^&]+)/);
      const logo = c.logo || (blobLogoMatch ? decodeURIComponent(blobLogoMatch[1]) : '');
      const K = INSTANTLY();
      const email = c.email.toLowerCase();
      // Match both real ("Pimple - X") and known-contacts test ("Volcano TEST...") campaigns —
      // narrowing to /pimple/i alone missed already-enrolled test leads entirely (found 2026-07-10
      // rebuilding Denzel's thumbnails: a Volcano TEST lead came back notFound even though it existed).
      const camps = ((await (await fetch('https://api.instantly.ai/api/v2/campaigns?limit=100', { headers: { authorization: `Bearer ${K}` } })).json())?.items || []).filter(x => /pimple|volcano/i.test(x.name));
      let lead = null, leadCamp = null;
      for (const camp of camps) {
        let starting, guard = 0;
        do {
          const b = await (await fetch('https://api.instantly.ai/api/v2/leads/list', { method: 'POST', headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json' }, body: JSON.stringify({ campaign: camp.id, limit: 100, ...(starting ? { starting_after: starting } : {}) }) })).json();
          lead = (b.items || []).find(l => (l.email || '').toLowerCase() === email) || null;
          starting = b.next_starting_after; guard++;
        } while (!lead && starting && guard < 10);
        if (lead) { leadCamp = camp; break; }
      }
      if (!lead) return json(res, 200, { ok: false, notFound: true });
      const custom_variables = { volcano_blob: blob || '', video: video || '', thumb: thumb || '', demo_thumb: demoThumb || '', logo, brand_color: brand || '#0A2F28', presenter: c.presenter || 'Sina Zarei', presenter_title: c.presenter_title || 'Account Executive', booking: c.booking || '' };
      const r = await fetch(`https://api.instantly.ai/api/v2/leads/${lead.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json' }, body: JSON.stringify({ custom_variables }) });
      const rb = await r.json().catch(() => null);
      return json(res, 200, { ok: r.status < 300, campaign: leadCamp?.name, campaignId: leadCamp?.id, leadId: lead.id, error: r.status >= 300 ? JSON.stringify(rb).slice(0, 200) : null });
    }

    // --- HeyReach (LinkedIn dispatch). Activates when HEYREACH_API_KEY lands in .env
    //     (.env is re-read per call, no restart needed). Public API: X-API-KEY header. ---
    const hr = (p, body, method = 'POST') => fetch(`https://api.heyreach.io/api/public${p}`, {
      method, headers: { 'X-API-KEY': HEYREACH(), accept: 'application/json', 'content-type': 'application/json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    if (u.pathname === '/api/heyreach/status') {
      if (!HEYREACH()) return json(res, 200, { configured: false });
      const r = await hr('/auth/CheckApiKey', undefined, 'GET');
      return json(res, 200, { configured: true, valid: r.status < 300, http: r.status });
    }

    if (u.pathname === '/api/heyreach/campaigns') {
      if (!HEYREACH()) return json(res, 200, { campaigns: [], error: 'no HEYREACH_API_KEY in .env' });
      const r = await hr('/campaign/GetAll', { offset: 0, limit: 100 });
      const b = await r.json().catch(() => null);
      if (r.status >= 300) return json(res, 200, { campaigns: [], error: `HeyReach ${r.status}: ${JSON.stringify(b).slice(0, 200)}` });
      const campaigns = (b?.items || b?.campaigns || b || []).map(c => ({ id: c.id, name: c.name, status: c.status || '' }));
      return json(res, 200, { campaigns });
    }

    // Push one contact into a HeyReach campaign, carrying the SAME personalization
    // set as email (blob link, co-branded thumb, booking) as custom fields usable
    // in connection notes / DM templates.
    if (u.pathname === '/api/heyreach/push' && req.method === 'POST') {
      const c = await readBody(req); // {contactId, campaignId} — campaignId 'auto'/missing -> match by vertical+owner
      if (!HEYREACH()) return json(res, 200, { ok: false, error: 'no HEYREACH_API_KEY in .env' });
      const g = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${c.contactId}?properties=firstname,lastname,company,email,hs_linkedin_url,volcano_icp_vertical,volcano_personalization,volcano_thumb_url,volcano_brand_color,hubspot_owner_id`, { headers: { authorization: `Bearer ${HUB()}` } });
      const p = (await g.json())?.properties || {};
      if (!p.hs_linkedin_url) return json(res, 200, { ok: false, error: 'contact has no LinkedIn URL (hs_linkedin_url)' });
      const blob = p.volcano_personalization || '';
      const IMAP = ['architecture', 'engineering', 'consulting', 'creative', 'construction', 'civil'];
      const industry = IMAP.find(x => (p.volcano_icp_vertical || '').toLowerCase().includes(x)) || '';
      const bookingMatch = blob.match(/booking=([^&]+)/);
      // Auto-route by vertical + owner so a contact never lands in the wrong sender's
      // campaign (owner=presenter=sender must stay consistent). Matches the naming
      // convention "Volcano LI - <Vertical> - <Owner>" from heyreach-seed-real-campaigns.mjs.
      let targetCampaignId = c.campaignId;
      if (!targetCampaignId || targetCampaignId === 'auto') {
        const ownerName = OWNER_NAME[p.hubspot_owner_id];
        if (!industry || !ownerName) return json(res, 200, { ok: false, error: `cannot auto-route: vertical="${p.volcano_icp_vertical || '?'}" owner="${p.hubspot_owner_id || '?'}" (need both to match a campaign)` });
        const allCamps = await (await hr('/campaign/GetAll', { offset: 0, limit: 100 })).json().catch(() => null);
        const match = (allCamps?.items || []).find(x => { const n = (x.name || '').toLowerCase(); return n.includes(industry) && n.includes(ownerName); });
        if (!match) return json(res, 200, { ok: false, error: `no HeyReach campaign found matching vertical "${industry}" + owner "${ownerName}"` });
        targetCampaignId = match.id;
      }
      c.campaignId = targetCampaignId;
      const mk = (tool) => (blob ? `https://lp.workflowmax.com/app?tool=${tool}&${blob}` : '');
      const links = blob ? await Promise.all(['intro', 'tp1', 'tp2', 'tp3', 'tp4', 'tp5', 'tp6'].map(t => shorten(mk(t)))) : ['', '', '', '', '', '', ''];
      const lead = {
        profileUrl: p.hs_linkedin_url,
        firstName: cleanFirst(p.firstname), lastName: p.lastname || '',
        companyName: cleanCompany(p.company), emailAddress: (p.email || '').toLowerCase(),
        customUserFields: [
          // {company} in our copy is NOT a confirmed HeyReach built-in (only {FIRST_NAME}
          // is documented) — push it explicitly as a custom field so it resolves via the
          // proven customUserFields path instead of relying on an unverified built-in name.
          { name: 'company', value: cleanCompany(p.company) },
          // one (shortened) link per touchpoint tool, so LinkedIn DMs stay clean
          { name: 'intro_link', value: links[0] },
          { name: 'health_check_link', value: links[1] },
          { name: 'calculator_link', value: links[2] },
          { name: 'benchmark_link', value: links[3] },
          { name: 'demo_link', value: links[4] },
          { name: 'firms_like_yours_link', value: links[5] },
          { name: 'resource_hub_link', value: links[6] },
          { name: 'thumb', value: p.volcano_thumb_url || '' },
          { name: 'booking', value: bookingMatch ? decodeURIComponent(bookingMatch[1]) : '' },
          { name: 'industry', value: industry },
        ].filter(f => f.value),
      };
      const cid = +c.campaignId || c.campaignId;
      // Route by campaign status. AddLeadsToCampaignV2 only works on a RUNNING
      // campaign; a DRAFT one can't take it, and starting a campaign with an
      // empty list makes HeyReach mark it FINISHED. So for not-yet-running
      // campaigns we seed the lead into the campaign's LIST (works in any
      // state); starting the campaign then enrols the list members.
      const camp = await (await hr(`/campaign/GetById?campaignId=${cid}`, undefined, 'GET')).json().catch(() => null);
      const status = camp?.status || '';
      if (status === 'FINISHED') return json(res, 200, { ok: false, error: 'campaign is FINISHED (was started with an empty list) — create a fresh campaign, seed leads, then start' });
      if (status === 'IN_PROGRESS' || status === 'ACTIVE') {
        const r = await hr('/campaign/AddLeadsToCampaignV2', { campaignId: cid, accountLeadPairs: [{ lead }] });
        const b = await r.json().catch(() => null);
        return json(res, 200, { ok: r.status < 300, http: r.status, mode: 'campaign', response: b, error: r.status >= 300 ? JSON.stringify(b).slice(0, 300) : null });
      }
      // DRAFT / SCHEDULED / PAUSED -> seed the campaign's list
      const listId = camp?.linkedInUserListId;
      if (!listId) return json(res, 200, { ok: false, error: `campaign ${cid} has no list to seed (status ${status || '?'})` });
      const r = await hr('/list/AddLeadsToListV2', { listId, leads: [lead] });
      const b = await r.json().catch(() => null);
      return json(res, 200, { ok: r.status < 300, http: r.status, mode: 'list', seeded: true, note: `seeded into list ${listId}; Start the campaign in HeyReach to enrol`, response: b, error: r.status >= 300 ? JSON.stringify(b).slice(0, 300) : null });
    }

    // --- Campaign Copy editor: see + edit the actual DM/InMail/email text, with saves
    //     landing in the live campaigns (not just a local file). Read-modify-write always
    //     goes through the live platform state for anything NOT being edited (delay, node
    //     shape, tracking settings, etc.) so an edit here can't silently clobber something
    //     it didn't touch. ---
    const COPY_HR_PATH = path.join(__dirname, 'copy-heyreach.json');
    const COPY_INST_PATH = path.join(__dirname, 'copy-instantly.json');
    const HR_CAMPAIGNS_PATH = path.join(__dirname, 'heyreach-real-campaigns.json');
    const INST_CAMPAIGNS_PATH = path.join(__dirname, 'instantly-real-campaigns.json');
    const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
    const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2));
    // Sina/Denzel's HeyReach seats (see heyreach-seed-real-campaigns.mjs's SEAT map).
    const HR_SEAT = { sina: 221310, denzel: 223029 };
    const cap = (s) => s[0].toUpperCase() + s.slice(1);

    if (u.pathname === '/api/copy/heyreach' && req.method === 'GET') {
      const vertical = u.searchParams.get('vertical');
      if (!HEYREACH_VERTICALS.includes(vertical)) return json(res, 200, { ok: false, error: `unknown vertical "${vertical}"` });
      const copy = readJson(COPY_HR_PATH)[vertical];
      const allCamps = readJson(HR_CAMPAIGNS_PATH);
      const entries = Object.entries(allCamps).filter(([, v]) => v.vertical === vertical);
      const campaigns = [];
      for (const [key, v] of entries) {
        const camp = await (await hr(`/campaign/GetById?campaignId=${v.campaignId}`, undefined, 'GET')).json().catch(() => null);
        campaigns.push({ key, owner: v.owner, campaignId: v.campaignId, status: camp?.status || 'UNKNOWN' });
      }
      return json(res, 200, { ok: true, copy, campaigns });
    }

    if (u.pathname === '/api/copy/instantly' && req.method === 'GET') {
      const vertical = u.searchParams.get('vertical');
      const campaignId = readJson(INST_CAMPAIGNS_PATH)[vertical];
      if (!campaignId) return json(res, 200, { ok: false, error: `no live Instantly campaign for vertical "${vertical}"` });
      const copy = readJson(COPY_INST_PATH)[vertical];
      const camp = await (await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}`, { headers: { authorization: `Bearer ${INSTANTLY()}` } })).json().catch(() => null);
      return json(res, 200, { ok: true, copy, campaignId, status: camp?.status });
    }

    if (u.pathname === '/api/copy/heyreach/save' && req.method === 'POST') {
      const { vertical, copy } = await readBody(req);
      if (!HEYREACH_VERTICALS.includes(vertical)) return json(res, 200, { ok: false, error: `unknown vertical "${vertical}"` });
      const allCopy = readJson(COPY_HR_PATH);
      allCopy[vertical] = copy;
      writeJson(COPY_HR_PATH, allCopy);
      const allCamps = readJson(HR_CAMPAIGNS_PATH);
      const entries = Object.entries(allCamps).filter(([, v]) => v.vertical === vertical);
      const updated = [], needsReplacement = [];
      for (const [, v] of entries) {
        const camp = await (await hr(`/campaign/GetById?campaignId=${v.campaignId}`, undefined, 'GET')).json().catch(() => null);
        if (camp?.status !== 'DRAFT') { needsReplacement.push({ owner: v.owner, campaignId: v.campaignId, status: camp?.status || 'UNKNOWN' }); continue; }
        const sequence = buildRealSequence(vertical, cap(v.owner), allCopy);
        const r = await hr('/campaign/UpdateSequence', { campaignId: v.campaignId, sequence });
        updated.push({ owner: v.owner, campaignId: v.campaignId, ok: r.status < 300, http: r.status });
      }
      return json(res, 200, { ok: true, updated, needsReplacement });
    }

    // Explicit, separately-confirmed action for a HeyReach campaign that's already
    // started (locked — see heyreach-real-sequences.mjs's header note). Creates a
    // fresh campaign/list with the edited copy; does NOT touch or migrate leads on
    // the old one — that's Sina's deliberate manual follow-up, same as 497484->500667.
    if (u.pathname === '/api/copy/heyreach/replace' && req.method === 'POST') {
      const { vertical, owner } = await readBody(req);
      const seat = HR_SEAT[owner];
      if (!seat) return json(res, 200, { ok: false, error: `no HeyReach seat for owner "${owner}"` });
      const listR = await hr('/list/CreateEmptyList', { name: `Volcano LI - ${vertical} - ${owner} (v2)` });
      const list = await listR.json();
      if (!list?.id) return json(res, 200, { ok: false, error: `list create failed: ${JSON.stringify(list).slice(0, 200)}` });
      const allCopy = readJson(COPY_HR_PATH);
      const sequence = buildRealSequence(vertical, cap(owner), allCopy);
      const campR = await hr('/campaign/Create', { name: `Volcano LI - ${cap(vertical)} - ${cap(owner)} (v2)`, linkedInUserListId: list.id, linkedInAccountIds: [seat], sequence });
      const camp = await campR.json();
      if (!camp?.campaignId) return json(res, 200, { ok: false, error: `campaign create failed: ${JSON.stringify(camp).slice(0, 300)}` });
      const allCamps = readJson(HR_CAMPAIGNS_PATH);
      const key = `${vertical}-${owner}`;
      allCamps[key] = { ...(allCamps[key] || {}), campaignId: camp.campaignId, listId: list.id, vertical, owner };
      writeJson(HR_CAMPAIGNS_PATH, allCamps);
      return json(res, 200, { ok: true, campaignId: camp.campaignId, listId: list.id, note: `old campaign left untouched — migrate any leads manually, then it can be abandoned` });
    }

    if (u.pathname === '/api/copy/instantly/save' && req.method === 'POST') {
      const { vertical, copy } = await readBody(req); // copy: [{subject, body}, ...7], delay untouched
      const campaignId = readJson(INST_CAMPAIGNS_PATH)[vertical];
      if (!campaignId) return json(res, 200, { ok: false, error: `no live Instantly campaign for vertical "${vertical}"` });
      const K = INSTANTLY();
      const campR = await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}`, { headers: { authorization: `Bearer ${K}` } });
      const camp = await campR.json();
      const steps = camp.sequences[0].steps;
      if (steps.length !== copy.length) return json(res, 200, { ok: false, error: `step count mismatch: live has ${steps.length}, copy has ${copy.length}` });
      // Only touch subject/body; delay/delay_unit/pre_delay_unit/type all come from the
      // live fetch untouched — same preserve-everything-else pattern already proven
      // fixing Engineering's delays this session (server.mjs history, 2026-07-09).
      steps.forEach((s, i) => { s.variants[0].subject = copy[i].subject; s.variants[0].body = copy[i].body; });
      // Instantly status: 0 draft, 1 active, 2 paused (confirmed live 2026-07-09).
      // Active must be paused before editing; resuming can reset in-flight lead
      // progress, so we leave it paused per Sina's call rather than auto-resuming.
      let pausedForEdit = false;
      if (camp.status === 1) {
        await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}/pause`, { method: 'POST', headers: { authorization: `Bearer ${K}` } });
        pausedForEdit = true;
      }
      const bodyStr = JSON.stringify({ sequences: camp.sequences });
      const patchR = await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}`, { method: 'PATCH', headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json; charset=utf-8' }, body: Buffer.from(bodyStr, 'utf8') });
      if (patchR.status >= 300) return json(res, 200, { ok: false, error: `Instantly PATCH ${patchR.status}: ${(await patchR.text()).slice(0, 300)}` });
      const allInstCopy = readJson(COPY_INST_PATH);
      allInstCopy[vertical] = steps.map((s, i) => ({ subject: s.variants[0].subject, body: s.variants[0].body, delay: s.delay }));
      writeJson(COPY_INST_PATH, allInstCopy);
      return json(res, 200, { ok: true, pausedForEdit, note: pausedForEdit ? 'campaign was not draft, paused before editing and left paused — resume manually when ready' : null });
    }

    // --- Known-contacts TEST campaign copy (single shared copy, not per-vertical —
    // the compact sequence is generic). Same save/replace pattern as the real tab. ---
    const COPY_HR_TEST_PATH = path.join(__dirname, 'copy-heyreach-test.json');
    const COPY_INST_TEST_PATH = path.join(__dirname, 'copy-instantly-test.json');
    const HR_TEST_CAMPAIGNS_PATH = path.join(__dirname, 'heyreach-test-campaigns.json');
    const INST_TEST_CAMPAIGNS_PATH = path.join(__dirname, 'instantly-test-campaigns.json');

    if (u.pathname === '/api/copy/heyreach-test' && req.method === 'GET') {
      const copy = readJson(COPY_HR_TEST_PATH);
      const owners = readJson(HR_TEST_CAMPAIGNS_PATH);
      const campaigns = [];
      for (const [owner, campaignId] of Object.entries(owners)) {
        const camp = await (await hr(`/campaign/GetById?campaignId=${campaignId}`, undefined, 'GET')).json().catch(() => null);
        campaigns.push({ owner, campaignId, status: camp?.status || 'UNKNOWN' });
      }
      return json(res, 200, { ok: true, copy, campaigns });
    }

    if (u.pathname === '/api/copy/heyreach-test/save' && req.method === 'POST') {
      const { copy } = await readBody(req);
      writeJson(COPY_HR_TEST_PATH, copy);
      const owners = readJson(HR_TEST_CAMPAIGNS_PATH);
      const updated = [], needsReplacement = [];
      for (const [owner, campaignId] of Object.entries(owners)) {
        const camp = await (await hr(`/campaign/GetById?campaignId=${campaignId}`, undefined, 'GET')).json().catch(() => null);
        if (camp?.status !== 'DRAFT') { needsReplacement.push({ owner, campaignId, status: camp?.status || 'UNKNOWN' }); continue; }
        const sequence = buildCompactSequence(cap(owner), copy);
        const r = await hr('/campaign/UpdateSequence', { campaignId, sequence });
        updated.push({ owner, campaignId, ok: r.status < 300, http: r.status });
      }
      return json(res, 200, { ok: true, updated, needsReplacement });
    }

    // HeyReach campaigns with zero leads have been observed auto-transitioning to
    // FINISHED after sitting idle a while (found 2026-07-10: both test campaigns
    // died this way before any leads were seeded) — treat FINISHED the same as
    // "started/locked" here, since it's equally unrecoverable in place.
    if (u.pathname === '/api/copy/heyreach-test/replace' && req.method === 'POST') {
      const { owner } = await readBody(req);
      const seat = HR_SEAT[owner];
      if (!seat) return json(res, 200, { ok: false, error: `no HeyReach seat for owner "${owner}"` });
      const listR = await hr('/list/CreateEmptyList', { name: `Volcano LI TEST - known contacts (${cap(owner)}) v${Date.now()}` });
      const list = await listR.json();
      if (!list?.id) return json(res, 200, { ok: false, error: `list create failed: ${JSON.stringify(list).slice(0, 200)}` });
      const copy = readJson(COPY_HR_TEST_PATH);
      const sequence = buildCompactSequence(cap(owner), copy);
      const campR = await hr('/campaign/Create', { name: `Volcano LI TEST - known contacts (${cap(owner)})`, linkedInUserListId: list.id, linkedInAccountIds: [seat], sequence });
      const camp = await campR.json();
      if (!camp?.campaignId) return json(res, 200, { ok: false, error: `campaign create failed: ${JSON.stringify(camp).slice(0, 300)}` });
      const owners = readJson(HR_TEST_CAMPAIGNS_PATH);
      owners[owner] = camp.campaignId;
      writeJson(HR_TEST_CAMPAIGNS_PATH, owners);
      return json(res, 200, { ok: true, campaignId: camp.campaignId, listId: list.id });
    }

    if (u.pathname === '/api/copy/instantly-test' && req.method === 'GET') {
      const vertical = u.searchParams.get('vertical');
      const owners = readJson(INST_TEST_CAMPAIGNS_PATH)[vertical];
      if (!owners) return json(res, 200, { ok: false, error: `no test campaigns for vertical "${vertical}"` });
      const copy = readJson(COPY_INST_TEST_PATH)[vertical];
      const campaigns = [];
      for (const [owner, id] of Object.entries(owners)) {
        const camp = await (await fetch(`https://api.instantly.ai/api/v2/campaigns/${id}`, { headers: { authorization: `Bearer ${INSTANTLY()}` } })).json().catch(() => null);
        campaigns.push({ owner, campaignId: id, status: camp?.status });
      }
      return json(res, 200, { ok: true, copy, campaigns });
    }

    if (u.pathname === '/api/copy/instantly-test/save' && req.method === 'POST') {
      const { vertical, copy } = await readBody(req);
      const owners = readJson(INST_TEST_CAMPAIGNS_PATH)[vertical];
      if (!owners) return json(res, 200, { ok: false, error: `no test campaigns for vertical "${vertical}"` });
      const K = INSTANTLY();
      const results = [];
      for (const [owner, campaignId] of Object.entries(owners)) {
        const campR = await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}`, { headers: { authorization: `Bearer ${K}` } });
        const camp = await campR.json();
        const steps = camp.sequences[0].steps;
        if (steps.length !== copy.length) { results.push({ owner, ok: false, error: `step count mismatch` }); continue; }
        steps.forEach((s, i) => { s.variants[0].subject = copy[i].subject; s.variants[0].body = copy[i].body; });
        let pausedForEdit = false;
        if (camp.status === 1) { await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}/pause`, { method: 'POST', headers: { authorization: `Bearer ${K}` } }); pausedForEdit = true; }
        const patchR = await fetch(`https://api.instantly.ai/api/v2/campaigns/${campaignId}`, { method: 'PATCH', headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json; charset=utf-8' }, body: Buffer.from(JSON.stringify({ sequences: camp.sequences }), 'utf8') });
        results.push({ owner, ok: patchR.status < 300, pausedForEdit, error: patchR.status >= 300 ? (await patchR.text()).slice(0, 200) : null });
      }
      const allCopy = readJson(COPY_INST_TEST_PATH);
      allCopy[vertical] = copy;
      writeJson(COPY_INST_TEST_PATH, allCopy);
      return json(res, 200, { ok: results.every(r => r.ok), results });
    }

    // --- Bulletproof check: one link per contact showing EVERYTHING that would
    // actually be sent to them — real personalized email HTML, real DM/InMail text
    // (tokens filled, links shortened exactly like a live push would), the actual
    // generated thumbnail/video, and every landing page link. Nothing here is a
    // sample/placeholder — it's this contact's real data, for a final check before
    // pushing. ?mode=real|test picks which copy source to render against (the
    // studio passes this based on which list the contact came from). ---
    if (u.pathname === '/api/contact-preview' && req.method === 'GET') {
      const contactId = u.searchParams.get('contactId');
      const mode = u.searchParams.get('mode') === 'test' ? 'test' : 'real';
      if (!contactId) { res.writeHead(400, { 'content-type': 'text/html' }); return res.end('<p>missing contactId</p>'); }
      const g = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,company,email,domain,volcano_icp_vertical,hubspot_owner_id,volcano_personalization,volcano_heygen_video_url,volcano_thumb_url,volcano_demo_thumb_url,volcano_brand_color,hs_linkedin_url`, { headers: { authorization: `Bearer ${HUB()}` } });
      const p = (await g.json())?.properties || {};
      const firstName = cleanFirst(p.firstname), company = cleanCompany(p.company);
      const IMAP = ['architecture', 'engineering', 'consulting', 'creative', 'construction', 'civil'];
      const vertical = IMAP.find(x => (p.volcano_icp_vertical || '').toLowerCase().includes(x)) || '';
      const ownerKey = OWNER_NAME[p.hubspot_owner_id] || 'sina';
      const presenter = PRESENTER_META[ownerKey];
      const blob = p.volcano_personalization || '';
      if (!blob) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(`<p style="font-family:sans-serif">No personalization generated yet for ${firstName} @ ${company} (contact ${contactId}) — generate + write back a video first.</p>`);
      }
      const TOOLS = ['intro', 'tp1', 'tp2', 'tp3', 'tp4', 'tp5', 'tp6'];
      const TOOL_LABEL = { intro: 'Intro video', tp1: 'Health check', tp2: 'Profit-leak calculator', tp3: 'Benchmark', tp4: 'Demo walkthrough', tp5: 'Firms like yours', tp6: 'Resource hub' };
      const longLinks = Object.fromEntries(TOOLS.map(t => [t, `https://lp.workflowmax.com/app?tool=${t}&${blob}`]));
      const shortLinks = Object.fromEntries(await Promise.all(TOOLS.map(async t => [t, await shorten(longLinks[t])])));
      const TOOL_TOKEN = { intro: 'intro_link', tp1: 'health_check_link', tp2: 'calculator_link', tp3: 'benchmark_link', tp4: 'demo_link', tp5: 'firms_like_yours_link', tp6: 'resource_hub_link' };

      const fillDm = (s) => (s || '')
        .replace(/\{FIRST_NAME\}/g, firstName).replace(/\{company\}/g, company)
        .replace(/\{signature\}/g, presenter.fullName.split(' ')[0])
        .replace(/\{booking\}/g, presenter.booking)
        .replace(/\{intro_link\}/g, shortLinks.intro).replace(/\{health_check_link\}/g, shortLinks.tp1)
        .replace(/\{calculator_link\}/g, shortLinks.tp2).replace(/\{benchmark_link\}/g, shortLinks.tp3)
        .replace(/\{demo_link\}/g, shortLinks.tp4).replace(/\{firms_like_yours_link\}/g, shortLinks.tp5)
        .replace(/\{resource_hub_link\}/g, shortLinks.tp6);
      const blobParams = Object.fromEntries(new URLSearchParams(blob));
      const fillEmail = (s) => (s || '')
        .replace(/\{\{firstName\}\}/g, firstName).replace(/\{\{companyName\}\}/g, company)
        .replace(/\{\{logo\}\}/g, blobParams.logo || '')
        .replace(/\{\{thumb\}\}/g, p.volcano_thumb_url || '').replace(/\{\{demo_thumb\}\}/g, p.volcano_demo_thumb_url || '')
        .replace(/\{\{presenter\}\}/g, presenter.fullName).replace(/\{\{presenter_title\}\}/g, presenter.title)
        .replace(/\{\{brand_color\}\}/g, p.volcano_brand_color || '#0A2F28').replace(/\{\{booking\}\}/g, presenter.booking)
        .replace(/\{\{volcano_blob\}\}/g, blob).replace(/\{\{unsubscribeLink\}\}/g, '#');

      const hrCopyAll = mode === 'test' ? readJson(COPY_HR_TEST_PATH) : readJson(COPY_HR_PATH)[vertical];
      const instCopy = mode === 'test' ? readJson(COPY_INST_TEST_PATH)[vertical] : readJson(COPY_INST_PATH)[vertical];
      const HR_ORDER = mode === 'test'
        ? [['cr', 'Connection request'], ['dm1', 'DM 1 · intro'], ['dm2', 'DM 2 · health check'], ['dm2_accept', 'DM 2 · accept variant'], ['dm3', 'DM 3 · calculator'], ['dm4', 'DM 4 · benchmark'], ['dm5', 'DM 5 · demo'], ['dm6', 'DM 6 · resource hub'], ['inmail1', 'InMail 1'], ['inmail2', 'InMail 2'], ['inmail3', 'InMail 3']]
        : [['cr', 'Connection request'], ['dm1', 'DM 1 · intro'], ['dm2', 'DM 2 · health check'], ['dm2_accept', 'DM 2 · accept variant'], ['dm3', 'DM 3 · calculator'], ['dm4', 'DM 4 · benchmark'], ['dm5', 'DM 5 · demo'], ['dm6', 'DM 6 · firms like yours'], ['dm7', 'DM 7 · resource hub'], ['inmail1', 'InMail 1'], ['inmail2', 'InMail 2'], ['inmail3', 'InMail 3']];

      const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const dmHtml = HR_ORDER.map(([key, label]) => {
        const d = hrCopyAll?.[key]; if (!d) return '';
        const isInmail = key.startsWith('inmail');
        return `<div class="tp"><div class="tplabel">${label}</div>${isInmail ? `<div class="subj">Subject: ${esc(fillDm(d.subject))}</div>` : ''}<div class="msg">${esc(fillDm(d.message)).replace(/\n/g, '<br>')}</div></div>`;
      }).join('');
      const emailHtml = (instCopy || []).map((s, i) => `<div class="tp"><div class="tplabel">Email ${i + 1}${s.delay != null ? ` · +${s.delay}d` : ''}</div><div class="subj">Subject: ${esc(fillEmail(s.subject))}</div><iframe style="width:100%;height:420px;border:1px solid #e4e8e6;border-radius:8px;background:#fff" srcdoc="${fillEmail(s.body).replace(/"/g, '&quot;')}"></iframe></div>`).join('');
      const linksHtml = TOOLS.map(t => `<a href="${longLinks[t]}" target="_blank">${TOOL_LABEL[t]}</a> <span class="muted">(${TOOL_TOKEN[t]}: <a href="${shortLinks[t]}" target="_blank">${shortLinks[t]}</a>)</span>`).join('<br>');

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(firstName)} @ ${esc(company)} — bulletproof check</title>
<style>
body{font-family:-apple-system,Segoe UI,sans-serif;color:#0A2F28;background:#f4f6f5;margin:0;padding:24px 28px 60px;max-width:900px}
h1{font-size:20px;margin:0 0 4px} .sub{color:#6b7a75;font-size:13px;margin-bottom:20px}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#6b7a75;margin:26px 0 10px;border-bottom:1px solid #e4e8e6;padding-bottom:6px}
.tp{background:#fff;border:1px solid #e4e8e6;border-radius:10px;padding:12px 14px;margin-bottom:10px}
.tplabel{font-weight:700;font-size:12.5px;margin-bottom:6px} .subj{font-style:italic;color:#3d5951;font-size:13px;margin-bottom:6px}
.msg{font-size:13.5px;line-height:1.5} .muted{color:#6b7a75;font-size:11px}
img,video{max-width:340px;border-radius:8px;display:block;margin-bottom:8px} a{color:#0D8D5C}
.pill{display:inline-block;background:#0A2F2812;border-radius:100px;padding:2px 10px;font-size:11px;font-weight:700;margin-right:6px}
</style></head><body>
<h1>${esc(firstName)} ${esc(p.lastname || '')} @ ${esc(company)}</h1>
<div class="sub"><span class="pill">${esc(vertical || '?')}</span><span class="pill">${presenter.fullName}</span><span class="pill">${mode === 'test' ? 'TEST round' : 'REAL round'}</span> ${esc(p.email || '')} ${p.hs_linkedin_url ? `· <a href="${esc(p.hs_linkedin_url)}" target="_blank">LinkedIn</a>` : '· no LinkedIn URL'}</div>

<h2>Video &amp; thumbnails</h2>
${p.volcano_heygen_video_url ? `<video controls src="${esc(p.volcano_heygen_video_url)}"></video>` : '<div class="muted">no video</div>'}
${p.volcano_thumb_url ? `<img src="${esc(p.volcano_thumb_url)}" alt="thumbnail">` : ''}
${p.volcano_demo_thumb_url ? `<img src="${esc(p.volcano_demo_thumb_url)}" alt="demo thumbnail">` : ''}

<h2>Landing pages (7 touchpoints)</h2>
<div class="tp">${linksHtml}</div>

<h2>LinkedIn &mdash; DMs, connection request &amp; InMails (${mode})</h2>
${dmHtml || '<div class="muted">no HeyReach copy found for this vertical/mode</div>'}

<h2>Email &mdash; Instantly sequence (${mode})</h2>
${emailHtml || '<div class="muted">no Instantly copy found for this vertical/mode</div>'}

<h2>Raw resources</h2>
<div class="tp"><div class="muted" style="word-break:break-all">${esc(blob)}</div></div>
</body></html>`;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    // --- Cockpit -> HubSpot: write the engagement score. Absolute value per contact
    //     (recomputed each sync, so re-running never double-counts). Kept in its own
    //     property so the forms-driven volcano_lead_score stays HubSpot-owned;
    //     routing workflows can branch on the sum of the two. ---
    if (u.pathname === '/api/scores/sync' && req.method === 'POST') {
      const { scores } = await readBody(req); // [{contactId, value}]
      if (!Array.isArray(scores) || !scores.length) return json(res, 200, { ok: false, error: 'no scores' });
      const T = HUB();
      const g = await fetch('https://api.hubapi.com/crm/v3/properties/contacts/volcano_engagement_score', { headers: { authorization: `Bearer ${T}` } });
      if (g.status !== 200) {
        for (const grp of ['wfm_content_tools', 'contactinformation']) {
          const cr = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', { method: 'POST', headers: { authorization: `Bearer ${T}`, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'volcano_engagement_score', label: 'Volcano engagement score', type: 'number', fieldType: 'number', groupName: grp }) });
          if (cr.status < 400) break;
        }
      }
      let updated = 0, failed = 0, firstError = null;
      for (let i = 0; i < scores.length; i += 100) {
        const inputs = scores.slice(i, i + 100).map(s => ({ id: String(s.contactId), properties: { volcano_engagement_score: String(+s.value || 0) } }));
        const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/update', { method: 'POST', headers: { authorization: `Bearer ${T}`, 'content-type': 'application/json' }, body: JSON.stringify({ inputs }) });
        if (r.status < 300) updated += inputs.length; else { failed += inputs.length; if (!firstError) firstError = JSON.stringify(await r.json().catch(() => null)).slice(0, 200); }
      }
      return json(res, 200, { ok: failed === 0, updated, failed, error: firstError });
    }

    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: String(e) });
  }
});

server.listen(PORT, () => console.log(`HeyGen studio -> http://localhost:${PORT}`));
