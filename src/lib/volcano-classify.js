// The single definition of how we read what a prospect said, and what an AE wrote about them.
//
// WHY IT LIVES HERE. Two things need it and they deploy separately: the 2-hourly rollup in
// heygen-studio, and the HubSpot webhook endpoint that reacts to a note or call the moment it
// is logged. Two copies of these patterns would drift, and the drift would be invisible: the
// webhook would close a contact the rollup would have left open, or the reverse, and nobody
// would notice until an AE asked why a record said two different things.
//
// Both are plain Node ESM in the same repo, so one file can serve both.
//
// The bar for every rule here: it must be something a person actually said or wrote. Machine
// artefacts do not belong in this file, which is the same standard that kept email opens and
// short-link fetches out of the heat model.

export const OPT_OUT = /\b(unsubscribe|opt[\s-]?out|remove me|take me off|stop (emailing|contacting)|do not (contact|email)|no longer wish)\b/i;
export const NOT_INTERESTED = /\b(not interested|no interest|no thanks|no thank you|not for us|not a fit|not (an?|the) [a-z ]{0,24}(company|business|firm)|we do not|we don'?t do|wrong person|no longer (with|at)|left the (company|business)|not the right)\b/i;

/* What a prospect said, in their own words, on any channel.
 *
 * Deliberately conservative: leaving a reply unclassified for a human to read is a smaller
 * mistake than closing a live conversation because it contained an unlucky phrase. */
export function classifyReply(text) {
  const own = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    // Everything below a quoted original is our words, not theirs, and our own footer contains
    // the word "unsubscribe".
    .split(/(?:On .{0,80}wrote:|-{2,}\s*Original Message|_{5,})/)[0].slice(0, 1200);
  if (!own.trim()) return null;
  if (OPT_OUT.test(own)) return 'opted_out';
  if (NOT_INTERESTED.test(own)) return 'not_interested';
  return null;
}

export const NOTE_RULES = [
  { d: 'disqualified',   re: /\b(not (a )?(good )?fit|wrong fit|not our icp|out of scope|manufactur\w*|product (business|company)|retail|not (a )?(services|projects?) business|no projects?)\b/i },
  { d: 'opted_out',      re: /\b(unsubscribe|do not (contact|call|email)|asked to be removed|remove (them|him|her) from)\b/i },
  { d: 'not_interested', re: /\b(not interested|no interest|declined|no thanks|happy with (their|what)|already (have|using)|staying with|no budget)\b/i },
  { d: 'engaged',        re: /\b(demo booked|booked (a )?(call|meeting|demo)|keen|wants (a )?(demo|call|quote|trial)|sending (them )?(a )?proposal)\b/i },
];

// Only a human's judgement counts, and two kinds of note are not that: ours, which carry a
// [volcano:] marker, and the conversation transcripts a LinkedIn integration writes into
// HubSpot, which quote OUR OWN marketing copy back at us. One of those matched "engaged" on a
// prospect whose actual words were "we are not an engineering company".
export const NOTE_NOISE = /\[volcano:[a-z-]+:|LinkedIn Conversation with|Campaign name:|Sent from HeyReach/i;

/* What an AE wrote or recorded. Returns { d, evidence } or null. */
export function classifyNote(text) {
  const t = String(text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (!t.trim() || NOTE_NOISE.test(t)) return null;
  for (const r of NOTE_RULES) if (r.re.test(t)) return { d: r.d, evidence: t.slice(0, 160) };
  return null;
}

// Dispositions that take a contact out of play. Ruling out beats promoting: an "engaged" note
// must never overturn a prospect who has said in their own words that they are not interested.
export const RULED_OUT = ['opted_out', 'not_interested', 'disqualified'];
