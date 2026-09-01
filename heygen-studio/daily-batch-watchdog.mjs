// Runs at 8:50am weekday, after the 7am main batch should have finished. If today's log
// is missing, the main task or the machine itself failed to run this morning — alert
// rather than silently notify nothing by 9am.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, 'logs');
// Local (Melbourne) calendar date — must match daily-batch.mjs's localDate() exactly,
// since a UTC date would misfile/mismatch relative to a 7am AEST run's log filename.
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const date = localDate();
const logPath = path.join(LOG_DIR, `${date}.json`);
const fatalPath = path.join(LOG_DIR, `${date}-FATAL.json`);

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
  } catch {}
}

// Is a batch process alive right now? The 7am trigger is StartWhenAvailable, so a
// machine that was asleep at 7am runs the missed task whenever it wakes — which can
// easily be after this 8:50 check. Without this test the watchdog reads "no log file
// yet" as "never ran" and fires a false DID-NOT-RUN alert over a batch that is happily
// mid-flight (seen live 2026-08-28: woke at 8:47, watchdog due at 8:50).
function batchRunning() {
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "(Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -like '*daily-batch.mjs*' } | Measure-Object).Count"],
      { encoding: 'utf8', timeout: 20000 });
    return parseInt(String(out).trim(), 10) > 0;
  } catch { return false; } // can't tell -> fall through to the normal checks
}

if (fs.existsSync(fatalPath)) {
  toast('WFM GTM Pipeline — ERROR', 'Daily batch crashed this morning — check heygen-studio/logs/' + date + '-FATAL.json');
} else if (fs.existsSync(logPath)) {
  // Main script already sent its own success/failure toast — nothing to add.
} else if (batchRunning()) {
  toast('WFM GTM Pipeline — still running', 'Batch started late (machine was asleep at 7am) and is still processing. You will get the result toast when it finishes.');
} else {
  toast('WFM GTM Pipeline — DID NOT RUN', 'No batch ran this morning (task or machine likely offline at 7am). Nothing was processed today.');
}
