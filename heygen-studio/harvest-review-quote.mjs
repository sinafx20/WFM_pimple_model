// Turns a stored Harvest review into a short fragment we can quote back to the person who
// wrote it, and decides which opener each contact gets.
//
// WHY THIS IS ITS OWN FILE: quoting someone's words back at them is the highest-risk
// personalisation in the campaign. Get it wrong and the first line they read is a garbled
// half-sentence attributed to them. So the extraction is deliberately conservative, every
// result is auditable before anything sends, and anything it cannot do cleanly it refuses
// rather than guesses.
//
// THE SPLIT (decided 2026-09-30): 69 of the 225 in-scope contacts left a review; 156 did not.
// The original copy opened "your review caught my eye" for everyone, which was false for two
// thirds of the audience. Reviewers get the review opener, everyone else gets one built on the
// price rise, which is true for all of them.
//
// {review_site} was dropped: none of the 69 stored reviews records which site it came from,
// so the token could never have resolved. We quote the substance instead, which we do have.

// Sentences that are safe to quote back. A fragment is rejected rather than trimmed, because a
// truncated quote in someone's own mouth is worse than no quote.
const MIN = 40, MAX = 200;   // below 40 a fragment is too contextless to attribute to someone

// Leading boilerplate from review-site prompts ("What do you like best about Harvest?").
const PROMPT = /^\s*(what (do|did) you (like|dislike)[^?]*\?|pros|cons|overall|review)\s*[:\-]?\s*/i;

function sentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(PROMPT, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Review sites ask "what do you like best" first, so the opening sentence of a review is
// usually praise for Harvest. Quoting that back is actively counterproductive: our first line
// would remind them what they like about the incumbent. Measured on the real 69, plain
// first-sentence extraction produced "Harvest is fantastic and I recommend it", "Harvest has
// benefited our business since inception" and "User-friendly, easy to pull reporting". None of
// those can be allowed out.
const PRAISE = /\b(fantastic|excellent|love(d|s)?|great|brilliant|perfect|recommend|benefit(ed|s)?|user.?friendly|easy to (use|navigate|set)|intuitive|seamless|straightforward|clean interface|no steep learning|minimal learning|is the best|works well|reliable)\b/i;

// What we actually want: the grievance. Pricing shock first, because that is this campaign's
// whole premise and it is the sharpest thing anyone wrote.
//
// Deliberately NOT matching bare "bill", "cost" or "invoice": those are the vocabulary of
// describing what Harvest does, not of complaining about it. Measured on the real 69, a looser
// rule pulled in "Our company uses Harvest every day to track projects for billing purposes"
// and "Harvest lets me bill to a project", both neutral descriptions we would have quoted as
// though they were grievances. A pricing complaint needs a change, an amount or an owner.
const PRICE_CHANGE = /\b(increase[ds]?|increasing|hike[ds]?|rise|risen|raised|going up|went up|shot up|quadrupl|doubl|tripl|\d+\s*x\b|\d+%|without warning|no notice|deceptive|misleading|outrageous|baseless|horrendous)\b/i;
const PRICE_THING = /(\$|\bUSD\b|\bAUD\b|\bprice|pricing|subscription fee|per (month|year)|enterprise plan)/i;
const OWNERSHIP = /\b(acquisi|acquired|was sold|sold to|new owner|private equity|bending spoons)\b/i;
const PRICING = (s) => (PRICE_CHANGE.test(s) && PRICE_THING.test(s)) || OWNERSHIP.test(s);
// A limitation must be one the reviewer FRAMED as a limitation, not a neutral statement we
// reinterpreted as one. Bare negations are not enough: "It does not try to be more than a time
// tracker" sits inside a glowing review that calls Harvest "the best solution I have seen", and
// quoting it back would put a complaint in a happy customer's mouth. The four real ones in this
// audience all announce themselves, with "Main limitations are", "Main downside is", "The
// downside is" and "Disappointing that", so that is the bar.
const LIMIT = /\b(limitations?|downsides?|drawbacks?|shortcomings?|disappoint|frustrat|annoy|clunk|struggl|cumbersome|too simplistic|lacks?|lacking|missing|wish (it|they)|would like (it|them)|no way to|not able to|falls? short|lets? (us|me) down)\b/i;

// A grievance sentence still gets rejected if it is mostly praise with a "but" bolted on, and
// we would be quoting the praise half.
const usableSentence = (s) => s.length >= MIN && s.length <= MAX
  && !/[{}<>|]/.test(s)                      // stray markup
  && !/\bharvest\b.*\bharvest\b/i.test(s);   // duplicated-name noise

export function extractQuote(review) {
  const ss = sentences(review);
  if (!ss.length) return { quote: null, reason: 'no review text' };

  // Short adjacent sentences are worth joining: "Business was sold. Prices hiked drastically."
  // is the single best line in the audience and neither half clears MIN on its own.
  const merged = [];
  for (let i = 0; i < ss.length; i++) {
    merged.push(ss[i]);
    if (ss[i].length < MIN && ss[i + 1] && (ss[i].length + ss[i + 1].length + 1) <= MAX) {
      merged.push(`${ss[i]} ${ss[i + 1]}`);
    }
  }

  const candidates = merged.filter(usableSentence);
  if (!candidates.length) return { quote: null, reason: 'no sentence in the safe length range' };

  // Strict order of preference, and praise is never quotable on its own.
  const pick = candidates.find((s) => PRICING(s) && !PRAISE.test(s))
    || candidates.find((s) => LIMIT.test(s) && !PRAISE.test(s))
    || null;

  if (!pick) return { quote: null, reason: 'only praise for Harvest, nothing quotable' };

  const kind = PRICING(pick) ? 'pricing' : 'limitation';
  // Quote without the trailing stop, so it sits inside our own sentence cleanly.
  return { quote: pick.replace(/[.!?]+$/, '').trim(), kind };
}

// 'review' only when we have a quote we are willing to put in their mouth. A contact who left
// a review we could not quote cleanly gets the pricing opener, which is never wrong.
export function entryFor(contact) {
  const { quote } = extractQuote(contact.volcano_harvest_review);
  return quote ? 'review' : 'pricing';
}
