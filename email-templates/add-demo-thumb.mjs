// One-shot: add the per-lead co-branded {{demo_thumb}} image to email 5 (demo,
// tool=tp4) in every industry, mirroring email 1's thumbnail pattern, and sync
// the embedded copies in _export.html. Idempotent: skips files already done.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const INDUSTRIES = ['architecture', 'engineering', 'consulting', 'creative', 'construction', 'civil'];

const THUMB_BLOCK = `    <!-- DEMO WALKTHROUGH THUMBNAIL: per-lead co-branded {{demo_thumb}} (product screen x firm logo) -->
    <tr><td class="sp-pad" align="center" style="padding:0 24px 6px 24px;line-height:0;font-size:0;">
      <a target="_blank" href="https://lp.workflowmax.com/app?tool=tp4&{{volcano_blob}}" style="text-decoration:none;display:inline-block;line-height:0;">
        <img src="{{demo_thumb}}" width="512" alt="Watch the walkthrough, prepared for {{companyName}}" style="width:100%;max-width:512px;height:auto;display:block;border-radius:10px;"></a>
    </td></tr>
    <tr><td class="sp-pad" align="center" style="padding:8px 24px 4px 24px;"><p style="color:#777777;font-size:13px;line-height:18px;margin:0;">&#9654;&nbsp; A 6-minute walkthrough for {{companyName}} &raquo; <a href="https://lp.workflowmax.com/app?tool=tp4&{{volcano_blob}}" style="color:{{brand_color}};font-weight:bold;">click to watch</a></p></td></tr>
`;
const CTA_ROW = '    <tr><td class="sp-pad" style="padding:0 24px;">';
const BUTTON_RE = /<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#46B347"[\s\S]*?<\/td><\/tr><\/table>\s*\n\s*/;

const esc = (s) => JSON.stringify(s).slice(1, -1);
let exp = fs.readFileSync(path.join(dir, '_export.html'), 'utf8');
let expChanged = 0;

for (const ind of INDUSTRIES) {
  const f = path.join(dir, ind, 'email-5-demo.html');
  const old = fs.readFileSync(f, 'utf8');
  if (old.includes('{{demo_thumb}}')) { console.log(`${ind}: already has demo_thumb, skipped`); continue; }
  if (!old.includes(CTA_ROW) || !BUTTON_RE.test(old)) { console.log(`${ind}: MARKERS NOT FOUND, skipped`); continue; }

  let next = old
    // the thumbnail replaces the green button (email-1 pattern: image + caption IS the CTA)
    .replace(BUTTON_RE, '')
    .replace(CTA_ROW, THUMB_BLOCK + CTA_ROW)
    .replace('margin:26px 0 0 0;">No live demo', 'margin:10px 0 0 0;">No live demo')
    // note the new merge var in the header comment
    .replace('Industry-tailored copy. Instantly tokens. Logo hosted on HubSpot CDN.',
      'Industry-tailored copy. Instantly tokens. Logo + {{demo_thumb}} (product screen x firm logo, per lead) hosted on HubSpot CDN.');

  fs.writeFileSync(f, next);
  console.log(`${ind}: file updated`);

  const oldEsc = esc(old), nextEsc = esc(next);
  if (exp.includes(oldEsc)) { exp = exp.replace(oldEsc, nextEsc); expChanged++; console.log(`${ind}: _export.html embedded copy synced`); }
  else console.log(`${ind}: WARNING - embedded copy not found verbatim in _export.html`);
}

fs.writeFileSync(path.join(dir, '_export.html'), exp);
console.log(`done. _export.html copies updated: ${expChanged}/6`);
