// Shared firm-input bands + banded slider, used by the Calculator and the
// Benchmark so both ask for revenue / headcount the same way.

export const REVENUE_BANDS = [
  { id: "r1", label: "$500K - $1M", value: 750000 },
  { id: "r2", label: "$1M - $5M", value: 3000000 },
  { id: "r3", label: "$5M - $10M", value: 7500000 },
  { id: "r4", label: "$10M - $20M", value: 15000000 },
  { id: "r5", label: "$20M - $50M", value: 35000000 },
];

/* Headcount / jobs bands: the slider snaps across these ranges rather
   than moving continuously. Representative midpoints feed the maths. */
export const COUNT_BANDS = [
  { label: "5 to 20", value: 12 },
  { label: "20 to 50", value: 35 },
  { label: "50 to 100", value: 75 },
  { label: "100 to 200", value: 150 },
];

export const nearestBand = (bands, val) =>
  bands.reduce((best, b) => (Math.abs(b.value - val) < Math.abs(best.value - val) ? b : best), bands[0]);

export function BandSlider({ bands, value, onChange, suffix }) {
  const idx = bands.indexOf(nearestBand(bands, value));
  const pct = bands.length > 1 ? (idx / (bands.length - 1)) * 100 : 0;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ textAlign: "right", fontSize: 20, fontWeight: 700, color: "#0A2F28", marginBottom: 4 }}>
        {bands[idx].label}<span style={{ fontSize: 14, fontWeight: 500, color: "#6C737F" }}> {suffix}</span>
      </div>
      <div style={{ position: "relative", height: 36, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 5, background: "#E5E7EB", borderRadius: 3 }}>
          <div style={{ height: "100%", background: "#0D8D5C", borderRadius: 3, width: `${pct}%`, transition: "width 0.1s" }} />
        </div>
        {/* Tick marks for each band */}
        {bands.map((_, i) => (
          <div key={i} style={{ position: "absolute", left: `calc(${(i / (bands.length - 1)) * 100}% - 3px)`, width: 6, height: 6, borderRadius: "50%", background: i <= idx ? "#0D8D5C" : "#CBD2DA", pointerEvents: "none" }} />
        ))}
        <input type="range" min={0} max={bands.length - 1} step={1} value={idx} onChange={(e) => onChange(bands[Number(e.target.value)].value)}
          style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 36, opacity: 0, cursor: "pointer", zIndex: 2, margin: 0 }} />
        <div style={{ position: "absolute", left: `calc(${pct}% - 11px)`, width: 22, height: 22, borderRadius: "50%", background: "#0A2F28", border: "3px solid #63DB94", boxShadow: "0 2px 6px rgba(0,0,0,0.15)", pointerEvents: "none", transition: "left 0.1s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 11, color: "#9DA4AE" }}>{bands[0].label}</span>
        <span style={{ fontSize: 11, color: "#9DA4AE" }}>{bands[bands.length - 1].label}</span>
      </div>
    </div>
  );
}
