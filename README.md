# WorkflowMAX Pimple Model - Interactive Content Pieces

## Quick Start

```bash
# Create a new Vite React project
npm create vite@latest . -- --template react

# Copy src/ folder contents into the new project's src/
# Copy public/fonts/ into the new project's public/

# Install dependencies
npm install

# Start dev server
npm run dev
```

## Project Structure

```
src/
  components/
    health-check/HealthCheck.jsx     - TP1: Workflow Health Check
    profit-leak-calculator/Calculator.jsx - TP2: Profit Leak Calculator
    firm-benchmark/Benchmark.jsx     - TP3: Firm Benchmark
    demo-landing-page/DemoPage.jsx   - TP4: Demo Video Landing Page
    firms-like-yours/FirmsLikeYours.jsx - TP5: Case Studies
    shared/                          - Reusable components (extract from above)
  data/
    verticals.js                     - Single source of truth for 6 verticals
  styles/
    tokens.js                        - WFM colour, font, spacing tokens
public/
  fonts/                             - Bruna TTF font files
docs/
  pimple-model-sop.docx             - CRO one-pager
CLAUDE.md                            - Context prompt for Claude Code
```

## Current State

All 5 content pieces are built as standalone React components. Each one contains its own data, styling, and logic inline. The next step is to refactor shared elements (logo, buttons, vertical selector, colours) into the shared/ directory and import from data/ files.

## To Use With Claude Code

1. Open this folder in VS Code
2. Claude Code will read CLAUDE.md automatically for context
3. Ask it to refactor, iterate, or build new features

## Branding

- Fonts: Bruna (headings), DM Sans (body via Google Fonts)
- Primary: Evergreen #0A2F28, Leaf #0D8D5C, Moneytree #63DB94
- Buttons: pill-shaped (border-radius: 100px)
- Mobile-first: max-width 480px
