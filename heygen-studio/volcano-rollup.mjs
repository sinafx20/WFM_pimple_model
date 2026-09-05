// Rolls the campaign's engagement signals up onto each HubSpot contact, so that HubSpot
// is the single source of truth for the Volcano heat model.
//
// WHY THIS EXISTS. The heat model used to live as JavaScript inside a published dashboard,
// LinkedIn activity lived only as timeline Notes, and genuine-reply classification lived in
// a local JSON file. None of those can be queried per contact, which meant the dashboard had
// to be rebuilt by hand from local dumps and HubSpot workflows had nothing to fire on. Once
// the same signals are contact properties, a page can read them live and a workflow can
// trigger on a contact crossing a band boundary.
//
// WHY IT READS EVERYTHING FROM HUBSPOT AND HEYREACH. This runs on a GitHub runner from a
// clean checkout, so it cannot depend on _viz.json or any other local dump.
//
// WHY NOT LIST 3698. The daily batch works from that list, but the list is dynamic and its
// filters were last updated 2026-07-06, so it now holds only 124 of the audience while 356
// contacts carry volcano_icp_vertical. Scoring off the list would silently ignore two
// thirds of the campaign, which is exactly the "offList: 210" figure the dashboard reports.
//
// Run: node volcano-rollup.mjs            (dry run, prints what would change)
//      node volcano-rollup.mjs --commit   (writes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = (f) => path.join(__dirname, f);
const envFile = fs.existsSync(p('.env')) ? fs.readFileSync(p('.env'), 'utf8') : '';
const g = (k) => process.env[k] || (envFile.match(new RegExp('^' + k + '=(.+)$', 'm')) || [])[1]?.trim();
const T = g('HUBSPOT_TOKEN'), HK = g('HEYREACH_API_KEY');
if (!T) { console.error('missing HUBSPOT_TOKEN'); process.exit(1); }
const H = { authorization: `Bearer ${T}`, 'content-type': 'application/json' };
const COMMIT = process.argv.includes('--commit');
// Kept for reference: the daily batch still works from this list.
const LIST_ID = '3698';

// Everything before this is our own testing, not prospects. Same cutoff verified-visits.mjs
// uses: counting July activity once crowned a test session as the hottest lead in the pipeline.
const CUTOFF = '2026-08-26';

// Teammates and test records sit in the same audience but must never generate heat, or an
// AE gets sent after their own colleague. Domains cover the team; the local override file
// exists because personal addresses used for testing (a gmail account exercising the tools)
// look exactly like a prospect and cannot be recognised by domain. Kept out of the repo
// because it is a list of real addresses and this repo is public.
const INTERNAL_DOMAINS = ['workflowmax.com', 'bluerock.com.au', 'example.com'];
const INTERNAL_EMAILS = new Set(
  (fs.existsSync(p('_internal-contacts.json'))
    ? JSON.parse(fs.readFileSync(p('_internal-contacts.json'), 'utf8'))
    : []).map((e) => String(e).toLowerCase())
);
// volcano_internal is the authority, because some testers used partner or personal domains
// that no rule can tell apart from a real firm. The domain list and the local file stay as
// a safety net for records nobody has flagged yet.
// A ruled-out contact is not a cold prospect, it is a closed one. Zeroing the heat is not
// enough on its own: a cold ember still reads as "not yet warmed up" and still sits in the
// queue. These are removed from the volcano entirely and counted separately instead.
const RULED_OUT = ['opted_out', 'not_interested', 'disqualified'];
const isRuledOut = (c) => RULED_OUT.includes(String(c.volcano_disposition || ''));

const isInternal = (c) => {
  if (String(c.volcano_internal || '').toLowerCase() === 'true') return true;
  const e = String(c.email || '').toLowerCase();
  return INTERNAL_EMAILS.has(e) || INTERNAL_DOMAINS.some((d) => e.endsWith('@' + d));
};

const jget = async (url) => (await fetch(url, { headers: H })).json();
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch { out[k] = null; } }
  }));
  return out;
}

// ---------------------------------------------------------------- contact set
const READ = ['email', 'firstname', 'lastname', 'company', 'jobtitle', 'hubspot_owner_id',
  'volcano_icp_vertical', 'volcano_interaction_log', 'volcano_interaction_depth',
  'wfm_completed_health_check', 'wfm_completed_calculator', 'wfm_completed_benchmark',
  'hs_analytics_last_timestamp', 'volcano_heat', 'volcano_li_stage',
  'volcano_genuine_reply', 'volcano_verified_visits', 'volcano_email_clicks', 'volcano_genuine_opens',
  'volcano_inmail_track', 'volcano_inmail_sent',
  'volcano_email_opens', 'volcano_emails_sent', 'volcano_li_messages',
  'volcano_disposition', 'volcano_disposition_note',
  'volcano_peak_heat', 'volcano_peak_band', 'volcano_first_warm_at',
  'volcano_internal'];
const contacts = [];
for (let after = 0; ;) {
  const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST', headers: H,
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName: 'volcano_icp_vertical', operator: 'HAS_PROPERTY' }] }],
      properties: READ, limit: 100, after: String(after),
    }),
  })).json();
  (b.results || []).forEach((c) => contacts.push({ id: c.id, ...c.properties }));
  if (!b.paging?.next?.after) break;
  after = b.paging.next.after;
}
console.log(`campaign audience: ${contacts.length} contacts`);

// ---------------------------------------------------------------- LinkedIn stage
// HeyReach has no webhooks (three endpoint shapes probed 2026-09-01, all 404), so the only
// way to know a stage is to ask. A missing key is not fatal: the other signals still roll up.
const liStage = {};
// The InMail arc is where the sequence sends a prospect who never accepted the connection
// request, because InMail is the only way to reach a non-connection. HeyReach has no
// per-lead flag for it, but the combination is unambiguous: request sent, never accepted,
// messaging started. That yields 29 leads against the 27 its own totalInmailStarted
// reports, the difference being leads that accepted after the aggregate window.
const inmailTrack = {};
const inmailSent = {};
const liMessages = {};
const RANK = { sent: 1, accepted: 2, replied: 3 };
if (HK) {
  const map = JSON.parse(fs.readFileSync(p('heyreach-real-campaigns.json'), 'utf8'));
  const hr = (path_, body) => fetch('https://api.heyreach.io/api/public' + path_, {
    method: 'POST', headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let leads = 0;
  const emailByProfileUrl = {};
  for (const m of Object.values(map)) {
    for (let offset = 0; ;) {
      const r = await hr('/campaign/GetLeadsFromCampaign', { campaignId: m.campaignId, offset, limit: 100 });
      if (!r.ok) { console.error(`heyreach campaign ${m.campaignId}: HTTP ${r.status}`); break; }
      const b = await r.json();
      const items = b.items || [];
      for (const l of items) {
        const email = (l.linkedInUserProfile?.emailAddress || l.linkedInUserProfile?.enrichedEmailAddress || '').toLowerCase();
        if (!email) continue;
        leads++;
        if (l.linkedInUserProfile?.profileUrl) emailByProfileUrl[l.linkedInUserProfile.profileUrl] = email;
        // Stage only ever climbs. The same person can appear in more than one campaign row,
        // and a later row still reading ConnectionSent must not demote someone who connected.
        const s = l.leadConnectionStatus === 'ConnectionAccepted' ? 'accepted'
          : l.leadConnectionStatus === 'ConnectionSent' ? 'sent' : null;
        if (s && (!liStage[email] || RANK[s] > RANK[liStage[email]])) liStage[email] = s;
        if (l.leadConnectionStatus === 'ConnectionSent' && l.leadMessageStatus === 'MessageSent') inmailTrack[email] = true;
      }
      offset += items.length;
      if (items.length < 100 || offset >= (b.totalCount || 0)) break;
    }
  }
  // Being on the InMail arc is not the same as an InMail going out, and the gap between the
  // two is the point: HeyReach reports 27 chains started and 0 InMail messages sent. Counting
  // deliveries separately is what makes that visible instead of implying the track is idle.
  const convs = [];
  for (let offset = 0; ;) {
    const r = await fetch('https://api.heyreach.io/api/public/inbox/GetConversationsV2', {
      method: 'POST', headers: { 'X-API-KEY': HK, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ filters: {}, offset, limit: 50 }),
    });
    if (!r.ok) { console.error('inbox: HTTP ' + r.status + ' - InMail delivery counts will be missing'); break; }
    const b = await r.json();
    const items = b.items || [];
    convs.push(...items);
    offset += items.length;
    if (items.length < 50 || offset >= (b.totalCount || 0)) break;
  }
  for (const c of convs) {
    const pr = c.correspondentProfile || {};
    const em = (pr.emailAddress || pr.enrichedEmailAddress || '').toLowerCase() || emailByProfileUrl[pr.profileUrl];
    if (!em) continue;
    const n = (c.messages || []).filter((m) => m.sender === 'ME' && m.isInMail).length;
    if (n) inmailSent[em] = (inmailSent[em] || 0) + n;
    // Every outbound message, InMail or not. The connection request is not a message and is
    // not counted here; it has its own stage.
    const out = (c.messages || []).filter((m) => m.sender === 'ME').length;
    if (out) liMessages[em] = (liMessages[em] || 0) + out;
  }
  console.log(`heyreach: ${leads} leads with an email, ${Object.keys(liStage).length} distinct`
    + `, ${Object.keys(inmailTrack).length} on the InMail track, `
    + `${Object.values(inmailSent).reduce((a, b) => a + b, 0)} InMails actually delivered`);
} else {
  console.log('heyreach: no HEYREACH_API_KEY, skipping LinkedIn stage');
}

// ---------------------------------------------------------------- Instantly open counts
// The raw open total has to come from Instantly, because HubSpot never sees an open: the
// webhook only started counting them on 2026-09-02 and would under-report the campaign's
// whole history. Instantly's per-lead email_open_count is the number its own dashboard
// shows, which is exactly the figure the cockpit needs to put a genuine count beside.
const openTotals = {};
const sentiment = {};
const IK = g('INSTANTLY_API_KEY');
if (IK) {
  const camps = JSON.parse(fs.readFileSync(p('instantly-real-campaigns.json'), 'utf8'));
  const ids = [...new Set(Object.values(camps).flatMap((v) => typeof v === 'string' ? [v] : Object.values(v)))];
  let seen = 0;
  for (const cid of ids) {
  for (let cursor = null; ;) {
      const r = await fetch('https://api.instantly.ai/api/v2/leads/list', {
        method: 'POST', headers: { authorization: 'Bearer ' + IK, 'content-type': 'application/json' },
        body: JSON.stringify({ campaign: cid, limit: 100, ...(cursor ? { starting_after: cursor } : {}) }),
      });
      if (!r.ok) { console.error('instantly campaign ' + cid + ': HTTP ' + r.status); break; }
      const b = await r.json();
      const items = b.items || [];
      for (const l of items) {
        const em = String(l.email || '').toLowerCase();
        if (!em) continue;
        seen++;
        openTotals[em] = (openTotals[em] || 0) + (Number(l.email_open_count) || 0);
      }
      cursor = b.next_starting_after;
      if (!cursor || !items.length) break;
    }
  }
  console.log(`instantly: ${seen} leads, ${Object.values(openTotals).reduce((a, b) => a + b, 0)} opens reported`);

  // Reply sentiment has to be read here rather than from HubSpot, because HubSpot's copy of a
  // reply arrives with an empty body: the webhook writes whatever Instantly puts in the
  // payload and that field is blank on these events. Subject alone cannot tell "Unsubscribe
  // me" from a real conversation, and treating both as a genuine reply at +30 is what put
  // someone who asked us to stop at the top of the volcano.
  //
  // Two independent inputs, and either is enough. Instantly's own ai_interest_value flags
  // negative sentiment, and an explicit opt-out phrase is matched directly, because asking to
  // be removed is a compliance obligation and far too important to leave to a model's score.
  const IH = { authorization: 'Bearer ' + IK, 'content-type': 'application/json' };
  let pages = 0;
  const OPT_OUT = /\b(unsubscribe|opt[\s-]?out|remove me|take me off|stop (emailing|contacting)|do not (contact|email)|no longer wish)\b/i;
  const NOT_INTERESTED = /\b(not interested|no thanks|no thank you|not for us|not a fit|we('| a)re (all )?(good|sorted|set))\b/i;
  for (let cursor = null; ;) {
    // 100 returns HTTP 500 from Instantly; 50 is the largest page it will serve.
    const url = 'https://api.instantly.ai/api/v2/emails?limit=50&email_type=received'
      + (cursor ? '&starting_after=' + encodeURIComponent(cursor) : '');
    const r = await fetch(url, { headers: IH });
    // Instantly 500s on some pages regardless of size. A truncated sweep would silently stop
    // classifying older replies while still reporting a tidy sentiment count, so drop to a
    // smaller page and retry before giving up, and say plainly how far it actually got.
    let b;
    if (!r.ok) {
      const r2 = await fetch(url.replace('limit=50', 'limit=20'), { headers: IH });
      if (!r2.ok) { console.error('instantly emails: HTTP ' + r.status + ' then ' + r2.status
        + ' on retry, sentiment covers the ' + pages + ' page(s) read so far only'); break; }
      b = await r2.json();
    } else b = await r.json();
    pages++;
    const items = b.items || [];
    for (const e of items) {
      const em = String(e.from_address_email || '').toLowerCase();
      if (!em) continue;
      const body = String((e.body && (e.body.text || e.body.html)) || '').replace(/<[^>]+>/g, ' ');
      // Only the prospect's own words count. A quoted copy of our email sits below the reply
      // and would match anything, including the unsubscribe line in our own footer.
      const own = body.split(/\r?\n\s*(?:On .{0,80}wrote:|-{2,}\s*Original Message|_{5,}|>)/)[0].slice(0, 1200);
      if (OPT_OUT.test(own)) sentiment[em] = 'opted_out';
      else if (sentiment[em] !== 'opted_out'
        && (NOT_INTERESTED.test(own) || Number(e.ai_interest_value) < 0)) sentiment[em] = 'not_interested';
    }
    cursor = b.next_starting_after;
    if (!cursor || !items.length) break;
  }
  const sc = Object.values(sentiment).reduce((a, v) => ((a[v] = (a[v] || 0) + 1), a), {});
  console.log('instantly sentiment:', JSON.stringify(sc), '| pages read:', pages);
} else {
  // Loud on purpose. This ran in GitHub Actions for days without the key, silently skipping
  // open counts AND reply sentiment, which meant an unsubscribe would never have been caught
  // automatically. A skipped input that looks like a clean run is worse than a failure.
  console.error('WARNING: no INSTANTLY_API_KEY. Open counts and reply sentiment are BOTH skipped,'
    + ' so opt-outs will not be detected in this run.');
}

// ---------------------------------------------------------------- genuine replies
// Instantly counts every inbound message including out-of-office, and a reply is the
// heaviest signal in the model. Both of the first replies this campaign recorded were
// auto-responders, one of which briefly sat at the top of the volcano. Erring toward
// "automatic" is the safe direction: a missed real reply still lands in the AE's inbox,
// whereas a scored out-of-office sends someone chasing a prospect who never wrote.
const AUTO = [
  /^\s*automatic reply\s*:/i, /^\s*auto(matic)?[-\s]?reply\b/i, /^\s*out of (the )?office\b/i,
  /\bout of office\b.*\bre\s*:/i, /^\s*re\s*:\s*out of (the )?office\b/i, /^\s*auto\s*:/i,
  /^\s*undeliverable\s*:/i, /^\s*delivery status notification/i,
  /^\s*(re\s*:\s*)?vacation\b/i, /\bon (annual )?leave\b/i, /\bi am currently (away|out)\b/i,
];
const isAuto = (s) => AUTO.some((r) => r.test(String(s || '')));

// ---------------------------------------------------------------- completion dates
// wfm_completed_* is a bare boolean with no date on it, so a completion from our own July
// testing looks identical to a prospect completing the tool yesterday. Property history is
// the only place the date exists, so ask for it, but only for the contacts that actually
// carry a completion flag: that is a handful of records, not the whole audience.
const COMPLETION_PROPS = ['wfm_completed_health_check', 'wfm_completed_calculator', 'wfm_completed_benchmark'];
const flagged = contacts.filter((c) => COMPLETION_PROPS.some((k) => String(c[k] || '').toLowerCase() === 'true'));
const completedAfterCutoff = new Set();
for (let i = 0; i < flagged.length; i += 50) {
  const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/read', {
    method: 'POST', headers: H,
    body: JSON.stringify({ properties: ['email'], propertiesWithHistory: COMPLETION_PROPS, inputs: flagged.slice(i, i + 50).map((c) => ({ id: c.id })) }),
  })).json();
  (b.results || []).forEach((c) => {
    const hist = Object.values(c.propertiesWithHistory || {}).flat();
    const setTrue = hist.filter((h) => String(h.value).toLowerCase() === 'true').map((h) => String(h.timestamp || ''));
    if (setTrue.some((t) => t >= CUTOFF)) completedAfterCutoff.add(c.id);
  });
}
console.log(`completions: ${flagged.length} contacts flagged, ${completedAfterCutoff.size} of them after the ${CUTOFF} cutoff`);

const emptyBodies = [];
const replies = await pool(contacts, 4, async (c) => {
  const a = await jget(`https://api.hubapi.com/crm/v4/objects/contacts/${c.id}/associations/emails`);
  const eids = (a.results || []).map((x) => x.toObjectId);
  if (!eids.length) return { genuine: 0, sent: 0 };
  let genuine = 0, sent = 0;
  for (let i = 0; i < eids.length; i += 100) {
    const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/emails/batch/read', {
      method: 'POST', headers: H,
      body: JSON.stringify({ properties: ['hs_email_subject', 'hs_email_direction', 'hs_timestamp', 'hs_email_text', 'hs_email_message_id'], inputs: eids.slice(i, i + 100).map((id) => ({ id })) }),
    })).json();
    (b.results || []).forEach((e) => {
      const pr = e.properties || {};
      // Walking a contact's whole association list reaches back years, so the campaign
      // window matters as much as the auto-reply test does: one prospect's February
      // "not interested" to a manual email briefly looked like the campaign's first reply.
      // The same walk answers "how many did we send", so count it here rather than paying
      // for a second pass over every contact's associations.
      if (pr.hs_email_direction === 'EMAIL' && String(pr.hs_timestamp || '') >= CUTOFF) sent++;
      // Instantly's webhook payload carries no body, so every email logged live since the one
      // backfill on 1 Sept landed on the timeline as a subject with nothing under it. The message
      // id is present though, which is all that is needed to go and fetch the text afterwards.
      if (String(pr.hs_timestamp || '') >= CUTOFF && !String(pr.hs_email_text || '').trim()
        && pr.hs_email_message_id) {
        emptyBodies.push({ id: e.id, messageId: String(pr.hs_email_message_id) });
      }
      if (pr.hs_email_direction !== 'INCOMING_EMAIL') return;
      if (String(pr.hs_timestamp || '') < CUTOFF) return;
      if (!isAuto(pr.hs_email_subject)) genuine++;
    });
  }
  return { genuine, sent };
});
console.log(`replies: ${replies.filter((r) => r && r.genuine).length} contacts with a genuine reply`, `| campaign emails on timelines: ${replies.reduce((a, r) => a + ((r && r.sent) || 0), 0)}`);

// ---------------------------------------------------------------- heat
// The interaction log is written live by the on-page beacon (src/pages/api/track.js) and by
// the Instantly click webhook, one line per verified action. Distinct days in it are the
// closest thing we have to "a real person came back", and unlike hs_analytics_num_page_views
// it is dated per event rather than being a lifetime cumulative counter.
const dates = (log) => new Set(String(log || '').split('\n')
  .map((l) => (l.match(/\d{4}-\d{2}-\d{2}/) || [])[0]).filter((d) => d && d >= CUTOFF));

// The beacon only started writing that log on 2026-08-31, so on its own it would erase every
// visit that happened earlier in the campaign. hs_analytics_last_timestamp fills the gap, but
// only conservatively: it is a single last-seen moment, not a per-view history (those need the
// web-analytics-api-access scope, which still returns 403), so it can evidence exactly one
// day. Union rather than sum, so a visit already in the log is never counted twice.
const visitDays = (c) => {
  const s = dates(c.volcano_interaction_log);
  const seen = String(c.hs_analytics_last_timestamp || '').slice(0, 10);
  if (seen && seen >= CUTOFF) s.add(seen);
  return s.size;
};
const clicksIn = (log) => (String(log || '').match(/instantly\/link-click/g) || []).length;

// Opens and short-link fetches are deliberately absent from this sum. Measured 2026-09-01
// across 107 openers, 84% of the opens whose timing could be resolved fired within five
// minutes of delivery and none of the 107 clicked anything: that is Apple Mail prefetching,
// Gmail proxying and security appliances scanning, not people reading.
//
// The LinkedIn numbers below are ours to choose. A reply is set at 30 so it matches an email
// reply and lands a contact in Warm on its own; a connection is worth noticing but not
// chasing. Change them here, not in the dashboard, so every consumer agrees.
// "Request sent" scores nothing, because it is OUR action, not the prospect's. It is us
// clicking connect, which is the same category as an email open or a short-link fetch, and
// both of those are already zero for exactly this reason: they are not evidence a person
// chose anything. Scoring it put 187 of 348 contacts on heat 5 for something they never
// did, which made Cold look textured when it is flat. Accepted and replied stay, because
// in both cases the prospect decided to act. Our own outbound volume is still fully visible
// in the campaign performance panel and on the contact timeline, which is where it belongs.
const LI_HEAT = { sent: 0, accepted: 15, replied: 30 };

// Opens score NOTHING, genuine or otherwise. They are counted and displayed, because the
// gap between the raw total and the plausible ones is worth seeing, but they never move an
// ember. An open is not an action a prospect chose to take in any way we can verify: 84% of
// resolvable opens fired within five minutes of delivery and not one of 107 openers clicked
// anything. Letting even a capped +2 through would rank contacts on pixel fetches, which is
// the exact failure this model was built to avoid.


const changes = [];
const heatById = {};
const bandKey = (h) => h >= 100 ? 'eruption' : h >= 65 ? 'hot' : h >= 25 ? 'warm' : 'cold';
for (let i = 0; i < contacts.length; i++) {
  const c = contacts[i];
  const email = (c.email || '').toLowerCase();
  const stage = liStage[email] || null;
  const gr = (replies[i] && replies[i].genuine) || 0;
  const emailsSent = (replies[i] && replies[i].sent) || 0;
  const vv = visitDays(c);
  const completed = completedAfterCutoff.has(c.id);
  // The first verified visit is worth more than an unverified click and lands the contact in
  // Warm on its own: if a real person reached our content, an AE should be looking at them.
  // Repeat visits add less and cap, so one person browsing repeatedly cannot outrank the
  // rest of the pipeline. Completing a tool is a form submission, so it scores like a reply.
  const visitHeat = (vv > 0 ? 25 + Math.min(50, (vv - 1) * 10) : 0) + (completed ? 30 : 0);
  const clicks = clicksIn(c.volcano_interaction_log);
  const heat = (isInternal(c) || isRuledOut(c)) ? 0
    : clicks * 10 + gr * 30 + (stage ? LI_HEAT[stage] : 0) + visitHeat;
  heatById[c.id] = heat;

  const next = {
    volcano_heat: String(heat),
    // Peak only ever climbs, including across a rollup that lowers today's heat. This is what the
    // ever-reached view reads and what travels with a contact into nurture.
    volcano_peak_heat: String(Math.max(Number(c.volcano_peak_heat) || 0, heat)),
    volcano_peak_band: bandKey(Math.max(Number(c.volcano_peak_heat) || 0, heat)),
    // Stamped once, the first time they cross into Warm, and never moved afterwards.
    ...((!c.volcano_first_warm_at && heat >= 25) ? { volcano_first_warm_at: new Date().toISOString() } : {}),
    volcano_inmail_track: inmailTrack[email] ? 'true' : 'false',
    volcano_inmail_sent: String(inmailSent[email] || 0),
    volcano_li_messages: String(liMessages[email] || 0),
    volcano_emails_sent: String(emailsSent),
    volcano_email_opens: String(openTotals[email] || 0),
    // Fill an empty disposition only. A person who has spoken to the prospect knows things no
    // signal can recover, so a value already on the record always wins, and an AE's
    // "disqualified" is never quietly downgraded to "not interested" by a sentiment score.
    ...(!c.volcano_disposition && sentiment[email] ? { volcano_disposition: sentiment[email] } : {}),
    volcano_email_clicks: String(clicks),
    volcano_verified_visits: String(vv),
    volcano_genuine_reply: gr > 0 ? 'true' : 'false',
    ...(stage ? { volcano_li_stage: stage } : {}),
  };
  // Only write what actually moved. A no-op PATCH still stamps lastmodifieddate, which would
  // make every contact look freshly touched every two hours and ruin any "recently active"
  // view an AE relies on.
  const diff = Object.fromEntries(Object.entries(next).filter(([k, v]) => String(c[k] ?? '') !== v));
  if (Object.keys(diff).length) changes.push({ id: c.id, email, heat, properties: diff });
}

// ------------------------------------------------- what the AEs actually learned
// The strongest signal in this pipeline is a person talking to a person, and it was the one
// thing the model could not see. An AE logs a call saying "they make products, not a fit" and
// the contact keeps sitting in Warm because they once visited a page. Bill Baker was exactly
// that: a verified visit holding him at 25 while the AE already knew he was out.
//
// Scoped to Warm and above. That is where it was asked for and also where it pays: a note on a
// cold contact changes nothing anyone is about to act on, and reading every association for
// all 356 would multiply the run for no decision.
//
// Our own automation notes are skipped. The LinkedIn sync writes hundreds carrying
// [volcano:...] markers, and "connection request sent" is not an AE's judgement.
const NOTE_RULES = [
  { d: 'disqualified',   re: /\b(not (a )?(good )?fit|wrong fit|not our icp|out of scope|manufactur\w*|product (business|company)|retail|not (a )?(services|projects?) business|no projects?)\b/i },
  { d: 'opted_out',      re: /\b(unsubscribe|do not (contact|call|email)|asked to be removed|remove (them|him|her) from)\b/i },
  { d: 'not_interested', re: /\b(not interested|no interest|declined|no thanks|happy with (their|what)|already (have|using)|staying with|no budget)\b/i },
  { d: 'engaged',        re: /\b(demo booked|booked (a )?(call|meeting|demo)|keen|wants (a )?(demo|call|quote|trial)|sending (them )?(a )?proposal)\b/i },
];
const classifyNote = (text) => {
  const t = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (!t.trim() || /\[volcano:[a-z-]+:/i.test(t)) return null;
  for (const r of NOTE_RULES) if (r.re.test(t)) return { d: r.d, evidence: t.slice(0, 160) };
  return null;
};

const warmSet = contacts.filter((c) => (heatById[c.id] || 0) >= 25 && !isInternal(c) && !isRuledOut(c));
const noteFindings = {};
if (warmSet.length) {
  await pool(warmSet, 4, async (c) => {
    for (const kind of ['notes', 'calls']) {
      const a = await jget('https://api.hubapi.com/crm/v4/objects/contacts/' + c.id + '/associations/' + kind);
      const ids = (a.results || []).map((x) => x.toObjectId);
      if (!ids.length) continue;
      const props = kind === 'notes'
        ? ['hs_note_body', 'hs_timestamp']
        : ['hs_call_body', 'hs_call_title', 'hs_timestamp', 'hs_call_disposition'];
      for (let i = 0; i < ids.length; i += 100) {
        const b = await (await fetch('https://api.hubapi.com/crm/v3/objects/' + kind + '/batch/read', {
          method: 'POST', headers: H,
          body: JSON.stringify({ properties: props, inputs: ids.slice(i, i + 100).map((id) => ({ id })) }),
        })).json();
        for (const o of (b.results || [])) {
          const pr = o.properties || {};
          if (String(pr.hs_timestamp || '') < CUTOFF) continue;
          const found = classifyNote([pr.hs_note_body, pr.hs_call_title, pr.hs_call_body].filter(Boolean).join(' '));
          // Ruling someone out beats promoting them: if one note says "not a fit" and another
          // says "keen", the one that closes them is the one to trust.
          if (found && (!noteFindings[c.id] || (noteFindings[c.id].d === 'engaged' && found.d !== 'engaged'))) {
            noteFindings[c.id] = Object.assign({}, found, { kind });
          }
        }
      }
    }
  });
  const nf = Object.values(noteFindings).reduce((a, v) => ((a[v.d] = (a[v.d] || 0) + 1), a), {});
  console.log('AE notes and calls: read ' + warmSet.length + ' warm contacts, '
    + Object.keys(noteFindings).length + ' carry a verdict', JSON.stringify(nf));
  for (const [id, f] of Object.entries(noteFindings)) {
    const c = contacts.find((x) => x.id === id) || {};
    console.log('   ' + String(c.email || id).padEnd(36) + f.d.padEnd(15) + 'from a ' + f.kind.slice(0, -1) + ': "' + f.evidence.slice(0, 90) + '"');
  }
}

// The findings land after the heat loop has already queued its writes, so amend those rather
// than reordering the whole pass around them.
for (const [id, f] of Object.entries(noteFindings)) {
  const c = contacts.find((x) => x.id === id);
  if (!c || c.volcano_disposition) continue;          // a value a person set always wins
  const ruled = RULED_OUT.includes(f.d);
  const props = Object.assign({ volcano_disposition: f.d }, ruled ? { volcano_heat: '0' } : {});
  const existing = changes.find((x) => x.id === id);
  if (existing) Object.assign(existing.properties, props);
  else changes.push({ id, email: c.email || '', heat: ruled ? 0 : (heatById[id] || 0), properties: props });
  if (ruled) heatById[id] = 0;
}
// ---------------------------------------------------- repair the missing email bodies
// Written as a repair pass rather than fixed in the webhook because the worker has no Instantly
// credential, and because a repair also heals everything already logged empty. The webhook keeps
// writing the timeline entry immediately, which is what matters for an AE opening a record; the
// text catches up within one rollup.
if (emptyBodies.length && IK) {
  const wanted = new Map(emptyBodies.map((e) => [e.messageId, e.id]));
  const bodies = new Map();
  const IH2 = { authorization: 'Bearer ' + IK, 'content-type': 'application/json' };
  for (let cursor = null, page = 0; page < 40 && bodies.size < wanted.size; page++) {
    const u = 'https://api.instantly.ai/api/v2/emails?limit=50' + (cursor ? '&starting_after=' + encodeURIComponent(cursor) : '');
    let r = await fetch(u, { headers: IH2 });
    if (!r.ok) { r = await fetch(u.replace('limit=50', 'limit=20'), { headers: IH2 }); }
    if (!r.ok) { console.error('body repair: Instantly HTTP ' + r.status + ', stopping at ' + bodies.size); break; }
    const b = await r.json();
    for (const e of (b.items || [])) {
      const mid = String(e.message_id || e.id || '').replace(/^</, '').replace(/@.*$/, '').replace(/>$/, '');
      if (!wanted.has(mid) || bodies.has(mid)) continue;
      const html = String((e.body && e.body.html) || '');
      const text = String((e.body && e.body.text) || '').trim()
        || html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      if (text) bodies.set(mid, { text: text.slice(0, 65000), html: html.slice(0, 65000) });
    }
    cursor = b.next_starting_after;
    if (!cursor) break;
  }
  console.log('email bodies: ' + emptyBodies.length + ' empty on timelines, ' + bodies.size + ' recovered from Instantly');
  if (COMMIT && bodies.size) {
    const inputs = [...bodies.entries()].map(([mid, body]) => ({
      id: wanted.get(mid),
      properties: { hs_email_text: body.text, ...(body.html ? { hs_email_html: body.html } : {}) },
    }));
    for (let i = 0; i < inputs.length; i += 100) {
      const r = await fetch('https://api.hubapi.com/crm/v3/objects/emails/batch/update', {
        method: 'POST', headers: H, body: JSON.stringify({ inputs: inputs.slice(i, i + 100) }),
      });
      if (!r.ok) console.error('  body repair write failed: ' + r.status + ' ' + (await r.text()).slice(0, 200));
    }
    console.log('  repaired ' + inputs.length + ' email bodies');
  }
} else if (emptyBodies.length) {
  console.error('email bodies: ' + emptyBodies.length + ' empty and no INSTANTLY_API_KEY to repair them');
}

const band = (h) => h >= 100 ? 'Eruption' : h >= 65 ? 'Hot' : h >= 25 ? 'Warm' : 'Cold';
const bands = {};
contacts.forEach((c) => { const b = band(heatById[c.id] || 0); bands[b] = (bands[b] || 0) + 1; });
const ruled = contacts.filter(isRuledOut).length;
const byDisp = contacts.reduce((a, c) => { const d = c.volcano_disposition; if (d) a[d] = (a[d] || 0) + 1; return a; }, {});
console.log('\nruled out of the volcano:', ruled, JSON.stringify(byDisp));
console.log('\nbands:', JSON.stringify(bands));
const peaks = contacts.reduce((a, c) => {
  const pk = bandKey(Math.max(Number(c.volcano_peak_heat) || 0, heatById[c.id] || 0));
  a[pk] = (a[pk] || 0) + 1; return a;
}, {});
console.log('ever reached:', JSON.stringify(peaks));
console.log(`${COMMIT ? 'WRITING' : 'DRY RUN'}: ${changes.length} contacts changed of ${contacts.length}`);
changes.slice(0, 8).forEach((c) => console.log(`  ${c.email.padEnd(38)} heat ${String(c.heat).padStart(4)}  ${JSON.stringify(c.properties)}`));
if (!COMMIT) { console.log('\nRe-run with --commit to write.'); process.exit(0); }

let ok = 0, fail = 0;
for (let i = 0; i < changes.length; i += 100) {
  const slice = changes.slice(i, i + 100);
  const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/batch/update', {
    method: 'POST', headers: H,
    body: JSON.stringify({ inputs: slice.map((c) => ({ id: c.id, properties: c.properties })) }),
  });
  if (r.ok) ok += slice.length;
  else { fail++; console.log('  FAILED', r.status, (await r.text()).slice(0, 300)); }
}
console.log(`\ndone: ${ok} contacts updated, ${fail} batches failed`);
