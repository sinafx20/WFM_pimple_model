import CredibilityStrip from "../shared/CredibilityStrip.jsx";

/* ─── WFM Logo ─── */
const WFMLogo = () => (
  <svg width="134" height="40" viewBox="0 0 134 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0r)">
      <path d="M13.845 14.0233L12.563 19.2264C12.4393 19.7471 12.3414 20.2456 12.2601 20.7053C12.164 20.2326 12.0421 19.7194 11.8925 19.1858L10.4867 14.0233H7.15617L5.82432 19.1968C5.69132 19.7323 5.58233 20.2474 5.49367 20.7256C5.40315 20.2567 5.29047 19.7489 5.15377 19.2171L3.79791 14.0233H0L3.31024 25.9638H7.33905L8.52497 21.2703C8.62472 20.866 8.70969 20.4745 8.78174 20.1089C8.85747 20.4727 8.94614 20.8604 9.05328 21.2574L10.3648 25.962H14.4139L17.569 14.0214H13.845V14.0233Z" fill="#0A2F28"/>
      <path d="M23.1717 13.7592C19.6121 13.7592 17.4878 16.0727 17.4878 19.9464C17.4878 23.8201 19.6657 26.2537 23.1717 26.2537C26.6778 26.2537 28.8557 23.8368 28.8557 19.9464C28.8557 16.0561 26.7313 13.7592 23.1717 13.7592ZM25.2148 19.9704C25.2148 22.8249 24.123 23.1924 23.1717 23.1924C22.2204 23.1924 21.1527 22.8249 21.1527 19.9704C21.1527 17.1159 22.2315 16.8925 23.1717 16.8925C24.112 16.8925 25.2148 17.2415 25.2148 19.9704Z" fill="#0A2F28"/>
      <path d="M33.3814 15.7533L33.1893 14.0251H29.929V25.9657H33.6179V20.2844C33.6179 18.3346 34.922 17.6403 36.143 17.6403C36.542 17.6403 36.845 17.6773 37.1923 17.7714L37.6633 17.897L38.0365 13.8072L37.6079 13.7851C35.6277 13.6817 34.2108 14.3427 33.3814 15.7533Z" fill="#0A2F28"/>
      <path d="M50.1302 14.0233H45.7042L42.6175 18.1869V9.06573H38.9268V25.9657H42.6175V21.2482H42.6674L46.0368 25.9657H50.4646L45.732 19.616L50.1302 14.0233Z" fill="#0A2F28"/>
      <path d="M62.8559 22.8545C62.54 22.8545 62.2832 22.596 62.2832 22.2803V9.0122L61.9193 9.05651C60.6078 9.21899 59.2815 9.15991 57.9773 8.95311C57.6337 8.89772 57.2791 8.87372 56.8874 8.87372C53.9171 8.87372 52.1419 10.6112 52.1419 13.5211V14.0233H50.5034V17.0846H52.1419V25.9638H55.8308V17.0846H57.4546V14.0233H55.8308V13.425C55.8308 12.3929 56.2668 11.9129 57.1996 11.9129C57.7002 11.9129 58.1306 12.0218 58.5684 12.2637V23.0742C58.5684 24.9908 59.843 26.1817 61.8934 26.1817C62.4439 26.1817 62.9981 26.0949 63.6908 25.9029L63.9753 25.8217L64.1452 22.4446L63.5301 22.7234C63.3287 22.8157 63.1219 22.8545 62.8559 22.8545Z" fill="#0A2F28"/>
      <path d="M70.3426 13.7592C66.783 13.7592 64.6587 16.0727 64.6587 19.9464C64.6587 23.8201 66.8366 26.2537 70.3426 26.2537C73.8487 26.2537 76.0266 23.8368 76.0266 19.9464C76.0266 16.0561 73.9022 13.7592 70.3426 13.7592ZM72.3875 19.9704C72.3875 22.8249 71.2939 23.1924 70.3445 23.1924C69.395 23.1924 68.3236 22.8249 68.3236 19.9704C68.3236 17.1159 69.4024 16.8925 70.3445 16.8925C71.2866 16.8925 72.3875 17.2415 72.3875 19.9704Z" fill="#0A2F28"/>
      <path d="M89.7035 14.0233L88.4215 19.2264C88.2996 19.7471 88.1999 20.2474 88.1204 20.7072C88.0225 20.2326 87.9006 19.7194 87.7528 19.1858L86.3471 14.0233H83.0165L81.6847 19.1968C81.5517 19.7323 81.4427 20.2474 81.354 20.7256C81.2635 20.2567 81.1508 19.7489 81.0141 19.2171L79.6583 14.0233H75.8604L79.1706 25.9638H83.1994L84.3853 21.2703C84.4851 20.866 84.57 20.4745 84.6421 20.1089C84.7178 20.4727 84.8065 20.8604 84.9136 21.2574L86.2252 25.962H90.2743L93.4294 14.0214H89.7072L89.7035 14.0233Z" fill="#0A2F28"/>
      <path d="M133.999 20C133.999 21.3626 133.865 22.7013 133.606 23.979C133.471 24.6658 133.299 25.3287 133.091 25.9786C130.549 34.1063 122.958 40 113.99 40C105.022 40 97.4316 34.1063 94.8898 25.9786C94.3005 24.1008 93.981 22.0864 93.981 20C93.981 17.9136 94.3005 15.8992 94.8898 14.0214C97.4316 5.89365 105.024 0 113.99 0C122.957 0 130.549 5.89365 133.091 14.0214C133.288 14.6473 133.458 15.3102 133.593 15.973C133.865 17.2729 133.999 18.6115 133.999 20Z" fill="#63DB94"/>
      <path d="M103.581 14.0086L100.313 19.0326L97.0326 14.0086H94.8825C94.2914 15.8882 93.9736 17.9026 93.9736 19.989C93.9736 22.0754 94.2932 24.0916 94.8825 25.9713H97.548V21.9166L99.9568 25.9713H100.657L103.066 21.9166V25.9713H107.427V14.0067H103.581V14.0086Z" fill="#0A2F28"/>
      <path d="M117.567 14.0085H110.992L108.018 25.9712H112.738L112.984 24.5975H115.958L116.279 25.9712H120.777L117.57 14.0085H117.567ZM113.597 21.1319L114.199 17.6182H114.347L115.145 21.1319H113.597Z" fill="#0A2F28"/>
      <path d="M131.257 19.9779L133.604 15.962C133.47 15.2992 133.298 14.6345 133.1 14.0085H129.781L128.222 16.8704L126.722 14.0085H121.339L124.841 19.989L121.278 25.9712H126.622L127.9 23.4029L129.265 25.9712H133.1C133.309 25.3195 133.481 24.6566 133.615 23.9679L131.257 19.976V19.9779Z" fill="#0A2F28"/>
    </g>
    <defs><clipPath id="clip0r"><rect width="134" height="40" fill="white"/></clipPath></defs>
  </svg>
);

/* ─── Verticals (personalisation + CTA routing). Industry rides in on ?industry= ─── */
const VERTICALS = [
  { id: "architecture", label: "Architecture & Design" },
  { id: "engineering", label: "Engineering Consultancy" },
  { id: "consulting", label: "Management & Business Consulting" },
  { id: "construction", label: "Construction & Trades" },
  { id: "civil", label: "Civil & Infrastructure" },
  { id: "creative", label: "Creative & Marketing" },
];

const detectVertical = () => {
  if (typeof window === "undefined") return VERTICALS[0];
  const raw = (new URLSearchParams(window.location.search).get("industry") ||
    new URLSearchParams(window.location.search).get("vertical") || "").toLowerCase().trim();
  if (!raw) return VERTICALS[0];
  return VERTICALS.find((v) => v.id === raw || v.label.toLowerCase() === raw || v.label.toLowerCase().includes(raw)) || VERTICALS[0];
};

/* Soft, tailored destination (pixel these for retargeting); booking routes by
   vertical — Sina: architecture/construction/consulting · Denzel: civil/
   engineering/creative. Civil falls back to building-and-construction. */
const SOLUTION_URLS = {
  architecture: "https://workflowmax.com/architects",
  engineering: "https://workflowmax.com/engineers",
  consulting: "https://workflowmax.com/business-consultants",
  construction: "https://workflowmax.com/building-and-construction",
  civil: "https://workflowmax.com/building-and-construction",
  creative: "https://workflowmax.com/creative-agencies",
};
const BOOKING_URLS = {
  architecture: "https://meetings.hubspot.com/szarei",
  construction: "https://meetings.hubspot.com/szarei",
  consulting: "https://meetings.hubspot.com/szarei",
  civil: "https://meetings.hubspot.com/denzel-kereama",
  engineering: "https://meetings.hubspot.com/denzel-kereama",
  creative: "https://meetings.hubspot.com/denzel-kereama",
};
const FREE_TRIAL_URL = "https://app.workflowmax.com/register/sign_up";

/* The other touchpoints' live pages. TODO (Leo): set each to its
   workflowmax.com/... URL once published. "#" is a safe no-op until then.
   Append ?industry= so the linked tool stays personalised to this prospect. */
const TOOL_URLS = {
  healthCheck: "#",
  calculator: "#",
  benchmark: "#",
  walkthrough: "#",
  stories: "#",
};

const goTo = (url) => {
  if (typeof window !== "undefined" && url && url !== "#") window.open(url, "_blank", "noopener,noreferrer");
};

/* Carry the current ?industry= through to the linked tool so personalisation
   persists across the journey. */
const withIndustry = (url, industryId) => {
  if (!url || url === "#") return url;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://workflowmax.com");
    if (industryId) u.searchParams.set("industry", industryId);
    return u.toString();
  } catch {
    return url;
  }
};

const RESOURCES = [
  {
    group: "Diagnose your firm",
    items: [
      { key: "healthCheck", icon: "🩺", title: "Workflow Health Check", desc: "Benchmark how your firm runs jobs, quote to invoice — about 2 minutes.", urlKey: "healthCheck" },
      { key: "calculator", icon: "🔍", title: "Profit Leak Calculator", desc: "Put a dollar figure on the gaps in your current workflow.", urlKey: "calculator" },
      { key: "benchmark", icon: "📊", title: "Firm Benchmark", desc: "See how you compare to the industry average and top performers.", urlKey: "benchmark" },
    ],
  },
  {
    group: "See it in action",
    items: [
      { key: "walkthrough", icon: "▶", title: "Product Walkthrough", desc: "A short tour of the full job lifecycle inside WorkflowMAX.", urlKey: "walkthrough" },
      { key: "stories", icon: "⭐", title: "Firms Like Yours", desc: "Video stories from customers across professional services.", urlKey: "stories" },
    ],
  },
];

/* ─── MAIN COMPONENT ─── */
export default function ResourceHub() {
  const v = detectVertical();
  const industryId = typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("industry") || new URLSearchParams(window.location.search).get("vertical") || "")
    : "";

  const trialBtn = {
    padding: "14px 28px", background: "#63DB94", color: "#0A2F28", border: "none",
    borderRadius: 100, fontSize: 16, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", transition: "background 0.2s", display: "block", width: "100%",
  };
  const outlineGreen = {
    padding: "13px 28px", marginTop: 10, background: "transparent", color: "#63DB94",
    border: "1px solid #63DB9450", borderRadius: 100, fontSize: 15, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", display: "block", width: "100%",
  };

  const ResourceRow = ({ item }) => (
    <button
      onClick={() => goTo(withIndustry(TOOL_URLS[item.urlKey], industryId))}
      style={{
        display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
        padding: "14px 16px", background: "#fff", border: "1px solid #E5E7EB",
        borderRadius: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0D8D5C"; e.currentTarget.style.background = "#f0fdf4"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#fff"; }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: "#0A2F28", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
      }}>{item.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0A2F28" }}>{item.title}</div>
        <div style={{ fontSize: 13, color: "#6C737F", lineHeight: 1.45, marginTop: 2 }}>{item.desc}</div>
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#0D8D5C", flexShrink: 0 }}>Open →</span>
    </button>
  );

  return (
    <div className="rh" style={{
      fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto",
      minHeight: "100vh", background: "#fff",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        .rh h1, .rh h2, .rh h3, .rh h4 { font-family: 'Bruna', 'DM Sans', sans-serif; letter-spacing: -0.01em; }
        @media (min-width: 768px) {
          body { margin: 0; background: #EDF0EE; }
          .rh { max-width: 680px !important; box-shadow: 0 0 50px rgba(10,47,40,0.08); border-left: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB; }
          .rh-rows { display: grid !important; grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "1px solid #E5E7EB", background: "#fff", position: "sticky", top: 0, zIndex: 10,
      }}>
        <WFMLogo />
      </div>

      <div style={{ padding: "28px 24px 48px" }}>

        {/* Hero */}
        <div style={{ marginBottom: 22 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", background: "#f6fef9", border: "1px solid #73e2a330",
            borderRadius: 100, marginBottom: 14,
          }}>
            <span style={{ fontSize: 12 }}>📦</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#087443" }}>Your toolkit</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0A2F28", lineHeight: 1.2, margin: "0 0 10px" }}>
            Everything in one place
          </h1>
          <p style={{ fontSize: 15, color: "#384250", lineHeight: 1.6, margin: 0 }}>
            Over this series you've explored how {v.label.toLowerCase()} firms find and fix profit leaks. Here's the full set — revisit anything, any time.
          </p>
        </div>

        {/* Start-here nudge */}
        <button
          onClick={() => goTo(withIndustry(TOOL_URLS.healthCheck, industryId))}
          style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
            padding: "12px 14px", marginBottom: 24, background: "#fff8e4",
            border: "1px solid #ECD99740", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <span style={{ fontSize: 16 }}>👉</span>
          <span style={{ flex: 1, fontSize: 13, color: "#713b12", fontWeight: 600 }}>
            New here? Start with the 2-minute Workflow Health Check
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#85490e" }}>→</span>
        </button>

        {/* Resource groups */}
        {RESOURCES.map((grp) => (
          <div key={grp.group} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6C737F", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
              {grp.group}
            </div>
            <div className="rh-rows" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {grp.items.map((item) => <ResourceRow key={item.key} item={item} />)}
            </div>
          </div>
        ))}

        {/* Credibility strip */}
        <div style={{ marginBottom: 28 }}>
          <CredibilityStrip />
        </div>

        {/* Final CTA */}
        <div style={{
          background: "#0A2F28", borderRadius: 16, padding: "24px 20px",
          textAlign: "center", marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
            Ready to act on what you've found?
          </h3>
          <p style={{ fontSize: 14, color: "#9DA4AE", margin: "0 0 16px", lineHeight: 1.55 }}>
            Start a free trial, book a 20-minute walkthrough, or see how WorkflowMAX fits {v.label.toLowerCase()} firms.
          </p>
          <button onClick={() => goTo(FREE_TRIAL_URL)} style={trialBtn}
            onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
            Start your free trial →
          </button>
          <button onClick={() => goTo(BOOKING_URLS[v.id])} style={outlineGreen}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#63DB9410"; e.currentTarget.style.borderColor = "#63DB94"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#63DB9450"; }}>
            Book a walkthrough
          </button>
          <button onClick={() => goTo(SOLUTION_URLS[v.id])} style={outlineGreen}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#63DB9410"; e.currentTarget.style.borderColor = "#63DB94"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#63DB9450"; }}>
            Or explore WorkflowMAX for {v.label} →
          </button>
        </div>

        {/* Footer */}
        <div style={{ paddingTop: 20, borderTop: "1px solid #E5E7EB", textAlign: "center" }}>
          <WFMLogo />
          <p style={{ fontSize: 12, color: "#9DA4AE", marginTop: 8 }}>© 2026 WorkflowMAX. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
