import { useState, useEffect, useRef } from "react";
import { downloadResultsPdf } from "../../lib/resultsPdf";
import { submitResults, getEmailFromUrl } from "../../lib/hubspot";

/* ─── WFM Logo ─── */
const Logo = () => (
  <svg width="120" height="36" viewBox="0 0 134 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#lcp)">
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
    <defs><clipPath id="lcp"><rect width="134" height="40" fill="white"/></clipPath></defs>
  </svg>
);

/* ─── FORMAT HELPERS ─── */
const fmt = (v) => {
  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${Math.round(v / 1000).toLocaleString("en-AU")}K`;
  return `$${Math.round(v).toLocaleString("en-AU")}`;
};

/* ─── VERTICALS ─── */
const VERTICALS = [
  { id: "architecture", label: "Architecture & Design", subtitle: "Practices delivering design, documentation, and contract administration", icon: "📐", model: "services",
    defaults: { staff: 35, annualRevenue: 7000000, avgRate: 165, feeErosion: 8, invisibleCost: 12, invoiceDelay: 21, scopeChange: 65, scopeInvoiced: 35, rework: 8 } },
  { id: "engineering", label: "Engineering Consultancy", subtitle: "Firms providing advisory, design, and technical engineering services", icon: "⚙️", model: "services",
    defaults: { staff: 45, annualRevenue: 10000000, avgRate: 175, feeErosion: 7, invisibleCost: 10, invoiceDelay: 18, scopeChange: 60, scopeInvoiced: 40, rework: 7 } },
  { id: "consulting", label: "Management & Business Consulting", subtitle: "Strategy, advisory, and professional services firms", icon: "💼", model: "services",
    defaults: { staff: 30, annualRevenue: 6500000, avgRate: 195, feeErosion: 9, invisibleCost: 13, invoiceDelay: 14, scopeChange: 70, scopeInvoiced: 30, rework: 6 } },
  { id: "construction", label: "Construction & Trades", subtitle: "Builders, contractors, and trade services businesses", icon: "🏗️", model: "project",
    defaults: { annualRevenue: 15000000, jobCount: 60, avgJobValue: 250000, quotedMargin: 18, actualMargin: 10, variationPct: 75, variationInvoiced: 40, invoiceDelay: 28, unattributed: 6, rework: 5 } },
  { id: "civil", label: "Civil & Infrastructure", subtitle: "Contractors delivering civil, infrastructure, and heavy engineering projects", icon: "🔧", model: "project",
    defaults: { annualRevenue: 12000000, jobCount: 45, avgJobValue: 265000, quotedMargin: 20, actualMargin: 12, variationPct: 65, variationInvoiced: 45, invoiceDelay: 22, unattributed: 5, rework: 6 } },
  { id: "creative", label: "Creative & Marketing", subtitle: "Agencies, studios, and creative services businesses", icon: "🎨", model: "services",
    defaults: { staff: 20, annualRevenue: 4000000, avgRate: 155, feeErosion: 10, invisibleCost: 14, invoiceDelay: 16, scopeChange: 75, scopeInvoiced: 25, rework: 10 } },
];

/* Heading typeface (Bruna), shared by display numbers below */
const HEAD = "'Bruna', 'DM Sans', sans-serif";

/* Revenue bands: prospects pick a range, we use a representative value
   for the maths so they never have to type an exact figure. */
const REVENUE_BANDS = [
  { id: "r1", label: "$500K - $1M", value: 750000 },
  { id: "r2", label: "$1M - $5M", value: 3000000 },
  { id: "r3", label: "$5M - $10M", value: 7500000 },
  { id: "r4", label: "$10M - $20M", value: 15000000 },
  { id: "r5", label: "$20M - $50M", value: 35000000 },
];

/* Headcount / jobs bands: the slider snaps across these ranges rather
   than moving continuously. Representative midpoints feed the maths. */
const COUNT_BANDS = [
  { label: "5 to 20", value: 12 },
  { label: "20 to 50", value: 35 },
  { label: "50 to 100", value: 75 },
  { label: "100 to 200", value: 150 },
];

const nearestBand = (bands, val) =>
  bands.reduce((best, b) => (Math.abs(b.value - val) < Math.abs(best.value - val) ? b : best), bands[0]);

/* Pre-fill the industry from the personalised campaign link, e.g.
   ?industry=architecture. Falls back to a sensible default so the
   confirm step is always shown. */
const detectVertical = () => {
  if (typeof window === "undefined") return VERTICALS[0];
  const raw = (new URLSearchParams(window.location.search).get("industry") ||
    new URLSearchParams(window.location.search).get("vertical") || "")
    .toLowerCase().trim();
  if (!raw) return VERTICALS[0];
  return (
    VERTICALS.find(
      (v) => v.id === raw || v.label.toLowerCase() === raw || v.label.toLowerCase().includes(raw)
    ) || VERTICALS[0]
  );
};

/* Where the results-page CTAs send prospects. The vertical solution pages live
   on the marketing site and should be pixeled (Meta / Google / LinkedIn) so we
   can retarget everyone who reaches results, whether or not they click. These
   are the soft, low-friction landing for the majority; booking is the
   high-intent path for the ready few. NOTE: no dedicated Civil page exists yet,
   so civil falls back to building-and-construction — change if a better fit. */
const SOLUTION_URLS = {
  architecture: "https://workflowmax.com/architects",
  engineering: "https://workflowmax.com/engineers",
  consulting: "https://workflowmax.com/business-consultants",
  construction: "https://workflowmax.com/building-and-construction",
  civil: "https://workflowmax.com/building-and-construction",
  creative: "https://workflowmax.com/creative-agencies",
};
/* Booking routes by vertical: Sina owns architecture, construction, consulting;
   Denzel owns civil, engineering, creative. */
const BOOKING_URLS = {
  architecture: "https://meetings.hubspot.com/szarei",
  construction: "https://meetings.hubspot.com/szarei",
  consulting: "https://meetings.hubspot.com/szarei",
  civil: "https://meetings.hubspot.com/denzel-kereama",
  engineering: "https://meetings.hubspot.com/denzel-kereama",
  creative: "https://meetings.hubspot.com/denzel-kereama",
};
const WALKTHROUGH_URL = "https://www.youtube.com/watch?v=X7RX3Bzz0sk"; // product walkthrough

/* Open a CTA destination in a new tab so the prospect keeps their results.
   No-op for unconfigured links so a placeholder never navigates to nowhere. */
const goTo = (url) => {
  if (typeof window !== "undefined" && url && url !== "#") window.open(url, "_blank", "noopener,noreferrer");
};

/* ─── LEAK DEFINITIONS ─── */
const SERVICES_LEAKS = [
  { key: "feeErosion", icon: "📉", label: "Fee erosion",
    question: "Of the work your team quotes, how much gets written down or written off before the client pays?",
    subtext: "Fee cuts at invoice, fixed-fee jobs that run over, and work delivered but never billed.",
    source: "SPI Research 2025: services firms average 7-12% fee erosion",
    inputKey: "feeErosion", unit: "%", min: 0, max: 25, step: 1,
    calc: (i) => i.annualRevenue * (i.feeErosion / 100),
    detail: (i) => `${i.feeErosion}% of $${(i.annualRevenue/1000000).toFixed(1)}M revenue`,
  },
  { key: "invisibleCost", icon: "⏱️", label: "Invisible cost gap",
    question: "How many of the hours your team actually works never make it onto a timesheet?",
    subtext: "On hourly jobs, that's revenue you can't bill. On fixed-fee jobs, it's cost you can't learn from.",
    source: "SPI Research 2025: 10-15% of worked hours typically go unrecorded",
    inputKey: "invisibleCost", unit: "%", min: 0, max: 30, step: 1,
    calc: (i) => (i.staff * 1760 * (i.invisibleCost / 100)) * i.avgRate,
    detail: (i) => `${i.invisibleCost}% of ${i.staff} staff x 1,760 hrs x $${i.avgRate}/hr`,
  },
  { key: "invoiceDelay", icon: "🏦", label: "Invoicing delay cost",
    question: "How many days pass between finishing the work and the client getting an invoice?",
    subtext: "Every extra day is your cash sitting in their account instead of yours.",
    source: "Industry average: 14-24 days. Top performers: under 7 days",
    inputKey: "invoiceDelay", unit: "days", min: 1, max: 60, step: 1,
    calc: (i) => { const daily = i.annualRevenue / 12 / 22; const excess = Math.max(i.invoiceDelay - 5, 0); return daily * excess * 0.09; },
    detail: (i) => `${Math.max(i.invoiceDelay - 5, 0)} excess days on ${fmt(i.annualRevenue / 12 / 22)}/day billing at 9% cost of capital`,
  },
  { key: "scopeCreep", icon: "📋", label: "Scope creep tax",
    question: "When scope grows on a job, how much of that extra work actually makes it onto an invoice?",
    subtext: "Most firms bill less than half. The rest gets written off as goodwill, or never tracked at all.",
    source: "SPI Research 2025: 60-75% of jobs experience scope changes",
    inputKeys: ["scopeChange", "scopeInvoiced"], unit: "%", min: 0, max: 100, step: 5,
    calc: (i) => { const changed = i.annualRevenue * (i.scopeChange / 100) * 0.12; return changed * (1 - i.scopeInvoiced / 100); },
    detail: (i) => `${i.scopeChange}% of jobs change scope, only ${i.scopeInvoiced}% of changes invoiced`,
  },
  { key: "rework", icon: "🔄", label: "Rework and revision drain",
    question: "How much of your team's time goes on avoidable rework and corrections?",
    subtext: "Not the good iteration that adds value. The rework that comes from unclear briefs or missing information.",
    source: "Industry benchmark: 5-10% of project hours on avoidable rework",
    inputKey: "rework", unit: "%", min: 0, max: 25, step: 1,
    calc: (i) => i.annualRevenue * (i.rework / 100),
    detail: (i) => `${i.rework}% of annual revenue consumed by avoidable rework`,
  },
];

const PROJECT_LEAKS = [
  { key: "marginErosion", icon: "📉", label: "Margin erosion",
    question: "What's the usual gap between the margin you quote and the margin you actually deliver?",
    subtext: "Think back over your last 10 jobs. How often did the final margin match the quote?",
    source: "ABS Australian Industry 2023-24: construction margins under sustained pressure",
    inputKeys: ["quotedMargin", "actualMargin"], unit: "%", min: 0, max: 40, step: 1,
    calc: (i) => i.annualRevenue * ((i.quotedMargin - i.actualMargin) / 100),
    detail: (i) => `Quoting ${i.quotedMargin}% but delivering ${i.actualMargin}% = ${i.quotedMargin - i.actualMargin} point gap`,
  },
  { key: "variationBlackHole", icon: "📋", label: "Variation black hole",
    question: "Of the variations on your jobs, how many actually get invoiced?",
    subtext: "Not logged, invoiced. There's usually a gap between recording a variation and recovering the cost.",
    source: "Industry benchmark: most contractors recover less than half of legitimate variations",
    inputKeys: ["variationPct", "variationInvoiced"], unit: "%", min: 0, max: 100, step: 5,
    calc: (i) => { const v = i.jobCount * (i.variationPct / 100) * i.avgJobValue * 0.10; return v * (1 - i.variationInvoiced / 100); },
    detail: (i) => `${i.variationPct}% of ${i.jobCount} jobs have variations, only ${i.variationInvoiced}% recovered`,
  },
  { key: "invoiceDelay", icon: "🏦", label: "Invoicing delay cost",
    question: "How many days pass between hitting a milestone and lodging the progress claim?",
    subtext: "On capital-heavy projects, every extra day ties up working capital you could be using.",
    source: "Industry average: 22-30 days. Top performers: under 10 days",
    inputKey: "invoiceDelay", unit: "days", min: 1, max: 60, step: 1,
    calc: (i) => { const daily = i.annualRevenue / 12 / 22; const excess = Math.max(i.invoiceDelay - 7, 0); return daily * excess * 0.09; },
    detail: (i) => `${Math.max(i.invoiceDelay - 7, 0)} excess days on ${fmt(i.annualRevenue / 12 / 22)}/day billing`,
  },
  { key: "unattributed", icon: "🔍", label: "Unattributed costs",
    question: "How much of your spend on materials, subbies and plant never gets allocated to the right job?",
    subtext: "When costs don't land on the job, your profit numbers are off, and so are the decisions you make from them.",
    source: "APQC benchmarking: 4-8% of costs typically unattributed in SMB contractors",
    inputKey: "unattributed", unit: "%", min: 0, max: 20, step: 1,
    calc: (i) => i.annualRevenue * (i.unattributed / 100),
    detail: (i) => `${i.unattributed}% of costs not linked to jobs`,
  },
  { key: "rework", icon: "🔄", label: "Rework and defect cost",
    question: "How much of your revenue goes on site revisits and rework from poor handover or documentation?",
    subtext: "The work that shouldn't have needed doing twice.",
    source: "Industry benchmark: 3-7% of revenue on avoidable rework",
    inputKey: "rework", unit: "%", min: 0, max: 20, step: 1,
    calc: (i) => i.annualRevenue * (i.rework / 100),
    detail: (i) => `${i.rework}% of revenue consumed by avoidable rework`,
  },
];

/* ─── SLIDER ─── */
function Slider({ value, onChange, min, max, step, unit }) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = unit === "%" ? `${value}%` : unit === "days" ? `${value} days` : value;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ textAlign: "right", fontSize: 20, fontWeight: 700, color: "#0A2F28", marginBottom: 4 }}>{display}</div>
      <div style={{ position: "relative", height: 36, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, height: 5, background: "#E5E7EB", borderRadius: 3 }}>
          <div style={{ height: "100%", background: "#0D8D5C", borderRadius: 3, width: `${pct}%`, transition: "width 0.05s" }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: "absolute", left: 0, right: 0, width: "100%", height: 36, opacity: 0, cursor: "pointer", zIndex: 2, margin: 0 }} />
        <div style={{ position: "absolute", left: `calc(${pct}% - 11px)`, width: 22, height: 22, borderRadius: "50%", background: "#0A2F28", border: "3px solid #63DB94", boxShadow: "0 2px 6px rgba(0,0,0,0.15)", pointerEvents: "none", transition: "left 0.05s" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 11, color: "#9DA4AE" }}>{min}{unit === "%" ? "%" : ""}</span>
        <span style={{ fontSize: 11, color: "#9DA4AE" }}>{max}{unit === "%" ? "%" : ""}</span>
      </div>
    </div>
  );
}

/* ─── BAND SLIDER (snaps across ranges) ─── */
function BandSlider({ bands, value, onChange, suffix }) {
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

/* ─── ANIMATED COUNTER ─── */
function Counter({ value, duration = 1500 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * value));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);
  return <>{fmt(display)}</>;
}

/* ─── MAIN ─── */
export default function ProfitLeakCalculator() {
  const [screen, setScreen] = useState("intro");
  const [verticalId, setVerticalId] = useState(() => detectVertical().id);
  const [inputs, setInputs] = useState({});
  const [leakStep, setLeakStep] = useState(0);
  const [adjusting, setAdjusting] = useState({});
  const [anim, setAnim] = useState(false);
  const [dir, setDir] = useState("fwd");
  const [showCalcs, setShowCalcs] = useState(false);
  const [shareState, setShareState] = useState("idle"); // idle | copied
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState("idle"); // idle | sending | sent | error
  const topRef = useRef(null);
  const completionSent = useRef(false); // fire the silent completion only once

  const v = VERTICALS.find((x) => x.id === verticalId);
  const leaks = v?.model === "services" ? SERVICES_LEAKS : PROJECT_LEAKS;

  // Seed inputs from vertical defaults, snapping revenue + count to the nearest band
  useEffect(() => {
    if (!v) return;
    const countKey = v.model === "services" ? "staff" : "jobCount";
    setInputs({
      ...v.defaults,
      annualRevenue: nearestBand(REVENUE_BANDS, v.defaults.annualRevenue).value,
      [countKey]: nearestBand(COUNT_BANDS, v.defaults[countKey]).value,
    });
  }, [verticalId]);

  const go = (cb) => { setAnim(true); setTimeout(() => { cb(); setTimeout(() => setAnim(false), 40); }, 220); };
  const set = (k) => (val) => setInputs((p) => ({ ...p, [k]: val }));
  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth" });

  /* Calculate all leaks */
  const leakResults = leaks.map((l) => ({ ...l, amount: l.calc(inputs) }));
  const runningTotal = leakResults.slice(0, leakStep + 1).reduce((s, l) => s + l.amount, 0);
  const totalLeakage = leakResults.reduce((s, l) => s + l.amount, 0);
  const totalPct = inputs.annualRevenue ? ((totalLeakage / inputs.annualRevenue) * 100).toFixed(1) : "0";
  const biggest = [...leakResults].sort((a, b) => b.amount - a.amount)[0];
  const perUnit = v?.model === "services"
    ? { value: fmt(totalLeakage / (inputs.staff || 1)), label: "per staff member per year" }
    : { value: fmt(totalLeakage / (inputs.jobCount || 1)), label: "leaking per job on average" };
  const wfmCostLow = 10000; const wfmCostHigh = 50000;
  const roiMultiple = Math.round(totalLeakage / ((wfmCostLow + wfmCostHigh) / 2));

  const halfFix = (() => {
    const sorted = [...leakResults].sort((a, b) => b.amount - a.amount);
    const top2 = sorted.slice(0, 2);
    return { amount: top2.reduce((s, l) => s + l.amount * 0.5, 0), names: top2.map((l) => l.label) };
  })();

  const revLabel = nearestBand(REVENUE_BANDS, inputs.annualRevenue || 0).label;
  const countLabel = v
    ? nearestBand(COUNT_BANDS, inputs[v.model === "services" ? "staff" : "jobCount"] || 0).label + (v.model === "services" ? " staff" : " jobs/yr")
    : "";

  /* Plain-text summary of the result, used for share + emailed results. */
  const buildSummary = () => {
    const revLabel = nearestBand(REVENUE_BANDS, inputs.annualRevenue || 0).label;
    const countKey = v?.model === "services" ? "staff" : "jobCount";
    const countLabel = nearestBand(COUNT_BANDS, inputs[countKey] || 0).label + (v?.model === "services" ? " staff" : " jobs/yr");
    return [
      "WorkflowMAX Profit Leak Calculator results",
      "",
      `Industry: ${v?.label}`,
      `Revenue band: ${revLabel}`,
      `${v?.model === "services" ? "Team size" : "Jobs per year"}: ${countLabel}`,
      `Total annual profit leakage: ${fmt(totalLeakage)} (${totalPct}% of revenue)`,
      "",
      "Where it comes from:",
      ...leakResults.map((l) => `- ${l.label}: ${fmt(l.amount)}/yr`),
      "",
      `Quickest win: closing ${halfFix.names[0]} and ${halfFix.names[1]} by half recovers ${fmt(halfFix.amount)}/yr.`,
    ].join("\n");
  };

  const handleShare = async () => {
    const shareData = {
      title: "WorkflowMAX Profit Leak Calculator",
      text: `My firm is leaking ${fmt(totalLeakage)} a year in hidden profit. See where yours is going:`,
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) { await navigator.share(shareData); return; }
      await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2200);
    } catch {
      /* user dismissed the share sheet, no action needed */
    }
  };

  /* The results record sent to HubSpot (field mapping). The endpoint + portal/
     form config live in src/lib/hubspot.js. */
  const hubspotFields = () => ({
    wfm_tool_used: "Profit Leak Calculator",
    wfm_completed_calculator: "true",
    wfm_industry: v?.label,
    wfm_revenue_band: revLabel,
    wfm_firm_size: countLabel,
    wfm_profit_leak: Math.round(totalLeakage),
    wfm_results_summary: buildSummary(),
  });

  /* Pre-HubSpot fallback: open the user's mail client with the summary. */
  const mailtoFallback = () => {
    if (typeof window === "undefined") return;
    const subject = encodeURIComponent("Your Profit Leak Calculator results");
    const body = encodeURIComponent(buildSummary());
    window.location.href = `mailto:${email.trim()}?subject=${subject}&body=${body}`;
  };

  const sendResults = async (e) => {
    e?.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!valid) { setEmailState("error"); return; }
    setEmailState("sending");
    const { ok, skipped } = await submitResults({ email: email.trim(), fields: hubspotFields(), pageName: "Profit Leak Calculator" });
    if (skipped) mailtoFallback(); // HubSpot not wired yet — keep the flow working
    setEmailState(ok || skipped ? "sent" : "error");
  };

  /* Build and download the branded PDF of the results, in the browser. */
  const handleDownloadPdf = () => downloadResultsPdf({
    tool: "Profit Leak Calculator",
    industry: v?.label,
    meta: `${revLabel} revenue · ${countLabel}`,
    hero: { label: "Total annual profit leakage", value: `${fmt(totalLeakage)}/yr`, sub: `${totalPct}% of revenue`, accent: "#EC5F60" },
    itemsTitle: "Where the leakage comes from",
    items: leakResults.map((l) => ({ label: l.label, value: `${fmt(l.amount)}/yr`, note: l.detail(inputs) })),
    highlights: [
      { title: "A realistic starting point", body: `If you closed ${halfFix.names[0].toLowerCase()} and ${halfFix.names[1].toLowerCase()} by half, you'd recover ${fmt(halfFix.amount)}/yr — not a total overhaul.` },
      { title: "For context", body: `Firms your size typically invest $10K–$50K a year in connected job management. Your current leakage is ${roiMultiple}x that.` },
    ],
  });

  /* Frictionless completion: if identity rides in on the enriched campaign link
     (?email=…), record the completion the moment they reach results — no form
     needed. Everyone else is captured via the email block below. */
  useEffect(() => {
    if (screen !== "results" || completionSent.current) return;
    const urlEmail = getEmailFromUrl();
    if (urlEmail) {
      completionSent.current = true;
      submitResults({ email: urlEmail, fields: hubspotFields(), pageName: "Profit Leak Calculator" });
    }
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Progress colour: amber to red as leaks accumulate */
  const progressColors = ["#D89F0A", "#E08A08", "#E07008", "#D94520", "#C92A2A"];
  const progColor = leakStep < 5 ? progressColors[leakStep] : "#C92A2A";

  const progress = screen === "leak" ? ((leakStep + 1) / leaks.length) * 100 : screen === "results" ? 100 : 0;

  const ctaBtn = (primary) => ({
    padding: "14px 28px", background: primary ? "#63DB94" : "transparent",
    color: primary ? "#0A2F28" : "#63DB94", border: primary ? "none" : "1px solid #63DB9450",
    borderRadius: 100, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.2s", display: "block", width: "100%",
  });

  return (
    <div ref={topRef} className="plc" style={{ fontFamily: "'DM Sans', sans-serif", maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#fff" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        .plc h1, .plc h2, .plc h3, .plc h4 { font-family: 'Bruna', 'DM Sans', sans-serif; letter-spacing: -0.01em; }
        @media (min-width: 768px) { body { margin: 0; background: #EDF0EE; } .plc { max-width: 560px !important; box-shadow: 0 0 50px rgba(10,47,40,0.08); border-left: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* HEADER */}
      <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E5E7EB", background: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <Logo />
        {screen === "leak" && (
          <span style={{ fontSize: 13, color: "#6C737F", fontWeight: 500 }}>Leak {leakStep + 1}/{leaks.length}</span>
        )}
      </div>

      {/* PROGRESS BAR */}
      {(screen === "leak" || screen === "results") && (
        <div style={{ height: 3, background: "#E5E7EB" }}>
          <div style={{ height: "100%", background: screen === "results" ? "#C92A2A" : progColor, width: `${progress}%`, transition: "width 0.5s, background 0.5s", borderRadius: "0 2px 2px 0" }} />
        </div>
      )}

      {/* ANIMATED WRAPPER */}
      <div style={{ opacity: anim ? 0 : 1, transform: anim ? (dir === "fwd" ? "translateX(24px)" : "translateX(-24px)") : "translateX(0)", transition: "opacity 0.22s, transform 0.22s" }}>

        {/* ═══ INTRO ═══ */}
        {screen === "intro" && (
          <div style={{ padding: "40px 24px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#0A2F28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 20 }}>🔍</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0A2F28", lineHeight: 1.15, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
              Profit Leak<br/>Calculator
            </h1>
            <p style={{ fontSize: 16, color: "#384250", lineHeight: 1.6, margin: "0 0 12px" }}>
              In the health check, you assessed how your firm manages jobs. This calculator puts a dollar value on the gaps.
            </p>
            <p style={{ fontSize: 14, color: "#6C737F", lineHeight: 1.55, margin: "0 0 36px" }}>
              We'll walk through 5 common profit leaks one at a time. Each one shows you the cost. The total might surprise you. Takes about 90 seconds.
            </p>
            <button onClick={() => { setDir("fwd"); go(() => setScreen("confirm")); }} style={ctaBtn(true)}
              onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
              Find Your Leaks
            </button>
          </div>
        )}

        {/* ═══ CONFIRM INDUSTRY ═══ */}
        {screen === "confirm" && v && (
          <div style={{ padding: "28px 24px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28", margin: "0 0 6px" }}>First, let's confirm your industry</h2>
            <p style={{ fontSize: 14, color: "#6C737F", margin: "0 0 20px" }}>This sets which profit leak model we use, so the numbers fit how your firm actually works. Just confirm it's right.</p>

            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 16px", background: "#f0fdf4", border: "1px solid #0D8D5C40", borderRadius: 14, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>{v.icon}</span>
              <div>
                <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: "#087443", textTransform: "uppercase", letterSpacing: "0.06em", background: "#0D8D5C18", borderRadius: 100, padding: "2px 8px", marginBottom: 5 }}>Your industry</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0A2F28", lineHeight: 1.2 }}>{v.label}</div>
                <div style={{ fontSize: 12, color: "#6C737F", marginTop: 3, lineHeight: 1.35 }}>{v.subtitle}</div>
              </div>
            </div>

            <button onClick={() => { setDir("fwd"); go(() => setScreen("firmInputs")); }} style={ctaBtn(true)}
              onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
              Yes, that's my industry
            </button>
            <div style={{ height: 10 }} />
            <button onClick={() => { setDir("fwd"); go(() => setScreen("vertical")); }} style={ctaBtn(false)}
              onMouseEnter={(e) => { e.target.style.background = "#63DB9410"; e.target.style.borderColor = "#63DB94"; }}
              onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.borderColor = "#63DB9450"; }}>
              No, choose a different industry
            </button>
          </div>
        )}

        {/* ═══ VERTICAL ═══ */}
        {screen === "vertical" && (
          <div style={{ padding: "28px 24px" }}>
            <button onClick={() => { setDir("back"); go(() => setScreen("confirm")); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6C737F", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit" }}>← Back</button>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28", margin: "0 0 6px" }}>What best describes your firm?</h2>
            <p style={{ fontSize: 14, color: "#6C737F", margin: "0 0 20px" }}>This determines which profit leak model we use.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {VERTICALS.map((vert) => (
                <button key={vert.id} onClick={() => { setVerticalId(vert.id); setDir("fwd"); go(() => setScreen("firmInputs")); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit", textAlign: "left" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0D8D5C"; e.currentTarget.style.background = "#f0fdf4"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; }}>
                  <span style={{ fontSize: 22 }}>{vert.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0A2F28" }}>{vert.label}</div>
                    <div style={{ fontSize: 12, color: "#6C737F", marginTop: 2 }}>{vert.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ FIRM INPUTS (2 only) ═══ */}
        {screen === "firmInputs" && v && (
          <div style={{ padding: "28px 24px" }}>
            <button onClick={() => { setDir("back"); go(() => setScreen("confirm")); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6C737F", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit" }}>← Back</button>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28", margin: "0 0 6px" }}>A couple of quick numbers</h2>
            <p style={{ fontSize: 14, color: "#6C737F", margin: "0 0 24px" }}>Pick the ranges that fit your firm. We've started you near a typical {v.label.toLowerCase()} firm.</p>

            <div style={{ fontSize: 14, fontWeight: 600, color: "#0A2F28", marginBottom: 8 }}>Annual revenue (AUD)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {REVENUE_BANDS.map((b) => {
                const sel = inputs.annualRevenue === b.value;
                return (
                  <button key={b.id} onClick={() => set("annualRevenue")(b.value)}
                    style={{ flex: "1 1 calc(50% - 4px)", minWidth: 0, padding: "14px 10px", background: sel ? "#0A2F28" : "#F9FAFB", color: sel ? "#fff" : "#0A2F28", border: `1px solid ${sel ? "#0A2F28" : "#E5E7EB"}`, borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.borderColor = "#0D8D5C"; e.currentTarget.style.background = "#f0fdf4"; } }}
                    onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; } }}>
                    {b.label}
                  </button>
                );
              })}
            </div>

            <div style={{ height: 24 }} />
            {v.model === "services" ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0A2F28", marginBottom: 4 }}>Billable staff</div>
                <BandSlider bands={COUNT_BANDS} value={inputs.staff || COUNT_BANDS[0].value} onChange={set("staff")} suffix="staff" />
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0A2F28", marginBottom: 4 }}>Jobs per year</div>
                <BandSlider bands={COUNT_BANDS} value={inputs.jobCount || COUNT_BANDS[0].value} onChange={set("jobCount")} suffix="jobs/yr" />
              </>
            )}

            <div style={{ height: 28 }} />
            <button onClick={() => { setLeakStep(0); setAdjusting({}); setDir("fwd"); go(() => setScreen("leak")); }} style={ctaBtn(true)}
              onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
              Show me the leaks
            </button>
          </div>
        )}

        {/* ═══ LEAK SCREENS (one at a time) ═══ */}
        {screen === "leak" && v && (() => {
          const leak = leaks[leakStep];
          const leakAmount = leak.calc(inputs);
          const isAdj = !!adjusting[leak.key];
          return (
            <div style={{ padding: "24px 24px 32px" }}>
              {leakStep > 0 && (
                <button onClick={() => { setDir("back"); go(() => setLeakStep((s) => s - 1)); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6C737F", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "0 0 14px", fontFamily: "inherit" }}>← Back</button>
              )}

              {/* Running total bar */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6C737F" }}>Running total</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: progColor, transition: "color 0.3s" }}>{fmt(runningTotal)}</span>
              </div>

              {/* Leak icon + label */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", background: "#fef3f2", borderRadius: 100, marginBottom: 14 }}>
                <span style={{ fontSize: 13 }}>{leak.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#b42318", textTransform: "uppercase", letterSpacing: "0.05em" }}>Leak {leakStep + 1}: {leak.label}</span>
              </div>

              {/* Question */}
              <h2 style={{ fontSize: 19, fontWeight: 700, color: "#0A2F28", lineHeight: 1.35, margin: "0 0 6px" }}>{leak.question}</h2>
              <p style={{ fontSize: 13, color: "#6C737F", lineHeight: 1.5, margin: "0 0 16px" }}>{leak.subtext}</p>

              {/* Default value display */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#6C737F", fontWeight: 500, marginBottom: 2 }}>Industry default</div>
                    <div style={{ fontSize: 11, color: "#9DA4AE", lineHeight: 1.4 }}>{leak.source}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28" }}>
                    {leak.inputKeys ? `${inputs[leak.inputKeys[0]]}% / ${inputs[leak.inputKeys[1]]}%` : `${inputs[leak.inputKey]}${leak.unit === "%" ? "%" : leak.unit === "days" ? " days" : ""}`}
                  </div>
                </div>
                {!isAdj && (
                  <button onClick={() => setAdjusting((p) => ({ ...p, [leak.key]: true }))}
                    style={{ marginTop: 10, padding: "6px 14px", background: "#E5E7EB", border: "none", borderRadius: 100, fontSize: 12, fontWeight: 600, color: "#384250", cursor: "pointer", fontFamily: "inherit" }}>
                    Adjust for my firm
                  </button>
                )}
                {isAdj && (
                  <div style={{ marginTop: 8 }}>
                    {leak.inputKeys ? (
                      <>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#384250", marginTop: 8 }}>{leak.key === "scopeCreep" ? "Jobs with scope changes" : leak.key === "marginErosion" ? "Quoted margin" : "Jobs with variations"}</div>
                        <Slider value={inputs[leak.inputKeys[0]]} onChange={set(leak.inputKeys[0])} min={leak.min} max={leak.max} step={leak.step} unit={leak.unit} />
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#384250", marginTop: 12 }}>{leak.key === "scopeCreep" ? "Changes actually invoiced" : leak.key === "marginErosion" ? "Actual delivered margin" : "Variations actually invoiced"}</div>
                        <Slider value={inputs[leak.inputKeys[1]]} onChange={set(leak.inputKeys[1])} min={leak.min} max={leak.key === "marginErosion" ? 35 : leak.max} step={leak.step} unit={leak.unit} />
                      </>
                    ) : (
                      <Slider value={inputs[leak.inputKey]} onChange={set(leak.inputKey)} min={leak.min} max={leak.max} step={leak.step} unit={leak.unit} />
                    )}
                  </div>
                )}
              </div>

              {/* This leak's cost */}
              <div style={{ background: "#0A2F28", borderRadius: 14, padding: "20px 16px", textAlign: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9DA4AE", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>This leak costs you</div>
                <div style={{ fontFamily: HEAD, fontSize: 36, fontWeight: 800, color: "#EC5F60", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(leakAmount)}<span style={{ fontSize: 16, fontWeight: 500, color: "#9DA4AE" }}>/yr</span></div>
                <div style={{ fontSize: 12, color: "#6C737F", marginTop: 6 }}>{leak.detail(inputs)}</div>
              </div>

              {/* Next button */}
              <div style={{ marginTop: 20 }}>
                {leakStep < leaks.length - 1 ? (
                  <button onClick={() => { setDir("fwd"); go(() => setLeakStep((s) => s + 1)); }} style={ctaBtn(true)}
                    onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
                    Next leak →
                  </button>
                ) : (
                  <button onClick={() => { setDir("fwd"); go(() => { setScreen("results"); scrollTop(); }); }} style={ctaBtn(true)}
                    onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
                    See the full picture
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* ═══ RESULTS ═══ */}
        {screen === "results" && (
          <div style={{ padding: "28px 24px 48px" }}>

            {/* Total leakage hero */}
            <div style={{ background: "#0A2F28", borderRadius: 16, padding: "28px 20px", textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9DA4AE", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Total annual profit leakage</div>
              <div style={{ fontFamily: HEAD, fontSize: 46, fontWeight: 800, color: "#EC5F60", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 6 }}>
                <Counter value={totalLeakage} />
              </div>
              <div style={{ fontSize: 15, color: "#9DA4AE", marginBottom: 14 }}>{totalPct}% of your annual revenue</div>
              <div style={{ height: 6, background: "#1a4a40", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#EC5F60", borderRadius: 3, width: `${Math.min(parseFloat(totalPct), 100)}%`, transition: "width 1.5s ease" }} />
              </div>
            </div>

            {/* Per unit + biggest leak */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, background: "#fef3f2", border: "1px solid #EC5F6020", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#b42318", lineHeight: 1 }}>{perUnit.value}</div>
                <div style={{ fontSize: 11, color: "#384250", fontWeight: 500, marginTop: 4 }}>{perUnit.label}</div>
              </div>
              <div style={{ flex: 1, background: "#fef3f2", border: "1px solid #EC5F6020", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#b42318", lineHeight: 1 }}>{fmt(biggest.amount)}</div>
                <div style={{ fontSize: 11, color: "#384250", fontWeight: 500, marginTop: 4 }}>biggest leak: {biggest.label.toLowerCase()}</div>
              </div>
            </div>

            {/* Leak breakdown bars */}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0A2F28", margin: "0 0 10px" }}>Where the leakage comes from</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {leakResults.map((l, i) => {
                const barW = totalLeakage > 0 ? (l.amount / totalLeakage) * 100 : 0;
                return (
                  <div key={l.key} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 14px", animation: `fadeUp 0.3s ease ${i * 0.08}s both` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0A2F28" }}>{l.icon} {l.label}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#b42318" }}>{fmt(l.amount)}/yr</span>
                    </div>
                    <div style={{ height: 8, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: "#EC5F60", borderRadius: 4, width: `${barW}%`, transition: "width 0.8s ease" }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#6C737F", marginTop: 4 }}>{l.detail(inputs)}</div>
                  </div>
                );
              })}
            </div>

            {/* You don't need to fix everything */}
            <div style={{ background: "#fefbe8", border: "1px solid #fde27240", borderRadius: 14, padding: "20px 16px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#713b12", marginBottom: 6 }}>You don't need to fix everything</div>
              <div style={{ fontFamily: HEAD, fontSize: 30, fontWeight: 800, color: "#85490e", lineHeight: 1, marginBottom: 8 }}>{fmt(halfFix.amount)}/yr</div>
              <p style={{ fontSize: 13, color: "#85490e", margin: 0, lineHeight: 1.5 }}>
                If you closed just <strong>{halfFix.names[0].toLowerCase()}</strong> and <strong>{halfFix.names[1].toLowerCase()}</strong> by 50%, you'd recover this annually. That's a realistic starting point, not a total overhaul.
              </p>
            </div>

            {/* ROI context */}
            <div style={{ background: "#f0fdf4", border: "1px solid #0D8D5C20", borderRadius: 14, padding: "16px", marginBottom: 24, textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "#087443", margin: 0, lineHeight: 1.55 }}>
                <strong>For context:</strong> firms your size typically invest $10K to $50K per year in end-to-end job management systems. Your current leakage is <strong>{roiMultiple}x</strong> that investment.
              </p>
            </div>

            {/* How did we calculate this */}
            <button onClick={() => setShowCalcs(!showCalcs)}
              style={{ width: "100%", padding: "12px 16px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showCalcs ? 0 : 24 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#384250" }}>How did we calculate this?</span>
              <span style={{ fontSize: 16, color: "#6C737F", transform: showCalcs ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▼</span>
            </button>
            {showCalcs && (
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderTop: "none", borderRadius: "0 0 12px 12px", padding: "14px 16px", marginBottom: 24 }}>
                {leakResults.map((l) => (
                  <div key={l.key} style={{ padding: "8px 0", borderBottom: "1px solid #E5E7EB", fontSize: 12, color: "#384250", lineHeight: 1.5 }}>
                    <strong>{l.label}:</strong> {l.detail(inputs)} = {fmt(l.amount)}/yr
                  </div>
                ))}
                <div style={{ padding: "8px 0", fontSize: 12, color: "#6C737F", lineHeight: 1.5 }}>
                  Working assumptions: 220 working days (1,760 hrs/person/yr). Cost of capital: 9%. All figures in AUD. Benchmarks from SPI Research 2025 PS Maturity Benchmark, ABS Australian Industry 2023-24, and APQC.
                </div>
              </div>
            )}

            {/* CTAs — soft, tailored destination first */}
            <button onClick={() => goTo(SOLUTION_URLS[v.id])} style={ctaBtn(true)} onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
              See how {v.label} firms plug these leaks →
            </button>
            <div style={{ height: 10 }} />
            <button onClick={() => goTo(WALKTHROUGH_URL)} style={ctaBtn(false)} onMouseEnter={(e) => { e.target.style.background = "#63DB9410"; e.target.style.borderColor = "#63DB94"; }} onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.borderColor = "#63DB9450"; }}>
              Watch a 12-min product walkthrough
            </button>

            {/* Share + email results */}
            <div style={{ background: "#fff8e4", border: "1px solid #ECD99740", borderRadius: 14, padding: "18px 16px", marginTop: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#713b12", margin: "0 0 4px", textAlign: "center" }}>Think this number is too high?</p>
              <p style={{ fontSize: 13, color: "#85490e", margin: "0 0 14px", lineHeight: 1.5, textAlign: "center" }}>
                Send it to your CFO and ask them, or email yourself the full breakdown to dig into later.
              </p>

              {/* Share */}
              <button onClick={handleShare}
                style={{ width: "100%", padding: "12px", background: shareState === "copied" ? "#0D8D5C" : "#0A2F28", color: "#fff", border: "none", borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                {shareState === "copied" ? "✓ Link copied" : "Share these numbers"}
              </button>

              {/* Download PDF */}
              <button onClick={handleDownloadPdf}
                style={{ width: "100%", padding: "12px", marginTop: 8, background: "#fff", color: "#713b12", border: "1px solid #ECD997", borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                ⬇ Download results as PDF
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0" }}>
                <div style={{ flex: 1, height: 1, background: "#ECD99780" }} />
                <span style={{ fontSize: 12, color: "#85490e", fontWeight: 600 }}>or email them to me</span>
                <div style={{ flex: 1, height: 1, background: "#ECD99780" }} />
              </div>

              {/* Email results */}
              {emailState === "sent" ? (
                <div style={{ textAlign: "center", fontSize: 14, fontWeight: 600, color: "#087443" }}>
                  ✓ On its way. Check your inbox for the full breakdown.
                </div>
              ) : (
                <form onSubmit={sendResults} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input type="email" value={email} placeholder="you@yourfirm.com.au"
                    onChange={(e) => { setEmail(e.target.value); if (emailState === "error") setEmailState("idle"); }}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${emailState === "error" ? "#EC5F60" : "#ECD997"}`, fontSize: 14, fontFamily: "inherit", outline: "none", background: "#fff", color: "#0A2F28", boxSizing: "border-box" }} />
                  <button type="submit" disabled={emailState === "sending"}
                    style={{ width: "100%", padding: "12px", background: "#63DB94", color: "#0A2F28", border: "none", borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: emailState === "sending" ? "default" : "pointer", fontFamily: "inherit", opacity: emailState === "sending" ? 0.7 : 1 }}>
                    {emailState === "sending" ? "Sending…" : "Email me my results"}
                  </button>
                  {emailState === "error" && (
                    <span style={{ fontSize: 12, color: "#b42318", textAlign: "center" }}>Please enter a valid email address.</span>
                  )}
                </form>
              )}
            </div>

            {/* Bottom booking CTA (optional, high-intent path) */}
            <div style={{ background: "#0A2F28", borderRadius: 16, padding: "24px 20px", textAlign: "center", marginTop: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>Prefer to talk it through?</h3>
              <p style={{ fontSize: 14, color: "#9DA4AE", margin: "0 0 14px", lineHeight: 1.5 }}>
                No pressure to book. Explore at your own pace and one of our {v.label.toLowerCase()} specialists may reach out — or grab a time now if you'd rather not wait.
              </p>
              <button onClick={() => goTo(BOOKING_URLS[v.id])} style={{ ...ctaBtn(true) }} onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
                Book a time
              </button>
            </div>

            {/* Restart */}
            <button onClick={() => { setAdjusting({}); setLeakStep(0); setVerticalId(detectVertical().id); setShareState("idle"); setEmail(""); setEmailState("idle"); completionSent.current = false; setDir("back"); go(() => setScreen("intro")); }}
              style={{ width: "100%", padding: "12px", background: "none", border: "1px solid #E5E7EB", borderRadius: 100, fontSize: 14, fontWeight: 500, color: "#6C737F", cursor: "pointer", fontFamily: "inherit", marginTop: 16 }}>
              Recalculate with different inputs
            </button>

            {/* Footer */}
            <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #E5E7EB", textAlign: "center" }}>
              <Logo />
              <p style={{ fontSize: 11, color: "#9DA4AE", marginTop: 6, lineHeight: 1.5 }}>
                Benchmarks from SPI Research 2025 PS Maturity Benchmark (403 firms), ABS Australian Industry 2023-24, Gartner, and APQC. All figures in AUD.
              </p>
              <p style={{ fontSize: 12, color: "#9DA4AE", marginTop: 4 }}>© 2026 WorkflowMAX. All rights reserved.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
