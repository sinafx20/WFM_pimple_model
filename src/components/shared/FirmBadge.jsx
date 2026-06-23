import { useState } from "react";
import { getFirm } from "../../lib/personalize.js";

// Subtle "Prepared for [logo] Company" badge. Renders nothing when the campaign
// link carries no company, so forwarded / shared links keep the generic look and
// never show an empty "Prepared for". The logo quietly drops out if it fails to
// load, leaving just the firm name.
//   variant: "light" (on white cards) | "dark" (on the green BrandSidebar)
//   align:   "left" | "center"
export default function FirmBadge({ variant = "light", align = "left", style }) {
  const { company, logo } = getFirm();
  const [logoOk, setLogoOk] = useState(true);
  if (!company) return null;

  const dark = variant === "dark";
  const labelColor = dark ? "#9DB9AE" : "#6C737F";
  const nameColor = dark ? "#FFFFFF" : "#0A2F28";
  const border = dark ? "1px solid rgba(255,255,255,0.16)" : "1px solid #E5E7EB";
  const bg = dark ? "rgba(255,255,255,0.06)" : "#F9FAFB";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 12px",
        borderRadius: 100,
        border,
        background: bg,
        alignSelf: align === "center" ? "center" : "flex-start",
        maxWidth: "100%",
        ...style,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: labelColor, whiteSpace: "nowrap" }}>
        Prepared for
      </span>
      {logo && logoOk && (
        <img
          src={logo}
          alt=""
          onError={() => setLogoOk(false)}
          style={{ height: 18, maxWidth: 84, objectFit: "contain", display: "block", borderRadius: 3 }}
        />
      )}
      <span style={{ fontSize: 13, fontWeight: 700, color: nameColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {company}
      </span>
    </div>
  );
}
