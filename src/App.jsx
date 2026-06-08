import { useState } from "react";
import WorkflowHealthCheck from "./components/health-check/HealthCheck.jsx";
import ProfitLeakCalculator from "./components/profit-leak-calculator/Calculator.jsx";
import FirmBenchmark from "./components/firm-benchmark/Benchmark.jsx";
import DemoLandingPage from "./components/demo-landing-page/DemoPage.jsx";
import FirmsLikeYours from "./components/firms-like-yours/FirmsLikeYours.jsx";
import ResourceHub from "./components/resource-hub/ResourceHub.jsx";

// Dev-only switcher so every content piece is previewable from one dev server.
// Each piece deploys to Webflow as its own standalone page, so this switcher
// is not shipped, it is purely a local harness.
const PIECES = [
  { id: "tp1", label: "TP1 · Health Check", Component: WorkflowHealthCheck },
  { id: "tp2", label: "TP2 · Profit Leak Calculator", Component: ProfitLeakCalculator },
  { id: "tp3", label: "TP3 · Firm Benchmark", Component: FirmBenchmark },
  { id: "tp4", label: "TP4 · Demo Landing Page", Component: DemoLandingPage },
  { id: "tp5", label: "TP5 · Firms Like Yours", Component: FirmsLikeYours },
  { id: "tp6", label: "TP6 · Resource Hub", Component: ResourceHub },
];

export default function App() {
  // Production routing: ?tool=tp1…tp6 renders that single touchpoint with no dev
  // chrome, so one deployed build serves every page (e.g. /?tool=tp3&industry=engineering).
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const requested = PIECES.find((p) => p.id === params.get("tool"));

  const [active, setActive] = useState(requested ? requested.id : "tp1");

  if (requested) {
    const Only = requested.Component;
    return <Only />;
  }

  const Active = PIECES.find((p) => p.id === active).Component;

  return (
    <div>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "10px 12px",
          background: "#0A2F28",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {PIECES.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            style={{
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 14px",
              borderRadius: 100,
              border: "1px solid rgba(99,219,148,0.3)",
              background: active === p.id ? "#63DB94" : "transparent",
              color: active === p.id ? "#0A2F28" : "#63DB94",
              transition: "all 0.15s ease",
            }}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <Active />
    </div>
  );
}
