// Turns the plain-text email bodies into HTML that actually reads as paragraphs.
//
// THE BUG THIS FIXES. copy-harvest.json stores bodies as plain text with blank lines between
// paragraphs. Instantly renders HTML, so every newline was discarded and the whole message
// arrived as one unbroken block of text. Checked against the live campaign: the stored body had
// ZERO newlines and sat inside a single <div>. LinkedIn was unaffected, because HeyReach sends
// plain text and kept the breaks.
//
// WHY <div> AND NOT <p>. Email clients disagree about default <p> margins, and Outlook adds its
// own; a <div> per line with an empty <div><br></div> between paragraphs is what Gmail itself
// produces and is the most predictable across clients. No stylesheet, no margins to be
// overridden, and it still degrades to sensible plain text in a client that strips tags.
//
// Links are made explicit anchors rather than left bare: a bare URL in an HTML body is not
// clickable in every client.
//
// A short, readable URL keeps its own text, because in a cold email a visible destination reads
// as more honest than hidden anchor text. A merge field does not, because of what it expands
// to: {{demo_link}} becomes 150 characters carrying tool, campaign, presenter, a percent-encoded
// booking URL and the recipient's own email address, and Instantly then rewrites the href
// through its click-tracking host anyway. Printed in full that reads as spam and exposes the
// tracking parameters to the reader, so the merge fields get a plain label instead.

// Escape only what breaks HTML. Merge-field braces are deliberately untouched: Instantly
// substitutes {{firstName}} and {{demo_link}} before send, and escaping them would ship the
// literal braces to the prospect.
const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// A bare https:// URL, or a merge field that holds one, becomes a clickable anchor.
const LINK = /(\{\{[a-z_]+\}\}|https:\/\/[^\s<>"')]+)/gi;
const LINKY_FIELD = /^\{\{(demo_link|booking|trial_link)\}\}$/i;

// What the reader sees in place of each expanded merge field. "Book a Conversation" is the
// campaign's fixed CTA wording and is deliberately not reworded here.
const LABEL = {
  demo_link: 'Watch the walkthrough',
  booking: 'Book a Conversation',
  trial_link: 'Start a free trial',
};

// The same three destinations also arrive as plain URLs, because resolveConstants expands
// {booking_link} and {trial_link} to literals before this runs. They deserve the same label as
// the merge-field form; a reader should not see one email say "Book a Conversation" and the
// next print a bare meetings URL for the identical action.
const URL_LABEL = [
  [/^https:\/\/meetings\.hubspot\.com\//i, 'Book a Conversation'],
  [/^https:\/\/app\.workflowmax\.com\/register\/sign_up/i, 'Start a free trial'],
];

function linkify(escaped) {
  return escaped.replace(LINK, (m) => {
    const isUrl = /^https:\/\//i.test(m);
    if (!isUrl && !LINKY_FIELD.test(m)) return m;   // {{firstName}} is not a link
    let text = m;
    if (isUrl) {
      const hit = URL_LABEL.find(([re]) => re.test(m));
      if (hit) text = hit[1];
    } else {
      text = LABEL[m.replace(/[{}]/g, '').toLowerCase()] || m;
    }
    return `<a href="${m}" target="_blank" rel="noopener">${text}</a>`;
  });
}

// The brand word itself links to the Harvest comparison page. Only the first mention in a
// message, because linking every one turns the body into a field of blue and reads as SEO spam.
const BRAND = 'WorkflowMAX';
export const BRAND_URL = 'https://start.workflowmax.com/harvest';

// Replace inside text only. Splitting on tags keeps the brand word out of an href, out of a
// tracking URL and out of anchor text that already points somewhere else, any of which would
// produce a nested or broken anchor.
function linkBrandOnce(html, state) {
  if (state.done) return html;
  let depth = 0;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) {
      if (/^<a\b/i.test(part)) depth++;
      else if (/^<\/a>/i.test(part)) depth = Math.max(0, depth - 1);
      return part;
    }
    if (state.done || depth > 0 || !part.includes(BRAND)) return part;
    state.done = true;
    return part.replace(BRAND, `<a href="${BRAND_URL}" target="_blank" rel="noopener">${BRAND}</a>`);
  }).join('');
}

// plain text -> HTML, preserving the paragraph structure the copy was written with.
export function toHtml(text) {
  const paras = String(text ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  const state = { done: false };
  return paras
    .map((para) => para.split('\n')
      .map((line) => `<div>${linkBrandOnce(linkify(esc(line)), state) || '<br>'}</div>`).join(''))
    .join('<div><br></div>');
}

// Does this body already look like HTML? Guards against double-converting on a re-push.
export const isHtml = (s) => /<(div|p|br|a|table)\b/i.test(String(s ?? ''));

// Convert every email body in a copy tree, leaving subjects alone.
export function htmlifyEmails(copy) {
  const out = { ...copy };
  for (const key of ['em1', 'em2', 'em3', 'em4']) {
    const step = copy[key];
    if (!step) continue;
    if (step.body !== undefined) {
      out[key] = { ...step, body: isHtml(step.body) ? step.body : toHtml(step.body) };
    } else {
      // an angled step: { A: {subject, body}, B: ..., C: ... }
      out[key] = Object.fromEntries(Object.entries(step).map(([angle, v]) => [
        angle,
        v && v.body !== undefined ? { ...v, body: isHtml(v.body) ? v.body : toHtml(v.body) } : v,
      ]));
    }
  }
  return out;
}
