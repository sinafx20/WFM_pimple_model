// Writes the Volcano LinkedIn sequence to a HeyReach campaign via UpdateSequence.
//   node heyreach-sequence.mjs [campaignId]        -> full sequence (default 495367 "Volcano LI - Sina")
//   node heyreach-sequence.mjs [campaignId] test   -> one-message-with-video test (default 495416)
//   node heyreach-sequence.mjs [campaignId] compact [senderName] -> compact 5-day test (default 497484, Sina)
//
// Connection-aware: the root is CHECK_IS_CONNECTION, so leads you are ALREADY
// connected with (Kim, Ryan, ...) skip the connection request and get the DM arc
// directly — a bare connection-request-first sequence was a no-op for them.
//
// Tree semantics: conditionalNode = branch when the check is TRUE
// (CHECK_IS_CONNECTION: already connected; CONNECTION_REQUEST: accepted;
// CHECK_IS_OPEN_PROFILE: open profile). unconditionalNode = the else/next path.
// Every child of an action node needs >= 3h delay.
//
// Video in the DM: HeyReach messages can't attach an MP4 (API confirmed — the
// payload only keeps messages + fallbackMessage). {intro_link} is the intro
// landing page, which now serves per-contact Open Graph tags (og:image = the
// co-branded thumbnail with a burned-in play button, og:video = the mp4), so
// LinkedIn unfurls the link into a play-thumbnail card rather than a raw blob.
//
// {FIRST_NAME}/{company} are HeyReach built-ins; {intro_link}/{health_check_link}/
// {booking} are custom fields the cockpit pushes per lead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const END = { nodeType: 'END', actionDelay: 3, actionDelayUnit: 'HOUR' };

// The DM that carries the AI video (unfurls as a play-thumbnail card via LP OG tags).
const videoDM = (next) => ({
  nodeType: 'MESSAGE', actionDelay: 3, actionDelayUnit: 'HOUR', externalReference: 'volcano-dm1-video',
  payload: {
    messages: ['{FIRST_NAME}, I recorded you a short video on where firms like {company} usually leak margin. My AI twin presents it so I will keep it honest, it is 2 minutes: {intro_link}'],
    fallbackMessage: 'I recorded a short 2-minute video on where firms in your space usually leak margin, happy to share it if useful.',
  },
  unconditionalNode: next,
});
const healthDM = (next) => ({
  nodeType: 'MESSAGE', actionDelay: 3, actionDelayUnit: 'DAY', externalReference: 'volcano-dm2-healthcheck',
  payload: {
    messages: ["Most directors cannot name last month's real utilisation. Not the target, the actual number. This gives {company} an instant read in about 2 minutes: {health_check_link}. Even if WorkflowMAX is never the right fit, you keep your number."],
    fallbackMessage: "Most directors cannot name last month's real utilisation. Not the target, the actual number. Happy to send a 2-minute check that gives you yours.",
  },
  unconditionalNode: next,
});
const bridgeDM = (next) => ({
  nodeType: 'MESSAGE', actionDelay: 4, actionDelayUnit: 'DAY', externalReference: 'volcano-dm3-email-bridge',
  payload: {
    messages: ['Happy to keep this async, {FIRST_NAME}. If email is easier, say the word and I will send over the benchmark for firms your size. And if you would rather talk it through, my calendar is here: {booking}'],
    fallbackMessage: 'Happy to keep this async. If email is easier, say the word and I will send over the benchmark for firms your size.',
  },
  unconditionalNode: next,
});
// connected -> full 3-DM arc
const connectedArc = () => videoDM(healthDM(bridgeDM(END)));

const inmail = () => ({
  nodeType: 'INMAIL', actionDelay: 3, actionDelayUnit: 'HOUR', externalReference: 'volcano-inmail',
  payload: {
    messages: [{ subject: 'the number most firms cannot name', message: 'Hi {FIRST_NAME}, no worries on the connection. One thing worth having regardless: most firms cannot name how much quoted time turned into unbilled work last month, and it is usually five figures. This gives {company} the number in about 2 minutes, no sign-up: {health_check_link}\n\nIf email is easier, happy to send the benchmark there instead. Either way, keep your number.\n\nSina' }],
    fallbackMessage: { subject: 'the number most firms cannot name', message: 'Hi, most firms cannot name how much quoted time turned into unbilled work last month, and it is usually five figures. Happy to send a 2-minute check that gives you the number.\n\nSina' },
  },
  unconditionalNode: END,
});

// FULL: connection-aware. connected -> DM arc; else request -> accepted DM arc / not -> InMail if open.
// Legacy/unused by the studio (no campaign currently runs this) — kept for reference.
const fullSequence = {
  nodeType: 'CHECK_IS_CONNECTION', actionDelay: 0, actionDelayUnit: 'DAY', externalReference: 'volcano-conn-gate',
  conditionalNode: connectedArc(), // already connected -> message directly
  unconditionalNode: {
    nodeType: 'CONNECTION_REQUEST', actionDelay: 3, actionDelayUnit: 'HOUR', externalReference: 'volcano-cr',
    payload: {
      messages: ['Hi {FIRST_NAME}, I work with firms like {company} on where quoted time quietly turns into unbilled work. A couple of the numbers surprise most directors, so thought it was worth connecting.'],
      fallbackMessage: 'Hi there, I work with professional services firms on where quoted time quietly turns into unbilled work. Thought it was worth connecting.',
      toBeWithdrawnAfterDays: 12,
    },
    conditionalNode: connectedArc(), // accepted -> same DM arc
    unconditionalNode: { // not accepted after 6 days -> InMail if open profile
      nodeType: 'CHECK_IS_OPEN_PROFILE', actionDelay: 6, actionDelayUnit: 'DAY', externalReference: 'volcano-openprofile-gate',
      conditionalNode: inmail(),
      unconditionalNode: END,
    },
  },
};

// TEST: just the video DM to people you are already connected with (Ryan).
const testSequence = {
  nodeType: 'CHECK_IS_CONNECTION', actionDelay: 0, actionDelayUnit: 'DAY', externalReference: 'test-conn-gate',
  conditionalNode: videoDM(END),
  unconditionalNode: END,
};

// COMPACT: the 5-day known-contacts test overlay — nudges to the email series and
// shares the built resources. Connection-aware; warm audience is mostly already
// connected so they get the DMs directly. Message TEXT lives in copy-heyreach-
// test.json (read fresh each call, same reasoning as heyreach-real-sequences.mjs —
// so the Campaign Copy editor's saves take effect without a server restart). This
// is a single shared copy (not per-vertical): the compact sequence is generic,
// only nudging to whichever email series each contact is already getting.
const COPY_TEST_PATH = path.join(__dirname, 'copy-heyreach-test.json');
export function loadCompactCopy() {
  return JSON.parse(fs.readFileSync(COPY_TEST_PATH, 'utf8'));
}
const withSig = (s, senderName) => (s || '').replace(/\{signature\}/g, senderName);

const DM = (ref, delay, unit, msg, fb, next) => ({
  nodeType: 'MESSAGE', actionDelay: delay, actionDelayUnit: unit, externalReference: ref,
  payload: { messages: [msg], fallbackMessage: fb }, unconditionalNode: next,
});
// DM3 onward is shared between the two entry points below: someone already
// connected gets the video as DM1 (they've never seen it); someone who just
// accepted the connection request already got the video in the CR note itself,
// so their first message acknowledges that instead of repeating it.
function compactTailFromCalculator(c) {
  return DM('compact-dm3-calculator', 1, 'DAY', c.dm3.message, c.dm3.fallback,
  DM('compact-dm4-benchmark', 1, 'DAY', c.dm4.message, c.dm4.fallback,
  DM('compact-dm5-demo', 1, 'DAY', c.dm5.message, c.dm5.fallback,
  DM('compact-dm6-hub', 3, 'HOUR', c.dm6.message, c.dm6.fallback,
  END))));
}
// Already connected (no CR was ever sent) -> DM1 delivers the video.
function compactDMs(c) {
  return DM('compact-dm1-intro', 3, 'HOUR', c.dm1.message, c.dm1.fallback,
  DM('compact-dm2-healthcheck', 1, 'DAY', c.dm2.message, c.dm2.fallback,
  compactTailFromCalculator(c)));
}
// CR accepted -> the video already went out in the connection-request note, so
// this opens with an acknowledgment + the health check instead of repeating it.
function compactAcceptedDMs(c) {
  return DM('compact-dm2-accept-healthcheck', 3, 'HOUR', c.dm2_accept.message, c.dm2_accept.fallback,
  compactTailFromCalculator(c));
}
// InMail nudge chain for non-connected who don't accept. Sales Nav lets us send
// follow-up InMails without a reply (1 credit each; 50/month per seat). 3 InMails
// mirror the DM arc condensed. Each message + its token-free fallback are objects.
// {signature} was hardcoded "Sina" until 2026-07-10 — a real bug once this same
// sequence started getting pushed to Denzel's test campaign (500764) too.
const INMAIL = (ref, delay, unit, subject, message, fbSubject, fbMessage, next) => ({
  nodeType: 'INMAIL', actionDelay: delay, actionDelayUnit: unit, externalReference: ref,
  payload: { messages: [{ subject, message }], fallbackMessage: { subject: fbSubject, message: fbMessage } },
  unconditionalNode: next,
});
function compactInmailChain(c, senderName) {
  return INMAIL('compact-inmail1-video', 2, 'DAY', c.inmail1.subject, withSig(c.inmail1.message, senderName), c.inmail1.fallbackSubject, withSig(c.inmail1.fallbackMessage, senderName),
  INMAIL('compact-inmail2-tools', 2, 'DAY', c.inmail2.subject, withSig(c.inmail2.message, senderName), c.inmail2.fallbackSubject, withSig(c.inmail2.fallbackMessage, senderName),
  INMAIL('compact-inmail3-hub', 2, 'DAY', c.inmail3.subject, withSig(c.inmail3.message, senderName), c.inmail3.fallbackSubject, withSig(c.inmail3.fallbackMessage, senderName),
  END)));
}
export function buildCompactSequence(senderName, copy = null) {
  const c = copy || loadCompactCopy();
  return {
    nodeType: 'CHECK_IS_CONNECTION', actionDelay: 0, actionDelayUnit: 'DAY', externalReference: 'compact-conn-gate',
    conditionalNode: compactDMs(c), // already connected -> the 6-DM arc directly
    // NOT connected -> send a connection request carrying the video (acts as DM1).
    // If accepted, they get an acknowledgment + health check (not a repeat of the
    // video); if not accepted within 2 days, one InMail (Sales Nav) then stop.
    // Connection status is decided at each branching node, so a very late accept
    // (after the InMail) won't backfill the DMs — that is expected.
    unconditionalNode: {
      nodeType: 'CONNECTION_REQUEST', actionDelay: 3, actionDelayUnit: 'HOUR', externalReference: 'compact-cr',
      payload: {
        messages: [c.cr.message],
        fallbackMessage: c.cr.fallback,
        toBeWithdrawnAfterDays: 7,
      },
      conditionalNode: compactAcceptedDMs(c), // accepted -> ack + health check (video already sent via CR note)
      unconditionalNode: compactInmailChain(c, senderName), // not accepted -> 3-InMail nudge chain
    },
  };
}

// CLI entry point — only runs when this file is executed directly (`node
// heyreach-sequence.mjs ...`), NOT when imported for its exports (server.mjs
// imports buildCompactSequence/loadCompactCopy for the Campaign Copy editor, and
// must not trigger a live push just by importing).
if (process.argv[1] && (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`)) {
  const K = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^HEYREACH_API_KEY=(.+)$/m)?.[1]?.trim();
  if (!K) { console.error('no HEYREACH_API_KEY in .env'); process.exit(1); }
  const mode = ['test', 'compact'].includes(process.argv[3]) ? process.argv[3] : 'full';
  const campaignId = +(process.argv[2] || (mode === 'test' ? 495416 : mode === 'compact' ? 497484 : 495367));
  const senderName = process.argv[4] || 'Sina';
  const sequence = mode === 'test' ? testSequence : mode === 'compact' ? buildCompactSequence(senderName) : fullSequence;

  const r = await fetch('https://api.heyreach.io/api/public/campaign/UpdateSequence', {
    method: 'POST', headers: { 'X-API-KEY': K, 'content-type': 'application/json' },
    body: JSON.stringify({ campaignId, sequence }),
  });
  console.log(`UpdateSequence (${mode}, campaign ${campaignId}):`, r.status, (await r.text()).slice(0, 400));
  const g = await fetch(`https://api.heyreach.io/api/public/campaign/GetCampaignSequence?campaignId=${campaignId}`, { headers: { 'X-API-KEY': K } });
  console.log('GetCampaignSequence:', g.status, (await g.text()).slice(0, 300));
}
