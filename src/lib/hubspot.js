// HubSpot Forms API integration for the WorkflowMAX content tools.
//
// HOW THIS WORKS (no backend, no database — HubSpot's CRM is the store):
// On results, we POST the prospect's email + their results to a single HubSpot
// form. HubSpot creates/updates the Contact, stamps the completion + result
// properties, and your scoring/routing workflows take it from there.
//
// ─── SETUP (Sina / Leo) ───
// 1. PORTAL_ID  — HubSpot → Settings → Account Management → Account Defaults →
//    "Hub ID" (the number top-right of the portal). Same for all tools.
// 2. FORM_GUID  — create ONE HubSpot form ("Content Tool Results") with the
//    fields listed in HUBSPOT-SETUP.md, publish it, then copy the GUID from the
//    form's share/embed URL (the long id after /forms/). Same form for all three
//    tools; the wfm_tool_used field tells them apart.
// Until both are filled, submissions are skipped and the caller falls back to
// the user's mail client, so the flow keeps working pre-integration.

const PORTAL_ID = "PORTAL_ID";   // TODO (Sina/Leo): e.g. "1234567"
const FORM_GUID = "FORM_GUID";   // TODO (Sina/Leo): e.g. "a1b2c3d4-...."

export const isHubSpotConfigured = () =>
  PORTAL_ID && FORM_GUID && PORTAL_ID !== "PORTAL_ID" && FORM_GUID !== "FORM_GUID";

/* Read a cookie by name (used for the HubSpot tracking cookie). */
const getCookie = (name) => {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
};

/* The HubSpot tracking cookie. When the HubSpot tracking script is on the page
   (it should be — these live on workflowmax.com), this ties the submission to
   the right Contact even before/without an email, and powers de-anonymisation
   of known, enriched contacts. */
export const getHutk = () => getCookie("hubspotutk");

/* Identity can ride in on the enriched campaign link, e.g.
   ?email=jane@firm.com.au (HubSpot personalisation token). Lets us record a
   completion with zero friction for known traffic. */
export const getEmailFromUrl = () => {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search);
  const raw = (q.get("email") || q.get("hs_email") || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : "";
};

/* Submit a results record to HubSpot.
   - email:  required (the Contact key)
   - fields: flat object of property name → value (empty values are dropped)
   Returns { ok, skipped }. `skipped: true` means HubSpot isn't configured yet,
   so the caller should use its mailto fallback. */
export async function submitResults({ email, fields = {}, pageName }) {
  if (!isHubSpotConfigured()) return { ok: false, skipped: true };
  if (!email) return { ok: false, skipped: false };

  const fieldArr = [{ name: "email", value: email }];
  Object.entries(fields).forEach(([name, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      fieldArr.push({ name, value: String(value) });
    }
  });

  const context = { pageUri: typeof window !== "undefined" ? window.location.href : "", pageName };
  const hutk = getHutk();
  if (hutk) context.hutk = hutk;

  try {
    const res = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_GUID}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: fieldArr, context }) }
    );
    return { ok: res.ok, skipped: false };
  } catch {
    return { ok: false, skipped: false };
  }
}
