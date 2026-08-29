// Unattended daily batch: pulls the next BATCH_SIZE not-yet-processed contacts from the
// master HubSpot list, generates a HeyGen video for each, hosts it durably on HubSpot's
// CDN, writes back all personalization (blob/thumbnails/brand colour), and pushes to the
// correct owner+vertical Instantly and HeyReach campaigns. Designed to be launched by a
// Windows Scheduled Task (see setup-daily-task.ps1) — NOT dependent on any browser tab or
// Claude session staying open.
//
// Script templates / avatar+voice presets / owner mapping are copied 1:1 from
// public/index.html's DEFAULT_TEMPLATES / PRESETS / KNOWN_OWNERS (confirmed with Sina
// 2026-08-26 as the correct source of truth — no browser localStorage overrides in use).
//
// State: daily-batch-queue.json holds the ordered list of not-yet-processed contacts,
// built once (first run) from HubSpot and then consumed BATCH_SIZE at a time. This is the
// only durable state — a plain file, so it survives process/session restarts, unlike the
// Kanban board's in-browser stage tracking.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:5178';
const BATCH_SIZE = 50;
const CONCURRENCY = 3; // same "3 at a time" empirical rate used by the Kanban board's pool()
const LIST_ID = '3698';
export const QUEUE_PATH = path.join(__dirname, 'daily-batch-queue.json');
const LOG_DIR = path.join(__dirname, 'logs');
const MAIN_TASK_NAME = 'WFM GTM Daily Batch';
const WATCHDOG_TASK_NAME = 'WFM GTM Daily Batch Watchdog';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- copied from public/index.html (source of truth confirmed with Sina) ----
export const PRESETS = {
  sina: { name: 'Sina', fullName: 'Sina Zarei', title: 'Account Executive', booking: 'https://meetings.hubspot.com/szarei', avatar: 'b8f33c1ab4cd48dbb356d9d38871703a', voice: 'f8bdb54f8f50454fbaa633c51c2b9609' },
  denzel: { name: 'Denzel', fullName: 'Denzel Kereama', title: 'Account Executive', booking: 'https://meetings.hubspot.com/denzel-kereama', avatar: 'b8aebde6a4664874ac1b014ea17e4635', voice: '13cb23d75356448b828aed75430c1df0' },
};
// Inverted until 2026-08-29; verified against hs_email_from_email on real records.
const KNOWN_OWNERS = { '80127259': 'denzel', '80406430': 'sina' };
export const presenterFor = (ownerId) => KNOWN_OWNERS[ownerId] || 'sina';
const MAP = { architecture: ['services', 'architecture'], engineering: ['services', 'engineering'], consulting: ['services', 'consulting'], creative: ['services', 'creative'], construction: ['project', 'construction'], civil: ['project', 'civil'] };
const classify = (v) => { const k = (v || '').toLowerCase(); for (const x in MAP) if (k.includes(x)) return { model: MAP[x][0], word: MAP[x][1], key: x }; return { model: 'services', word: 'professional services', key: '' }; };
const DEFAULT_TEMPLATES = {
  services: `Hi {firstName}, I'm {presenter}'s AI twin from WorkflowMAX. I record a few of these each week for {industry} firms, and wanted to send one to {company}, there's a pattern I keep seeing with firms your size. The biggest drain on the profitability of each project isn't typically pricing or staffing costs, it's the time that gets worked but never billed. A few unbilled minutes on each job, or scope that quietly creeps past the fee. It never shows up on a report, which is exactly why it compounds. For a firm {company}'s size, that's often tens of thousands a year, hiding in plain sight. But look, you might have all of this figured out already, so instead of presuming to tell you where your margin gaps are coming from, I built you a 2-minute Workflow Health Check, just below this video. A few reflective questions on how {company} runs today, and what comes back isn't just a score, it's the gap costing you the most, and what to do about it. Even if WorkflowMAX is never the right fit for you, you'll walk away with a clearer read on where to focus. Go ahead and click it below, it only takes two minutes.`,
  project: `Hi {firstName}, I'm {presenter}'s AI twin from WorkflowMAX, so I'll keep this quick. Here's what most {industry} MDs miss. The margin you lose usually isn't on the quote, it's between the quote and the final number. It's the variations that got done but never invoiced, or the costs that crept in before anyone flagged them. On one job it's noise, but across a year it's real money, and it stays invisible until the job closes out. The fix starts with seeing it. So I built you a 2-minute Workflow Health Check, just below this video. It shows where {company} sits, and the biggest gap between the margin you quote and the margin you actually deliver. Even if we never work together, you'll walk away knowing that number. Worth a look?`,
  construction: `Hi {firstName}, I'm {presenter}'s AI twin from WorkflowMAX. I record a few of these each week for {industry} firms, and wanted to send one to {company}, there's a pattern I keep seeing with firms your size. The biggest drain on the margin of each job isn't typically the quote or staffing costs, it's the variations that get done but never claimed. A few unrecorded changes on site, or scope that creeps past the original fee. It never shows up until the job closes out, which is exactly why it compounds. For a firm {company}'s size, that's often tens of thousands a year, hiding in plain sight. But look, you might have all of this figured out already, so instead of presuming to tell you where your margin gaps are coming from, I built you a 2-minute Workflow Health Check, just below this video. A few reflective questions on how {company} runs today, and what comes back isn't just a score, it's the gap costing you the most, and what to do about it. Even if WorkflowMAX is never the right fit for you, you'll walk away with a clearer read on where to focus. Go ahead and click it below, it only takes two minutes.`,
  engineering: `Hi {firstName}, I'm {presenter}'s AI twin from WorkflowMAX. I record a few of these each week for {industry} firms, and wanted to send one to {company}, there's a pattern I keep seeing with firms your size. The biggest drain on the profitability of each project isn't typically pricing or staffing costs, it's the hours that get worked but never make it onto the timesheet. A few minutes logged late, rounded down, or never recorded at all. It never shows up on a report, which is exactly why it compounds. For a firm {company}'s size, that's often tens of thousands a year, hiding in plain sight. But look, you might have all of this figured out already, so instead of presuming to tell you where your margin gaps are coming from, I built you a 2-minute Workflow Health Check, just below this video. A few reflective questions on how {company} runs today, and what comes back isn't just a score, it's the gap costing you the most, and what to do about it. Even if WorkflowMAX is never the right fit for you, you'll walk away with a clearer read on where to focus. Go ahead and click it below, it only takes two minutes.`,
};
function script(c, presenterName) {
  const { model, key } = classify(c.vertical);
  const { word } = classify(c.vertical);
  const tpl = (key && DEFAULT_TEMPLATES[key]) ? DEFAULT_TEMPLATES[key] : DEFAULT_TEMPLATES[model];
  return tpl.replace(/{firstName}/g, c.firstName || 'there').replace(/{company}/g, c.company || 'your firm').replace(/{industry}/g, word).replace(/{presenter}/g, presenterName || 'Sina');
}

// ---- infra ----
async function isServerUp() {
  try { const r = await fetch(`${BASE}/api/instantly/campaigns`, { signal: AbortSignal.timeout(4000) }); return r.status < 500; } catch { return false; }
}
export async function ensureServerUp() {
  if (await isServerUp()) { log('server already running'); return; }
  log('server not running — starting it');
  const child = spawn(process.execPath, ['server.mjs'], { cwd: __dirname, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  for (let i = 0; i < 30; i++) { await sleep(1000); if (await isServerUp()) { log('server up'); return; } }
  throw new Error('server.mjs did not come up within 30s of starting it');
}
function toast(title, message) {
  try {
    const ps = `
      [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
      $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
      $textNodes = $template.GetElementsByTagName("text")
      $textNodes.Item(0).AppendChild($template.CreateTextNode("${title.replace(/"/g, "'")}")) | Out-Null
      $textNodes.Item(1).AppendChild($template.CreateTextNode("${message.replace(/"/g, "'")}")) | Out-Null
      $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
      $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("WFM GTM Studio")
      $notifier.Show($toast)
    `;
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore', timeout: 15000 });
  } catch (e) { log('toast failed: ' + e.message); }
}
function unregisterTasks() {
  for (const name of [MAIN_TASK_NAME, WATCHDOG_TASK_NAME]) {
    try { execFileSync('schtasks.exe', ['/delete', '/tn', name, '/f'], { stdio: 'ignore' }); log(`unregistered scheduled task: ${name}`); }
    catch (e) { log(`could not unregister task ${name} (may not exist): ${e.message}`); }
  }
}
let LOG_LINES = [];
function log(msg) { const line = `[${new Date().toISOString()}] ${msg}`; console.log(line); LOG_LINES.push(line); }
// Local (Melbourne) calendar date, not UTC — a 7am AEST run is still 9pm the previous
// day in UTC, so new Date().toISOString().slice(0,10) would file it under yesterday.
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

async function retry(fn, { tries = 3, delayMs = 6000, label = 'op' } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); }
    catch (e) { lastErr = e; log(`${label} attempt ${i + 1}/${tries} failed: ${e.message || e}`); if (i < tries - 1) await sleep(delayMs); }
  }
  throw lastErr;
}
async function j(path_, opts) {
  const r = await fetch(`${BASE}${path_}`, { headers: { 'content-type': 'application/json' }, ...opts });
  const body = await r.json().catch(() => ({}));
  if (r.status >= 500) throw new Error(`${path_} -> HTTP ${r.status}: ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

// ---- pipeline ----
export async function buildQueueIfMissing() {
  if (fs.existsSync(QUEUE_PATH)) return;
  log('no queue file — building from HubSpot list ' + LIST_ID);
  const r = await j(`/api/contacts?list=${LIST_ID}`);
  const remaining = (r.contacts || []).filter((c) => !c.hasVideo);
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(remaining, null, 2));
  log(`queue built: ${remaining.length} not-yet-processed contacts (list has ${r.count} total)`);
}

async function generateVideo(c, presenterKey) {
  const preset = PRESETS[presenterKey];
  const gen = await retry(() => j('/api/generate', { method: 'POST', body: JSON.stringify({ avatar_id: preset.avatar, voice_id: preset.voice, script: script(c, preset.name), width: 1280, height: 720, background: '#FFFFFF' }) }), { label: `generate:${c.id}`, tries: 2 });
  if (!gen.video_id) throw new Error('generate rejected: ' + JSON.stringify(gen.error || gen.raw).slice(0, 200));
  for (let k = 0; k < 100; k++) {
    await sleep(8000);
    const s = await j(`/api/status?video_id=${gen.video_id}`);
    if (s.status === 'completed') return s.video_url;
    if (s.status === 'failed') throw new Error('HeyGen generation failed: ' + JSON.stringify(s.error));
  }
  throw new Error('HeyGen generation timed out (13+ min)');
}
async function hostAndWriteback(c, rawVideoUrl, presenterKey) {
  const h = await retry(() => j('/api/host', { method: 'POST', body: JSON.stringify({ video_url: rawVideoUrl, name: (c.company || 'volcano') + '-' + c.id }) }), { label: `host:${c.id}` });
  if (!h.url) throw new Error('host failed: ' + JSON.stringify(h.error).slice(0, 200));
  const w = await retry(() => j('/api/writeback', { method: 'POST', body: JSON.stringify({ contactId: c.id, video: h.url, firstName: c.firstName, company: c.company, vertical: c.vertical, email: c.email, domain: c.domain, presenter: presenterKey }) }), { label: `writeback:${c.id}` });
  if (!w.ok) throw new Error('writeback failed: ' + JSON.stringify(w.error).slice(0, 200));
  return { hostedUrl: h.url, ...w };
}
async function pushInstantly(c, w, preset) {
  if (!c.email) return { ok: false, skipped: true, reason: 'no email' };
  return retry(() => j('/api/instantly/push', { method: 'POST', body: JSON.stringify({ contactId: c.id, email: c.email, firstName: c.firstName, company: c.company, vertical: c.vertical, domain: c.domain, blob: w.blob, video: w.hostedUrl, thumb: w.thumb, demo_thumb: w.demo_thumb, brand_color: w.brand_color, logo: w.logo, presenter: preset.fullName, presenter_title: preset.title, booking: preset.booking }) }), { label: `instantly:${c.id}`, tries: 2 });
}
async function pushHeyReach(c) {
  if (!c.linkedin) return { ok: false, skipped: true, reason: 'no LinkedIn URL' };
  return retry(() => j('/api/heyreach/push', { method: 'POST', body: JSON.stringify({ contactId: c.id }) }), { label: `heyreach:${c.id}`, tries: 2 });
}

export async function processContact(c) {
  const rec = { id: c.id, company: c.company, email: c.email, vertical: c.vertical, ok: false, steps: {} };
  const presenterKey = presenterFor(c.owner);
  const preset = PRESETS[presenterKey];
  try {
    const rawVideoUrl = await generateVideo(c, presenterKey);
    rec.steps.generate = 'ok';
    const w = await hostAndWriteback(c, rawVideoUrl, presenterKey);
    rec.steps.writeback = 'ok';
    const [inst, hr] = await Promise.all([pushInstantly(c, w, preset), pushHeyReach(c)]);
    rec.steps.instantly = inst.skipped ? `skipped (${inst.reason})` : inst.ok ? 'ok' : `FAILED: ${JSON.stringify(inst.error || inst).slice(0, 150)}`;
    rec.steps.heyreach = hr.skipped ? `skipped (${hr.reason})` : hr.ok ? 'ok' : `FAILED: ${JSON.stringify(hr.error || hr).slice(0, 150)}`;
    rec.ok = true; // video generated + written back is the bar for "processed"; push failures are logged but don't re-queue the contact
    return rec;
  } catch (e) {
    rec.error = String(e.message || e).slice(0, 300);
    log(`contact ${c.id} (${c.company}) FAILED: ${rec.error}`);
    return rec;
  }
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; results[idx] = await fn(items[idx]); }
  }));
  return results;
}

async function main() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  await ensureServerUp();
  await buildQueueIfMissing();
  const queue = JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  const date = localDate();

  if (!queue.length) {
    log('queue is empty — nothing left to process');
    toast('WFM GTM Pipeline', 'All contacts already processed. Nothing to do today — cleaning up the scheduled task.');
    unregisterTasks();
    return;
  }

  const batch = queue.slice(0, BATCH_SIZE);
  const rest = queue.slice(BATCH_SIZE);
  log(`processing ${batch.length} contacts (${rest.length} will remain after this run)`);

  const results = await pool(batch, CONCURRENCY, processContact);
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(rest, null, 2));

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const pushFailed = results.filter((r) => r.ok && (String(r.steps.instantly).startsWith('FAILED') || String(r.steps.heyreach).startsWith('FAILED')));

  const parts = [`${succeeded.length}/${batch.length} processed and pushed`];
  if (failed.length) parts.push(`${failed.length} failed to generate/writeback`);
  if (pushFailed.length) parts.push(`${pushFailed.length} had a push failure`);
  parts.push(`${rest.length} contacts remaining`);
  const msg = parts.join(' · ');
  // Log the outcome BEFORE writing the file, or the saved log array ends on
  // "processing N contacts" and reads like the run died mid-batch.
  log('DONE: ' + msg);

  fs.writeFileSync(path.join(LOG_DIR, `${date}.json`), JSON.stringify({ date, batchSize: batch.length, succeeded: succeeded.length, failed: failed.length, remaining: rest.length, results, log: LOG_LINES }, null, 2));

  toast('WFM GTM Pipeline', msg);

  if (!rest.length) { log('last batch — unregistering scheduled tasks'); unregisterTasks(); }
}

// Guard: only auto-run when this file is executed directly (`node daily-batch.mjs`),
// never when imported for its exported functions (e.g. by test-one-contact.mjs) — an
// earlier version of this file lacked this guard, which caused an unauthorized real
// 50-contact production run to fire as a side effect of a supervised 1-contact test
// (2026-08-26). See the incident note in the repo history / conversation log.
if (path.resolve(process.argv[1] || '') === path.resolve(fileURLToPath(import.meta.url))) {
main().catch((e) => {
  log('FATAL: ' + (e.stack || e));
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); fs.writeFileSync(path.join(LOG_DIR, `${localDate()}-FATAL.json`), JSON.stringify({ error: String(e.stack || e), log: LOG_LINES }, null, 2)); } catch {}
  toast('WFM GTM Pipeline — ERROR', 'Daily batch crashed: ' + String(e.message || e).slice(0, 140));
  process.exit(1);
});
}
