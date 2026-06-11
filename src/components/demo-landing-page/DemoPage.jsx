import { useState } from "react";
import CredibilityStrip from "../shared/CredibilityStrip.jsx";

/* ─── WFM Logo ─── */
const WFMLogo = () => (
  <svg width="134" height="40" viewBox="0 0 134 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#clip0d)">
      <path d="M13.845 14.023L12.563 19.226c-.124.521-.222 1.02-.303 1.48-.096-.473-.218-.986-.368-1.52L10.487 14.023H7.156L5.824 19.197c-.133.536-.242 1.05-.331 1.529-.09-.469-.202-.977-.339-1.509L3.798 14.023H0l3.31 11.94h4.029l1.186-4.693c.1-.405.185-.796.257-1.162.076.364.165.751.272 1.149l1.312 4.704h4.049l3.155-11.94h-3.724v.002z" fill="#0A2F28"/>
      <path d="M23.1717 13.7592C19.6121 13.7592 17.4878 16.0727 17.4878 19.9464C17.4878 23.8201 19.6657 26.2537 23.1717 26.2537C26.6778 26.2537 28.8557 23.8368 28.8557 19.9464C28.8557 16.0561 26.7313 13.7592 23.1717 13.7592ZM25.2148 19.9704C25.2148 22.8249 24.123 23.1924 23.1717 23.1924C22.2204 23.1924 21.1527 22.8249 21.1527 19.9704C21.1527 17.1159 22.2315 16.8925 23.1717 16.8925C24.112 16.8925 25.2148 17.2415 25.2148 19.9704Z" fill="#0A2F28"/>
      <path d="M33.381 15.753l-.192-1.728h-3.26v11.94h3.689v-5.681c0-1.95 1.304-2.644 2.525-2.644.399 0 .702.037 1.05.131l.47.126.374-4.09-.429-.022c-1.98-.103-3.397.558-4.227 1.968z" fill="#0A2F28"/>
      <path d="M50.13 14.023h-4.426l-3.087 4.164V9.066h-3.69v16.9h3.69v-4.718h.05l3.37 4.718h4.427l-4.732-6.35 4.398-5.593z" fill="#0A2F28"/>
      <path d="M62.856 22.855c-.316 0-.573-.259-.573-.574V9.012l-.364.044c-1.311.163-2.638.1-3.942-.106a5.94 5.94 0 00-.69-.08c-2.97 0-4.746 1.738-4.746 4.648v.502h-1.638v3.061h1.638v8.879h3.689v-8.879h1.624v-3.061h-1.624v-.599c0-1.032.436-1.512 1.369-1.512.5 0 .93.109 1.369.35v10.815c0 1.917 1.274 3.108 3.325 3.108.55 0 1.104-.087 1.797-.279l.285-.081.17-3.377-.616.279c-.2.092-.407.131-.673.131z" fill="#0A2F28"/>
      <path d="M70.343 13.76c-3.56 0-5.684 2.313-5.684 6.187s2.178 6.307 5.684 6.307 5.684-2.417 5.684-6.307-2.124-6.187-5.684-6.187zm2.045 6.21c0 2.855-1.094 3.222-2.045 3.222-.95 0-2.02-.367-2.02-3.222s1.079-3.078 2.02-3.078 2.045.349 2.045 3.078z" fill="#0A2F28"/>
      <path d="M89.704 14.023l-1.283 5.203c-.121.521-.221 1.02-.3 1.48-.098-.473-.22-.986-.37-1.52l-1.405-5.163h-3.331l-1.332 5.173c-.133.536-.242 1.051-.33 1.529-.09-.469-.203-.977-.34-1.509l-1.355-5.193h-3.798l3.31 11.94h4.03l1.185-4.693c.1-.405.185-.796.257-1.162.076.364.165.751.272 1.149l1.311 4.704h4.05l3.154-11.94h-3.722l-.003.002z" fill="#0A2F28"/>
      <path d="M134 20c0 1.363-.134 2.701-.393 3.979a19.85 19.85 0 01-.516 2l-.001-.001C130.549 34.106 122.958 40 113.99 40S97.432 34.106 94.89 25.979a19.963 19.963 0 01-1.091-5.979c0-2.086.32-4.1.91-5.979C97.431 5.894 105.024 0 113.99 0s16.559 5.894 19.101 14.021c.197.626.367 1.289.502 1.952A20.135 20.135 0 01134 20z" fill="#63DB94"/>
      <path d="M103.581 14.009l-3.268 5.024-3.28-5.024h-2.15c-.592 1.88-.909 3.894-.909 5.98 0 2.087.32 4.103.91 5.983h2.664v-4.055l2.41 4.055h.7l2.409-4.055v4.055h4.36V14.007h-3.846v.002z" fill="#0A2F28"/>
      <path d="M117.567 14.009h-6.575l-2.974 11.963h4.72l.246-1.374h2.974l.32 1.374h4.499l-3.207-11.963h-.003zm-3.97 7.123l.602-3.514h.148l.798 3.514h-1.548z" fill="#0A2F28"/>
      <path d="M131.257 19.978l2.347-4.016a19.35 19.35 0 00-.504-1.953h-3.319l-1.559 2.862-1.5-2.862h-5.383l3.502 5.98-3.563 5.983h5.344l1.278-2.569 1.365 2.569h3.835c.21-.652.381-1.315.515-2.003l-2.358-3.992v-.001z" fill="#0A2F28"/>
    </g>
    <defs><clipPath id="clip0d"><rect width="134" height="40" fill="white"/></clipPath></defs>
  </svg>
);

/* ─── Checkmark icon ─── */
const Check = () => (
  <div style={{
    width: 22, height: 22, borderRadius: "50%", background: "#63DB94",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  }}>
    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
      <path d="M1 5L4.5 8.5L11 1.5" stroke="#0A2F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
);

/* ─── Video placeholder YouTube ID ─── */
// Replace this with your actual YouTube video ID
const YOUTUBE_VIDEO_ID = "X7RX3Bzz0sk";

const WALKTHROUGH_POINTS = [
  {
    title: "Quote to job to invoice in one flow",
    desc: "See how a fee proposal becomes a live job, tracks time and costs as work progresses, and flows straight into an invoice without re-entry or switching tools.",
  },
  {
    title: "Real-time job profitability dashboards",
    desc: "Watch how project managers and leadership get a live view of budget vs actual across every active job, with drill-down into time, costs, and margins.",
  },
  {
    title: "Capacity planning and staff utilisation",
    desc: "See how firms plan resourcing across teams, spot availability gaps, and balance workload before it becomes a problem.",
  },
];

/* Verticals (id + label) for personalisation + CTA routing. Industry rides in
   on the enriched campaign link (?industry=…); falls back to the first. */
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
const goTo = (url) => {
  if (typeof window !== "undefined" && url && url !== "#") window.open(url, "_blank", "noopener,noreferrer");
};

export default function DemoLandingPage() {
  const [playing, setPlaying] = useState(false);
  const v = detectVertical();

  return (
    <div className="dlp wfm-card" style={{
      fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto",
      minHeight: "100vh", background: "#fff",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        .dlp h1, .dlp h2, .dlp h3, .dlp h4 { font-family: 'Bruna', 'DM Sans', sans-serif; letter-spacing: -0.01em; }
        @media (min-width: 768px) { body { margin: 0; } .dlp { max-width: 1040px !important; } .dlp-inner { max-width: 900px; margin: 0 auto; } }
      `}</style>

      {/* Header */}
      <div style={{
        padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: "1px solid #E5E7EB", background: "#fff", position: "sticky", top: 0, zIndex: 10,
      }}>
        <WFMLogo />
      </div>

      <div className="dlp-inner" style={{ padding: "24px 24px 48px" }}>

        {/* Hero section */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 14px", background: "#f6fef9", border: "1px solid #73e2a330",
            borderRadius: 100, marginBottom: 16,
          }}>
            <span style={{ fontSize: 12 }}>▶</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#087443" }}>12-minute walkthrough</span>
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 800, color: "#0A2F28", lineHeight: 1.25,
            margin: "0 0 10px",
          }}>
            See WorkflowMAX in action
          </h1>
          <p style={{
            fontSize: 15, color: "#384250", lineHeight: 1.6, margin: 0,
          }}>
            A quick walkthrough of how {v.label} firms manage the full job lifecycle, from quoting through to invoicing, in one connected platform.
          </p>
        </div>

        {/* Video embed with thumbnail cover */}
        <div style={{
          position: "relative", width: "100%", paddingBottom: "56.25%",
          borderRadius: 14, overflow: "hidden", marginBottom: 24,
          background: "#0A2F28", boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          cursor: playing ? "default" : "pointer",
        }}
          onClick={() => !playing && setPlaying(true)}
        >
          {!playing ? (
            <>
              <img
                src={`https://img.youtube.com/vi/${YOUTUBE_VIDEO_ID}/maxresdefault.jpg`}
                alt="WorkflowMAX Product Walkthrough"
                style={{
                  position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                  objectFit: "cover",
                }}
              />
              {/* Play button overlay */}
              <div style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(10, 47, 40, 0.3)",
                transition: "background 0.2s",
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: "#63DB94", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
                  transition: "transform 0.2s",
                }}>
                  <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
                    <path d="M28 16L0 32V0L28 16Z" fill="#0A2F28"/>
                  </svg>
                </div>
              </div>
            </>
          ) : (
            <iframe
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1&autoplay=1`}
              style={{
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                border: "none",
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="WorkflowMAX Product Walkthrough"
            />
          )}
        </div>

        {/* What you'll see */}
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#0A2F28", margin: "0 0 16px" }}>
          What this walkthrough covers
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
          {WALKTHROUGH_POINTS.map((point, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ paddingTop: 2 }}>
                <Check />
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0A2F28", margin: "0 0 4px" }}>
                  {point.title}
                </h3>
                <p style={{ fontSize: 14, color: "#6C737F", margin: 0, lineHeight: 1.55 }}>
                  {point.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof strip */}
        <div style={{ marginBottom: 28 }}>
          <CredibilityStrip />
        </div>

        {/* CTA section */}
        <div style={{
          background: "#0A2F28", borderRadius: 16, padding: "24px 20px",
          textAlign: "center", marginBottom: 24,
        }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>
            Ready to get started?
          </h3>
          <p style={{ fontSize: 14, color: "#9DA4AE", margin: "0 0 16px", lineHeight: 1.55 }}>
            Start a free trial and explore it yourself, book a tailored walkthrough, or see how WorkflowMAX fits {v.label.toLowerCase()} firms.
          </p>
          <button
            onClick={() => goTo(FREE_TRIAL_URL)}
            style={{
              padding: "14px 32px", background: "#63DB94", color: "#0A2F28", border: "none",
              borderRadius: 100, fontSize: 16, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", transition: "background 0.2s", display: "block", width: "100%",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#45c97e")}
            onMouseLeave={(e) => (e.target.style.background = "#63DB94")}
          >
            Start your free trial →
          </button>
          <button
            onClick={() => goTo(BOOKING_URLS[v.id])}
            style={{
              padding: "13px 32px", marginTop: 10, background: "transparent", color: "#63DB94",
              border: "1px solid #63DB9450", borderRadius: 100, fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", display: "block", width: "100%",
            }}
            onMouseEnter={(e) => { e.target.style.background = "#63DB9410"; e.target.style.borderColor = "#63DB94"; }}
            onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.borderColor = "#63DB9450"; }}
          >
            Book a walkthrough
          </button>
          <button
            onClick={() => goTo(SOLUTION_URLS[v.id])}
            style={{
              padding: "13px 32px", marginTop: 10, background: "transparent", color: "#63DB94",
              border: "1px solid #63DB9450", borderRadius: 100, fontSize: 15, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", display: "block", width: "100%",
            }}
            onMouseEnter={(e) => { e.target.style.background = "#63DB9410"; e.target.style.borderColor = "#63DB94"; }}
            onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.borderColor = "#63DB9450"; }}
          >
            Or explore WorkflowMAX for {v.label} firms →
          </button>
        </div>

        {/* Soft alternative */}
        <div style={{
          background: "#fefbe8", border: "1px solid #fde27240", borderRadius: 14,
          padding: "18px 16px", marginBottom: 24, textAlign: "center",
        }}>
          <p style={{ fontSize: 14, color: "#713b12", margin: "0 0 10px", fontWeight: 600 }}>
            Not ready for a call?
          </p>
          <p style={{ fontSize: 13, color: "#85490e", margin: 0, lineHeight: 1.5 }}>
            No pressure. Keep an eye out for the next email in this series, where we'll share how {v.label.toLowerCase()} firms are using WorkflowMAX to get better results.
          </p>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #E5E7EB", textAlign: "center" }}>
          <WFMLogo />
          <p style={{ fontSize: 12, color: "#9DA4AE", marginTop: 8 }}>© 2026 WorkflowMAX. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
