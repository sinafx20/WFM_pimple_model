// Writes the Volcano LinkedIn sequence to a HeyReach campaign via UpdateSequence.
// Usage: node heyreach-sequence.mjs [campaignId]   (default 495367 = "Volcano LI - Sina")
// Copy source: email-templates/linkedin-sequence.md. Tree semantics: conditionalNode =
// branch when true (CONNECTION_REQUEST: accepted; CHECK_IS_OPEN_PROFILE: open profile),
// unconditionalNode = otherwise. Every child of an action node needs >= 3h delay.
// {FIRST_NAME}/{company} are HeyReach built-ins; {intro_link}/{health_check_link}/
// {booking} are the custom fields the cockpit pushes with each lead — verify the custom
// variable brace syntax with one test lead before starting the campaign.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const K = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^HEYREACH_API_KEY=(.+)$/m)?.[1]?.trim();
if (!K) { console.error('no HEYREACH_API_KEY in .env'); process.exit(1); }
const campaignId = +(process.argv[2] || 495367);

const END = { nodeType: 'END', actionDelay: 3, actionDelayUnit: 'HOUR' };

const sequence = {
  nodeType: 'CONNECTION_REQUEST',
  actionDelay: 0, actionDelayUnit: 'DAY',
  externalReference: 'volcano-cr',
  payload: {
    messages: [
      'Hi {FIRST_NAME}, I work with firms like {company} on where quoted time quietly turns into unbilled work. A couple of the numbers surprise most directors, so thought it was worth connecting.',
    ],
    fallbackMessage: 'Hi there, I work with professional services firms on where quoted time quietly turns into unbilled work. Thought it was worth connecting.',
    toBeWithdrawnAfterDays: 12,
  },
  // ACCEPTED -> 3-DM arc (video -> health check -> email/booking bridge)
  conditionalNode: {
    nodeType: 'MESSAGE',
    actionDelay: 3, actionDelayUnit: 'HOUR',
    externalReference: 'volcano-dm1-video',
    payload: {
      messages: [
        'Thanks for connecting, {FIRST_NAME}. I put together a short video for {company} on where firms in your space usually leak margin. My AI twin presents it so I will keep it honest: it is 2 minutes and worth it. {intro_link}',
      ],
      fallbackMessage: 'Thanks for connecting. I put together a short 2-minute video on where firms in your space usually leak margin, happy to share it if useful.',
    },
    unconditionalNode: {
      nodeType: 'MESSAGE',
      actionDelay: 3, actionDelayUnit: 'DAY',
      externalReference: 'volcano-dm2-healthcheck',
      payload: {
        messages: [
          "Most directors I speak with cannot name last month's real utilisation. Not the target, the actual number. This gives {company} an instant read in about 2 minutes: {health_check_link}. Even if WorkflowMAX is never the right fit, you keep your number.",
        ],
        fallbackMessage: "Most directors I speak with cannot name last month's real utilisation. Not the target, the actual number. Happy to send over a 2-minute check that gives you yours.",
      },
      unconditionalNode: {
        nodeType: 'MESSAGE',
        actionDelay: 4, actionDelayUnit: 'DAY',
        externalReference: 'volcano-dm3-email-bridge',
        payload: {
          messages: [
            'Happy to keep this async, {FIRST_NAME}. If email is easier, say the word and I will send over the benchmark for firms your size instead. And if you would rather talk it through, my calendar is here: {booking}',
          ],
          fallbackMessage: 'Happy to keep this async. If email is easier, say the word and I will send over the benchmark for firms your size instead.',
        },
        unconditionalNode: END,
      },
    },
  },
  // NOT accepted after 6 days -> InMail if their profile is open, else stop
  // (these leads are already in the Instantly email sequence, so no double-dispatch)
  unconditionalNode: {
    nodeType: 'CHECK_IS_OPEN_PROFILE',
    actionDelay: 6, actionDelayUnit: 'DAY',
    externalReference: 'volcano-openprofile-gate',
    conditionalNode: {
      nodeType: 'INMAIL',
      actionDelay: 3, actionDelayUnit: 'HOUR',
      externalReference: 'volcano-inmail',
      payload: {
        // InMail messages are objects (PublicInMailMessage), not strings
        messages: [
          {
            subject: 'the number most firms cannot name',
            message: 'Hi {FIRST_NAME}, no worries on the connection, inbox zero is a myth on here anyway. One thing worth having regardless: most firms cannot name how much quoted time turned into unbilled work last month, and it is usually five figures. This gives {company} the number in about 2 minutes, no sign-up: {health_check_link}\n\nIf email is easier, happy to send the benchmark there instead. Either way, keep your number.\n\nSina',
          },
        ],
        fallbackMessage: {
          subject: 'the number most firms cannot name',
          message: 'Hi, one thing worth having regardless of whether we connect: most firms cannot name how much quoted time turned into unbilled work last month, and it is usually five figures. Happy to send over a 2-minute check that gives you the number.\n\nSina',
        },
      },
      unconditionalNode: END,
    },
    unconditionalNode: END,
  },
};

const r = await fetch('https://api.heyreach.io/api/public/campaign/UpdateSequence', {
  method: 'POST',
  headers: { 'X-API-KEY': K, 'content-type': 'application/json' },
  body: JSON.stringify({ campaignId, sequence }),
});
console.log('UpdateSequence:', r.status, (await r.text()).slice(0, 500));

const g = await fetch(`https://api.heyreach.io/api/public/campaign/GetCampaignSequence?campaignId=${campaignId}`, {
  headers: { 'X-API-KEY': K },
});
const seq = await g.text();
console.log('GetCampaignSequence:', g.status, seq.slice(0, 400));
