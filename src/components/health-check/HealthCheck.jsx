import { useState, useRef, useEffect } from "react";
import { downloadResultsPdf } from "../../lib/resultsPdf";
import { submitResults, getEmailFromUrl } from "../../lib/hubspot";
import brandBg from "../../assets/brand-bg.png";

/* ─────────────────────────────────────
   VERTICALS
   ───────────────────────────────────── */
const VERTICALS = [
  { id: "architecture", label: "Architecture & Design", subtitle: "Practices delivering design, documentation, and contract administration", icon: "📐" },
  { id: "engineering", label: "Engineering Consultancy", subtitle: "Firms providing advisory, design, and technical engineering services", icon: "⚙️" },
  { id: "consulting", label: "Management & Business Consulting", subtitle: "Strategy, advisory, and professional services firms", icon: "💼" },
  { id: "construction", label: "Construction & Trades", subtitle: "Builders, contractors, and trade services businesses", icon: "🏗️" },
  { id: "civil", label: "Civil & Infrastructure", subtitle: "Contractors delivering civil, infrastructure, and heavy engineering projects", icon: "🔧" },
  { id: "creative", label: "Creative & Marketing", subtitle: "Agencies, studios, and creative services businesses", icon: "🎨" },
];

const FIRM_SIZES = [
  { id: "small", label: "10 to 25 staff" },
  { id: "mid", label: "25 to 80 staff" },
  { id: "large", label: "80 to 200 staff" },
];

/* Heading typeface (Bruna), shared by display numbers below */
const HEAD = "'Bruna', 'DM Sans', sans-serif";

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

/* ─────────────────────────────────────
   QUESTIONS (Version B set)
   ───────────────────────────────────── */
const QUESTIONS = [
  {
    id: 1,
    theme: "Job Visibility",
    icon: "📊",
    text: "If a client called you today and asked whether their project is on budget, how long would it take you to give an honest answer?",
    subtext: "Not a guess. A confident, data-backed answer you'd stand behind.",
    options: [
      { label: "I'd have to chase people and pull numbers together first", score: 1 },
      { label: "I could get a rough answer from a spreadsheet within a day", score: 2 },
      { label: "I'd check our system, but the data could be a week or two old", score: 3 },
      { label: "I'd have it in front of me within minutes", score: 4 },
    ],
  },
  {
    id: 2,
    theme: "Data Trust",
    icon: "🎯",
    text: "When a job wraps up, how often does the final profit catch you off guard, higher or lower than you expected?",
    subtext: "It usually means the numbers during the job weren't telling the full story while you could still act on them.",
    options: [
      { label: "Often. We usually learn the real number at the end", score: 1 },
      { label: "Sometimes, and usually too late to do anything", score: 2 },
      { label: "Rarely, but when it happens the gap is big", score: 3 },
      { label: "Almost never. Our live numbers are solid enough to act on", score: 4 },
    ],
  },
  {
    id: 3,
    theme: "Connected Workflow",
    icon: "🔗",
    text: "When information moves from one stage of a job to the next, say from quoting to scheduling to invoicing, how much of that is manual re-entry?",
    subtext: "Think about how often someone types the same data into a different system.",
    options: [
      { label: "Most of it. We copy and paste between tools constantly", score: 1 },
      { label: "A fair bit. Some things connect, but there are manual gaps", score: 2 },
      { label: "Not much. Most handoffs are linked or automated", score: 3 },
      { label: "Almost none. Data flows through without re-entry", score: 4 },
    ],
  },
  {
    id: 4,
    theme: "Revenue Capture",
    icon: "💰",
    text: "What percentage of the work your team delivers do you think actually gets invoiced?",
    subtext: "Not hours logged. Work delivered. There's often a gap between what your team produces and what the client ends up paying for.",
    options: [
      { label: "Honestly, probably under 80%. We give away more than we should", score: 1 },
      { label: "Around 80 to 90%. Some things slip through", score: 2 },
      { label: "90 to 95%. We're disciplined, but not perfect", score: 3 },
      { label: "95% or more. We invoice for everything we deliver", score: 4 },
    ],
  },
  {
    id: 5,
    theme: "Capacity Planning",
    icon: "👥",
    text: "If a new project landed tomorrow, could you tell within 5 minutes who on your team has the bandwidth to take it on?",
    subtext: "Not who's 'probably free.' Who actually has capacity based on their current commitments.",
    options: [
      { label: "No. I'd have to ask around and piece it together", score: 1 },
      { label: "Roughly. I know who's busy, but nothing concrete", score: 2 },
      { label: "I'd check a spreadsheet or schedule, but it might be out of date", score: 3 },
      { label: "Yes. I can see live capacity across the team", score: 4 },
    ],
  },
  {
    id: 6,
    theme: "Invoicing",
    icon: "⚡",
    text: "What triggers an invoice at your firm: completing the work, hitting a calendar date, or someone remembering to do it?",
    subtext: "The difference between event-driven and calendar-driven invoicing can be weeks of cash flow.",
    options: [
      { label: "Mostly someone remembering, or the end of the month rolling around", score: 1 },
      { label: "We batch invoices on set dates, whenever the work actually finishes", score: 2 },
      { label: "A PM triggers it, but timing depends on how busy they are", score: 3 },
      { label: "It goes out automatically when a milestone or deliverable is done", score: 4 },
    ],
  },
  {
    id: 7,
    theme: "Budget Control",
    icon: "📋",
    text: "Think about the last job that went over budget. When did you first know it was in trouble?",
    subtext: "Not when you suspected. When you had the data to confirm it.",
    options: [
      { label: "At the end, when we reconciled the final costs", score: 1 },
      { label: "Late on, when the overrun was already big", score: 2 },
      { label: "Midway, with some time to course-correct", score: 3 },
      { label: "Early, in time to step in before it became a problem", score: 4 },
    ],
  },
  {
    id: 8,
    theme: "Knowledge Risk",
    icon: "🧠",
    text: "If your most experienced project manager left next month, how much project knowledge would walk out the door with them?",
    subtext: "Think about client relationships, job history, pricing context, and project decisions that only exist in their head or their inbox.",
    options: [
      { label: "A lot. Most of what they know isn't written down anywhere", score: 1 },
      { label: "Quite a bit. Some is in our systems, but a lot is in their head", score: 2 },
      { label: "Some, but the core job data lives in our systems", score: 3 },
      { label: "Very little. Our systems hold the full picture, not any one person", score: 4 },
    ],
  },
];

/* ─────────────────────────────────────
   MATURITY TIERS
   ───────────────────────────────────── */
const TIERS = [
  {
    id: "reactive",
    label: "Reactive",
    range: [8, 14],
    color: "#EC5F60",
    bg: "#fef3f2",
    border: "#EC5F6020",
    summary: "Your firm is operating with limited visibility into job performance, relying on gut feel and manual workarounds. This creates real risk around profitability, cash flow, and the ability to scale without things breaking.",
  },
  {
    id: "structured",
    label: "Structured",
    range: [15, 24],
    color: "#D89F0A",
    bg: "#fefbe8",
    border: "#D89F0A20",
    summary: "You have processes and tools in place, but gaps between systems and inconsistent practices mean you're leaving money on the table. The foundations are there. They need connecting.",
  },
  {
    id: "optimised",
    label: "Optimised",
    range: [25, 32],
    color: "#0D8D5C",
    bg: "#f0fdf4",
    border: "#0D8D5C20",
    summary: "Your workflows are well-connected and your team has strong visibility across the job lifecycle. You're in a strong position to fine-tune performance and explore what's possible with AI-connected analysis.",
  },
];

/* Average scores by vertical+size for comparison */
const AVERAGES = {
  architecture: { small: 14, mid: 17, large: 20 },
  engineering: { small: 15, mid: 18, large: 21 },
  consulting: { small: 14, mid: 17, large: 19 },
  construction: { small: 12, mid: 16, large: 19 },
  civil: { small: 13, mid: 16, large: 18 },
  creative: { small: 13, mid: 16, large: 19 },
};

/* ─────────────────────────────────────
   RECOMMENDATIONS (3 per tier per vertical)
   ───────────────────────────────────── */
const RECS = {
  reactive: {
    architecture: [
      { title: "See a job's costs while it's still live", desc: "On long architecture jobs, the hours and scope that eat your fee are easy to miss until the end. A live view against budget lets you catch them in time. Firms that make the switch typically recover 5 to 8% of revenue." },
      { title: "Connect quoting through to invoicing", desc: "When fee proposals, timesheets and invoices live in separate tools, detail gets lost at every handoff. One connected flow from proposal to Xero cuts the double-entry and gets invoices out faster." },
      { title: "Keep project knowledge from walking out the door", desc: "When files and approvals sit in inboxes and personal drives, every departure is a risk and every audit is painful. Linking documents straight to the job keeps the history in one place." },
    ],
    engineering: [
      { title: "See costs against budget in real time", desc: "Engineering jobs shift scope constantly, and the variations you don't track are the ones that erode margin. A live cost view catches them early. Firms that make the move typically recover 5 to 8% of revenue." },
      { title: "Capture the hours that go missing in the field", desc: "When engineers are on-site, timesheets slip and billable hours quietly disappear. Easy mobile time entry with approvals makes sure every hour lands on the right job." },
      { title: "Build one source of truth for project data", desc: "When drawings, reports and emails are scattered across drives, handovers get risky and audits get slow. Centralising everything against the job keeps it findable." },
    ],
    consulting: [
      { title: "Track engagement margin as it happens", desc: "Blended teams and shifting scope make consulting margins hard to read until the end. Watching cost against budget live means you spot erosion weeks earlier, while you can still adjust." },
      { title: "Link your pipeline, delivery and billing", desc: "When proposals, resourcing and billing live in different tools, utilisation slips and invoices lag. Connecting them means less admin and faster revenue." },
      { title: "Plan capacity before you over-commit", desc: "Consulting lives and dies on utilisation. Without a forward view you overload your seniors and underuse your juniors. Live capacity planning lets you staff smarter." },
    ],
    construction: [
      { title: "See job costs across every trade, live", desc: "Subbies, materials and labour across sites make construction costs hard to pin down until it's too late. A live view catches overruns before they hit your margin." },
      { title: "Capture every variation before it costs you", desc: "On fixed-price work, the scope changes you don't log are the ones you absorb. Logging variations as they happen, against the cost line, makes sure nothing gets given away." },
      { title: "Connect the field to the back office", desc: "When site teams log time and costs from their phone and it flows straight to invoicing, you close the gap between work done and money in." },
    ],
    civil: [
      { title: "Catch overruns in week 2, not month 6", desc: "Civil jobs span labour, plant, materials and subbies, so costs blur together until reconciliation. A live cost view lets you act while it still matters." },
      { title: "Recover variations before they vanish", desc: "On fixed-price civil work, a variation not captured in the billing cycle tends to get absorbed for good. A clear variation process tied to costing makes sure every legitimate change is claimed." },
      { title: "Speed up progress claims to protect cash", desc: "Civil work is capital-heavy, so a claim that takes four weeks is four weeks you're funding yourself. Linking milestones to claim generation cuts that cycle right down." },
    ],
    creative: [
      { title: "See where the fee is going, mid-project", desc: "Fluid briefs and endless rounds make creative margins slippery. Tracking cost against budget during the work catches scope creep before it eats the fee." },
      { title: "Join up briefing, time and billing", desc: "When briefs, timesheets and invoices live in different tools, the team loses hours to admin instead of client work. One connected flow lifts both output and margin." },
      { title: "Get a clear read on who's overloaded", desc: "Agencies run hot without noticing until someone burns out. A live capacity view shows who's buried, who's free, and where you can safely take on more." },
    ],
  },
  structured: {
    architecture: [
      { title: "Close the gaps between your tools", desc: "You've got the pieces, but the manual handoffs between them cause delays and lost detail. Linking quoting, time and invoicing into one flow gives you a single source of truth for every job." },
      { title: "Turn capacity from a spreadsheet into a live view", desc: "Knowing who's free next week shouldn't take a phone call. A live view drawn from real allocations lets you resource confidently and spot utilisation dips early." },
      { title: "Let your data surface the insights", desc: "Leading firms use connected workflows to flag at-risk jobs and billing gaps automatically, instead of building reports by hand or hopping between tools." },
    ],
    engineering: [
      { title: "Tighten the link between field and finance", desc: "You track costs, but it leans on people following the process. Pushing field data into your finance system automatically closes the compliance gap and lifts accuracy." },
      { title: "Make every PM handle variations the same way", desc: "Inconsistent scope-change handling is a quiet margin leak. One clear process for logging, approving and billing variations means nothing slips through unnoticed." },
      { title: "Use your data to get ahead of problems", desc: "Connected data shows which job types run over and which clients cost more to serve, so you can act before it shows up in the numbers." },
    ],
    consulting: [
      { title: "Retire the side-spreadsheets", desc: "If your team still keeps spreadsheets for WIP or client reporting, your core system isn't pulling its weight. Consolidating them saves hours a week and cuts errors." },
      { title: "Make invoicing a byproduct of delivery", desc: "When timesheets and milestones flow straight into draft invoices, billing just happens instead of getting batched and chased. Cash comes in faster with less admin." },
      { title: "Read the patterns already in your data", desc: "Your numbers already show which engagements are most profitable and where utilisation dips. Connected analysis surfaces it without anyone building a spreadsheet." },
    ],
    construction: [
      { title: "Standardise how every PM sets up a job", desc: "Different job structures make projects impossible to compare. Shared templates for tasks, costs and milestones give you reliable data to benchmark and improve." },
      { title: "Link supplier costs to the right job automatically", desc: "Matching supplier invoices to jobs by hand means things get missed. Automatic cost attribution puts every dollar against the right project, so your margins are accurate without the effort." },
      { title: "Flag at-risk jobs early", desc: "With job data connected to analysis, you can see projects trending over budget and act before a small overrun turns into a real loss." },
    ],
    civil: [
      { title: "Standardise cost attribution across projects", desc: "When PMs use different structures, you can't compare across your portfolio. Consistent templates for costs and milestones give you reliable benchmarking data." },
      { title: "Close the gap between site and finance", desc: "You track costs, but a manual step between the field and finance hurts both speed and accuracy. Automating that handoff keeps your numbers current and clean." },
      { title: "Spot at-risk projects before they slip", desc: "With your job data already structured, connected analysis flags projects trending over budget and unusual cost patterns that would take hours to find by hand." },
    ],
    creative: [
      { title: "Make scope tracking consistent across clients", desc: "Creative work invites scope creep, and if tracking depends on each PM, your data won't add up. A shared way to log extra requests against cost protects your margins." },
      { title: "Turn your time data into live utilisation", desc: "You're capturing time, but is it driving decisions? Live utilisation shows which teams are running hot, who has room, and whether your pricing matches the real effort." },
      { title: "Find your most and least profitable work", desc: "Your job data shows which clients, project types and team mixes deliver the best margins. Connected analysis surfaces it so you can chase the work that actually pays." },
    ],
  },
  optimised: {
    architecture: [
      { title: "Benchmark against the best firms in your region", desc: "You run a tight ship. The next step is seeing how your utilisation, margins and invoicing cycles stack up against the top-performing architecture firms around you." },
      { title: "Put your clean data to work predicting", desc: "With your data well-structured, you're set up to use connected analysis for forecasting, risk detection and reporting that would otherwise take hours to produce." },
      { title: "Make sure your processes scale with you", desc: "What works at 30 staff can break at 80. Keeping the same visibility across multiple offices and disciplines is what separates smooth growth from growing pains." },
    ],
    engineering: [
      { title: "Benchmark your numbers against the industry", desc: "Your processes are strong. Comparing your utilisation, margins and days-to-invoice against industry benchmarks shows where the last gains are hiding." },
      { title: "Forecast demand instead of reacting to it", desc: "Clean, connected data lets you predict resourcing needs, manage pipeline capacity, and step off the feast-or-famine cycle." },
      { title: "Get set for multi-region growth now", desc: "If expansion is on the cards, making sure your platform handles consolidated reporting and cross-entity visibility today saves a painful migration later." },
    ],
    consulting: [
      { title: "Benchmark your utilisation and margins", desc: "Top consulting firms run at 75% or more billable utilisation. Seeing where you sit against that shows exactly where small gains drive real revenue." },
      { title: "Let your data write the reports", desc: "You've got the data. Connected analysis can produce client profitability reports and flag engagement risks without anyone touching a spreadsheet." },
      { title: "Make sure your stack is ready for what's next", desc: "The tools that got you here may not carry you to bigger engagements. Check your platform can handle the added complexity before you feel it." },
    ],
    construction: [
      { title: "Benchmark your margins and invoicing speed", desc: "You're tracking well. Comparing your job margins, days-to-invoice and overrun frequency against firms your size shows where the remaining edge is." },
      { title: "Predict overruns before they happen", desc: "With structured job data flowing through, connected analysis can spot the early signs of a project heading over budget and flag it before you need to step in." },
      { title: "Hold your margins as you add sites", desc: "Growth means more sites and more subbies. Keeping visibility and control as volume rises is what protects margin at scale." },
    ],
    civil: [
      { title: "Benchmark your margins and claim speed", desc: "You run a strong operation. Comparing your margins, claim speed and overrun frequency against the top civil contractors in Australia shows where the last gains sit." },
      { title: "Forecast project risk and resource demand", desc: "With clean job data, connected analysis can predict which projects are likely to overrun and help you plan resourcing months ahead." },
      { title: "Get ready for bigger contracts now", desc: "Larger contracts and new regions add complexity. Making sure your platform handles consolidated reporting and cross-project visibility today avoids a painful migration later." },
    ],
    creative: [
      { title: "Benchmark your agency against the market", desc: "Top agencies run at 70 to 80% utilisation with healthy margins. Seeing how you compare shows where tuning pricing, scoping or staffing could move the needle." },
      { title: "Surface your most profitable patterns", desc: "Your data is clean and connected. Analysis can reveal which clients and project types deliver the best margins, so you know where to point business development." },
      { title: "Grow without adding complexity", desc: "Scaling an agency usually means more people and more moving parts. Systems that grow with you, without piling on admin, are what keep agencies profitable as they scale." },
    ],
  },
};

/* ─────────────────────────────────────
   WFM LOGO
   ───────────────────────────────────── */
const Logo = () => (
  <svg width="120" height="36" viewBox="0 0 134 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#lc)">
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
    <defs><clipPath id="lc"><rect width="134" height="40" fill="white"/></clipPath></defs>
  </svg>
);

/* ─────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────── */
export default function WorkflowHealthCheck() {
  const [screen, setScreen] = useState("intro");
  const [vertical, setVertical] = useState(() => detectVertical());
  const [firmSize, setFirmSize] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [anim, setAnim] = useState(false);
  const [dir, setDir] = useState("fwd");
  const [shareState, setShareState] = useState("idle"); // idle | copied
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState("idle"); // idle | sending | sent | error
  const topRef = useRef(null);
  const completionSent = useRef(false); // fire the silent completion only once

  const totalScore = Object.values(answers).reduce((s, a) => s + a.score, 0);
  const tier = TIERS.find((t) => totalScore >= t.range[0] && totalScore <= t.range[1]) || TIERS[0];
  const tierKey = tier.id;
  const avgScore = vertical && firmSize ? AVERAGES[vertical.id]?.[firmSize] || 16 : 16;
  const recs = vertical ? RECS[tierKey]?.[vertical.id] || [] : [];

  const scoreBreakdown = QUESTIONS.map((q) => ({
    theme: q.theme, icon: q.icon, score: answers[q.id]?.score || 0,
  }));
  const sorted = [...scoreBreakdown].sort((a, b) => a.score - b.score);
  const biggestGap = sorted[0];

  const progress = screen === "question" ? ((currentQ + 1) / QUESTIONS.length) * 100 : screen === "results" ? 100 : 0;

  const go = (cb) => {
    setAnim(true);
    setTimeout(() => { cb(); setTimeout(() => setAnim(false), 40); }, 220);
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: "smooth" });

  const pick = (qId, opt) => {
    setAnswers((p) => ({ ...p, [qId]: opt }));
    if (currentQ < QUESTIONS.length - 1) {
      setDir("fwd"); go(() => setCurrentQ((c) => c + 1));
    } else {
      setDir("fwd"); go(() => { setScreen("results"); scrollTop(); });
    }
  };

  const back = () => {
    if (screen === "question" && currentQ > 0) { setDir("back"); go(() => setCurrentQ((c) => c - 1)); }
    else if (screen === "question" && currentQ === 0) { setDir("back"); go(() => setScreen("size")); }
  };

  const restart = () => {
    setAnswers({}); setCurrentQ(0); setVertical(detectVertical()); setFirmSize(null);
    setShareState("idle"); setEmail(""); setEmailState("idle"); completionSent.current = false;
    setDir("back"); go(() => setScreen("intro"));
  };

  /* Build a plain-text summary of answers + recommendations.
     Used for both the share action and the emailed results. */
  const buildSummary = () => {
    const sizeLabel = FIRM_SIZES.find((s) => s.id === firmSize)?.label || "";
    const lines = [
      `WorkflowMAX Workflow Health Check results`,
      ``,
      `Industry: ${vertical?.label}`,
      `Team size: ${sizeLabel}`,
      `Maturity score: ${totalScore}/32 (${tier.label})`,
      `Industry average: ${avgScore}/32`,
      ``,
      `Scores by area:`,
      ...QUESTIONS.map((q) => `- ${q.theme}: ${answers[q.id]?.score || 0}/4`),
      ``,
      `Recommended focus areas:`,
      ...recs.map((r, i) => `${i + 1}. ${r.title}\n   ${r.desc}`),
    ];
    return lines.join("\n");
  };

  const handleShare = async () => {
    const shareData = {
      title: "WorkflowMAX Workflow Health Check",
      text: `My firm scored ${totalScore}/32 (${tier.label}) on the WorkflowMAX Workflow Health Check. See where yours lands:`,
      url: typeof window !== "undefined" ? window.location.href : "",
    };
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share(shareData);
        return;
      }
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
    wfm_tool_used: "Workflow Health Check",
    wfm_completed_health_check: "true",
    wfm_industry: vertical?.label,
    wfm_firm_size: FIRM_SIZES.find((s) => s.id === firmSize)?.label,
    wfm_health_score: totalScore,
    wfm_maturity_tier: tier.label,
    wfm_biggest_issue: biggestGap?.theme,
    wfm_results_summary: buildSummary(),
  });

  /* Pre-HubSpot fallback: open the user's mail client with the summary. */
  const mailtoFallback = () => {
    if (typeof window === "undefined") return;
    const subject = encodeURIComponent("Your Workflow Health Check results");
    const body = encodeURIComponent(buildSummary());
    window.location.href = `mailto:${email.trim()}?subject=${subject}&body=${body}`;
  };

  const sendResults = async (e) => {
    e?.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!valid) { setEmailState("error"); return; }
    setEmailState("sending");
    const { ok, skipped } = await submitResults({ email: email.trim(), fields: hubspotFields(), pageName: "Workflow Health Check" });
    if (skipped) mailtoFallback(); // HubSpot not wired yet — keep the flow working
    setEmailState(ok || skipped ? "sent" : "error");
  };

  /* Build and download the branded PDF of the results, in the browser. */
  const handleDownloadPdf = () => downloadResultsPdf({
    tool: "Workflow Health Check",
    industry: vertical?.label,
    meta: `${FIRM_SIZES.find((s) => s.id === firmSize)?.label || ""} · ${tier.label}`,
    hero: { label: "Your workflow maturity score", value: `${totalScore}/32`, sub: `${tier.label} · industry average ${avgScore}/32`, accent: tier.color },
    itemsTitle: "Your scores by area",
    itemValueColor: "#0A2F28",
    items: scoreBreakdown.map((s) => ({ label: s.theme, value: `${s.score}/4` })),
    highlightsTitle: "Recommended focus areas",
    highlights: recs.map((r) => ({ title: r.title, body: r.desc })),
  });

  /* Frictionless completion: if identity rides in on the enriched campaign link
     (?email=…), record the completion the moment they reach results — no form
     needed. Everyone else is captured via the email block below. */
  useEffect(() => {
    if (screen !== "results" || completionSent.current) return;
    const urlEmail = getEmailFromUrl();
    if (urlEmail) {
      completionSent.current = true;
      submitResults({ email: urlEmail, fields: hubspotFields(), pageName: "Workflow Health Check" });
    }
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Shared styles */
  const pill = (active) => ({
    padding: "14px 20px", background: active ? "#0A2F28" : "#F9FAFB",
    color: active ? "#fff" : "#0A2F28", border: `1px solid ${active ? "#0A2F28" : "#E5E7EB"}`,
    borderRadius: 12, fontSize: 15, fontWeight: 500, lineHeight: 1.4,
    cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "all 0.15s", width: "100%",
  });
  const ctaBtn = (primary) => ({
    padding: "14px 28px", background: primary ? "#63DB94" : "transparent",
    color: primary ? "#0A2F28" : "#63DB94", border: primary ? "none" : "1px solid #63DB9450",
    borderRadius: 100, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
    transition: "all 0.2s", display: "block", width: "100%",
  });

  return (
    <div ref={topRef} className="hc-root">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        .hc-root { font-family: 'DM Sans', sans-serif; min-height: 100vh; background: #fff; }
        .hc h1, .hc h2, .hc h3, .hc h4 { font-family: 'Bruna', 'DM Sans', sans-serif; letter-spacing: -0.01em; }
        .hc-brand { display: none; }
        .hc-main { max-width: 480px; margin: 0 auto; background: #fff; min-height: 100vh; }
        @keyframes slideIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideOut { from { opacity:0; transform:translateX(-24px); } to { opacity:1; transform:translateX(0); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @media (min-width: 768px) {
          body { margin: 0; }
          .hc-root {
            background: url(${brandBg}) center center / cover no-repeat fixed;
          }
          .hc-shell { max-width: 1080px; margin: 0 auto; display: flex; align-items: stretch; }
          .hc-brand { display: flex; flex-direction: column; width: 360px; flex-shrink: 0; background: #0A2F28; }
          .hc-brand-inner { position: sticky; top: 0; padding: 44px 34px; display: flex; flex-direction: column; }
          .hc-main { max-width: none; margin: 0; flex: 1 1 auto; min-width: 0; box-shadow: 0 24px 60px rgba(10,47,40,0.12); }
          .hc-stage { max-width: 680px; margin: 0 auto; }
          .hc-hide-desktop { display: none !important; }
          .hc-grid-2 { display: grid !important; grid-template-columns: 1fr 1fr; gap: 10px !important; align-items: start; }
          .hc-cta-row { display: flex !important; gap: 12px; }
          .hc-cta-row > button { width: auto !important; flex: 1; }
          .hc-spacer { display: none !important; }
        }
      `}</style>

      <div className="hc-shell">

        {/* ── BRAND SIDEBAR (desktop only) ── */}
        <aside className="hc-brand">
          <div className="hc-brand-inner">
            <div style={{ background: "#fff", borderRadius: 12, padding: "9px 14px", display: "inline-flex", alignSelf: "flex-start", marginBottom: 34 }}>
              <Logo />
            </div>
            <h2 style={{ fontFamily: HEAD, fontSize: 30, fontWeight: 800, color: "#fff", lineHeight: 1.15, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
              Workflow Health Check
            </h2>
            <p style={{ fontSize: 15, color: "#9DB9AE", lineHeight: 1.6, margin: "0 0 30px" }}>
              See how your firm manages jobs from quote through to invoice, and where the easy wins are.
            </p>

            {/* Progress */}
            <div style={{ marginBottom: 30 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#63DB94", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 9 }}>
                {screen === "results" ? "Your results" : screen === "question" ? `Question ${currentQ + 1} of ${QUESTIONS.length}` : "Quick setup"}
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 100, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(progress, 5)}%`, background: "#63DB94", borderRadius: 100, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
              </div>
            </div>

            {/* What you'll get */}
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {["Your maturity score vs firms your size", "The biggest gap quietly costing you margin", "Three recommendations tailored to your sector"].map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#63DB94", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                    <svg width="11" height="9" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1.5" stroke="#0A2F28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <span style={{ fontSize: 14, color: "#E5E7EB", lineHeight: 1.45 }}>{t}</span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: 12, color: "#6F8C82", lineHeight: 1.5, margin: "34px 0 0" }}>
              Trusted by 100,000+ professionals. 18 years in market.
            </p>
          </div>
        </aside>

        {/* ── MAIN PANE ── */}
        <div className="hc-main hc">

      {/* ── HEADER (mobile) ── */}
      <div className="hc-hide-desktop" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #E5E7EB", background: "#fff", position: "sticky", top: 0, zIndex: 10 }}>
        <Logo />
        {screen === "question" && (
          <span style={{ fontSize: 13, color: "#6C737F", fontWeight: 500 }}>{currentQ + 1}/{QUESTIONS.length}</span>
        )}
      </div>

      {/* ── PROGRESS ── */}
      {(screen === "question" || screen === "results") && (
        <div className="hc-hide-desktop" style={{ height: 3, background: "#E5E7EB" }}>
          <div style={{ height: "100%", background: "#0D8D5C", width: `${progress}%`, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)", borderRadius: "0 2px 2px 0" }} />
        </div>
      )}

      {/* ── ANIMATED CONTENT ── */}
      <div className="hc-stage" style={{ opacity: anim ? 0 : 1, transform: anim ? (dir === "fwd" ? "translateX(24px)" : "translateX(-24px)") : "translateX(0)", transition: "opacity 0.22s, transform 0.22s" }}>

        {/* ════ INTRO ════ */}
        {screen === "intro" && (
          <div style={{ padding: "40px 24px" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "#0A2F28", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 20 }}>🩺</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0A2F28", lineHeight: 1.15, margin: "0 0 12px", letterSpacing: "-0.02em" }}>
              Workflow<br/>Health Check
            </h1>
            <p style={{ fontSize: 16, color: "#384250", lineHeight: 1.6, margin: "0 0 12px" }}>
              8 questions to benchmark how your firm manages jobs from quote through to invoice. Takes about 2 minutes.
            </p>
            <p style={{ fontSize: 14, color: "#6C737F", lineHeight: 1.55, margin: "0 0 36px" }}>
              You'll get a maturity score compared to firms your size, your biggest gap area, and specific recommendations for your industry.
            </p>
            <button onClick={() => { setDir("fwd"); go(() => setScreen("confirm")); }} style={ctaBtn(true)}
              onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
              Start Health Check
            </button>
          </div>
        )}

        {/* ════ CONFIRM INDUSTRY ════ */}
        {screen === "confirm" && (
          <div style={{ padding: "28px 24px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28", margin: "0 0 6px" }}>First, let's confirm your industry</h2>
            <p style={{ fontSize: 14, color: "#6C737F", margin: "0 0 20px" }}>We've matched you to the sector below so your benchmarks and recommendations are relevant. Just confirm it's right.</p>

            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 16px", background: "#f0fdf4", border: "1px solid #0D8D5C40", borderRadius: 14, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>{vertical?.icon}</span>
              <div>
                <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: "#087443", textTransform: "uppercase", letterSpacing: "0.06em", background: "#0D8D5C18", borderRadius: 100, padding: "2px 8px", marginBottom: 5 }}>Your industry</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#0A2F28", lineHeight: 1.2 }}>{vertical?.label}</div>
                <div style={{ fontSize: 12, color: "#6C737F", marginTop: 3, lineHeight: 1.35 }}>{vertical?.subtitle}</div>
              </div>
            </div>

            <button onClick={() => { setDir("fwd"); go(() => setScreen("size")); }} style={ctaBtn(true)}
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

        {/* ════ VERTICAL ════ */}
        {screen === "vertical" && (
          <div style={{ padding: "28px 24px" }}>
            <button onClick={() => { setDir("back"); go(() => setScreen("confirm")); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6C737F", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit" }}>
              ← Back
            </button>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28", margin: "0 0 6px" }}>What industry is your firm in?</h2>
            <p style={{ fontSize: 14, color: "#6C737F", margin: "0 0 20px" }}>This tailors benchmarks and recommendations to your sector.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {VERTICALS.map((v) => (
                <button key={v.id} onClick={() => { setVertical(v); setDir("fwd"); go(() => setScreen("size")); }}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit", textAlign: "left" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0D8D5C"; e.currentTarget.style.background = "#f0fdf4"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; }}>
                  <span style={{ fontSize: 22 }}>{v.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0A2F28" }}>{v.label}</div>
                    <div style={{ fontSize: 12, color: "#6C737F", marginTop: 2, lineHeight: 1.35 }}>{v.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ════ FIRM SIZE ════ */}
        {screen === "size" && (
          <div style={{ padding: "28px 24px" }}>
            <button onClick={() => { setDir("back"); go(() => setScreen("confirm")); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6C737F", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "0 0 16px", fontFamily: "inherit" }}>
              ← Back
            </button>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0A2F28", margin: "0 0 6px" }}>How large is your team?</h2>
            <p style={{ fontSize: 14, color: "#6C737F", margin: "0 0 20px" }}>This helps us compare your results to firms your size.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FIRM_SIZES.map((s) => (
                <button key={s.id} onClick={() => { setFirmSize(s.id); setDir("fwd"); go(() => setScreen("question")); }}
                  style={{ padding: "18px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit", fontSize: 16, fontWeight: 600, color: "#0A2F28", textAlign: "center" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0D8D5C"; e.currentTarget.style.background = "#f0fdf4"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ════ QUESTIONS ════ */}
        {screen === "question" && (
          <div style={{ padding: "20px 24px 32px" }}>
            {currentQ > 0 && (
              <button onClick={back} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#6C737F", fontSize: 14, fontWeight: 500, cursor: "pointer", padding: "0 0 14px", fontFamily: "inherit" }}>← Back</button>
            )}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 12px", background: "#F1F1F1", borderRadius: 100, marginBottom: 14 }}>
              <span style={{ fontSize: 13 }}>{QUESTIONS[currentQ].icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#384250", textTransform: "uppercase", letterSpacing: "0.05em" }}>{QUESTIONS[currentQ].theme}</span>
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 700, color: "#0A2F28", lineHeight: 1.35, margin: "0 0 6px" }}>
              {QUESTIONS[currentQ].text}
            </h2>
            <p style={{ fontSize: 13, color: "#6C737F", lineHeight: 1.5, margin: "0 0 22px" }}>
              {QUESTIONS[currentQ].subtext}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {QUESTIONS[currentQ].options.map((opt, i) => {
                const sel = answers[QUESTIONS[currentQ].id]?.label === opt.label;
                return (
                  <button key={i} onClick={() => pick(QUESTIONS[currentQ].id, opt)} style={pill(sel)}
                    onMouseEnter={(e) => { if (!sel) { e.currentTarget.style.borderColor = "#0D8D5C"; e.currentTarget.style.background = "#f0fdf4"; } }}
                    onMouseLeave={(e) => { if (!sel) { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#F9FAFB"; } }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ════ RESULTS ════ */}
        {screen === "results" && (
          <div style={{ padding: "28px 24px 48px" }}>

            {/* Score card */}
            <div style={{ background: tier.bg, border: `1px solid ${tier.border}`, borderRadius: 16, padding: "24px 20px", textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: HEAD, fontSize: 48, fontWeight: 800, color: tier.color, lineHeight: 1, letterSpacing: "-0.03em" }}>
                {totalScore}<span style={{ fontSize: 20, color: "#6C737F", fontWeight: 400 }}>/32</span>
              </div>
              <div style={{ display: "inline-flex", padding: "4px 14px", background: `${tier.color}18`, borderRadius: 100, fontSize: 14, fontWeight: 700, color: tier.color, margin: "8px 0 10px" }}>
                {tier.label}
              </div>
              {/* Comparison */}
              <div style={{ fontSize: 13, color: "#384250", lineHeight: 1.5, marginBottom: 6 }}>
                {vertical?.label} firms with {FIRM_SIZES.find((s) => s.id === firmSize)?.label} average <strong>{avgScore}/32</strong>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: totalScore >= avgScore ? "#087443" : "#b42318" }}>
                  {totalScore >= avgScore ? `${totalScore - avgScore} points above average` : `${avgScore - totalScore} points below average`}
                </span>
              </div>
            </div>

            {/* Tier summary */}
            <p style={{ fontSize: 14, color: "#384250", lineHeight: 1.6, margin: "0 0 20px" }}>{tier.summary}</p>

            {/* Biggest gap callout (tone adapts to the lowest-scoring area) */}
            {biggestGap && (() => {
              const s = biggestGap.score;
              const t = s <= 2
                ? { label: "Your biggest opportunity area", color: "#b42318", bg: "#fef3f2", border: "#EC5F6020", body: "This is where the gap between your current approach and best practice is widest. Even a small improvement here is likely to have a noticeable impact on profitability and operational control." }
                : s === 3
                ? { label: "Where you've got room to tighten", color: "#85490e", bg: "#fefbe8", border: "#D89F0A20", body: "You're doing well here, but it's still your lowest-scoring area. A small refinement is often where the next bit of margin and control is hiding." }
                : { label: "Even your lowest area is strong", color: "#087443", bg: "#f0fdf4", border: "#0D8D5C20", body: "There's no obvious weak spot. From here it's about fine-tuning and exploring what connected, AI-assisted analysis can surface across your portfolio." };
              return (
                <div style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 14, padding: "16px", marginBottom: 20, animation: "fadeUp 0.4s ease 0.1s both" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{t.label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{biggestGap.icon}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#0A2F28" }}>{biggestGap.theme}</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#384250", margin: "6px 0 0", lineHeight: 1.45 }}>{t.body}</p>
                </div>
              );
            })()}

            {/* Score breakdown */}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0A2F28", margin: "0 0 10px" }}>Your scores by area</h3>
            <div className="hc-grid-2" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
              {scoreBreakdown.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#F9FAFB", borderRadius: 10, animation: `fadeUp 0.3s ease ${i * 0.05}s both` }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#0A2F28" }}>{item.theme}</span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {[1, 2, 3, 4].map((d) => (
                      <div key={d} style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: d <= item.score ? (item.score >= 3 ? "#0D8D5C" : item.score >= 2 ? "#D89F0A" : "#EC5F60") : "#E5E7EB",
                      }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations (text only, no individual CTAs) */}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0A2F28", margin: "0 0 4px" }}>Recommended focus areas</h3>
            <p style={{ fontSize: 12, color: "#6C737F", margin: "0 0 14px" }}>Based on your results for {vertical?.label} firms</p>
            <div className="hc-grid-2" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
              {recs.map((rec, i) => (
                <div key={i} style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 14, padding: "16px", animation: `fadeUp 0.4s ease ${0.2 + i * 0.08}s both` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 7, background: "#0A2F28", color: "#63DB94", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{i + 1}</div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: "#0A2F28", margin: 0, lineHeight: 1.3 }}>{rec.title}</h4>
                  </div>
                  <p style={{ fontSize: 13, color: "#384250", lineHeight: 1.55, margin: 0 }}>{rec.desc}</p>
                </div>
              ))}
            </div>

            {/* CTAs — soft, tailored destination first */}
            <div className="hc-cta-row">
              <button onClick={() => goTo(SOLUTION_URLS[vertical.id])} style={ctaBtn(true)} onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
                See how {vertical.label} firms close these gaps →
              </button>
              <div className="hc-spacer" style={{ height: 10 }} />
              <button onClick={() => goTo(WALKTHROUGH_URL)} style={ctaBtn(false)} onMouseEnter={(e) => { e.target.style.background = "#63DB9410"; e.target.style.borderColor = "#63DB94"; }} onMouseLeave={(e) => { e.target.style.background = "transparent"; e.target.style.borderColor = "#63DB9450"; }}>
                Watch a 12-min product walkthrough
              </button>
            </div>

            {/* Share + email results */}
            <div style={{ background: "#fff8e4", border: "1px solid #ECD99740", borderRadius: 14, padding: "18px 16px", marginTop: 24 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#713b12", margin: "0 0 4px", textAlign: "center" }}>Worth comparing notes?</p>
              <p style={{ fontSize: 13, color: "#85490e", margin: "0 0 14px", lineHeight: 1.5, textAlign: "center" }}>
                Send this to your COO or ops lead, or email yourself the full results to revisit later.
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
                  ✓ On its way. Check your inbox for your full results.
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
                No pressure to book. Explore at your own pace and one of our {vertical.label.toLowerCase()} specialists may reach out — or grab a time now if you'd rather not wait.
              </p>
              <button onClick={() => goTo(BOOKING_URLS[vertical.id])} style={{ ...ctaBtn(true), background: "#63DB94" }}
                onMouseEnter={(e) => (e.target.style.background = "#45c97e")} onMouseLeave={(e) => (e.target.style.background = "#63DB94")}>
                Book a time
              </button>
            </div>

            {/* Retake */}
            <button onClick={restart} style={{ width: "100%", padding: "12px", background: "none", border: "1px solid #E5E7EB", borderRadius: 100, fontSize: 14, fontWeight: 500, color: "#6C737F", cursor: "pointer", fontFamily: "inherit", marginTop: 16 }}>
              Retake Health Check
            </button>

            {/* Footer */}
            <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #E5E7EB", textAlign: "center" }}>
              <Logo />
              <p style={{ fontSize: 12, color: "#9DA4AE", marginTop: 6 }}>© 2026 WorkflowMAX. All rights reserved.</p>
            </div>
          </div>
        )}
      </div>

        </div>{/* .hc-main */}
      </div>{/* .hc-shell */}
    </div>
  );
}
