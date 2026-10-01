// Which of the three Harvest lanes a contact belongs to, and why.
//
// THE RULE: the lane is a property of the COMPANY, not the person. Several contacts at the
// same firm are in this audience (that is how the Harvest list was built, and in some cases
// only one of them left the review we are referencing), and two people at one firm comparing
// notes on two different angles reads as a mail merge. So every contact at a firm gets the
// same lane, decided once from the company name.
//
// WHY A HASH RATHER THAN ROUND-ROBIN: assignment has to be stable and reproducible. A
// round-robin over a list depends on the order the list came back in, so re-running after
// the list grows would reshuffle firms already mid-sequence and start sending someone a
// different angle halfway through. Hashing the normalised company name gives the same answer
// every time, on any machine, without storing anything.
//
// The lane is still written to the contact (volcano_lane) so an AE can see it, HubSpot can
// filter on it and the cockpit can group by it, but the hash stays the source of truth: a
// blank property is recomputed, never re-rolled.

export const LANES = {
  A: {
    key: 'A',
    name: 'Disconnected workflows',
    angle: 'What the stitched-together stack is costing you',
  },
  B: {
    key: 'B',
    name: 'AI on one source of truth',
    angle: 'Automation is only as good as the system holding the job data',
  },
  C: {
    key: 'C',
    name: 'Scope creep, WIP and variations',
    angle: 'The pieces that decide job profitability and stall growth',
  },
};
export const LANE_KEYS = Object.keys(LANES);

// Same normalisation the rest of the pipeline uses for company names, so "Spark Architects",
// "SPARK Architects Pty Ltd" and "spark  architects" cannot land in different lanes.
export function normaliseCompany(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(pty|ltd|limited|llc|inc|incorporated|group|holdings|co|company|nz|aus|australia)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

// FNV-1a. Small, dependency-free, and spreads short strings evenly, which matters because
// company names share long prefixes far more often than random strings do.
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Free and role mailboxes are not firms. Grouping by these domains would put unrelated
// companies in one lane and, worse, make laneSplit report them as a single large firm.
const GENERIC_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com',
  'live.com', 'yahoo.com', 'yahoo.com.au', 'icloud.com', 'me.com', 'aol.com', 'proton.me',
  'protonmail.com', 'bigpond.com', 'optusnet.com.au', 'xtra.co.nz']);

// The firm key, in order of what we actually trust.
//
// Company name is the real answer, but the Harvest audience was imported from LinkedIn
// exports and carries none (0 of 225 on 2026-09-30), pending the companies scope on the
// HubSpot token. Until then the email domain is a good proxy: it groups the 55 multi-contact
// firms in this audience correctly, which is the whole point of assigning lanes per firm.
// A personal or role mailbox is not a firm, so those fall through to the person themselves,
// who then simply gets their own stable lane.
export function firmKey(c) {
  const byName = normaliseCompany(c.company);
  if (byName) return byName;
  const email = String(c.email || '').toLowerCase().trim();
  const domain = email.split('@')[1] || '';
  if (domain && !GENERIC_DOMAINS.has(domain)) return 'd:' + domain;
  if (email) return 'e:' + email;
  // No company and no email: 22 contacts here are LinkedIn-only. The profile URL is unique
  // per person, so they get a stable lane of their own rather than all landing in A.
  const li = String(c.hs_linkedin_url || '').toLowerCase().replace(/\/+$/, '');
  return li ? 'l:' + li : 'unknown';
}

export function laneForCompany(company, fallback = '') {
  const key = normaliseCompany(company) || normaliseCompany(fallback) || 'unknown';
  return LANE_KEYS[hash(key) % LANE_KEYS.length];
}

// Honour a lane already written to the contact. Re-deriving would be identical in the normal
// case, but this keeps a hand override (an AE who knows a firm's real pain) from being
// silently reverted by the next sync. It also means lanes assigned now, from email domains,
// survive company names arriving later rather than reshuffling mid-sequence.
export function laneForContact(c) {
  const existing = String(c.volcano_lane || '').toUpperCase();
  if (LANE_KEYS.includes(existing)) return existing;
  return LANE_KEYS[hash(firmKey(c)) % LANE_KEYS.length];
}

// Assign lanes across a WHOLE audience at once, balanced by contact count.
//
// WHY NOT JUST THE HASH: hashing each firm independently is stable and needs no context, but
// across only 141 firms the variance is large — the real Harvest audience came out 53 / 85 /
// 87 contacts, and a lane with 60% of another lane's volume is a weak test of its angle. The
// three lanes exist to compare three messages, so they should be comparable in size.
//
// HOW IT STAYS STABLE: firms are ordered by their hash, not by list order, so the ordering
// does not depend on how HubSpot returned the rows. Firms are then filled into whichever lane
// is currently smallest, largest firms first, so a firm with five contacts cannot land last
// and skew the totals. Ties break on the firm key, so the result is identical on every run.
//
// Growth is handled by persistence rather than by the algorithm: a lane already written to a
// contact always wins (see laneForContact), so adding firms later assigns only the new ones
// and never reshuffles anyone mid-sequence.
export function assignLanes(contacts) {
  const firms = new Map();
  for (const c of contacts) {
    const k = firmKey(c);
    if (!firms.has(k)) firms.set(k, { key: k, members: [], fixed: null });
    const f = firms.get(k);
    f.members.push(c);
    const pinned = String(c.volcano_lane || '').toUpperCase();
    if (LANE_KEYS.includes(pinned)) f.fixed = pinned;   // an existing lane pins the whole firm
  }

  const load = Object.fromEntries(LANE_KEYS.map((k) => [k, 0]));
  const out = new Map();

  // Firms already carrying a lane keep it, and their weight counts before anything new is placed.
  const pinned = [...firms.values()].filter((f) => f.fixed);
  for (const f of pinned) { load[f.fixed] += f.members.length; out.set(f.key, f.fixed); }

  // Biggest firms first, so the large ones cannot all arrive at the end and unbalance the result.
  const free = [...firms.values()].filter((f) => !f.fixed)
    .sort((a, b) => b.members.length - a.members.length
      || hash(a.key) - hash(b.key)
      || a.key.localeCompare(b.key));
  for (const f of free) {
    const lane = LANE_KEYS.reduce((best, k) => (load[k] < load[best] ? k : best), LANE_KEYS[0]);
    load[lane] += f.members.length;
    out.set(f.key, lane);
  }

  return contacts.map((c) => ({ contact: c, lane: out.get(firmKey(c)) }));
}

// Report how a set of contacts splits, by company and by contact. The two differ whenever a
// firm has several people in the audience, and that gap is worth seeing before launch: an
// even split of companies can still be a lopsided split of sends.
export function laneSplit(contacts) {
  const byCompany = new Map();
  const out = { companies: {}, contacts: {}, multiContactFirms: 0, totalCompanies: 0 };
  LANE_KEYS.forEach((k) => { out.companies[k] = 0; out.contacts[k] = 0; });
  for (const c of contacts) {
    const lane = laneForContact(c);
    out.contacts[lane]++;
    const key = firmKey(c);
    if (!byCompany.has(key)) { byCompany.set(key, { lane, n: 0 }); out.companies[lane]++; }
    byCompany.get(key).n++;
  }
  out.totalCompanies = byCompany.size;
  out.multiContactFirms = [...byCompany.values()].filter((v) => v.n > 1).length;
  // A firm whose contacts disagree on lane is a bug in this module, not a data problem.
  out.inconsistent = contacts.filter((c) => byCompany.get(firmKey(c)).lane !== laneForContact(c)).length;
  return out;
}
