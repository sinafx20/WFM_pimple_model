// Local HeyGen studio server. The API key stays here (server-side); the browser
// only talks to these local endpoints. Run: node server.mjs  ->  http://localhost:5178
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
if (!KEY) { console.error('No HEYGEN_API_KEY (env or .env).'); process.exit(1); }

// Clean names for natural pronunciation + no legal suffixes (applied everywhere: script, thumbnail, blob, email, LinkedIn).
const LEGAL = /[\s,]+(?:pty\.?\s*ltd\.?|pte\.?\s*ltd\.?|p\/l|proprietary\s+limited|limited|ltd\.?|l\.?l\.?c\.?|incorporated|inc\.?|corporation|corp\.?|gmbh|plc|pty\.?|s\.?a\.?|s\.?r\.?l\.?|b\.?v\.?)\.?\s*$/i;
function cleanCompany(name) { let s = (name || '').trim(); for (let i = 0; i < 3; i++) { const n = s.replace(LEGAL, '').replace(/[,\s]+$/, '').trim(); if (n === s) break; s = n; } return s || (name || '').trim(); }
function cleanFirst(name) { const s = (name || '').trim(); const r = s.replace(/^(?:[A-Za-z]\.?\s+)+/, '').trim(); return r || s; }

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
  sina: { booking: 'https://meetings.hubspot.com/szarei', demoVideo: 'X7RX3Bzz0sk' },
  denzel: { booking: 'https://meetings.hubspot.com/denzel-kereama', demoVideo: '699el1Gba3M' },
};
// Hand-picked product-demo frames (Sina chose these) for the demo-email thumbnail's
// left half. Drop demo-frame-<presenter>.png next to server.mjs; the presenter's
// YouTube maxres frame is the fallback when the file is missing.
const DEMO_FRAME = { sina: path.join(__dirname, 'demo-frame-sina.png'), denzel: path.join(__dirname, 'demo-frame-denzel.png') };
const demoFrameBuf = async (pKey, meta) => {
  try { return fs.readFileSync(DEMO_FRAME[pKey]); } catch {}
  return Buffer.from(await (await fetch(`https://img.youtube.com/vi/${meta.demoVideo}/maxresdefault.jpg`)).arrayBuffer());
};
const logoImgUrl = (domain) => `https://img.logo.dev/${encodeURIComponent(domain)}?token=${LOGODEV()}&size=300&format=png&retina=true`;
const rgbHex = ({ r, g, b }) => '#' + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
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
      const props = ['firstname', 'company', 'email', 'volcano_icp_vertical', 'hubspot_owner_id', 'volcano_heygen_video_url', 'volcano_thumb_url', 'volcano_lead_score', 'linkedin_url'];
      const contacts = [];
      for (let i = 0; i < ids.length; i += 100) {
        const r = await hs('/crm/v3/objects/contacts/batch/read', { method: 'POST', body: JSON.stringify({ properties: props, inputs: ids.slice(i, i + 100).map(id => ({ id })) }) });
        (await r.json()).results?.forEach(c => { const p = c.properties; contacts.push({ id: c.id, firstName: cleanFirst(p.firstname), company: cleanCompany(p.company), email: (p.email || '').toLowerCase(), vertical: p.volcano_icp_vertical || '', owner: p.hubspot_owner_id || '', hasAssets: !!(p.volcano_thumb_url || p.volcano_heygen_video_url), hsScore: +(p.volcano_lead_score || 0), linkedin: !!p.linkedin_url }); });
      }
      // 2) Instantly engagement across Pimple campaigns
      const camps = ((await (await fetch('https://api.instantly.ai/api/v2/campaigns?limit=100', { headers: { authorization: `Bearer ${K}` } })).json()).items || []).filter(c => /pimple/i.test(c.name));
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
      // 3) join + rank
      const rows = contacts.map(c => {
        const e = eng[c.email] || { opens: 0, clicks: 0, replies: 0, campaign: '' };
        const hubEng = e.opens * 2 + e.clicks * 10 + e.replies * 30;
        return { ...c, opens: e.opens, clicks: e.clicks, replies: e.replies, emailLive: !!eng[c.email], hubEng, total: hubEng + c.hsScore };
      }).sort((a, b) => b.total - a.total);
      return json(res, 200, { count: rows.length, emailLive: rows.filter(r => r.emailLive).length, rows });
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
      const props = ['firstname', 'company', 'email', 'website', 'domain', 'volcano_icp_vertical', 'hubspot_owner_id', 'volcano_heygen_video_url'];
      const contacts = [];
      for (let i = 0; i < ids.length; i += 100) {
        const r = await hsb('/crm/v3/objects/contacts/batch/read', { method: 'POST', body: JSON.stringify({ properties: props, inputs: ids.slice(i, i + 100).map(id => ({ id })) }) });
        (await r.json()).results?.forEach(c => {
          const p = c.properties;
          const domain = (p.domain || p.website || (p.email || '').split('@')[1] || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
          contacts.push({ id: c.id, firstName: cleanFirst(p.firstname), company: cleanCompany(p.company), email: p.email || '', domain, vertical: p.volcano_icp_vertical || '', owner: p.hubspot_owner_id || '', hasVideo: !!p.volcano_heygen_video_url });
        });
      }
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
      return json(res, r.status < 300 ? 200 : r.status, { url: b.url || null, id: b.id || null, error: r.status >= 300 ? b : null });
    }

    // --- Phase 2: build personalization blob + write back to HubSpot ---
    if (u.pathname === '/api/writeback' && req.method === 'POST') {
      const c = await readBody(req); // {contactId, video, firstName, company, vertical, email, domain}
      c.firstName = cleanFirst(c.firstName); c.company = cleanCompany(c.company);
      const T = HUB();
      const IMAP = ['architecture', 'engineering', 'consulting', 'creative', 'construction', 'civil'];
      const industry = IMAP.find(x => (c.vertical || '').toLowerCase().includes(x)) || '';
      const logoTok = LOGODEV();
      const logo = (logoTok && c.domain) ? `https://img.logo.dev/${encodeURIComponent(c.domain)}?token=${logoTok}&size=200&format=png&retina=true` : '';
      const pKey = (c.presenter || 'sina').toLowerCase();
      const pMeta = PRESENTER_META[pKey] || PRESENTER_META.sina;
      // composite the co-branded thumbnails + extract brand colour (before the blob, so thumb= can ride in it)
      let thumb = '', demoThumb = '', brand = '#0A2F28';
      if (logoTok && c.domain) {
        try {
          const logoBuf = Buffer.from(await (await fetch(logoImgUrl(c.domain))).arrayBuffer());
          const rgb = await vibrant(logoBuf); brand = rgbHex(rgb);
          const img = await composeThumb(pKey, logoBuf, rgb);
          thumb = await uploadPublic(img, `thumb-${c.contactId}.png`);
          try { // demo-email thumbnail: hand-picked product-demo frame | firm logo
            const frame = await demoFrameBuf(pKey, pMeta);
            const dimg = await composeThumb(pKey, logoBuf, rgb, frame);
            demoThumb = await uploadPublic(dimg, `demo-thumb-${c.contactId}.png`);
          } catch (e) { /* leave demo thumb blank on failure */ }
        } catch (e) { /* leave thumb blank on failure */ }
      }
      const parts = [
        `firstname=${encodeURIComponent(c.firstName || '')}`,
        `company=${encodeURIComponent(c.company || '')}`,
        `industry=${encodeURIComponent(industry)}`,
        `email=${encodeURIComponent(c.email || '')}`,
        `video=${encodeURIComponent(c.video || '')}`,
        `presenter=${encodeURIComponent(pKey)}`,
      ];
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
      const patch = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${c.contactId}`, { method: 'PATCH', headers: { authorization: `Bearer ${T}`, 'content-type': 'application/json' }, body: JSON.stringify({ properties: { volcano_heygen_video_url: c.video || '', volcano_personalization: blob, volcano_thumb_url: thumb, volcano_brand_color: brand, volcano_demo_thumb_url: demoThumb } }) });
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
      const logo = c.logo || (LOGODEV() && c.domain ? logoImgUrl(c.domain) : '');
      const K = INSTANTLY();
      const cr = await fetch('https://api.instantly.ai/api/v2/campaigns?limit=100', { headers: { authorization: `Bearer ${K}` } });
      const camps = (await cr.json())?.items || [];
      const IMAP = ['architecture', 'engineering', 'consulting', 'creative', 'construction', 'civil'];
      const word = IMAP.find(x => (c.vertical || '').toLowerCase().includes(x)) || '';
      const camp = camps.find(x => /pimple/i.test(x.name) && word && x.name.toLowerCase().includes(word));
      if (!camp) return json(res, 200, { ok: false, error: `no Pimple campaign for vertical "${c.vertical || '?'}"` });
      const body = { campaign: camp.id, email: c.email, first_name: c.firstName || '', company_name: c.company || '', custom_variables: { volcano_blob: blob || '', industry: word, video: video || '', thumb: thumb || '', demo_thumb: demoThumb || '', logo, brand_color: brand || '#0A2F28', presenter: c.presenter || 'Sina Zarei', presenter_title: c.presenter_title || 'Account Executive', booking: c.booking || '' } };
      const r = await fetch('https://api.instantly.ai/api/v2/leads', { method: 'POST', headers: { authorization: `Bearer ${K}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const rb = await r.json().catch(() => null);
      return json(res, r.status < 300 ? 200 : r.status, { ok: r.status < 300, campaign: camp.name, leadId: rb?.id || null, error: r.status >= 300 ? rb : null });
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
      const c = await readBody(req); // {contactId, campaignId}
      if (!HEYREACH()) return json(res, 200, { ok: false, error: 'no HEYREACH_API_KEY in .env' });
      if (!c.campaignId) return json(res, 200, { ok: false, error: 'pick a HeyReach campaign first' });
      const g = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${c.contactId}?properties=firstname,lastname,company,email,linkedin_url,volcano_icp_vertical,volcano_personalization,volcano_thumb_url,volcano_brand_color`, { headers: { authorization: `Bearer ${HUB()}` } });
      const p = (await g.json())?.properties || {};
      if (!p.linkedin_url) return json(res, 200, { ok: false, error: 'contact has no linkedin_url' });
      const blob = p.volcano_personalization || '';
      const IMAP = ['architecture', 'engineering', 'consulting', 'creative', 'construction', 'civil'];
      const industry = IMAP.find(x => (p.volcano_icp_vertical || '').toLowerCase().includes(x)) || '';
      const bookingMatch = blob.match(/booking=([^&]+)/);
      const lead = {
        profileUrl: p.linkedin_url,
        firstName: cleanFirst(p.firstname), lastName: p.lastname || '',
        companyName: cleanCompany(p.company), emailAddress: (p.email || '').toLowerCase(),
        customUserFields: [
          { name: 'intro_link', value: blob ? `https://lp.workflowmax.com/app?tool=intro&${blob}` : '' },
          { name: 'health_check_link', value: blob ? `https://lp.workflowmax.com/app?tool=tp1&${blob}` : '' },
          { name: 'thumb', value: p.volcano_thumb_url || '' },
          { name: 'booking', value: bookingMatch ? decodeURIComponent(bookingMatch[1]) : '' },
          { name: 'industry', value: industry },
        ].filter(f => f.value),
      };
      const r = await hr('/campaign/AddLeadsToCampaignV2', { campaignId: +c.campaignId || c.campaignId, accountLeadPairs: [{ lead }] });
      const b = await r.json().catch(() => null);
      return json(res, 200, { ok: r.status < 300, http: r.status, response: b, error: r.status >= 300 ? JSON.stringify(b).slice(0, 300) : null });
    }

    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: String(e) });
  }
});

server.listen(PORT, () => console.log(`HeyGen studio -> http://localhost:${PORT}`));
