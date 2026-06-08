// Shared social-proof block used on TP4 (Demo) and TP5 (Firms Like Yours).
// Two tiers: credibility stats, then the integration ecosystem. Integrations
// are text chips for now — swap to real logos later when brand assets are ready.

const STATS = [
  { value: "100,000+", label: "professionals" },
  { value: "18 years", label: "in market" },
  { value: "4.2★", label: "on G2" },
  { value: "4.3★", label: "on Capterra" },
];

const INTEGRATIONS = [
  "Xero", "QuickBooks", "HubSpot", "SharePoint",
  "Zapier", "Google Drive", "Outlook & Google Calendar", "AI tools",
];

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
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {INTEGRATIONS.map((name) => (
          <span key={name} style={{ padding: "6px 12px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 100, fontSize: 12, fontWeight: 600, color: "#384250" }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
