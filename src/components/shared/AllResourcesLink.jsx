// Persistent "back to the toolkit" nav shown on every screen of the 5 tool
// pages (Health Check, Calculator, Benchmark, Demo Landing Page, Firms Like
// Yours), so a prospect who lands on any one of them directly (from an email
// or DM link) can discover the rest instead of only finding out via TP6.
//
// A plain same-tab navigation, not client-side routing: App.jsx reads ?tool=
// once at mount (see src/App.jsx), it isn't reactive, so pushState alone
// wouldn't switch the rendered piece.
const goToHub = () => {
  if (typeof window === "undefined") return;
  const u = new URL(window.location.href);
  u.searchParams.set("tool", "tp6");
  window.location.href = u.toString();
};

export default function AllResourcesLink({ variant = "light", style }) {
  const dark = variant === "dark";
  return (
    <button
      onClick={goToHub}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none",
        color: dark ? "#9DB9AE" : "#6C737F", fontSize: 13, fontWeight: 600, cursor: "pointer",
        padding: 0, fontFamily: "inherit", whiteSpace: "nowrap", ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = dark ? "#63DB94" : "#0D8D5C")}
      onMouseLeave={(e) => (e.currentTarget.style.color = dark ? "#9DB9AE" : "#6C737F")}
    >
      ← All Resources
    </button>
  );
}
