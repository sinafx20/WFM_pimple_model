import { useState, useMemo, useRef, useEffect } from "react";
import { downloadResultsPdf } from "../../lib/resultsPdf";
import { submitResults, getEmailFromUrl } from "../../lib/hubspot";
import BrandSidebar from "../shared/BrandSidebar.jsx";
import { REVENUE_BANDS, COUNT_BANDS, nearestBand, BandSlider } from "../shared/bands.jsx";

/* ─── WFM Logo ─── */
const Logo = () => (
  <svg width="120" height="36" viewBox="0 0 134 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#lfb)">
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
    <defs><clipPath id="lfb"><rect width="134" height="40" fill="white"/></clipPath></defs>
  </svg>
);

/* Heading typeface (Bruna), shared by display numbers below */
const HEAD = "'Bruna', 'DM Sans', sans-serif";

const fmt = (v) => {
  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${Math.round(v / 1000).toLocaleString("en-AU")}K`;
  return `$${Math.round(v).toLocaleString("en-AU")}`;
};

/* ─── VERTICALS ─── */
const VERTICALS = [
  { id: "architecture", label: "Architecture & Design", subtitle: "Practices delivering design, documentation, and contract administration", icon: "📐", model: "services", defaults: { rev: 7000000, staff: 35, jobs: 60 } },
  { id: "engineering", label: "Engineering Consultancy", subtitle: "Firms providing advisory, design, and technical engineering services", icon: "⚙️", model: "services", defaults: { rev: 10000000, staff: 45, jobs: 60 } },
  { id: "consulting", label: "Management & Business Consulting", subtitle: "Strategy, advisory, and professional services firms", icon: "💼", model: "services", defaults: { rev: 6500000, staff: 30, jobs: 60 } },
  { id: "construction", label: "Construction & Trades", subtitle: "Builders, contractors, and trade services businesses", icon: "🏗️", model: "project", defaults: { rev: 15000000, staff: 65, jobs: 60 } },
  { id: "civil", label: "Civil & Infrastructure", subtitle: "Contractors delivering civil, infrastructure, and heavy engineering projects", icon: "🔧", model: "project", defaults: { rev: 12000000, staff: 65, jobs: 45 } },
  { id: "creative", label: "Creative & Marketing", subtitle: "Agencies, studios, and creative services businesses", icon: "🎨", model: "services", defaults: { rev: 4000000, staff: 20, jobs: 60 } },
];

/* Pre-fill the industry from the personalised campaign link, e.g.
   ?industry=architecture or ?vertical=engineering. Falls back to a
   sensible default so the confirm step is always shown. Leo's enriched
   links will always carry this param in production. */
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

const PLACEMENT_OPTIONS = [
  { id: "below", label: "Below average", mult: 1.3 },
  { id: "avg", label: "Around average", mult: 1.0 },
  { id: "above", label: "Above average", mult: 0.5 },
  { id: "top", label: "Near top", mult: 0.1 },
];

/* ─── METRICS BY VERTICAL ─── */
const METRICS = {
  architecture: {
    hook: "The biggest profitability risk for architecture practices in 2026 isn't losing projects. It's delivering them without knowing what they actually cost.",
    items: [
      { key: "util", label: "Billable utilisation", question: "What percentage of your team's available hours actually generate revenue?", avg: "62%", top: "78%", avgNum: 62, topNum: 78, unit: "%", lower: false,
        gapCalc: (rev, staff) => { const rate = rev / (staff * 1760 * 0.62); return staff * 1760 * ((78 - 62) / 100) * rate; },
        gapSimple: "Moving from average to top performer would recover this in additional billable revenue each year",
        topDo: "Live capacity planning with forward-looking allocation based on actual project commitments",
        source: "SPI Research 2025" },
      { key: "erosion", label: "Fee erosion rate", question: "How much of what you quote never makes it to your bank account?", avg: "10%", top: "4%", avgNum: 10, topNum: 4, unit: "%", lower: true,
        gapCalc: (rev) => rev * 0.06,
        gapSimple: "The difference between average and top-performer write-off rates, applied to your revenue",
        topDo: "Real-time WIP tracking with automated alerts when jobs exceed budgeted hours or costs",
        source: "SPI Research 2025" },
      { key: "invoice", label: "Days to invoice", question: "How long between finishing work and sending the bill?", avg: "21 days", top: "5 days", avgNum: 21, topNum: 5, unit: "days", lower: true,
        gapCalc: (rev) => (rev / 12 / 22) * 16 * 0.09,
        gapSimple: "The working capital cost of invoicing 16 days slower than top performers, based on your revenue",
        topDo: "Event-driven invoicing triggered by milestone completion, not calendar dates",
        source: "SPI Research 2025" },
      { key: "scope", label: "Scope change recovery rate", question: "When a client changes the scope, how much of that extra work actually gets billed?", avg: "35%", top: "80%", avgNum: 35, topNum: 80, unit: "%", lower: false,
        gapCalc: (rev) => rev * 0.65 * 0.12 * 0.45,
        gapSimple: "Revenue absorbed through unrecovered scope changes each year, based on your revenue",
        topDo: "Structured variation logging linked to job costing with client approval workflows",
        source: "SPI Research 2025" },
    ],
    connection: "These metrics form a chain. Low utilisation means more pressure on each billable hour. Fee erosion eats what does get billed. Slow invoicing delays collecting what remains. Poor scope recovery means you're absorbing the extra work. Improving any one lifts the rest.",
    trend: "68% of mid-sized professional services firms plan to consolidate to a single operational platform by 2027. Firms that move early capture the efficiency gains. Firms that wait face a more painful migration.",
    trendSource: "Gartner IT Spending Forecast 2025",
  },
  engineering: {
    hook: "Engineering consultancies are billing more hours than ever but capturing fewer of them. The gap between work delivered and revenue collected is widening.",
    items: [
      { key: "invisible", label: "Invisible cost gap", question: "What percentage of the hours your team works never gets recorded anywhere?", avg: "12%", top: "3%", avgNum: 12, topNum: 3, unit: "%", lower: true,
        gapCalc: (rev, staff) => { const rate = rev / (staff * 1760 * 0.65); return staff * 1760 * 0.09 * rate; },
        gapSimple: "Hours your team works but never records, costed at your blended rate",
        topDo: "Flexible time entry (mobile, timer, weekly views) with automated reminders and approval workflows",
        source: "SPI Research 2025" },
      { key: "margin", label: "Average project margin", question: "What margin do your projects actually deliver once they're done?", avg: "17%", top: "26%", avgNum: 17, topNum: 26, unit: "%", lower: false,
        gapCalc: (rev) => rev * 0.09,
        gapSimple: "The 9-point margin gap between average and top-performing firms, applied to your revenue",
        topDo: "Phase-level cost tracking against budget with alerts when margins drop below threshold",
        source: "SPI Research 2025" },
      { key: "invoice", label: "Days to invoice", question: "How long between finishing work and sending the bill?", avg: "18 days", top: "7 days", avgNum: 18, topNum: 7, unit: "days", lower: true,
        gapCalc: (rev) => (rev / 12 / 22) * 11 * 0.09,
        gapSimple: "The working capital cost of invoicing 11 days slower than top performers",
        topDo: "Invoicing workflows connected to job milestones that generate draft invoices automatically",
        source: "SPI Research 2025" },
      { key: "util", label: "Billable utilisation", question: "What percentage of your team's available hours actually generate revenue?", avg: "65%", top: "80%", avgNum: 65, topNum: 80, unit: "%", lower: false,
        gapCalc: (rev, staff) => { const rate = rev / (staff * 1760 * 0.65); return staff * 1760 * 0.15 * rate; },
        gapSimple: "Additional billable revenue if your team moved from average to top-performer utilisation",
        topDo: "Forward-looking capacity views with resource allocation against live commitments",
        source: "SPI Research 2025" },
    ],
    connection: "Unrecorded hours distort your cost data. Distorted costs mean untrustworthy margins. Untrustworthy margins mean inaccurate pricing. Slow invoicing compounds the cash flow impact of all three.",
    trend: "68% of mid-sized firms plan to consolidate to a single operational platform by 2027. Engineering firms with 3+ disconnected tools spend more on technology admin than the tools themselves cost.",
    trendSource: "Gartner IT Spending Forecast 2025",
  },
  consulting: {
    hook: "Consulting firm pipelines grew 8% in 2024 but EBITDA hit a decade low at 9.8%. The problem isn't demand. It's delivery economics.",
    items: [
      { key: "scope", label: "Scope change recovery rate", question: "When an engagement evolves beyond the original brief, how much of the extra work actually gets billed?", avg: "35%", top: "75%", avgNum: 35, topNum: 75, unit: "%", lower: false,
        gapCalc: (rev) => rev * 0.70 * 0.12 * 0.40,
        gapSimple: "Revenue absorbed through unrecovered scope changes each year",
        topDo: "Structured variation logging at the engagement level with automated client approval workflows",
        source: "SPI Research 2025" },
      { key: "util", label: "Billable utilisation", question: "What percentage of your team's available hours actually generate revenue?", avg: "64%", top: "78%", avgNum: 64, topNum: 78, unit: "%", lower: false,
        gapCalc: (rev, staff) => { const rate = rev / (staff * 1760 * 0.64); return staff * 1760 * 0.14 * rate; },
        gapSimple: "Additional billable revenue if your team moved from average to top-performer utilisation",
        topDo: "Forward-looking capacity views with resource allocation against live engagement commitments",
        source: "SPI Research 2025" },
      { key: "erosion", label: "Fee erosion rate", question: "How much of what you quote never actually gets collected?", avg: "9%", top: "3%", avgNum: 9, topNum: 3, unit: "%", lower: true,
        gapCalc: (rev) => rev * 0.06,
        gapSimple: "The difference between average and top-performer fee erosion, applied to your revenue",
        topDo: "Real-time engagement P&L dashboards that surface margin erosion during delivery, not at close",
        source: "SPI Research 2025" },
      { key: "invoice", label: "Days to invoice", question: "How long between completing a milestone and the client receiving a bill?", avg: "14 days", top: "5 days", avgNum: 14, topNum: 5, unit: "days", lower: true,
        gapCalc: (rev) => (rev / 12 / 22) * 9 * 0.09,
        gapSimple: "The working capital cost of invoicing 9 days slower than top performers",
        topDo: "Milestone-triggered invoicing that drafts bills automatically as deliverables are completed",
        source: "SPI Research 2025" },
    ],
    connection: "Low utilisation feeds fee erosion. Fee erosion compresses margins. Compressed margins slow investment in the systems that would fix utilisation. Breaking the cycle at any point lifts everything downstream.",
    trend: "Despite pipeline growth, profitability is under pressure from utilisation decline and fee erosion. Firms investing in connected delivery platforms are the ones maintaining margins while competitors compress.",
    trendSource: "SPI Research 2025 PS Maturity Benchmark",
  },
  construction: {
    hook: "The single biggest profit driver for builders in 2026 isn't winning more work. It's recovering what you're already earning but not collecting.",
    items: [
      { key: "variation", label: "Variation recovery rate", question: "When scope changes happen on a job, how much of the extra work actually gets invoiced?", avg: "40%", top: "80%", avgNum: 40, topNum: 80, unit: "%", lower: false,
        gapCalc: (rev, _, jobs) => jobs * (rev / jobs) * 0.10 * 0.40,
        gapSimple: "Revenue from legitimate scope changes that gets absorbed instead of invoiced each year",
        topDo: "Variation logging at the job level with automated approval and invoicing workflows",
        source: "Master Builders Australia" },
      { key: "overrun", label: "Jobs with cost overruns", question: "How many of your jobs end up costing more than you quoted?", avg: "35%", top: "12%", avgNum: 35, topNum: 12, unit: "%", lower: true,
        gapCalc: (rev, _, jobs) => jobs * 0.23 * (rev / jobs) * 0.08,
        gapSimple: "The cost of overrun frequency being 23 points higher than top performers, across your jobs",
        topDo: "Real-time job cost dashboards with automated alerts when a job exceeds 80% of budget",
        source: "ABS, Master Builders Australia" },
      { key: "margin", label: "Average delivered job margin", question: "What margin do your jobs actually deliver once they're done?", avg: "11%", top: "22%", avgNum: 11, topNum: 22, unit: "%", lower: false,
        gapCalc: (rev) => rev * 0.11,
        gapSimple: "The 11-point margin gap between what average and top-performing builders actually deliver",
        topDo: "Standardised job templates with cost categories and budget tracking from day one of every project",
        source: "ABS Australian Industry 2023-24" },
      { key: "invoice", label: "Days to progress claim", question: "How long between completing a milestone and lodging the claim?", avg: "28 days", top: "10 days", avgNum: 28, topNum: 10, unit: "days", lower: true,
        gapCalc: (rev) => (rev / 12 / 22) * 18 * 0.09,
        gapSimple: "The working capital cost of claiming 18 days slower than top performers",
        topDo: "Progress claim workflows connected to milestones that generate claims as work is completed",
        source: "APQC benchmarking data" },
    ],
    connection: "Unrecovered variations erode quoted margins. Overruns that aren't caught early become write-offs at close. Slow claims compound the cash flow impact. Fix the variation and visibility problem and the rest follows.",
    trend: "ABS data shows construction expenses surged from $275B to $571B since 2011-12. In this cost environment, real-time job costing is a margin necessity, not a nice-to-have.",
    trendSource: "ABS Australian Industry 2023-24",
  },
  civil: {
    hook: "Heavy and civil engineering posted 37.3% profit growth in 2023-24, the highest of any construction segment. But that headline masks huge variance at firm level.",
    items: [
      { key: "unattributed", label: "Unattributed cost rate", question: "How much of your job costs end up floating between projects instead of pinned to a job?", avg: "6%", top: "1%", avgNum: 6, topNum: 1, unit: "%", lower: true,
        gapCalc: (rev) => rev * 0.05,
        gapSimple: "Costs not properly linked to jobs, distorting profitability data across your entire portfolio",
        topDo: "Automated cost attribution rules that link supplier invoices and POs to jobs at the point of entry",
        source: "APQC benchmarking data" },
      { key: "margin", label: "Average delivered job margin", question: "What margin do your projects actually deliver once they're done?", avg: "12%", top: "25%", avgNum: 12, topNum: 25, unit: "%", lower: false,
        gapCalc: (rev) => rev * 0.13,
        gapSimple: "The 13-point margin gap between what average and top-performing contractors deliver",
        topDo: "Live budget vs actual dashboards at the project level with drill-down into cost categories",
        source: "ABS Australian Industry 2023-24" },
      { key: "invoice", label: "Days to progress claim", question: "How long between completing a milestone and lodging the claim?", avg: "26 days", top: "7 days", avgNum: 26, topNum: 7, unit: "days", lower: true,
        gapCalc: (rev) => (rev / 12 / 22) * 19 * 0.09,
        gapSimple: "The working capital cost of claiming 19 days slower than top performers",
        topDo: "Milestone-triggered claim generation connected to job completion data",
        source: "APQC, SPI Research" },
      { key: "variation", label: "Variation recovery rate", question: "When scope changes happen on a project, how much of the extra work actually gets invoiced?", avg: "42%", top: "78%", avgNum: 42, topNum: 78, unit: "%", lower: false,
        gapCalc: (rev, _, jobs) => jobs * (rev / jobs) * 0.10 * 0.36,
        gapSimple: "Revenue from legitimate scope changes that gets absorbed instead of invoiced",
        topDo: "Structured variation capture and approval workflows linked to invoicing",
        source: "Master Builders Australia, industry benchmarks" },
    ],
    connection: "Unattributed costs hide the truth about job margins. Hidden margins lead to mispriced tenders. Mispriced tenders lead to overruns. The fix starts with cost attribution accuracy.",
    trend: "Heavy and civil engineering reported 37.3% growth in operating profit in 2023-24. The contractors capturing this are the ones with the tightest cost attribution and fastest claim cycles.",
    trendSource: "ABS Australian Industry 2023-24",
  },
  creative: {
    hook: "Creative agencies have the highest fee write-off rate of any professional services vertical. \"One more round of revisions\" is costing more than most agency owners realise.",
    items: [
      { key: "erosion", label: "Fee write-off rate", question: "How much of what you quote gets written off before the client pays, after all the revisions?", avg: "12%", top: "4%", avgNum: 12, topNum: 4, unit: "%", lower: true,
        gapCalc: (rev) => rev * 0.08,
        gapSimple: "The difference between average and top-performer write-off rates, applied to your revenue",
        topDo: "Structured change request processes linked to job costing, so every revision beyond scope is captured",
        source: "SPI Research 2025" },
      { key: "margin", label: "Average project margin", question: "What margin do your projects actually deliver?", avg: "18%", top: "38%", avgNum: 18, topNum: 38, unit: "%", lower: false,
        gapCalc: (rev) => rev * 0.20,
        gapSimple: "The 20-point margin gap between average and top agencies, almost entirely driven by scope discipline",
        topDo: "Real-time job profitability dashboards showing margin by project, client, and team composition",
        source: "SPI Research 2025" },
      { key: "util", label: "Billable utilisation", question: "What percentage of your team's time is actually spent on billable client work?", avg: "60%", top: "78%", avgNum: 60, topNum: 78, unit: "%", lower: false,
        gapCalc: (rev, staff) => { const rate = rev / (staff * 1760 * 0.60); return staff * 1760 * 0.18 * rate; },
        gapSimple: "Additional billable revenue if your team moved from average to top-performer utilisation",
        topDo: "Live utilisation dashboards showing team-level and individual billing rates against targets",
        source: "SPI Research 2025" },
      { key: "invoice", label: "Days to invoice", question: "How long between delivering work and sending the bill?", avg: "18 days", top: "6 days", avgNum: 18, topNum: 6, unit: "days", lower: true,
        gapCalc: (rev) => (rev / 12 / 22) * 12 * 0.09,
        gapSimple: "The working capital cost of invoicing 12 days slower than top performers",
        topDo: "Deliverable-triggered invoicing that drafts bills when milestones are marked complete",
        source: "SPI Research 2025" },
    ],
    connection: "Scope creep drives write-offs. Write-offs compress margins. Compressed margins mean the team works harder for less. Breaking the scope creep cycle fixes everything downstream.",
    trend: "Creative agencies show the widest margin variance of any vertical (8% to 40%+). The difference is almost entirely operational, not creative. Scope discipline and connected job management are what separate the top from the average.",
    trendSource: "SPI Research 2025 PS Maturity Benchmark",
  },
};

/* ─── METRIC BAR ─── */
function MetricBar({ avg, top, lower, unit }) {
  // Show a clean bar with avg and top markers and actual values
  const maxVal = lower ? Math.max(avg, top) * 1.4 : Math.max(avg, top) * 1.25;
  const avgPct = (avg / maxVal) * 100;
  const topPct = (top / maxVal) * 100;
  const u = unit === "%" ? "%" : unit === "days" ? "d" : "";

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ position: "relative", height: 12, background: "#E5E7EB", borderRadius: 6, overflow: "visible" }}>
        {/* Avg marker */}
        <div style={{ position: "absolute", left: `${avgPct}%`, top: -2, transform: "translateX(-50%)", zIndex: 2 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: lower ? "#EC5F60" : "#D89F0A", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
        </div>
        {/* Top marker */}
        <div style={{ position: "absolute", left: `${topPct}%`, top: -2, transform: "translateX(-50%)", zIndex: 2 }}>
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#087443", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }} />
        </div>
        {/* Fill between or to show range */}
        <div style={{ position: "absolute", left: `${Math.min(avgPct, topPct)}%`, width: `${Math.abs(topPct - avgPct)}%`, height: "100%", background: "#63DB9440", borderRadius: 6 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: lower ? "#EC5F60" : "#D89F0A" }} />
          <span style={{ fontSize: 11, color: "#6C737F", fontWeight: 600 }}>Avg: {avg}{u}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#087443" }} />
          <span style={{ fontSize: 11, color: "#087443", fontWeight: 600 }}>Top: {top}{u}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── MAIN ─── */
export default function FirmBenchmark() {
  const [screen, setScreen] = useState("intro");
  const [verticalId, setVerticalId] = useState(() => detectVertical().id);
  const [revenue, setRevenue] = useState(() => nearestBand(REVENUE_BANDS, detectVertical().defaults.rev).value);
  const [staff, setStaff] = useState(() => nearestBand(COUNT_BANDS, detectVertical().defaults.staff).value);
  const [jobs, setJobs] = useState(() => nearestBand(COUNT_BANDS, detectVertical().defaults.jobs).value);
  const [placements, setPlacements] = useState({});
  const [metricStep, setMetricStep] = useState(0);
  const [anim, setAnim] = useState(false);
  const [dir, setDir] = useState("fwd");
  const [shareState, setShareState] = useState("idle"); // idle | copied
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState("idle"); // idle | sending | sent | error
  const topRef = useRef(null);
  const completionSent = useRef(false); // fire the silent completion only once

  const v = VERTICALS.find((x) => x.id === verticalId);
  const data = verticalId ? METRICS[verticalId] : null;
  const isProject = v?.model === "project";

  const go = (cb) => { setAnim(true); setTimeout(() => { cb(); setTimeout(() => setAnim(false), 40); }, 220); };
  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth" });

  /* Seed the firm inputs from a vertical's typical-firm defaults and clear
     any self-placements, so each industry starts from a sensible baseline. */
  const seedFirm = (vert) => {
    setRevenue(vert.defaults.rev);
    setStaff(vert.defaults.staff);
    setJobs(vert.defaults.jobs);
    setPlacements({});
  };

  const setPlacement = (key, val) => setPlacements((p) => ({ ...p, [key]: val }));

  // Calculate gap costs. Each metric's gap only counts once the user has
  // placed themselves; until then it is shown as "pending" so the running
  // total only reflects what they've actually answered.
  const gapResults = useMemo(() => {
    if (!data) return [];
    return data.items.map((m) => {
      const baseGap = m.gapCalc(revenue, staff, jobs);
      const placed = !!placements[m.key];
      const pl = placements[m.key] || "avg";
      const mult = PLACEMENT_OPTIONS.find((o) => o.id === pl)?.mult || 1;
      return { ...m, gapCost: baseGap * mult, placement: pl, placed };
    });
  }, [data, revenue, staff, jobs, placements]);

  // Running total during the walk-through: only metrics already placed.
  const runningGap = gapResults.filter((r) => r.placed).reduce((s, r) => s + r.gapCost, 0);
  const totalGap = gapResults.reduce((s, r) => s + r.gapCost, 0);
  const halfGap = totalGap * 0.5;
  const biggest = gapResults.length ? [...gapResults].sort((a, b) => b.gapCost - a.gapCost)[0] : null;

  const placementLabel = (id) => PLACEMENT_OPTIONS.find((o) => o.id === id)?.label || "Around average";
  const progress = screen === "metric" && data ? ((metricStep + 1) / data.items.length) * 100 : screen === "results" ? 100 : 0;

  /* Plain-text summary of the result, used for share + emailed results. */
  const buildSummary = () => {
    return [
      "WorkflowMAX Firm Benchmark results",
      "",
      `Industry: ${v?.label}`,
      `${isProject ? "Annual revenue / jobs" : "Annual revenue / staff"}: ${fmt(revenue)} · ${isProject ? `${jobs} jobs/yr` : `${staff} staff`}`,
      `Total gap to top performers: ${fmt(totalGap)}/yr`,
      "",
      "Metric by metric (avg vs top, where you placed, what the gap is worth):",
      ...gapResults.map((m) => `- ${m.label}: avg ${m.avg} / top ${m.top}, you said "${placementLabel(m.placement)}" = ${fmt(m.gapCost)}/yr`),
      "",
      `Closing even half the gap across these ${gapResults.length} metrics is worth ${fmt(halfGap)}/yr.`,
    ].join("\n");
  };

  const handleShare = async () => {
    const shareData = {
      title: `${v?.label} Firm Benchmark`,
      text: `My firm is leaving ${fmt(totalGap)} a year on the table versus top-performing ${v?.label} firms. See where yours sits:`,
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
    wfm_tool_used: "Firm Benchmark",
    wfm_completed_benchmark: "true",
    wfm_industry: v?.label,
    wfm_firm_size: isProject ? `${jobs} jobs/yr` : `${staff} staff`,
    wfm_revenue_band: fmt(revenue),
    wfm_benchmark_gap: Math.round(totalGap),
    wfm_biggest_issue: biggest?.label,
    wfm_results_summary: buildSummary(),
  });

  /* Pre-HubSpot fallback: open the user's mail client with the summary. */
  const mailtoFallback = () => {
    if (typeof window === "undefined") return;
    const subject = encodeURIComponent("Your Firm Benchmark results");
    const body = encodeURIComponent(buildSummary());
    window.location.href = `mailto:${email.trim()}?subject=${subject}&body=${body}`;
  };

  const sendResults = async (e) => {
    e?.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!valid) { setEmailState("error"); return; }
    setEmailState("sending");
    const { ok, skipped } = await submitResults({ email: email.trim(), fields: hubspotFields(), pageName: "Firm Benchmark" });
    if (skipped) mailtoFallback(); // HubSpot not wired yet — keep the flow working
    setEmailState(ok || skipped ? "sent" : "error");
  };

  /* Build and download the branded PDF of the results, in the browser. */
  const handleDownloadPdf = () => downloadResultsPdf({
    tool: "Firm Benchmark",
    industry: v?.label,
    meta: `${fmt(revenue)} revenue · ${isProject ? `${jobs} jobs/yr` : `${staff} staff`}`,
    hero: { label: "Total gap to top performers", value: `${fmt(totalGap)}/yr`, sub: `across ${gapResults.length} metrics, at your scale`, accent: "#EC5F60" },
    itemsTitle: "Where the gap sits",
    items: gapResults.map((m) => ({ label: m.label, value: `${fmt(m.gapCost)}/yr`, note: `Avg ${m.avg} · Top ${m.top} · You: ${placementLabel(m.placement)}` })),
    highlights: [
      { title: "You don't need to reach top-performer level", body: `Closing even half the gap across these ${gapResults.length} metrics is worth ${fmt(halfGap)}/yr at your firm's scale.` },
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
      submitResults({ email: urlEmail, fields: hubspotFields(), pageName: "Firm Benchmark" });
    }
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctaBtn = (primary) => ({
    padding: "14px 28px", background: primary ? "#63DB94" : "transparent",
    color: primary ? "#0A2F28" : "#63DB94", border: primary ? "none" : "1px solid #63DB9450",
    borderRadius: 100, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.2s", display: "block", width: "100%",
  });

  return (
    <div ref={topRef} className="fb-root" style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        .fb h1, .fb h2, .fb h3, .fb h4 { font-family: 'Bruna', 'DM Sans', sans-serif; letter-spacing: -0.01em; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div className="wfm-shell">
        <BrandSidebar
          title="Firm Benchmark"
          blurb="See how your firm stacks up against peers, and what closing the gap is worth."
          step={screen === "results" ? "Your results" : screen === "metric" && data ? `Metric ${metricStep + 1} of ${data.items.length}` : "Quick setup"}
          progress={progress}
          bullets={["How you compare to firms your size", "The gap to top performers, in dollars", "Where closing it is worth the most"]}
        />
        <div className="wfm-main fb">

      {/* HEADER */}
      <div className="wfm-hide-desktop" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E5E7EB", background: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <Logo />
        {screen === "metric" && data && (
          <span style={{ fontSize: 13, color: "#6C737F", fontWeight: 500 }}>Metric {metricStep + 1}/{data.items.length}</span>
        )}
      </div>

      {/* PROGRESS BAR */}
      {(screen === "metric" || screen === "results") && (
        <div className="wfm-hide-desktop" style={{ height: 3, background: "#E5E7EB" }}>
          <div style={{ height: "100%", background: "#0D8D5C", width: `${progress}%`, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)", borderRadius: "0 2px 2px 0" }} />
        </div>
      )}

      <div className="wfm-stage" style={{ opacity: anim ? 0 : 1, transform: anim ? (dir === "fwd" ? "translateX(24px)" : "translateX(-24px)") : "translateX(0)", transition: "opacity 0.22s, transform 0.22s" }}>

        {/* ═══ INTRO ═══ */}
        {screen === "intro" && (
          <div style={{ padding: "40px 24px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#0A2F28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 20 }}>📊</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0A2F28", lineHeight: 1.15, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
              Firm<br/>Benchmark
            </h1>
            <p style={{ fontSize: 16, color: "#384250", lineHeight: 1.6, margin: "0 0 12px" }}>
              See where your firm sits on 4 key metrics against the industry average and top performers. We'll put a dollar value on the gap.
            </p>
            <p style={{ fontSize: 14, color: "#6C737F", lineHeight: 1.55, margin: "0 0 36px" }}>
              Takes about 60 seconds. All figures drawn from independent industry research.
            </p>
            <button onClick={() => { setDir("fwd"); go(() => setScreen("confirm")); }} style={ctaBtn(true)}
              onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
              See My Benchmarks
            </button>
          </div>
        )}

        {/* ═══ CONFIRM INDUSTRY ═══ */}
        {screen === "confirm" && v && (
          <div style={{ padding: "28px 24px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28", margin: "0 0 6px" }}>First, let's confirm your industry</h2>
            <p style={{ fontSize: 14, color: "#6C737F", margin: "0 0 20px" }}>We've matched you to the sector below so your benchmarks are relevant. Just confirm it's right.</p>

            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 16px", background: "#f0fdf4", border: "1px solid #0D8D5C40", borderRadius: 14, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>{v.icon}</span>
              <div>
                <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: "#087443", textTransform: "uppercase", letterSpacing: "0.06em", background: "#0D8D5C18", borderRadius: 100, padding: "2px 8px", marginBottom: 5 }}>Your industry</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0A2F28", lineHeight: 1.2 }}>{v.label}</div>
                <div style={{ fontSize: 12, color: "#6C737F", marginTop: 3, lineHeight: 1.35 }}>{v.subtitle}</div>
              </div>
            </div>

            <button onClick={() => { seedFirm(v); setDir("fwd"); go(() => setScreen("inputs")); }} style={ctaBtn(true)}
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
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28", margin: "0 0 6px" }}>What industry is your firm in?</h2>
            <p style={{ fontSize: 14, color: "#6C737F", margin: "0 0 20px" }}>Benchmarks are tailored to each sector.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {VERTICALS.map((vert) => (
                <button key={vert.id} onClick={() => {
                  setVerticalId(vert.id);
                  seedFirm(vert);
                  setDir("fwd"); go(() => setScreen("inputs"));
                }}
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

        {/* ═══ INPUTS ═══ */}
        {screen === "inputs" && v && (
          <div style={{ padding: "28px 24px" }}>
            <button onClick={() => { setDir("back"); go(() => setScreen("confirm")); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6C737F", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit" }}>← Back</button>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28", margin: "0 0 6px" }}>Tell us about your firm</h2>
            <p style={{ fontSize: 14, color: "#6C737F", margin: "0 0 24px" }}>This lets us calculate what the benchmarks mean in dollars for you specifically.</p>

            <div style={{ fontSize: 14, fontWeight: 600, color: "#0A2F28", marginBottom: 8 }}>Annual revenue (AUD)</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {REVENUE_BANDS.map((b) => {
                const sel = revenue === b.value;
                return (
                  <button key={b.id} onClick={() => setRevenue(b.value)}
                    style={{ flex: "1 1 calc(50% - 4px)", minWidth: 0, padding: "14px 10px", background: sel ? "#0A2F28" : "#F9FAFB", color: sel ? "#fff" : "#0A2F28", border: `1px solid ${sel ? "#0A2F28" : "#E5E7EB"}`, borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.borderColor = "#0D8D5C"; e.currentTarget.style.background = "#f0fdf4"; } }}
                    onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; } }}>
                    {b.label}
                  </button>
                );
              })}
            </div>

            <div style={{ height: 24 }} />
            {isProject ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0A2F28", marginBottom: 4 }}>Jobs per year</div>
                <BandSlider bands={COUNT_BANDS} value={jobs} onChange={setJobs} suffix="jobs/yr" />
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0A2F28", marginBottom: 4 }}>Billable staff</div>
                <BandSlider bands={COUNT_BANDS} value={staff} onChange={setStaff} suffix="staff" />
              </>
            )}

            <div style={{ height: 28 }} />
            <button onClick={() => { setPlacements({}); setMetricStep(0); setDir("fwd"); go(() => setScreen("metric")); }} style={ctaBtn(true)}
              onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
              Show my benchmarks
            </button>
          </div>
        )}

        {/* ═══ METRIC WALK-THROUGH (one at a time) ═══ */}
        {screen === "metric" && data && (() => {
          const m = gapResults[metricStep];
          const placed = m.placed;
          return (
            <div style={{ padding: "24px 24px 32px" }}>
              {metricStep > 0 && (
                <button onClick={() => { setDir("back"); go(() => setMetricStep((s) => s - 1)); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6C737F", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "0 0 14px", fontFamily: "inherit" }}>← Back</button>
              )}

              {/* Running total bar */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#6C737F" }}>Gap so far</span>
                <span style={{ fontFamily: HEAD, fontSize: 18, fontWeight: 800, color: "#b42318", transition: "color 0.3s" }}>{fmt(runningGap)}<span style={{ fontSize: 11, fontWeight: 500, color: "#9DA4AE" }}>/yr</span></span>
              </div>

              {/* Metric tag */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", background: "#F1F1F1", borderRadius: 100, marginBottom: 14 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#384250", textTransform: "uppercase", letterSpacing: "0.05em" }}>Metric {metricStep + 1}: {m.label}</span>
              </div>

              {/* Question as headline */}
              <h2 style={{ fontSize: 19, fontWeight: 700, color: "#0A2F28", lineHeight: 1.35, margin: "0 0 14px" }}>{m.question}</h2>

              {/* Visual bar with avg + top markers */}
              <MetricBar avg={m.avgNum} top={m.topNum} lower={m.lower} unit={m.unit} />

              {/* Self placement (required to reveal the gap) */}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0A2F28", marginBottom: 8 }}>Where does your firm sit?</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PLACEMENT_OPTIONS.map((opt) => {
                    const sel = placed && m.placement === opt.id;
                    return (
                      <button key={opt.id} onClick={() => setPlacement(m.key, opt.id)}
                        style={{
                          flex: "1 1 calc(50% - 3px)", minWidth: 0, padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                          background: sel ? "#0A2F28" : "#F9FAFB", color: sel ? "#fff" : "#384250",
                          border: `1px solid ${sel ? "#0A2F28" : "#E5E7EB"}`,
                        }}
                        onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.borderColor = "#0D8D5C"; e.currentTarget.style.background = "#f0fdf4"; } }}
                        onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; } }}>
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gap reveal — hidden until they place themselves */}
              {placed ? (
                <div style={{ animation: "fadeUp 0.4s ease both", marginTop: 16 }}>
                  <div style={{ background: "#0A2F28", borderRadius: 14, padding: "20px 16px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#9DA4AE", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Closing this gap is worth</div>
                    <div style={{ fontFamily: HEAD, fontSize: 36, fontWeight: 800, color: "#EC5F60", lineHeight: 1, letterSpacing: "-0.02em" }}>{fmt(m.gapCost)}<span style={{ fontSize: 16, fontWeight: 500, color: "#9DA4AE" }}>/yr</span></div>
                    <p style={{ fontSize: 12, color: "#9DA4AE", margin: "8px 0 0", lineHeight: 1.45 }}>{m.gapSimple}</p>
                  </div>

                  {/* Top performers */}
                  <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#087443" }}>Top performers: </span>
                    <span style={{ fontSize: 12, color: "#087443" }}>{m.topDo}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "#9DA4AE", marginTop: 8 }}>Source: {m.source}</div>

                  {/* Next */}
                  <div style={{ marginTop: 20 }}>
                    {metricStep < data.items.length - 1 ? (
                      <button onClick={() => { setDir("fwd"); go(() => setMetricStep((s) => s + 1)); }} style={ctaBtn(true)}
                        onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
                        Next metric →
                      </button>
                    ) : (
                      <button onClick={() => { setDir("fwd"); go(() => { setScreen("results"); scrollTop(); }); }} style={ctaBtn(true)}
                        onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
                        See the full picture
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "#9DA4AE", margin: "16px 0 0", lineHeight: 1.5, textAlign: "center", fontStyle: "italic" }}>
                  Pick where your firm sits to see what the gap is costing you.
                </p>
              )}
            </div>
          );
        })()}

        {/* ═══ RESULTS ═══ */}
        {screen === "results" && data && (
          <div style={{ padding: "0 0 48px" }}>

            {/* Banner */}
            <div style={{ background: "#0A2F28", padding: "20px 24px 18px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ padding: "4px 12px", background: "rgba(99,219,148,0.15)", borderRadius: 100, fontSize: 11, fontWeight: 700, color: "#63DB94" }}>{v.icon} {v.label}</span>
                <span style={{ padding: "4px 12px", background: "rgba(255,255,255,0.08)", borderRadius: 100, fontSize: 11, fontWeight: 600, color: "#9DA4AE" }}>{fmt(revenue)} revenue · {isProject ? `${jobs} jobs/yr` : `${staff} staff`}</span>
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.25, margin: "0 0 6px" }}>Your Firm Benchmark</h1>
              <p style={{ fontSize: 12, color: "#9DA4AE", margin: 0 }}>2026 · Independent research data</p>
            </div>

            <div style={{ padding: "18px 24px 0" }}>

              {/* Hook */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
                <p style={{ fontSize: 14, color: "#384250", margin: 0, lineHeight: 1.55 }}>{data.hook}</p>
              </div>

              {/* Total gap hero */}
              <div style={{ background: "#0A2F28", borderRadius: 16, padding: "24px 20px", textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9DA4AE", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Total gap to top performers</div>
                <div style={{ fontFamily: HEAD, fontSize: 44, fontWeight: 800, color: "#EC5F60", lineHeight: 1, letterSpacing: "-0.03em", marginBottom: 8 }}>
                  {fmt(totalGap)}<span style={{ fontSize: 16, fontWeight: 500, color: "#9DA4AE" }}>/yr</span>
                </div>
                <p style={{ fontSize: 13, color: "#9DA4AE", margin: 0, lineHeight: 1.5 }}>
                  Based on where you placed your firm across these {gapResults.length} metrics, at your scale.
                </p>
              </div>

              {/* Breakdown bars */}
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0A2F28", margin: "0 0 10px" }}>Where the gap sits</h3>
              <div className="wfm-grid-2" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
                {gapResults.map((m, i) => {
                  const barW = totalGap > 0 ? (m.gapCost / totalGap) * 100 : 0;
                  const isBiggest = biggest && m.key === biggest.key;
                  return (
                    <div key={m.key} style={{ background: isBiggest ? "#fef3f2" : "#F9FAFB", border: `1px solid ${isBiggest ? "#EC5F6020" : "#E5E7EB"}`, borderRadius: 12, padding: "12px 14px", animation: `fadeUp 0.3s ease ${i * 0.08}s both` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#0A2F28" }}>{m.label}</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#b42318" }}>{fmt(m.gapCost)}/yr</span>
                      </div>
                      <div style={{ height: 8, background: "#E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "#EC5F60", borderRadius: 4, width: `${barW}%`, transition: "width 0.8s ease" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
                        <span style={{ fontSize: 11, color: "#6C737F" }}>Avg {m.avg} · Top {m.top}</span>
                        <span style={{ fontSize: 11, color: "#6C737F", fontWeight: 600 }}>You: {placementLabel(m.placement)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Trend */}
              <div style={{ background: "#fefbe8", border: "1px solid #ECD99740", borderRadius: 14, padding: "14px 16px", marginTop: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#854d0e", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Industry trend</div>
                <p style={{ fontSize: 13, color: "#854d0e", margin: 0, lineHeight: 1.5 }}>{data.trend}</p>
                <div style={{ fontSize: 10, color: "#a16207", marginTop: 4, fontStyle: "italic" }}>Source: {data.trendSource}</div>
              </div>

              {/* How these connect */}
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: "14px 16px", marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0A2F28", marginBottom: 4 }}>How these metrics connect</div>
                <p style={{ fontSize: 13, color: "#384250", margin: 0, lineHeight: 1.5 }}>{data.connection}</p>
              </div>

              {/* Synthesis: closing half the gap */}
              <div style={{ background: "#0A2F28", borderRadius: 16, padding: "22px 18px", marginTop: 20, textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9DA4AE", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Closing half the gap across these {gapResults.length} metrics</div>
                <div style={{ fontFamily: HEAD, fontSize: 38, fontWeight: 800, color: "#63DB94", lineHeight: 1, marginBottom: 6, letterSpacing: "-0.03em" }}>{fmt(halfGap)}<span style={{ fontSize: 16, fontWeight: 500, color: "#9DA4AE" }}>/yr</span></div>
                <p style={{ fontSize: 13, color: "#9DA4AE", margin: 0, lineHeight: 1.5 }}>
                  You don't need to reach top-performer level. Closing even half the gap at your firm's scale is worth this much annually.
                </p>
              </div>

              {/* Share + email results */}
              <div style={{ background: "#fff8e4", border: "1px solid #ECD99740", borderRadius: 14, padding: "18px 16px", marginTop: 24 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#713b12", margin: "0 0 4px", textAlign: "center" }}>Worth comparing notes?</p>
                <p style={{ fontSize: 13, color: "#85490e", margin: "0 0 14px", lineHeight: 1.5, textAlign: "center" }}>
                  Send this to your CFO or ops lead, or email yourself the full benchmark to revisit later.
                </p>

                {/* Share */}
                <button onClick={handleShare}
                  style={{ width: "100%", padding: "12px", background: shareState === "copied" ? "#0D8D5C" : "#0A2F28", color: "#fff", border: "none", borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                  {shareState === "copied" ? "✓ Link copied" : "Share these results"}
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
                    ✓ On its way. Check your inbox for your full benchmark.
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

              {/* CTAs — soft, tailored destination first; booking demoted below */}
              <div className="wfm-cta-row" style={{ marginTop: 24 }}>
                <button onClick={() => goTo(SOLUTION_URLS[v.id])} style={ctaBtn(true)} onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
                  See how {v.label} firms close this gap →
                </button>
                <div className="wfm-spacer" style={{ height: 10 }} />
                <button onClick={() => goTo(WALKTHROUGH_URL)} style={ctaBtn(false)} onMouseEnter={(e) => { e.target.style.background = "#63DB9410"; e.target.style.borderColor = "#63DB94"; }} onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.borderColor = "#63DB9450"; }}>
                  Watch a 12-min product walkthrough
                </button>
              </div>

              {/* Booking (optional, high-intent path) */}
              <div style={{ background: "#0A2F28", borderRadius: 16, padding: "22px 18px", textAlign: "center", marginTop: 24 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>Prefer to talk it through?</h3>
                <p style={{ fontSize: 13, color: "#9DA4AE", margin: "0 0 14px", lineHeight: 1.5 }}>
                  No pressure to book. Explore at your own pace and one of our {v.label.toLowerCase()} specialists may reach out — or grab a time now if you'd rather not wait.
                </p>
                <button onClick={() => goTo(BOOKING_URLS[v.id])} style={{ ...ctaBtn(true) }} onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
                  Book a time
                </button>
              </div>

              {/* Restart */}
              <button onClick={() => { const d = detectVertical(); setVerticalId(d.id); seedFirm(d); setMetricStep(0); setShareState("idle"); setEmail(""); setEmailState("idle"); completionSent.current = false; setDir("back"); go(() => setScreen("intro")); }}
                style={{ width: "100%", padding: "12px", background: "none", border: "1px solid #E5E7EB", borderRadius: 100, fontSize: 14, fontWeight: 500, color: "#6C737F", cursor: "pointer", fontFamily: "inherit", marginTop: 16 }}>
                See benchmarks for a different industry
              </button>

              {/* Footer */}
              <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #E5E7EB", textAlign: "center" }}>
                <Logo />
                <p style={{ fontSize: 10, color: "#9DA4AE", marginTop: 6, lineHeight: 1.5 }}>
                  Benchmarks from SPI Research 2025 PS Maturity Benchmark (403 firms), ABS Australian Industry 2023-24, Gartner, APQC, and Master Builders Australia. Gap costs are estimates based on your inputs and industry averages. All figures in AUD.
                </p>
                <p style={{ fontSize: 11, color: "#9DA4AE", marginTop: 4 }}>© 2026 WorkflowMAX. All rights reserved.</p>
              </div>
            </div>
          </div>
        )}
      </div>

        </div>{/* .wfm-main */}
      </div>{/* .wfm-shell */}
    </div>
  );
}
