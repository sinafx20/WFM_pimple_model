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
// clickable in every client. The visible text stays the URL, because in a cold email a visible
// destination reads as more honest than hidden anchor text.

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

function linkify(escaped) {
  return escaped.replace(LINK, (m) => {
    const isUrl = /^https:\/\//i.test(m);
    if (!isUrl && !LINKY_FIELD.test(m)) return m;   // {{firstName}} is not a link
    return `<a href="${m}" target="_blank" rel="noopener">${m}</a>`;
  });
}

// plain text -> HTML, preserving the paragraph structure the copy was written with.
export function toHtml(text) {
  const paras = String(text ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/);
  return paras
    .map((para) => para.split('\n').map((line) => `<div>${linkify(esc(line)) || '<br>'}</div>`).join(''))
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
