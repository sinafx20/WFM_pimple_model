// Resolves the copy's tokens: the constants are baked in at load time, and whatever is left
// is translated into each platform's own merge syntax.
//
// WHY BAKE RATHER THAN MERGE. A token only needs to be a merge field if its value differs per
// LEAD. None of the four in this copy do:
//
//   {signature}     per campaign  - each campaign has exactly one owner
//   {booking_link}  per campaign  - same reason
//   {trial_link}    global        - one sign-up URL for everybody
//   {demo_link}     PER LEAD      - it carries the contact's email so the visit is attributed
//
// So {demo_link} and {FIRST_NAME} are the only live merge fields, and {demo_link} is the one
// thing the lead push has to supply.
//
// Baking them removes three ways to fail. A merge field that is missing at send time does not
// send a blank, it triggers HeyReach's fallbackMessage, so the prospect silently receives a
// different and weaker message. The fewer live merge fields, the fewer messages that can
// quietly degrade.
//
// WHY THE SIGNATURE MATTERS: one copy file feeds all four campaigns and two are Denzel's.
// Without this substitution his contacts would receive mail signed "Sina".
//
// FALLBACK RULE, probed against HeyReach 2026-10-01 rather than assumed:
//   no tokens -> accepted | {FIRST_NAME} -> accepted | any custom token -> REJECTED | empty -> accepted
// A fallback may greet someone by name but may not reference a link, which is the whole point:
// the fallback is what sends when a link field is missing.

export const HEYREACH_BUILTIN = '{FIRST_NAME}';

// One sign-up URL for everyone, confirmed 2026-10-01.
export const TRIAL_LINK = 'https://app.workflowmax.com/register/sign_up';

// Per owner, confirmed 2026-10-01. owner = sender = calendar, always: Volcano sent 153 people
// the wrong AE's booking link when that rule was broken.
export const BOOKING = {
  sina: 'https://meetings.hubspot.com/szarei',
  denzel: 'https://meetings.hubspot.com/denzel-kereama',
};

export const SIGNATURE = { sina: 'Sina', denzel: 'Denzel' };

// The demo now points at our own landing page rather than YouTube, so the visit hits the
// on-page HubSpot beacon instead of disappearing into youtube.com. The page selects the
// presenter's walkthrough from ?presenter= (its built-in ids are the same two recordings) and
// routes the calendar from ?booking=.
//
// ?campaign=harvest switches on the Harvest treatment: no "All Resources" nav, the migration
// callout, and no invented vertical. Without it the page renders the Volcano version.
export const DEMO_PAGE = 'https://lp.workflowmax.com/app';

// WHY THE EMAIL IS IN THE URL. src/layouts/Layout.astro returns before tracking anything when
// the URL carries no email parameter:
//     var email = new URLSearchParams(window.location.search).get("email");
//     if (!email || email.indexOf("@") < 0) return;
// Without it a visit is recorded anonymously at best, cookie-matched only for people HubSpot
// already knows. With it the page view lands on the contact, which is what makes the demo step
// measurable and what feeds volcano_verified_visits.
//
// This is the one thing that puts a live merge field back into the copy. A contact with no
// email still gets a working link, just an untracked one, which is why the whole URL is built
// per lead rather than appending {email} to a baked URL: a missing merge field inside the URL
// would trigger HeyReach's fallback and drop the demo link entirely.
export function demoLinkFor(owner, email) {
  const book = BOOKING[owner];
  if (!book) throw new Error(`no booking link for owner "${owner}"`);
  const u = new URL(DEMO_PAGE);
  u.searchParams.set('tool', 'tp4');
  u.searchParams.set('campaign', 'harvest');
  u.searchParams.set('presenter', owner);
  u.searchParams.set('booking', book);
  const e = String(email || '').trim();
  if (e.includes('@')) u.searchParams.set('email', e);
  return u.toString();
}

// Everything resolvable before the copy reaches a platform. {demo_link} is deliberately NOT
// here: it carries the contact's email, so it is built per lead by the push.
export function constantsFor(owner) {
  const sig = SIGNATURE[owner], book = BOOKING[owner];
  if (!sig || !book) throw new Error(`missing signature or booking link for owner "${owner}"`);
  return {
    '{signature}': sig,
    '{booking_link}': book,
    '{trial_link}': TRIAL_LINK,
  };
}

const applyMap = (text, map) =>
  Object.entries(map).reduce((s, [from, to]) => s.split(from).join(to), String(text ?? ''));

// Walks strings, arrays and objects alike so a whole copy tree can be resolved in one call.
function deep(value, fn) {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((v) => deep(v, fn));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deep(v, fn)]));
  }
  return value;
}

// Bake the constants for one owner. Run this BEFORE the per-platform translation.
export const resolveConstants = (copy, owner) => {
  const map = constantsFor(owner);
  return deep(copy, (t) => applyMap(t, map));
};

// Replace every literal https:// URL in a copy tree with its branded short form, so LinkedIn
// clicks can be counted. LinkedIn exposes no click event of any kind, so an unshortened link
// there is simply invisible. Email does not need this: Instantly's own link tracking rewrites
// links at send time, and wrapping ours inside that would double-redirect the prospect.
//
// The demo link is NOT shortened here. It is a per-lead merge field carrying the contact's
// email, so the push shortens each contact's own URL and the alias maps back to one person.
// These baked links (trial, booking) are shared, so their hits are a per-campaign count.
export async function shortenCopy(copy, shorten) {
  const seen = new Map();
  const sub = async (text) => {
    const urls = [...new Set(String(text).match(/https:\/\/[^\s<>"')]+/g) || [])];
    let out = String(text);
    for (const u of urls) {
      if (!seen.has(u)) seen.set(u, await shorten(u));
      out = out.split(u).join(seen.get(u));
    }
    return out;
  };
  const walk = async (v) => {
    if (typeof v === 'string') return sub(v);
    if (Array.isArray(v)) return Promise.all(v.map(walk));
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = await walk(x);
      return o;
    }
    return v;
  };
  return walk(copy);
}

const HEYREACH_MAP = { '{first_name}': '{FIRST_NAME}' };
const INSTANTLY_MAP = { '{first_name}': '{{firstName}}', '{demo_link}': '{{demo_link}}' };

export const forHeyReach = (text) => applyMap(text, HEYREACH_MAP);
export const forInstantly = (text) => applyMap(text, INSTANTLY_MAP);

// Any {token} left after the HeyReach mapping, other than the built-in, is a live merge field
// that something must push per lead.
export function customTokens(heyreachText) {
  return [...new Set((String(heyreachText).match(/\{[A-Za-z_][A-Za-z0-9_]*\}/g) || [])
    .filter((t) => t !== HEYREACH_BUILTIN))];
}

// Build a fallback from a message: drop whatever depends on a live merge field, keep the rest.
//
// The dangling-promise trim only applies when a line was ACTUALLY dropped. Once the links are
// baked in there is nothing to drop, and trimming anyway would strip "Here is a walkthrough.
// https://..." out of the fallback for no reason, quietly removing the demo link from the one
// message that is sent when personalisation fails.
export function toFallback(heyreachText, generic = 'Worth a look either way, happy to share more if useful.') {
  const lines = String(heyreachText).split('\n');
  const keptLines = lines.filter((line) => customTokens(line).length === 0);
  const droppedSomething = keptLines.length !== lines.length;

  const kept = keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!kept) return generic;
  if (!droppedSomething) return kept;

  // A trailing line that introduced something now removed reads as a broken promise.
  const trimmed = kept.replace(/\n?[^\n]*\b(here is|here's|have a look at|see it (for yourself )?here)\b[^\n]*$/i, '').trim();
  return trimmed || generic;
}

export function verifyFallback(fallback) {
  const bad = customTokens(fallback);
  return { ok: bad.length === 0, offending: bad };
}
