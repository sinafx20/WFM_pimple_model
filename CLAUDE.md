# WorkflowMAX Pimple Model: MVP Outbound Campaign

## Project Overview

You are helping build interactive content pieces for WorkflowMAX's (capital MAX) first MVP outbound email campaign targeting CEO/MD/CFO/COO personas at professional services firms (20-200 staff) across Australia. This is called the "Pimple Model", a compressed version of a signal accumulation framework where every prospect interaction feeds a lead score.

## What WorkflowMAX Is

Job management SaaS for professional services firms. Covers the full job lifecycle: quoting, job creation, time tracking, cost tracking, invoicing, and reporting. Native Xero integration. Used by architecture, engineering, consulting, construction, and creative firms. Recently launched MCP integration for AI-connected workflows. WorkflowMAX and BlueRock share a mutual majority shareholder, Everything Is Awesome (EIA). Not owned by Xero.

## Campaign Structure

6 touchpoints over 18 days per contact. 250 contacts staggered at 50/day across week 1. Two AEs splitting verticals:
- Sina: Management & Business Consulting, Creative & Marketing, Civil & Infrastructure
- Denzel: Architecture & Design, Engineering Consultancy, Construction & Trades

Average ACV: $20K. Campaign launch: June 8, 2026. Total budget: under $350 USD.

## Touchpoint Map

- TP1 (Day 1, Tue, Email): AI video + Workflow Health Check
- TP2 (Day 5, Fri, Email): Profit Leak Calculator
- TP3 (Day 9, Tue, SMS conditional): Firm Benchmark
- TP4 (Day 12, Fri, Email): Demo video landing page (YouTube ID: X7RX3Bzz0sk)
- TP5 (Day 15, Tue, Email): Firms Like Yours (case studies)
- TP6 (Day 18, Fri, Email): Breakup recap (plain text, no build needed)

## Scoring Thresholds

- Email open: +5 | Link click: +15 | Content interaction: +25 | Booking link click: +50
- Warm (25-64): AE notified, sequence continues
- Hot (65-99): Sequence pauses, AE task created, outreach within 24hrs
- Eruption (100+): Sequence stops, AE calls within the hour

## Content Pieces (5 React components)

### 1. Workflow Health Check (TP1)
- 8 scenario-based questions (Version B set: reflective, not operational)
- Vertical selector (6 verticals with subtitles) + firm size selector (5-20, 21-80, 81-200)
- Single-question-per-screen flow with animated transitions
- Maturity scoring: Reactive / Structured / Optimised
- Results page: score with industry average comparison, biggest gap callout, 3 text-only recommendations per tier per vertical, share prompt
- CTAs: "See how much this is costing you" (primary, to calculator), "See how firms your size compare" (secondary, to benchmark), "Book a Conversation" (bottom)

### 2. Profit Leak Calculator (TP2)
- Step-by-step flow, one leak per screen (NOT a wall of sliders)
- Two firm inputs only: revenue + staff/jobs
- 5 compounding leaks per model:
  - Services model (Arch, Eng, Consulting, Creative): fee erosion, invisible cost gap, invoicing delay, scope creep, rework
  - Project model (Construction, Civil): margin erosion, variation black hole, invoicing delay, unattributed costs, rework
- Each leak screen: provocative question, industry default with source, optional "Adjust for my firm" slider reveal, individual dollar cost
- Running total bar with progressive colour (amber to red)
- Results: animated counter, biggest leak callout, per-staff/per-job translation, waterfall breakdown, "you don't need to fix everything" insight, ROI context vs WFM cost, "How did we calculate this?" expandable, share with CFO prompt
- CTAs: "See how firms your size compare" (primary), "Watch a 12-min walkthrough" (secondary), "Book a Conversation" (bottom)

### 3. Firm Benchmark (TP3, replaces old cheat sheet + benchmark snapshot)
- Vertical selector + firm size + revenue + headcount inputs
- 4 key metrics per vertical with actual avg/top numbers on visual bar
- Self-placement selector per metric (Below avg / Around avg / Above avg / Near top) that updates gap cost in real time
- Each metric card: question prompt, visual bar with Avg and Top markers, self-placement, "Closing this gap is worth $X/yr" with plain English explanation, "Top performers:" one-liner
- Industry trend section, "How these connect" section, synthesis number ("Closing half the gap = $X/yr")
- Functional share button (navigator.share / clipboard fallback)
- CTAs: "See the detailed breakdown of each leak" (primary), "Watch a 12-min walkthrough" (secondary), "Book a Conversation" (bottom)

### 4. Demo Landing Page (TP4)
- YouTube embed (ID: X7RX3Bzz0sk) with thumbnail-first, play button overlay
- Chapter markers for video sections
- 3 value prop summaries
- Social proof strip (10,000+ firms, 20+ years, Xero integration)
- "Not ready for a call?" soft fallback
- CTA: "Book a Conversation"

### 5. Firms Like Yours (TP5)
- Vertical-filterable case study cards
- Each card: YouTube testimonial embed (thumbnail-first), firm info, pull quote, "The challenge" paragraph, 3 outcome badges with hard numbers
- Additional anonymous pull quotes section
- Trust strip
- Needs real customer data and YouTube video IDs (currently placeholder)
- CTA: "Book a Conversation"

## 6 Consistent Verticals (used across ALL content pieces)

1. Architecture & Design: "Practices delivering design, documentation, and contract administration" (icon: 📐, model: services)
2. Engineering Consultancy: "Firms providing advisory, design, and technical engineering services" (icon: ⚙️, model: services)
3. Management & Business Consulting: "Strategy, advisory, and professional services firms" (icon: 💼, model: services)
4. Construction & Trades: "Builders, contractors, and trade services businesses" (icon: 🏗️, model: project)
5. Civil & Infrastructure: "Contractors delivering civil, infrastructure, and heavy engineering projects" (icon: 🔧, model: project)
6. Creative & Marketing: "Agencies, studios, and creative services businesses" (icon: 🎨, model: services)

These MUST be identical in label, subtitle, icon, and order across every component. They live in src/data/verticals.js as a single source of truth.

## Two Calculation Models

- Services model (Architecture, Engineering Consultancy, Consulting, Creative): focuses on utilisation, fee erosion, time capture, scope recovery, invoicing speed
- Project model (Construction, Civil): focuses on job margins, variation recovery, cost attribution, progress claims, overrun frequency
- Both models work regardless of whether the firm bills hourly, fixed fee, or a mix

## Branding

### Colours
- Evergreen: #0A2F28 (primary dark, headings, dark cards)
- Leaf: #0D8D5C (secondary green, progress bars)
- Moneytree: #63DB94 (CTA buttons, accents)
- Crisp: #F1F1F1 (light backgrounds)
- Obsidian: #0B151F
- Glacial: #53A8F8 (blue accent, used sparingly)
- Stickynote: #ECD997 (warm accent for share prompts)

### Typography
- Headings: Bruna font family (TTF files in public/fonts/)
- Body: DM Sans (Google Fonts fallback, weights 400/500/600/700/800)
- Fallback for Bruna until font files loaded: system sans-serif

### Buttons
- Pill-shaped: border-radius: 100px
- Primary: Moneytree (#63DB94) background, Evergreen (#0A2F28) text
- Secondary/Ghost: transparent background, Moneytree text, Moneytree border at 30% opacity
- Hover: darken to #45c97e

### Logo
- SVG logo component in src/components/shared/Logo.jsx
- The logo SVG includes the WorkflowMAX wordmark with the green MAX circle

### Mobile-first
- All components max-width: 480px, centred
- Touch-friendly tap targets (minimum 44px)
- Smooth transitions between screens

## Benchmark Data Sources (credible only, no competitor citations)

- SPI Research 2025 Professional Services Maturity Benchmark (403 firms surveyed)
- Australian Bureau of Statistics (ABS) Australian Industry 2023-24
- Gartner IT Spending Benchmarks / Forecast
- APQC (American Productivity & Quality Center) benchmarking data
- Master Builders Australia

NEVER cite: Total Synergy, Buildern, Deltek, Mosaic, BQE, or any other WorkflowMAX competitor as a source.

## Writing Rules

- NEVER use em dashes (—). Replace with commas, full stops, or restructured sentences.
- Conversational tone, not essay-like. Concise. Scannable.
- No assumptive language about prospect problems. Acknowledge they likely have systems in place.
- All currency in AUD unless specified otherwise.
- CTA button text is always "Book a Conversation" (not "Book a Walkthrough" or "Book a Demo").
- Video scripts under 1,000 characters.

## Project Structure

```
src/
  components/
    shared/
      Logo.jsx           - WFM SVG logo component
      CTAButton.jsx      - Pill-shaped primary/secondary button
      VerticalSelector.jsx - Reusable vertical picker
      FirmSizeSelector.jsx - Reusable size picker (5-20, 21-80, 81-200)
      SliderInput.jsx    - Reusable range slider with custom styling
      MetricBar.jsx      - Visual avg/top comparison bar
    health-check/
      HealthCheck.jsx    - Main TP1 component
    profit-leak-calculator/
      Calculator.jsx     - Main TP2 component
    firm-benchmark/
      Benchmark.jsx      - Main TP3 component
    demo-landing-page/
      DemoPage.jsx       - Main TP4 component
    firms-like-yours/
      FirmsLikeYours.jsx - Main TP5 component
  data/
    verticals.js         - Single source of truth for all 6 verticals
    benchmarks.js        - Metric data by vertical + firm size
    leaks.js             - Leak definitions, questions, calculations
    recommendations.js   - Health check recommendations by tier + vertical
    questions.js         - Health check questions (Version B set)
    case-studies.js      - Placeholder customer stories + video IDs
  styles/
    tokens.js            - Colour, font, spacing tokens
  App.jsx                - Router/switcher between content pieces
  main.jsx               - Entry point
public/
  fonts/                 - Bruna TTF files (add from Webflow export)
```

## Key Collaborators

- Leo: GTM Engineer, owns Clay enrichment, HubSpot workflows, integrations. He will receive these components for Webflow deployment.
- Denzel: Other AE, owns Architecture, Engineering, Construction verticals.
- Ryan: CRO, leadership approver.

## What "Done" Looks Like

Each content piece should:
1. Render correctly on mobile (380px viewport) and desktop
2. Use consistent verticals, colours, fonts, and CTA styling from shared components
3. Have smooth animated transitions between screens
4. Show transparent, credible data with source citations
5. Drive toward "Book a Conversation" as the ultimate CTA
6. Be deployable to Webflow as standalone pages (one URL per content piece)
