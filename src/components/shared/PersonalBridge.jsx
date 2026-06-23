import { getFirm } from "../../lib/personalize.js";

// A personalised "X could be next, let us prove it" bridge that sits between the
// content and the booking CTA. Names the firm when the campaign link carries
// ?company=, otherwise falls back to a confident generic line ("Your firm…").
// `headline` may be a string or a function of the display name, so each tool
// frames the same concept in its own words. Bruna is set inline so it renders
// the same regardless of which tool's scoped CSS it lands in.
export default function PersonalBridge({ headline, sub, style }) {
  const { company } = getFirm();
  const name = company || "Your firm";
  const text = typeof headline === "function" ? headline(name) : headline;
  return (
    <div style={{ textAlign: "center", padding: "0 8px", ...style }}>
      <div style={{ width: 34, height: 3, background: "#63DB94", borderRadius: 2, margin: "0 auto 14px" }} />
      <h4 style={{ fontFamily: "'Bruna', 'DM Sans', sans-serif", fontSize: 20, fontWeight: 800, color: "#0A2F28", lineHeight: 1.3, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
        {text}
      </h4>
      <p style={{ fontSize: 14, color: "#384250", lineHeight: 1.55, margin: 0 }}>{sub}</p>
    </div>
  );
}
