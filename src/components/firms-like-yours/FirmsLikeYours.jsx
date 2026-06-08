import { useState } from "react";
import CredibilityStrip from "../shared/CredibilityStrip.jsx";

/* ─── WFM Logo ─── */
const WFMLogo = () => (
  <svg width="134" height="40" viewBox="0 0 134 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0f)">
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
    <defs><clipPath id="clip0f"><rect width="134" height="40" fill="white"/></clipPath></defs>
  </svg>
);

/* ─── Verticals (filter + routing). Industry rides in on ?industry=. ─── */
const VERTICALS = [
  { id: "all", label: "All industries" },
  { id: "architecture", label: "Architecture & Design", icon: "📐" },
  { id: "engineering", label: "Engineering", icon: "⚙️" },
  { id: "consulting", label: "Consulting", icon: "💼" },
  { id: "construction", label: "Construction & Trades", icon: "🏗️" },
  { id: "civil", label: "Civil & Infrastructure", icon: "🔧" },
  { id: "creative", label: "Creative & Marketing", icon: "🎨" },
];

const detectCampaignVertical = () => {
  if (typeof window === "undefined") return null;
  const raw = (new URLSearchParams(window.location.search).get("industry") ||
    new URLSearchParams(window.location.search).get("vertical") || "").toLowerCase().trim();
  if (!raw) return null;
  const match = VERTICALS.find((v) => v.id !== "all" && (v.id === raw || v.label.toLowerCase() === raw || v.label.toLowerCase().includes(raw)));
  return match ? match.id : null;
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
const goTo = (url) => {
  if (typeof window !== "undefined" && url && url !== "#") window.open(url, "_blank", "noopener,noreferrer");
};

/* ─── TESTIMONIALS (Sina: replace [placeholders] + REPLACE_VIDEO_ID with the
   real footage). Outcomes are intentionally QUALITATIVE — the videos carry the
   specifics, so there are no unverifiable numbers on the page. We have 5 videos
   across architecture / engineering / consulting / creative; construction and
   civil don't have one yet (they fall back gracefully). ─── */
const TESTIMONIALS = [
  {
    id: 1, vertical: "architecture", featured: true,
    firmName: "[Architecture Firm Name]", descriptor: "Large multi-disciplinary practice", location: "[City, State]",
    quote: "We went from chasing timesheets every Friday to seeing exactly where every job stands in real time. It changed how we run the practice.",
    quoteName: "[Director Name]", quoteTitle: "Managing Director",
    tags: ["Live job profitability", "One source of truth", "Faster fee proposals"],
    youtubeId: "REPLACE_VIDEO_ID_ARCH",
  },
  {
    id: 2, vertical: "engineering",
    firmName: "[Engineering Firm Name]", descriptor: "Multi-disciplinary consultancy", location: "[City, State]",
    quote: "One system from proposal through to invoice means we're not re-entering data three times. Our finance team got their week back.",
    quoteName: "[Director Name]", quoteTitle: "Finance Director",
    tags: ["Real-time cost visibility", "Field-to-finance connected", "No double entry"],
    youtubeId: "REPLACE_VIDEO_ID_ENG",
  },
  {
    id: 3, vertical: "consulting",
    firmName: "[Consulting Firm Name]", descriptor: "Advisory & professional services firm", location: "[City, State]",
    quote: "We can finally see engagement profitability while the work is happening, not months later. That changed how we price and staff.",
    quoteName: "[Partner Name]", quoteTitle: "Managing Partner",
    tags: ["Engagement margin clarity", "Variations captured", "Faster billing"],
    youtubeId: "REPLACE_VIDEO_ID_CONS",
  },
  {
    id: 4, vertical: "creative",
    firmName: "[Creative Agency Name]", descriptor: "Independent creative agency", location: "[City, State]",
    quote: "We used to absorb revision rounds because tracking them was painful. Now the system does it, and we invoice for the work we actually do.",
    quoteName: "[Director Name]", quoteTitle: "Creative Director",
    tags: ["Scope creep under control", "Live utilisation", "Invoicing in days, not weeks"],
    youtubeId: "REPLACE_VIDEO_ID_CRE",
  },
  {
    id: 5, vertical: "architecture", // 5th video — reassign vertical to match your real footage
    firmName: "[Architecture Firm Name]", descriptor: "Growing design studio", location: "[City, State]",
    quote: "The reporting we get now would have taken our team days to pull together by hand. It's just there when we need it.",
    quoteName: "[Director Name]", quoteTitle: "Associate Director",
    tags: ["Reporting on tap", "Capacity at a glance", "Connected to Xero"],
    youtubeId: "REPLACE_VIDEO_ID_5",
  },
];

const verticalMeta = (id) => VERTICALS.find((v) => v.id === id);

/* ─── Video embed with thumbnail ─── */
function VideoEmbed({ youtubeId, label = "Watch their story" }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div style={{
      position: "relative", width: "100%", paddingBottom: "56.25%",
      borderRadius: 10, overflow: "hidden", background: "#0A2F28",
      cursor: playing ? "default" : "pointer",
    }}
      onClick={() => !playing && setPlaying(true)}
    >
      {!playing ? (
        <>
          <img
            src={`https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`}
            alt="Customer testimonial"
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { e.target.src = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`; }}
          />
          <div style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(10, 47, 40, 0.35)",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", background: "#63DB94",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
            }}>
              <svg width="22" height="26" viewBox="0 0 28 32" fill="none">
                <path d="M28 16L0 32V0L28 16Z" fill="#0A2F28"/>
              </svg>
            </div>
          </div>
          <div style={{
            position: "absolute", bottom: 10, left: 10,
            padding: "4px 10px", background: "rgba(10, 47, 40, 0.8)", borderRadius: 6,
            fontSize: 11, fontWeight: 600, color: "#fff",
          }}>
            {label}
          </div>
        </>
      ) : (
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1&autoplay=1`}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </div>
  );
}

/* ─── Qualitative outcome tag ─── */
function Tag({ children }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 10px", background: "#f6fef9", border: "1px solid #73e2a330",
      borderRadius: 100, fontSize: 11, fontWeight: 600, color: "#087443",
    }}>
      <span style={{ color: "#0D8D5C" }}>✓</span>{children}
    </span>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function FirmsLikeYours() {
  const campaignVertical = detectCampaignVertical();
  const routeV = campaignVertical || "architecture";        // CTA routing fallback
  const routeLabel = verticalMeta(campaignVertical)?.label || "firms like yours";
  const heroAudience = campaignVertical ? `${verticalMeta(campaignVertical).label} firms` : "firms like yours";

  // Feature the visitor's vertical if we have a video for it; otherwise the
  // architecture flagship (a large, recognisable practice).
  const featured = TESTIMONIALS.find((t) => t.vertical === campaignVertical) ||
    TESTIMONIALS.find((t) => t.featured) || TESTIMONIALS[0];
  const others = TESTIMONIALS.filter((t) => t.id !== featured.id);

  const [activeFilter, setActiveFilter] = useState("all");
  const filteredOthers = activeFilter === "all" ? others : others.filter((t) => t.vertical === activeFilter);

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

  return (
    <div className="fly" style={{
      fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto",
      minHeight: "100vh", background: "#fff",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        .fly h1, .fly h2, .fly h3, .fly h4 { font-family: 'Bruna', 'DM Sans', sans-serif; letter-spacing: -0.01em; }
        @media (min-width: 768px) {
          body { margin: 0; background: #EDF0EE; }
          .fly { max-width: 680px !important; box-shadow: 0 0 50px rgba(10,47,40,0.08); border-left: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB; }
          .fly-gallery { display: grid !important; grid-template-columns: repeat(2, 1fr); overflow: visible !important; }
          .fly-card { flex: initial !important; width: auto !important; }
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
            <span style={{ fontSize: 12 }}>⭐</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#087443" }}>Customer stories</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0A2F28", lineHeight: 1.2, margin: "0 0 10px" }}>
            {campaignVertical ? `${verticalMeta(campaignVertical).label} firms,` : "Firms like yours,"}<br/>in their own words
          </h1>
          <p style={{ fontSize: 15, color: "#384250", lineHeight: 1.6, margin: 0 }}>
            Short video stories from WorkflowMAX customers across professional services — what actually changed when they moved to one connected system.
          </p>
        </div>

        {/* Featured story */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6C737F", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
            Featured story
          </div>
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 16px 0" }}>
              <VideoEmbed youtubeId={featured.youtubeId} />
            </div>
            <div style={{ padding: "14px 18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span style={{ padding: "4px 10px", background: "#F1F1F1", borderRadius: 100, fontSize: 11, fontWeight: 600, color: "#384250" }}>
                  {verticalMeta(featured.vertical)?.icon} {verticalMeta(featured.vertical)?.label}
                </span>
                <span style={{ fontSize: 12, color: "#6C737F", fontWeight: 500 }}>{featured.descriptor}</span>
              </div>
              <div style={{ borderLeft: "3px solid #63DB94", paddingLeft: 16, marginBottom: 14 }}>
                <p style={{ fontSize: 15, color: "#0A2F28", margin: "0 0 8px", lineHeight: 1.5, fontStyle: "italic", fontWeight: 500 }}>
                  "{featured.quote}"
                </p>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0A2F28" }}>{featured.quoteName}</div>
                <div style={{ fontSize: 12, color: "#6C737F" }}>{featured.quoteTitle}, {featured.firmName}</div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {featured.tags.map((t, i) => <Tag key={i}>{t}</Tag>)}
              </div>
            </div>
          </div>
        </div>

        {/* Credibility strip */}
        <div style={{ marginBottom: 28 }}>
          <CredibilityStrip />
        </div>

        {/* More stories */}
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0A2F28", margin: "0 0 12px" }}>More stories</h2>

        {/* Filter pills */}
        <div style={{
          display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16,
          WebkitOverflowScrolling: "touch", msOverflowStyle: "none", scrollbarWidth: "none",
        }}>
          {VERTICALS.map((v) => (
            <button key={v.id} onClick={() => setActiveFilter(v.id)}
              style={{
                padding: "8px 14px", borderRadius: 100, border: "1px solid",
                borderColor: activeFilter === v.id ? "#0A2F28" : "#E5E7EB",
                background: activeFilter === v.id ? "#0A2F28" : "#fff",
                color: activeFilter === v.id ? "#fff" : "#384250",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                whiteSpace: "nowrap", transition: "all 0.2s", flexShrink: 0,
              }}>
              {v.icon && <span style={{ marginRight: 4 }}>{v.icon}</span>}{v.label}
            </button>
          ))}
        </div>

        {/* Story cards — horizontal scroll keeps it compact */}
        {filteredOthers.length > 0 ? (
          <div className="fly-gallery" style={{
            display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, marginBottom: 28,
            WebkitOverflowScrolling: "touch", msOverflowStyle: "none", scrollbarWidth: "none",
          }}>
            {filteredOthers.map((t) => (
              <div key={t.id} className="fly-card" style={{
                flex: "0 0 260px", width: 260, background: "#fff",
                border: "1px solid #E5E7EB", borderRadius: 14, overflow: "hidden",
              }}>
                <div style={{ padding: "12px 12px 0" }}>
                  <VideoEmbed youtubeId={t.youtubeId} />
                </div>
                <div style={{ padding: "10px 14px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{verticalMeta(t.vertical)?.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#6C737F" }}>{verticalMeta(t.vertical)?.label}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#384250", margin: "0 0 10px", lineHeight: 1.45, fontStyle: "italic" }}>
                    "{t.quote.length > 110 ? t.quote.slice(0, 110).trim() + "…" : t.quote}"
                  </p>
                  <Tag>{t.tags[0]}</Tag>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14,
            padding: "20px 16px", marginBottom: 28, textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: "#384250", margin: "0 0 4px", fontWeight: 600 }}>
              {verticalMeta(activeFilter)?.label} stories are in production
            </p>
            <p style={{ fontSize: 13, color: "#6C737F", margin: 0, lineHeight: 1.5 }}>
              In the meantime, the stories above are from firms running the same connected job-to-invoice workflow.
            </p>
          </div>
        )}

        {/* Final CTA */}
        <div style={{
          background: "#0A2F28", borderRadius: 16, padding: "24px 20px",
          textAlign: "center", marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
            See it on your own jobs
          </h3>
          <p style={{ fontSize: 14, color: "#9DA4AE", margin: "0 0 16px", lineHeight: 1.55 }}>
            Start a free trial, book a 20-minute walkthrough, or see how WorkflowMAX fits {routeLabel}.
          </p>
          <button onClick={() => goTo(FREE_TRIAL_URL)} style={trialBtn}
            onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
            Start your free trial →
          </button>
          <button onClick={() => goTo(BOOKING_URLS[routeV])} style={outlineGreen}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#63DB9410"; e.currentTarget.style.borderColor = "#63DB94"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#63DB9450"; }}>
            Book a walkthrough
          </button>
          <button onClick={() => goTo(SOLUTION_URLS[routeV])} style={outlineGreen}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#63DB9410"; e.currentTarget.style.borderColor = "#63DB94"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "#63DB9450"; }}>
            Or see WorkflowMAX for {routeLabel} →
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
