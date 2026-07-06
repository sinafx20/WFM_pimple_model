// Shared social-proof block used on TP4 (Demo) and TP5 (Firms Like Yours).
// Two tiers: credibility stats, then the integration ecosystem. Product icons
// are vendored in src/assets/integrations (Wikimedia brand assets; Xero via
// logo.dev) so nothing is hotlinked at runtime.
import xeroIcon from "../../assets/integrations/xero.png";
import quickbooksIcon from "../../assets/integrations/quickbooks.png";
import hubspotIcon from "../../assets/integrations/hubspot.png";
import sharepointIcon from "../../assets/integrations/sharepoint.png";
import zapierIcon from "../../assets/integrations/zapier.png";
import gdriveIcon from "../../assets/integrations/google-drive.png";
import outlookIcon from "../../assets/integrations/outlook.png";
import gcalIcon from "../../assets/integrations/google-calendar.png";

const STATS = [
  { value: "100,000+", label: "professionals" },
  { value: "18 years", label: "in market" },
  { value: "4.2★", label: "on G2" },
  { value: "4.3★", label: "on Capterra" },
];

const INTEGRATIONS = [
  { name: "Xero", icons: [xeroIcon] },
  { name: "QuickBooks", icons: [quickbooksIcon] },
  { name: "HubSpot", icons: [hubspotIcon] },
  { name: "SharePoint", icons: [sharepointIcon] },
  { name: "Zapier", icons: [zapierIcon] },
  { name: "Google Drive", icons: [gdriveIcon] },
  { name: "Outlook & Google Calendar", icons: [outlookIcon, gcalIcon] },
  { name: "AI tools", icons: [] }, // sparkle drawn inline below
];

const AISparkle = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
    <path d="M13 2l2.2 6.4L21.5 11l-6.3 2.6L13 20l-2.2-6.4L4.5 11l6.3-2.6L13 2z" fill="#63DB94"/>
    <path d="M20.5 16l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1 1-2.8z" fill="#0A2F28"/>
  </svg>
);

const HEAD = "'Bruna', 'DM Sans', sans-serif";

export default function CredibilityStrip() {
  return (
    <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: "18px 16px" }}>
      {/* Stats */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center" }}>
        {STATS.map((s, i) => (
          <div key={i} style={{ flex: "1 1 calc(50% - 7px)", minWidth: 110, textAlign: "center" }}>
            <div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, color: "#0A2F28", lineHeight: 1.1, letterSpacing: "-0.01em" }}>{s.value}</div>
            <div style={{ fontSize: 12, color: "#6C737F", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: "#E5E7EB", margin: "16px 0" }} />

      {/* Integrations */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6C737F", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", marginBottom: 10 }}>
        Connects with the tools you already use
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 10px", justifyContent: "center" }}>
        {INTEGRATIONS.map((app) => (
          <div key={app.name} style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start",
            gap: 7, flex: "0 1 86px", minWidth: 74,
          }}>
            <div style={{ height: 26, display: "flex", alignItems: "center", gap: 6 }}>
              {app.icons.length
                ? app.icons.map((icon, i) => (
                    // Astro imports images as metadata objects ({src,...}), not URL strings
                    <img key={i} src={icon.src || icon} alt="" style={{ height: 26, width: "auto", maxWidth: 68, objectFit: "contain", display: "block" }} />
                  ))
                : <AISparkle />}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#384250", textAlign: "center", lineHeight: 1.3 }}>
              {app.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
