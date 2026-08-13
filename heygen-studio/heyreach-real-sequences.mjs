// Builds the LinkedIn sequence tree for the real Volcano cold campaigns, one per
// vertical x owner (8 total — see heyreach-seed-real-campaigns.mjs for the list).
// Layers on top of the live Instantly `Pimple - <vertical>` email campaigns: DM/InMail
// delays are set to land ~1 day after the matching email, using each vertical's real
// Instantly step delays (pulled from campaign/GetById on 2026-07-09).
//
// Tree shape follows heyreach-sequence.mjs's connection-aware pattern (CHECK_IS_CONNECTION
// root, CONNECTION_REQUEST, CHECK_IS_OPEN_PROFILE, INMAIL chain). A mid-chain recheck before
// every InMail send was attempted (so a late accept mid-InMail-chain would jump back to the
// DM arc) but HeyReach's validator rejects CHECK_IS_CONNECTION anywhere after a message has
// already been sent on that path ("Cannot have a MESSAGE before IS_CONNECTION node", confirmed
// live both after CONNECTION_REQUEST and after INMAIL) — the platform only supports ONE
// connection check, at the root, plus CONNECTION_REQUEST's own accepted/not-accepted branch.
// So this matches compactSequence's existing documented limitation: a late accept after
// InMail 1 or 2 keeps getting the remaining InMails on schedule rather than switching to DMs.
// Per Sina, when a lead DOES reach the DM arc (via the root check or CR's accept branch), it
// ALWAYS restarts from DM1 (no "catch up to current touchpoint" logic) — matches how
// connectedArc()/compactDMs() are already reused as fresh subtrees at multiple branch points
// in heyreach-sequence.mjs.
//
// Tokens: {FIRST_NAME}/{company} are HeyReach built-ins. {intro_link}/{health_check_link}/
// {calculator_link}/{benchmark_link}/{demo_link}/{firms_like_yours_link}/{resource_hub_link}/
// {booking} are custom fields pushed per-lead by /api/heyreach/push (server.mjs) — booking
// already resolves to the correct owner's calendar link per contact, no extra work needed.
//
// Message TEXT lives in copy-heyreach.json (read fresh each call, not cached at import time,
// so the GTM studio's Campaign Copy editor can rewrite that file and have the very next
// UpdateSequence pick up the edit without restarting the server). This file only owns the
// tree SHAPE and TIMING — see docs/plans or the Campaign Copy editor to change what's said.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COPY_PATH = path.join(__dirname, 'copy-heyreach.json');
export function loadCopy() {
  return JSON.parse(fs.readFileSync(COPY_PATH, 'utf8'));
}

const END = { nodeType: 'END', actionDelay: 3, actionDelayUnit: 'HOUR' };

const DM = (ref, delay, unit, msg, fb, next) => ({
  nodeType: 'MESSAGE', actionDelay: delay, actionDelayUnit: unit, externalReference: ref,
  payload: { messages: [msg], fallbackMessage: fb }, unconditionalNode: next,
});
const INMAIL = (ref, delay, unit, subject, message, fbSubject, fbMessage, next) => ({
  nodeType: 'INMAIL', actionDelay: delay, actionDelayUnit: unit, externalReference: ref,
  payload: { messages: [{ subject, message }], fallbackMessage: { subject: fbSubject, message: fbMessage } },
  unconditionalNode: next,
});

// Per-vertical DM arc delays: [DM1 delay-from-entry, then delta to each next DM],
// derived from real Instantly Pimple-<vertical> step delays (email cumulative day + 1).
// engineering was [2,1,1,1,1,1,1] (matching a broken 7-day Instantly setup found and
// fixed 2026-07-09 — all 7 email steps had delay=1; patched to 3,4,3,4,3,4,1 to match
// the other services verticals) — now shares the same cadence as everyone but creative.
const TIMING = {
  architecture: [4, 4, 3, 4, 3, 4, 1],
  consulting:   [4, 4, 3, 4, 3, 4, 1],
  construction: [4, 4, 3, 4, 3, 4, 1],
  creative:     [4, 3, 4, 3, 1, 1, 1],
  engineering:  [4, 4, 3, 4, 3, 4, 1],
};
export const VERTICALS = Object.keys(TIMING);

const withSig = (s, senderName) => (s || '').replace(/\{signature\}/g, senderName);

// DM3 onward is shared by both entry points below (dmArc and acceptedArc) — the
// only difference between them is how the video (DM1) and health check (DM2) get
// delivered, since the connection-request note already carries the video pitch.
function tailFromCalculator(vertical, copy) {
  const t = TIMING[vertical], c = copy[vertical];
  return DM(`${vertical}-dm3-calculator`, t[2], 'DAY', c.dm3.message, c.dm3.fallback,
  DM(`${vertical}-dm4-benchmark`, t[3], 'DAY', c.dm4.message, c.dm4.fallback,
  DM(`${vertical}-dm5-demo`, t[4], 'DAY', c.dm5.message, c.dm5.fallback,
  DM(`${vertical}-dm6-firms`, t[5], 'DAY', c.dm6.message, c.dm6.fallback,
  DM(`${vertical}-dm7-hub`, t[6], 'DAY', c.dm7.message, c.dm7.fallback,
  END)))));
}

// Root "already connected" path — they've never seen the video (no CR was ever
// sent to them), so DM1 delivers it, same as before.
function dmArc(vertical, copy) {
  const t = TIMING[vertical], c = copy[vertical];
  return DM(`${vertical}-dm1-intro`, t[0], 'DAY', c.dm1.message, c.dm1.fallback,
    DM(`${vertical}-dm2-healthcheck`, t[1], 'DAY', c.dm2.message, c.dm2.fallback,
      tailFromCalculator(vertical, copy)));
}

// CR-accepted path — the video pitch already went out as the connection-request
// note, so this opens with an acknowledgment + the health check instead of
// repeating the video (fires shortly after acceptance, not on DM2's normal delay).
function acceptedArc(vertical, copy) {
  const c = copy[vertical];
  return DM(`${vertical}-dm2-accept-healthcheck`, 3, 'HOUR', c.dm2_accept.message, c.dm2_accept.fallback,
    tailFromCalculator(vertical, copy));
}

// HeyReach rejects CHECK_IS_CONNECTION anywhere after a message-sending node has
// already fired on that path (confirmed live: "Cannot have a MESSAGE before
// IS_CONNECTION node", both directly after CONNECTION_REQUEST and after INMAIL).
// So there is no mid-chain recheck available — a late accept after InMail 1 or 2
// keeps getting InMails on the fixed schedule rather than switching to DMs. This
// matches the existing compactSequence's documented limitation exactly. The only
// connection-status forks HeyReach supports are: the root CHECK_IS_CONNECTION, and
// CONNECTION_REQUEST's own built-in accepted/not-accepted branch.
function inmailChain(vertical, senderName, copy) {
  const c = copy[vertical];
  const inmail3 = INMAIL(`${vertical}-inmail3-hub`, 7, 'DAY',
    c.inmail3.subject, withSig(c.inmail3.message, senderName), c.inmail3.fallbackSubject, withSig(c.inmail3.fallbackMessage, senderName), END);
  const inmail2 = INMAIL(`${vertical}-inmail2-tools`, 7, 'DAY',
    c.inmail2.subject, withSig(c.inmail2.message, senderName), c.inmail2.fallbackSubject, withSig(c.inmail2.fallbackMessage, senderName), inmail3);
  const inmail1 = INMAIL(`${vertical}-inmail1-video`, 3, 'HOUR',
    c.inmail1.subject, withSig(c.inmail1.message, senderName), c.inmail1.fallbackSubject, withSig(c.inmail1.fallbackMessage, senderName), inmail2);
  return inmail1;
}

// Full tree for one (vertical, senderName) pair.
//
// NOTE: HeyReach's validator rejects CHECK_IS_CONNECTION anywhere after a message-
// sending node has already fired on that path (confirmed live, both directly after
// CONNECTION_REQUEST and after INMAIL) — the platform only supports the root check
// plus CONNECTION_REQUEST's own accepted/not-accepted branch. So the InMail chain
// (see inmailChain above) runs on a fixed schedule with no further rechecks.
//
// The connection-request note carries {intro_link} (the 2-min video, LinkedIn's
// 300-char note cap comfortably fits FIRST_NAME + company + hook + a shortened
// link — sits ~150-190 chars, in the 120-180 sweet spot data shows converts best)
// so even the very first touch, before any acceptance, already delivers TP1.
export function buildRealSequence(vertical, senderName, copy = null) {
  if (!TIMING[vertical]) throw new Error(`unknown vertical: ${vertical}`);
  const fullCopy = copy || loadCopy();
  const c = fullCopy[vertical];
  const openProfileGate = {
    nodeType: 'CHECK_IS_OPEN_PROFILE', actionDelay: 4, actionDelayUnit: 'DAY', externalReference: `${vertical}-openprofile-gate`,
    conditionalNode: inmailChain(vertical, senderName, fullCopy),
    unconditionalNode: END, // not open profile -> no InMail credits usable, stop
  };
  return {
    nodeType: 'CHECK_IS_CONNECTION', actionDelay: 0, actionDelayUnit: 'DAY', externalReference: `${vertical}-conn-gate0`,
    conditionalNode: dmArc(vertical, fullCopy), // already connected -> DM arc directly
    unconditionalNode: {
      nodeType: 'CONNECTION_REQUEST', actionDelay: 3, actionDelayUnit: 'HOUR', externalReference: `${vertical}-cr`,
      payload: {
        messages: [c.cr.message],
        fallbackMessage: c.cr.fallback,
        toBeWithdrawnAfterDays: 12,
      },
      conditionalNode: acceptedArc(vertical, fullCopy), // accepted -> ack + health check (video already sent via CR note)
      unconditionalNode: openProfileGate, // not accepted -> wait 4d, check open profile, then InMail path
    },
  };
}
