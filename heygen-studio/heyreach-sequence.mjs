// Writes the Volcano LinkedIn sequence to a HeyReach campaign via UpdateSequence.
//   node heyreach-sequence.mjs [campaignId]        -> full sequence (default 495367 "Volcano LI - Sina")
//   node heyreach-sequence.mjs [campaignId] test   -> one-message-with-video test (default 495416)
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
const K = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^HEYREACH_API_KEY=(.+)$/m)?.[1]?.trim();
if (!K) { console.error('no HEYREACH_API_KEY in .env'); process.exit(1); }
const mode = ['test', 'compact'].includes(process.argv[3]) ? process.argv[3] : 'full';
const campaignId = +(process.argv[2] || (mode === 'test' ? 495416 : 495367));

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

// COMPACT: the 5-day test overlay — 3 DMs that NUDGE TO THE EMAIL series and
// share the built resources. Connection-aware; warm audience is mostly already
// connected so they get the DMs directly.
// 6 short DMs across ~5 days, one per touchpoint tool, each nudging to the email
// series. Chained newest-last via a small builder so the tree stays readable.
const DM = (ref, delay, unit, msg, fb, next) => ({
  nodeType: 'MESSAGE', actionDelay: delay, actionDelayUnit: unit, externalReference: ref,
  payload: { messages: [msg], fallbackMessage: fb }, unconditionalNode: next,
});
const compactDMs = () =>
  DM('compact-dm1-intro', 3, 'HOUR',
    '{FIRST_NAME}, just sent you an email with a short personal video on where firms like {company} usually leak margin. Would genuinely value your honest take: {intro_link}',
    'Just sent you an email with a short personal video on where firms usually leak margin. Would value your honest take.',
  DM('compact-dm2-healthcheck', 1, 'DAY',
    'Following up on the email series, {FIRST_NAME}. The 2-minute Workflow Health Check shows where {company} sits today: {health_check_link}',
    'Following up on the email series. The 2-minute Workflow Health Check is worth a look.',
  DM('compact-dm3-calculator', 1, 'DAY',
    'This one is worth two minutes, {FIRST_NAME}: the profit-leak calculator puts a real number on the time that never gets billed at {company}: {calculator_link}',
    'The profit-leak calculator puts a real number on the time that never gets billed. Worth two minutes.',
  DM('compact-dm4-benchmark', 1, 'DAY',
    'Curious how {company} compares to similar firms, {FIRST_NAME}? The benchmark gives you an instant read: {benchmark_link}',
    'Curious how your firm compares to similar ones? The benchmark gives an instant read.',
  DM('compact-dm5-demo', 1, 'DAY',
    'If you would rather see the fix than read about it, {FIRST_NAME}, here is the 6-minute walkthrough: {demo_link}',
    'If you would rather see the fix than read about it, here is the 6-minute walkthrough.',
  DM('compact-dm6-hub', 3, 'HOUR',
    'Last one, {FIRST_NAME}. Everything from this week in one place: {resource_hub_link}. Any feedback on the whole set would mean a lot.',
    'Last one. Everything from this week in one place. Any feedback on the whole set would mean a lot.',
  END))))));
// Personalized InMail; the fallback must be token-free (it fires when the
// custom variables are missing, so it cannot reference {intro_link} etc.).
const compactInmail = {
  subject: 'a 2-minute video for {company}',
  message: 'Hi {FIRST_NAME}, we are not connected yet so I will keep this short. I recorded a 2-minute video on where firms like {company} usually leak margin, and I have sent it to your inbox too. Here it is if easier: {intro_link}\n\nThere is a short series of tools behind it (a health check, profit-leak calculator, benchmark and a quick demo). I would genuinely value your feedback on the whole set this week.\n\nSina',
};
const compactInmailFallback = {
  subject: 'a 2-minute video from WorkflowMAX',
  message: 'Hi, we are not connected yet so I will keep this short. I recorded a 2-minute video on where professional services firms usually leak margin, and I have sent it to your inbox too. There is a short series of tools behind it (a health check, profit-leak calculator, benchmark and a quick demo). I would genuinely value your feedback this week.\n\nSina',
};
const compactSequence = {
  nodeType: 'CHECK_IS_CONNECTION', actionDelay: 0, actionDelayUnit: 'DAY', externalReference: 'compact-conn-gate',
  conditionalNode: compactDMs(), // already connected -> the 6-DM arc directly
  // NOT connected -> InMail straight away (warm test audience; Sales Nav seat).
  // The email series covers the rest of the content for them.
  unconditionalNode: {
    nodeType: 'INMAIL', actionDelay: 3, actionDelayUnit: 'HOUR', externalReference: 'compact-inmail',
    payload: { messages: [compactInmail], fallbackMessage: compactInmailFallback },
    unconditionalNode: END,
  },
};

const sequence = mode === 'test' ? testSequence : mode === 'compact' ? compactSequence : fullSequence;

const r = await fetch('https://api.heyreach.io/api/public/campaign/UpdateSequence', {
  method: 'POST', headers: { 'X-API-KEY': K, 'content-type': 'application/json' },
  body: JSON.stringify({ campaignId, sequence }),
});
console.log(`UpdateSequence (${mode}, campaign ${campaignId}):`, r.status, (await r.text()).slice(0, 400));
const g = await fetch(`https://api.heyreach.io/api/public/campaign/GetCampaignSequence?campaignId=${campaignId}`, { headers: { 'X-API-KEY': K } });
console.log('GetCampaignSequence:', g.status, (await g.text()).slice(0, 300));
