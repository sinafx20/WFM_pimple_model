// The SHAPE of the Harvest LinkedIn sequence. Deliberately holds no real copy.
//
// STRUCTURE: four campaigns, region x owner. The three angles are A/B VARIANTS inside each
// angled step rather than separate campaigns, so the platform distributes them and the result
// is a straight A/B/C test of the three messages.
//
//   region  APAC (AU 96, NZ 17, SG 13) | US-West (US 34)   - different send windows
//   owner   sina | denzel                                   - owner = sender, always
//   angle   A disconnected workflows | B AI on one source of truth | C scope creep, WIP
//
// THE DM ARC MATCHES THE COPY THAT EXISTS, not a shape invented ahead of it:
//   cr   connection request, Act 1          shared
//   dm1  after accept, Act 1                shared
//   dm2  the angle, carrying the demo link  A/B/C
//   dm3  trial + Harvest migration tool     shared
// An earlier draft had a second angled DM and a separate close. There was never copy for
// either, so they are gone rather than sitting as permanent blockers.
//
// THE INMAIL ARC IS OPTIONAL. It is the only path to anyone who never accepts the connection
// request, and that is not a small group: the Volcano run delivered 65 InMails against 31
// acceptances, so more people saw an InMail than accepted. But no InMail copy exists yet, and
// requiring it would block the whole campaign from loading. So: if InMail copy is present the
// chain is built, and if it is absent the sequence simply ends when the request is not
// accepted. Non-accepters then receive nothing after the request, which is a real loss, not a
// neutral default. hasInmailCopy() reports which of the two you are getting.
//
// WHAT THE VARIANT MODEL GIVES UP, ON PURPOSE. The platform picks the variant, so a contact is
// not pinned to one angle and two people at one firm can get different ones. Nothing downstream
// should claim to know a contact's angle, which is why volcano_lane is not written.
//
// UNVERIFIED, TEST BEFORE TRUSTING. HeyReach's payload.messages is an array and no Volcano
// sequence used more than one entry, so whether it rotates variants or concatenates parts is
// not established here. Open a campaign in the UI and confirm a step shows three VARIANTS.

import { forHeyReach, toFallback, customTokens } from './harvest-tokens.mjs';

export const ANGLES = {
  A: 'Disconnected workflows and what they cost',
  B: 'AI and automation on one source of truth',
  C: 'Scope creep, WIP, variations and utilisation',
};
export const ANGLE_KEYS = Object.keys(ANGLES);

export const REGIONS = {
  APAC: { label: 'APAC', countries: ['Australia', 'New Zealand', 'Singapore'] },
  'US-West': { label: 'US-West', countries: ['United States'] },
};
export const REGION_KEYS = Object.keys(REGIONS);

export const STEPS = [
  { key: 'cr',      kind: 'connection_request', week: 1, angled: true,  required: true,  label: 'Connection request, Act 1 (A/B/C)' },
  { key: 'dm1',     kind: 'message',            week: 1, angled: false, required: true,  label: 'DM1 after accept, Act 1' },
  { key: 'dm2',     kind: 'message',            week: 2, angled: true,  required: true,  label: 'DM2, the angle + demo link' },
  { key: 'dm3',     kind: 'message',            week: 3, angled: false, required: true,  label: 'DM3, trial + migration tool' },
  { key: 'inmail1', kind: 'inmail',             week: 2, angled: false, required: false, label: 'InMail 1, Act 1 for non-connections' },
  { key: 'inmail2', kind: 'inmail',             week: 3, angled: true,  required: false, label: 'InMail 2, the angle' },
  { key: 'inmail3', kind: 'inmail',             week: 4, angled: false, required: false, label: 'InMail 3, trial + close' },
];
export const REQUIRED_STEPS = STEPS.filter((s) => s.required);
export const INMAIL_STEPS = STEPS.filter((s) => s.kind === 'inmail');

// HeyReach enforces a minimum of 3 hours and a maximum of 500 days on every node, so DM1,
// which fires as soon as the connection is accepted, is 3 hours rather than zero.
const DELAY = {
  cr: [3, 'HOUR'], dm1: [3, 'HOUR'], dm2: [4, 'DAY'], dm3: [6, 'DAY'],
  inmail1: [4, 'DAY'], inmail2: [6, 'DAY'], inmail3: [6, 'DAY'],
};

export const PLACEHOLDER = (key, angle) =>
  `[PLACEHOLDER ${key}${angle ? '/' + angle : ''}] Copy has not been loaded into this campaign yet. `
  + 'Do not start it. Load copy with: node harvest-campaigns.mjs copy';

const END = { nodeType: 'END', actionDelay: 3, actionDelayUnit: 'HOUR' };

// fallbackMessage is what sends when a custom field is missing, so HeyReach rejects any
// fallback that itself references one (probed 2026-10-01). It is derived from the first
// variant with the custom-field lines removed, never set to the variant itself.
const msg = (ref, [n, unit], bodies, next) => ({
  nodeType: 'MESSAGE', actionDelay: n, actionDelayUnit: unit, externalReference: ref,
  payload: { messages: bodies, fallbackMessage: toFallback(bodies[0]) },
  unconditionalNode: next,
});
const inmailNode = (ref, [n, unit], variants, next) => ({
  nodeType: 'INMAIL', actionDelay: n, actionDelayUnit: unit, externalReference: ref,
  payload: {
    messages: variants,
    fallbackMessage: { subject: variants[0].subject, message: toFallback(variants[0].message) },
  },
  unconditionalNode: next,
});

const blank = (t) => !t || !String(t).trim() || /^\[PLACEHOLDER/.test(String(t));

// Copy is authored in neutral tokens and translated per platform here. HeyReach's built-in is
// {FIRST_NAME}; a lowercase {first_name} would be treated as a custom field and arrive blank.
const hr = (t) => forHeyReach(t);

function bodiesFor(step, copy) {
  const c = copy?.[step.key];
  if (!step.angled) {
    const t = c?.message ?? c;
    return [blank(t) ? PLACEHOLDER(step.key) : hr(t)];
  }
  return ANGLE_KEYS.map((a) => {
    const t = c?.[a]?.message ?? c?.[a];
    return blank(t) ? PLACEHOLDER(step.key, a) : hr(t);
  });
}
function inmailVariants(step, copy) {
  const c = copy?.[step.key];
  if (!step.angled) {
    return [{ subject: hr(c?.subject || `[PLACEHOLDER ${step.key} subject]`), message: hr(c?.message || PLACEHOLDER(step.key)) }];
  }
  return ANGLE_KEYS.map((a) => ({
    subject: hr(c?.[a]?.subject || `[PLACEHOLDER ${step.key}/${a} subject]`),
    message: hr(c?.[a]?.message || PLACEHOLDER(step.key, a)),
  }));
}

// True when every InMail step has usable copy. Partial InMail copy is treated as none, because
// a chain with one real message and two placeholders is worse than no chain.
export function hasInmailCopy(copy) {
  return INMAIL_STEPS.every((s) => {
    const c = copy?.[s.key];
    if (!c) return false;
    if (!s.angled) return !blank(c.message) && !blank(c.subject);
    return ANGLE_KEYS.every((a) => !blank(c?.[a]?.message) && !blank(c?.[a]?.subject));
  });
}

export function buildHarvestSequence(copy = null) {
  const S = Object.fromEntries(STEPS.map((s) => [s.key, s]));
  const b = (k) => bodiesFor(S[k], copy);
  const ref = (k) => `harvest-${k}`;

  const dmArc =
    msg(ref('dm1'), DELAY.dm1, b('dm1'),
    msg(ref('dm2'), DELAY.dm2, b('dm2'),
    msg(ref('dm3'), DELAY.dm3, b('dm3'), END)));

  // Only build the InMail path when there is copy for all of it; otherwise a non-accepted
  // request simply ends the sequence.
  let notAccepted = END;
  if (copy && hasInmailCopy(copy)) {
    const iv = (k) => inmailVariants(S[k], copy);
    notAccepted = {
      nodeType: 'CHECK_IS_OPEN_PROFILE', actionDelay: 4, actionDelayUnit: 'DAY',
      externalReference: ref('openprofile-gate'),
      conditionalNode:
        inmailNode(ref('inmail1'), DELAY.inmail1, iv('inmail1'),
        inmailNode(ref('inmail2'), DELAY.inmail2, iv('inmail2'),
        inmailNode(ref('inmail3'), DELAY.inmail3, iv('inmail3'), END))),
      unconditionalNode: END,
    };
  }

  const crBodies = b('cr');
  return {
    nodeType: 'CHECK_IS_CONNECTION', actionDelay: 0, actionDelayUnit: 'DAY',
    externalReference: ref('conn-gate'),
    conditionalNode: dmArc,
    unconditionalNode: {
      nodeType: 'CONNECTION_REQUEST', actionDelay: 3, actionDelayUnit: 'HOUR',
      externalReference: ref('cr'),
      payload: { messages: crBodies, fallbackMessage: crBodies[0], toBeWithdrawnAfterDays: 12 },
      conditionalNode: dmArc,
      unconditionalNode: notAccepted,
    },
  };
}

// Every custom field the LinkedIn copy depends on. Each one must be pushed per lead or the
// fallback fires instead of the real message.
export function requiredCustomFields(copy) {
  const seq = JSON.stringify(buildHarvestSequence(copy));
  return customTokens(seq);
}

// Only the required steps block a load. Missing InMail copy is reported separately, because it
// costs reach rather than correctness.
export function copyComplete(copy) {
  const missing = [];
  for (const s of REQUIRED_STEPS) {
    const c = copy?.[s.key];
    if (!s.angled) {
      if (blank(c?.message ?? c)) missing.push(s.key);
      if (s.kind === 'inmail' && blank(c?.subject)) missing.push(`${s.key}.subject`);
    } else {
      for (const a of ANGLE_KEYS) {
        if (blank(c?.[a]?.message ?? c?.[a])) missing.push(`${s.key}.${a}`);
      }
    }
  }
  return { ok: missing.length === 0, missing, inmail: hasInmailCopy(copy) };
}
