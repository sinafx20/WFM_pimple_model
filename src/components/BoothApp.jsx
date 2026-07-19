import WorkflowHealthCheckBooth from "./health-check-booth/HealthCheckBooth.jsx";
import ProfitLeakCalculatorBooth from "./profit-leak-calculator-booth/CalculatorBooth.jsx";
import FirmBenchmarkBooth from "./firm-benchmark-booth/BenchmarkBooth.jsx";

// BookkeepCon booth switcher, analogous to App.jsx but only serving the three
// gated booth variants. Does not import or touch App.jsx or the live
// campaign's tool components. QR codes point at ?tool=tp1|tp2|tp3 with no
// personalisation params, since booth visitors have no existing HubSpot
// contact — identity is captured via the gate inside each tool instead.
const PIECES = [
  { id: "tp1", label: "Health Check", Component: WorkflowHealthCheckBooth },
  { id: "tp2", label: "Profit Leak Calculator", Component: ProfitLeakCalculatorBooth },
  { id: "tp3", label: "Firm Benchmark", Component: FirmBenchmarkBooth },
];

export default function BoothApp() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const requested = PIECES.find((p) => p.id === params.get("tool")) || PIECES[0];
  const Active = requested.Component;
  return <Active />;
}
