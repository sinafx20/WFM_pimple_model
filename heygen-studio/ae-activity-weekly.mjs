// Builds an 8-week, per-AE activity series for the cockpit: HubSpot-logged activity
// broken down by type, plus a separate "Volcano" series counting the outreach this
// campaign generates (Instantly sends + LinkedIn connection requests + LinkedIn DMs).
// The point is to show what the campaign added on top of each AE's baseline effort.
//
// Run: node ae-activity-weekly.mjs   ->  writes ae-activity-weekly.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envGet = (k) => {
  if (process.env[k]) return process.env[k];
  try { const m = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(new RegExp(`^\\s*${k}\\s*=\\s*(.+)\\s*$`, 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined; } catch { return undefined; }
};
const HUB = envGet('HUBSPOT_TOKEN'), IK = envGet('INSTANTLY_API_KEY'), HK = envGet('HEYREACH_API_KEY');

const OWNERS = { '80127259': 'denzel', '80406430': 'sina' }; // verified 2026-08-29 via email senders
// HeyReach seat ids -> AE (same seats used in heyreach-seed-real-campaigns.mjs)
const SEATS = { 221310: 'sina', 223029: 'denzel' };
const TYPES = ['calls', 'meetings', 'emails', 'tasks', 'notes'];
const WEEKS = 8;

// --- week buckets, Monday-start, local time, ending with the current week ---
function mondayOf(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;            // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}
const thisMonday = mondayOf(new Date());
const weeks = [];
for (let i = WEEKS - 1; i >= 0; i--) {
  const s = new Date(thisMonday); s.setDate(s.getDate() - i * 7);
  const e = new Date(s); e.setDate(e.getDate() + 7);
  weeks.push({ key: `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`,
    label: s.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), start: s.getTime(), end: e.getTime() });
}
const weekIndexFor = (ms) => weeks.findIndex((w) => ms >= w.start && ms < w.end);

const blank = () => Object.fromEntries(weeks.map((w) => [w.key, Object.fromEntries([...TYPES, 'volcano'].map((t) => [t, 0]))]));
const data = { sina: blank(), denzel: blank() };

const hs = (p, o = {}) => fetch('https://api.hubapi.com' + p, { ...o, headers: { authorization: `Bearer ${HUB}`, 'content-type': 'application/json', ...(o.headers || {}) } });

async function hubspotActivity() {
  for (const [ownerId, ae] of Object.entries(OWNERS)) {
    for (const type of TYPES) {
      for (const w of weeks) {
        const r = await hs(`/crm/v3/objects/${type}/search`, { method: 'POST', body: JSON.stringify({
          filterGroups: [{ filters: [
            { propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId },
            { propertyName: 'hs_timestamp', operator: 'GTE', value: String(w.start) },
            { propertyName: 'hs_timestamp', operator: 'LT', value: String(w.end) }] }], limit: 1 }) });
        const b = await r.json();
        data[ae][w.key][type] = b.total ?? 0;
      }
    }
  }
}

// --- Volcano outreach: Instantly sends ---
async function instantlySends() {
  const camps = JSON.parse(fs.readFileSync(path.join(__dirname, 'instantly-real-campaigns.json'), 'utf8'));
  for (const owners of Object.values(camps)) {
    for (const [ae, id] of Object.entries(owners)) {
      // MUST be campaign_id. `id`, `campaign` and `campaignId` are all silently
      // ignored and return the same workspace-wide series for every campaign, which
      // multiplied sends by the campaign count and back-dated them into weeks before
      // this campaign existed (caught 2026-08-29 when July showed Volcano activity).
      const r = await fetch(`https://api.instantly.ai/api/v2/campaigns/analytics/daily?campaign_id=${id}`, { headers: { authorization: `Bearer ${IK}` } });
      if (r.status !== 200) continue;
      for (const d of (await r.json()) || []) {
        const i = weekIndexFor(new Date(d.date + 'T00:00:00').getTime());
        if (i >= 0) data[ae][weeks[i].key].volcano += d.sent || 0;
      }
    }
  }
}

const hr = (p, body) => fetch('https://api.heyreach.io/api/public' + p, { method: 'POST', headers: { 'X-API-KEY': HK, 'content-type': 'application/json' }, body: JSON.stringify(body) });

// --- Volcano outreach: LinkedIn connection requests ---
// creationTime is when the lead entered the campaign; HeyReach fires the request
// shortly after, so it is the closest available stamp for "request sent".
const realProfiles = new Set();   // prospects in the real vertical+owner campaigns

async function linkedinRequests() {
  const camps = JSON.parse(fs.readFileSync(path.join(__dirname, 'heyreach-real-campaigns.json'), 'utf8'));
  let counted = 0;
  for (const meta of Object.values(camps)) {
    let offset = 0, guard = 0;
    while (guard++ < 20) {
      const b = await (await hr('/campaign/GetLeadsFromCampaign', { campaignId: meta.campaignId, offset, limit: 100 })).json();
      const items = b?.items || [];
      for (const it of items) {
        const pu = (it.linkedInUserProfile?.profileUrl || '').replace(/\/+$/, '').toLowerCase();
        if (pu) realProfiles.add(pu);
        const st = it.leadConnectionStatus;
        if (st !== 'ConnectionSent' && st !== 'ConnectionAccepted') continue;
        const ae = SEATS[it.linkedInSenderId] || meta.owner;
        const i = weekIndexFor(new Date(it.creationTime).getTime());
        if (i >= 0 && data[ae]) { data[ae][weeks[i].key].volcano++; counted++; }
      }
      if (items.length < 100) break;
      offset += 100;
    }
  }
  return counted;
}

// --- Volcano outreach: LinkedIn DMs actually sent ---
async function linkedinDMs() {
  let counted = 0, offset = 0, guard = 0;
  while (guard++ < 20) {
    const b = await (await hr('/inbox/GetConversationsV2', { offset, limit: 100 })).json();
    const items = b?.items || [];
    for (const c of items) {
      const ae = SEATS[c.linkedInAccountId];
      if (!ae) continue;
      // Only count DMs to prospects in the real campaigns. The inbox also holds
      // threads from July's "known contacts" test round (colleagues, not prospects);
      // counting those put ~111 phantom Volcano actions into mid-July.
      const pu = (c.correspondentProfile?.profileUrl || '').replace(/\/+$/, '').toLowerCase();
      if (!realProfiles.has(pu)) continue;
      for (const m of c.messages || []) {
        if (m.sender !== 'ME') continue;
        const i = weekIndexFor(new Date(m.createdAt).getTime());
        if (i >= 0) { data[ae][weeks[i].key].volcano++; counted++; }
      }
    }
    if (items.length < 100 || offset + items.length >= (b.totalCount || 0)) break;
    offset += 100;
  }
  return counted;
}

const out = {};
await hubspotActivity();
console.log('hubspot activity collected');
await instantlySends();
console.log('instantly sends collected');
const crs = await linkedinRequests();
console.log('linkedin connection requests:', crs);
const dms = await linkedinDMs();
console.log('linkedin DMs sent:', dms);

fs.writeFileSync(path.join(__dirname, 'ae-activity-weekly.json'), JSON.stringify({
  generated: new Date().toISOString(), types: TYPES,
  weeks: weeks.map((w) => ({ key: w.key, label: w.label })), data,
  note: 'volcano = Instantly sends + LinkedIn connection requests + LinkedIn DMs generated by this campaign; it adds on top of the HubSpot-logged types',
}, null, 2));

for (const ae of ['sina', 'denzel']) {
  console.log('\n' + ae.toUpperCase());
  for (const w of weeks) {
    const d = data[ae][w.key];
    const base = TYPES.reduce((s, t) => s + d[t], 0);
    console.log('  ' + w.label.padEnd(8), 'base=' + String(base).padStart(4), 'volcano=' + String(d.volcano).padStart(4), '  ' + TYPES.map((t) => t[0] + d[t]).join(' '));
  }
}
