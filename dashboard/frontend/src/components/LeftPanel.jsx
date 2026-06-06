import { useCallback } from "react";
import { motion } from "framer-motion";
import Sparkline from "./Sparkline.jsx";

const HYPERTENSION_TREND = [23, 25, 24, 27, 26, 29, 28, 31, 30, 32, 31, 33, 34, 33];
const UNDIAGNOSED_TREND  = [18, 19, 17, 20, 19, 21, 20, 22, 21, 23, 22, 24, 23, 25];
const FEVER_CASES        = [2, 1, 3, 4, 2, 5, 3, 4, 6, 5, 4, 7, 5, 6];

const DIABETES_AGE = [
  { label: "18–35", value: 8,  max: 60 },
  { label: "36–50", value: 22, max: 60 },
  { label: "51–65", value: 41, max: 60 },
  { label: "65+",   value: 58, max: 60 },
];

const DEMENTIA_TREND = [11, 12, 11, 13, 13, 14, 15, 14, 16, 16, 17, 18, 17, 19];
const DEMENTIA_AGE = [
  { label: "60–65", value: 4,  max: 55, color: "#5cf0d6" },
  { label: "65–70", value: 9,  max: 55, color: "#5cf0d6" },
  { label: "70–80", value: 22, max: 55, color: "#f5c451" },
  { label: "80+",   value: 48, max: 55, color: "#ff5d73" },
];

function StatCard({ label, value, suffix, accent, sub, children }) {
  return (
    <div className="rounded-xl glass-soft px-3.5 py-3">
      <div className="label mb-1">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <span className="font-mono text-2xl font-semibold" style={{ color: accent || "#fff" }}>
            {value}
          </span>
          {suffix && <span className="ml-1 text-xs text-slate-500">{suffix}</span>}
          {sub && <div className="mt-0.5 text-[10px] leading-snug text-slate-600">{sub}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function HBar({ label, value, max, color = "#36e2c4" }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">{label}</span>
        <span className="font-mono text-[11px] text-slate-500">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-base-800">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function FeverBars({ values }) {
  const max = Math.max(...values, 1);
  const BAR_HEIGHT_PX = 48;
  return (
    <div className="flex items-end gap-[3px]" style={{ height: BAR_HEIGHT_PX }}>
      {values.map((v, i) => {
        const h = Math.max(5, (v / max) * BAR_HEIGHT_PX);
        const bg = v >= 5 ? "#ff5d73" : v >= 4 ? "#f5c451" : "#36e2c4";
        return (
          <motion.div
            key={i}
            className="flex-1 rounded-sm"
            style={{ height: h, background: bg, originY: "bottom" }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: i * 0.035, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

function exportGovernmentReport(network) {
  const report = {
    exportedAt: new Date().toISOString(),
    region: "Hong Kong",
    network: network
      ? {
          totalBuildings: network.totalBuildings,
          activeRobots: network.activeRobots,
          totalResidents: network.totalResidents,
          totalChecks: network.totalChecks,
          alerts: network.alerts,
        }
      : null,
    metrics: {
      hypertensionRate: {
        value: 33,
        unit: "%",
        trend: "↑2.1% this week",
        timeSeries: HYPERTENSION_TREND.map((v, i) => ({ day: i + 1, value: v })),
      },
      diabetesRiskScore: {
        unit: "% elevated blood glucose",
        byAgeGroup: DIABETES_AGE.map((g) => ({ ageGroup: g.label, value: g.value })),
      },
      feverClusterDetection: {
        unit: "cases per day",
        last14Days: FEVER_CASES.map((v, i) => ({ day: i + 1, cases: v })),
        todayCases: FEVER_CASES[FEVER_CASES.length - 1],
      },
      undiagnosedRate: {
        value: 25,
        unit: "%",
        trend: "↑1.4% this week",
        timeSeries: UNDIAGNOSED_TREND.map((v, i) => ({ day: i + 1, value: v })),
      },
      complicationRiskIndex: {
        value: 6.4,
        scale: "0–10",
        description: "Combination of multiple vital indicators",
      },
    },
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `government-health-report-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LeftPanel({ network }) {
  const handleExport = useCallback(() => exportGovernmentReport(network), [network]);

  return (
    <aside className="absolute left-0 top-0 z-20 flex h-full w-[300px] flex-col border-r border-white/[0.07] bg-[#080b12]/90 backdrop-blur-xl">
      {/* Brand */}
      <div className="shrink-0 flex items-center gap-3 border-b border-white/[0.07] px-4 py-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10">
          <svg viewBox="0 0 32 32" className="h-5 w-5">
            <path
              d="M16 6 L16 26 M9 12 L9 26 M23 9 L23 26"
              stroke="#36e2c4"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <circle cx="16" cy="6" r="2.1" fill="#5cf0d6" />
          </svg>
        </div>
        <div>
          <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-white">Aether Health</h1>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Hong Kong Fleet</p>
        </div>
      </div>

      {/* Section label + export */}
      <div className="shrink-0 flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5">
        <span className="label">Government Dashboard</span>
        <button
          onClick={handleExport}
          title="Export report as JSON"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-400 transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
          </svg>
          Export
        </button>
      </div>

      {/* Scrollable content */}
      <div className="scroll-area flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          <StatCard
            label="Hypertension Rate"
            value={33}
            suffix="%"
            accent="#f5c451"
            sub="erhöhter Blutdruck · ↑2.1% diese Woche"
          >
            <Sparkline values={HYPERTENSION_TREND} color="#f5c451" width={80} height={32} />
          </StatCard>

          <div className="rounded-xl glass-soft px-3.5 py-3">
            <div className="label mb-2.5">Diabetes Risk Score</div>
            <div className="space-y-2">
              {DIABETES_AGE.map((g) => (
                <HBar key={g.label} label={g.label} value={g.value} max={g.max} color="#5cf0d6" />
              ))}
            </div>
            <div className="mt-2 text-[10px] text-slate-600">erhöhte Blutzuckerwerte nach Altersgruppe</div>
          </div>

          <div className="rounded-xl glass-soft px-3.5 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="label">Fever Cluster Detection</div>
              <span className="rounded-full bg-signal-alert/10 px-2 py-0.5 text-[10px] font-medium text-signal-alert">
                6 Fälle heute
              </span>
            </div>
            <FeverBars values={FEVER_CASES} />
            <div className="mt-1.5 text-[10px] text-slate-600">Fieberfälle pro Tag · letzte 14 Tage</div>
          </div>

          {/* Demenz-Score */}
          <StatCard
            label="Demenz-Prävalenz (MCI+)"
            value={19}
            suffix="%"
            accent="#a78bfa"
            sub="geschätzte ungemeldete MCI/Demenz · ↑1.8% diese Woche"
          >
            <Sparkline values={DEMENTIA_TREND} color="#a78bfa" width={80} height={32} />
          </StatCard>

          <div className="rounded-xl glass-soft px-3.5 py-3">
            <div className="label mb-2.5">MCI-Prävalenz nach Altersgruppe</div>
            <div className="space-y-2">
              {DEMENTIA_AGE.map((g) => {
                const pct = Math.round((g.value / g.max) * 100);
                return (
                  <div key={g.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">{g.label}</span>
                      <span className="font-mono text-[11px] text-slate-500">{g.value}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-base-800">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: g.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 text-[10px] text-slate-600">Anteil auffälliger MCI-Scores · Bezirk Wan Chai</div>
          </div>

          <div className="rounded-xl glass-soft px-3.5 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="label">Memory-Clinic-Pipeline</div>
              <span className="rounded-full bg-[#a78bfa]/10 px-2 py-0.5 text-[10px] font-medium text-[#a78bfa]">
                nächste 30 Tage
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-base-800/60 px-2.5 py-2">
                <div className="font-mono text-xl font-semibold text-[#a78bfa]">34</div>
                <div className="text-[10px] text-slate-500">Triagierte Fälle</div>
              </div>
              <div className="rounded-lg bg-base-800/60 px-2.5 py-2">
                <div className="font-mono text-xl font-semibold text-accent">18</div>
                <div className="text-[10px] text-slate-500">Termine erspart</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-slate-600">Wartelisten-Entlastung vs. Baseline</div>
          </div>

          <StatCard
            label="Undiagnosed Rate"
            value={25}
            suffix="%"
            accent="#ff5d73"
            sub="auffällige Werte ohne Diagnose · ↑1.4% diese Woche"
          >
            <Sparkline values={UNDIAGNOSED_TREND} color="#ff5d73" width={80} height={32} />
          </StatCard>

          <div className="rounded-xl glass-soft px-3.5 py-3">
            <div className="label mb-2.5">Komplikationsrisiko-Index</div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-3xl font-semibold text-white">6.4</span>
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-base-800">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-accent-deep to-signal-alert"
                    initial={{ width: 0 }}
                    animate={{ width: "64%" }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
                <div className="mt-1 text-[10px] text-slate-600">aus 10 · Kombination mehrerer Vitalwerte</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Network stats footer */}
      {network && (
        <div className="shrink-0 grid grid-cols-3 gap-2 border-t border-white/[0.07] px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="label">Buildings</span>
            <span className="font-mono text-sm font-medium text-white/90">{network.totalBuildings}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="label">Robots</span>
            <span className="font-mono text-sm font-medium text-white/90">{network.activeRobots}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="label">Alerts</span>
            <span className="flex items-center gap-1 font-mono text-sm font-medium text-signal-alert">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-signal-alert" />
              {network.alerts}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
