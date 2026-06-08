// Single source of truth for all 6 verticals
// Import this in EVERY component that shows a vertical selector
// Never hardcode verticals elsewhere

export const VERTICALS = [
  {
    id: "architecture",
    label: "Architecture & Design",
    subtitle: "Practices delivering design, documentation, and contract administration",
    icon: "📐",
    model: "services",
    defaults: {
      staff: 35,
      annualRevenue: 7000000,
      avgRate: 165,
      jobCount: null,
      avgJobValue: null,
    },
  },
  {
    id: "engineering",
    label: "Engineering Consultancy",
    subtitle: "Firms providing advisory, design, and technical engineering services",
    icon: "⚙️",
    model: "services",
    defaults: {
      staff: 45,
      annualRevenue: 10000000,
      avgRate: 175,
      jobCount: null,
      avgJobValue: null,
    },
  },
  {
    id: "consulting",
    label: "Management & Business Consulting",
    subtitle: "Strategy, advisory, and professional services firms",
    icon: "💼",
    model: "services",
    defaults: {
      staff: 30,
      annualRevenue: 6500000,
      avgRate: 195,
      jobCount: null,
      avgJobValue: null,
    },
  },
  {
    id: "construction",
    label: "Construction & Trades",
    subtitle: "Builders, contractors, and trade services businesses",
    icon: "🏗️",
    model: "project",
    defaults: {
      staff: null,
      annualRevenue: 15000000,
      avgRate: null,
      jobCount: 60,
      avgJobValue: 250000,
    },
  },
  {
    id: "civil",
    label: "Civil & Infrastructure",
    subtitle: "Contractors delivering civil, infrastructure, and heavy engineering projects",
    icon: "🔧",
    model: "project",
    defaults: {
      staff: null,
      annualRevenue: 12000000,
      avgRate: null,
      jobCount: 45,
      avgJobValue: 265000,
    },
  },
  {
    id: "creative",
    label: "Creative & Marketing",
    subtitle: "Agencies, studios, and creative services businesses",
    icon: "🎨",
    model: "services",
    defaults: {
      staff: 20,
      annualRevenue: 4000000,
      avgRate: 155,
      jobCount: null,
      avgJobValue: null,
    },
  },
];

export const FIRM_SIZES = [
  { id: "small", label: "10 to 25 staff" },
  { id: "mid", label: "25 to 80 staff" },
  { id: "large", label: "80 to 200 staff" },
];

export const getVertical = (id) => VERTICALS.find((v) => v.id === id);
export const isProjectModel = (id) => getVertical(id)?.model === "project";
