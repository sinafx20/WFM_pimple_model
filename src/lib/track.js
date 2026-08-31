// Verified-human interaction tracking for the Volcano tools.
//
// WHY THIS EXISTS: we cannot tell a human from a bot at the link layer. TinyURL's
// `hits` is a bare cumulative integer with no timestamp, user agent, IP or referrer,
// and its analytics endpoints return 501 Not implemented regardless of key scope
// (verified 2026-08-31). The evidence that hits are not people is in our own data:
// of 249 total hits, one contact accounted for 124 and a single intro alias had 87.
// That is a mail security appliance re-fetching, not a prospect.
//
// So we stop asking "was this fetch human?" and measure something a scanner cannot
// counterfeit: a sequence of deliberate choices inside a tool. Nothing here fires on
// a page load. A link fetch, an unfurl crawler and a headless render all produce zero
// milestones, because none of them answer question three or drag a slider.
//
// The raw evidence is sent to /api/track and classified there, not here — a browser
// can lie about its own signals, so the verdict belongs on the server where the rule
// lives in one place.
import { getEmailFromUrl, getHutk } from "./hubspot.js";

/* Milestones in ascending order of how hard they are to fake. `started` is one
   deliberate choice; `engaged` is several in sequence and is the first level we
   would defend to anyone as a real person. */
export const DEPTH = { started: 1, engaged: 2, completed: 3, booking: 4 };

const isBrowser = typeof window !== "undefined";
const SENT_KEY = "volcano_sent_depth";

/* Evidence accumulated over the life of the page. */
const ev = {
  loadedAt: isBrowser ? Date.now() : 0,
  steps: 0,          // deliberate interactions counted so far
  trusted: true,     // false as soon as any interaction is a synthetic event
  pointer: false,    // a real pointer/touch was observed
  keyboard: false,   // a real keypress was observed
  minGapMs: Infinity, // fastest gap between consecutive interactions
  lastAt: 0,
};

if (isBrowser) {
  // Passive and cheap. Automation that dispatches clicks directly usually never
  // produces these at all, which is itself the signal.
  const opts = { passive: true, capture: true, once: true };
  window.addEventListener("pointermove", () => { ev.pointer = true; }, opts);
  window.addEventListener("touchstart", () => { ev.pointer = true; }, opts);
  window.addEventListener("keydown", () => { ev.keyboard = true; }, opts);
}

/* Call from any handler that represents a real choice by the prospect. Pass the
   originating event where you have one so we can read isTrusted: a click created by
   element.click() or injected script reports false, a click from a mouse reports true. */
export function noteInteraction(event) {
  if (!isBrowser) return;
  const now = Date.now();
  if (ev.lastAt) ev.minGapMs = Math.min(ev.minGapMs, now - ev.lastAt);
  ev.lastAt = now;
  ev.steps += 1;
  if (event && event.isTrusted === false) ev.trusted = false;
}

/* Highest milestone already reported this session, so a prospect stepping back and
   forth through a tool does not re-post the same milestone repeatedly. */
const sentDepth = () => {
  try { return Number(sessionStorage.getItem(SENT_KEY)) || 0; } catch { return 0; }
};
const rememberDepth = (d) => {
  try { sessionStorage.setItem(SENT_KEY, String(d)); } catch { /* private mode */ }
};

/* Report a milestone. Fire-and-forget: never blocks or breaks the tool.
   `tool` is the content piece ("health-check", "calculator", ...).
   `milestone` is a key of DEPTH. */
export function trackMilestone(tool, milestone, extra = {}) {
  if (!isBrowser) return;
  const depth = DEPTH[milestone];
  if (!depth || depth <= sentDepth()) return;   // only ever report new ground
  rememberDepth(depth);

  const payload = {
    email: getEmailFromUrl(),
    hutk: getHutk(),
    tool,
    milestone,
    depth,
    evidence: {
      dwellMs: Date.now() - ev.loadedAt,
      steps: ev.steps,
      trusted: ev.trusted,
      pointer: ev.pointer,
      keyboard: ev.keyboard,
      minGapMs: ev.minGapMs === Infinity ? null : ev.minGapMs,
    },
    ...extra,
  };

  // A virtual pageview as well as the beacon. HubSpot page views work on every
  // portal tier and land on the contact timeline, so the signal survives even if
  // the deployed environment has no HUBSPOT_TOKEN for /api/track to use.
  try {
    const _hsq = (window._hsq = window._hsq || []);
    _hsq.push(["setPath", `/app/${tool}/${milestone}`]);
    _hsq.push(["trackPageView"]);
  } catch { /* tracking script absent */ }

  const url = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/track`;
  const body = JSON.stringify(payload);
  try {
    // sendBeacon survives the page being closed mid-interaction, which matters
    // most for the `completed` and `booking` milestones.
    if (navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
  } catch { /* fall through */ }
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}
