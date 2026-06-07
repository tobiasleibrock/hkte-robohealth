import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  { label: "60–65", value: 4,  max: 55, color: "#10b981" },
  { label: "65–70", value: 9,  max: 55, color: "#10b981" },
  { label: "70–80", value: 22, max: 55, color: "#f59e0b" },
  { label: "80+",   value: 48, max: 55, color: "#ef4444" },
];

const ACCENT = "#10b981";

function StatCard({ label, value, suffix, sub, sparkline, compact }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3">
      <div className="label mb-1.5">{label}</div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <span className="font-mono text-2xl font-semibold text-gray-900">{value}</span>
          {suffix && <span className="ml-1 text-xs text-gray-400">{suffix}</span>}
          {sub && !compact && (
            <div className="mt-1 text-[10px] leading-snug text-gray-400">{sub}</div>
          )}
        </div>
        {sparkline && (
          <Sparkline values={sparkline} color={ACCENT} width={compact ? 56 : 76} height={32} />
        )}
      </div>
    </div>
  );
}

function HBar({ label, value, max }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-gray-500">{label}</span>
        <span className="font-mono text-[11px] text-gray-400">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <motion.div
          className="h-full rounded-full"
          style={{ background: ACCENT }}
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
        const bg = v >= 5 ? "#ef4444" : v >= 4 ? "#f59e0b" : ACCENT;
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

export default function StatsPanel({ network, hidden }) {
  const [cols, setCols] = useState(2);
  const handleExport = useCallback(() => exportGovernmentReport(network), [network]);
  const compact = cols === 2;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.aside
          key="stats-panel"
          initial={{ x: "110%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "110%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          className="absolute right-4 top-4 bottom-4 z-20 flex w-[42vw] min-w-[420px] max-w-[640px] flex-col rounded-2xl bg-white border border-gray-100 shadow-panel overflow-hidden"
        >
          {/* Brand */}
          <div className="shrink-0 flex items-center gap-3 border-b border-gray-100 px-4 py-3.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10">
              <svg viewBox="0 0 32 32" className="h-5 w-5">
                <path
                  d="M16 6 L16 26 M9 12 L9 26 M23 9 L23 26"
                  stroke={ACCENT}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="6" r="2.1" fill={ACCENT} />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-[15px] font-semibold leading-tight tracking-tight text-gray-900">
                Aether Health
              </h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-gray-400">Hong Kong Fleet</p>
            </div>
          </div>

          {/* Toolbar */}
          <div className="shrink-0 flex items-center gap-2 border-b border-gray-100 px-4 py-2.5">
            <span className="label flex-1">Government Dashboard</span>

            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-gray-200 p-0.5 gap-0.5">
              <button
                onClick={() => setCols(2)}
                title="2-column view"
                className={`grid h-6 w-7 place-items-center rounded-md transition-colors ${
                  compact
                    ? "bg-accent/10 text-accent"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
              </button>
              <button
                onClick={() => setCols(1)}
                title="List view"
                className={`grid h-6 w-7 place-items-center rounded-md transition-colors ${
                  !compact
                    ? "bg-accent/10 text-accent"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
                  <rect x="1" y="1.5" width="14" height="3" rx="1" />
                  <rect x="1" y="6.5" width="14" height="3" rx="1" />
                  <rect x="1" y="11.5" width="14" height="3" rx="1" />
                </svg>
              </button>
            </div>

            <button
              onClick={handleExport}
              title="Export report as JSON"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 transition hover:border-accent/40 hover:bg-accent/5 hover:text-accent"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
              </svg>
              Export
            </button>
          </div>

          {/* Scrollable content */}
          <div className="scroll-area flex-1 overflow-y-auto px-3 py-3">
            <div className={compact ? "grid grid-cols-2 gap-3" : "space-y-3"}>

              <StatCard
                label="Hypertension Rate"
                value={33}
                suffix="%"
                sub="elevated blood pressure · ↑2.1% this week"
                sparkline={HYPERTENSION_TREND}
                compact={compact}
              />

              <StatCard
                label="Undiagnosed Rate"
                value={25}
                suffix="%"
                sub="abnormal values without diagnosis · ↑1.4% this week"
                sparkline={UNDIAGNOSED_TREND}
                compact={compact}
              />

              <StatCard
                label="Dementia Prevalence"
                value={19}
                suffix="%"
                sub="estimated unreported MCI/Dementia · ↑1.8% this week"
                sparkline={DEMENTIA_TREND}
                compact={compact}
              />

              {/* Complication Risk Index */}
              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3">
                <div className="label mb-1.5">Complication Risk Index</div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <span className="font-mono text-2xl font-semibold text-gray-900">6.4</span>
                    <span className="ml-1 text-xs text-gray-400">/ 10</span>
                    {!compact && (
                      <div className="mt-1 text-[10px] leading-snug text-gray-400">
                        combination of vital indicators
                      </div>
                    )}
                  </div>
                  <div className="w-16">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(to right, ${ACCENT}, #f59e0b)` }}
                        initial={{ width: 0 }}
                        animate={{ width: "64%" }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Diabetes Risk Score */}
              <div className={`rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3${compact ? " col-span-2" : ""}`}>
                <div className="label mb-2.5">Diabetes Risk Score</div>
                <div className="space-y-2">
                  {DIABETES_AGE.map((g) => (
                    <HBar key={g.label} label={g.label} value={g.value} max={g.max} />
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-gray-400">elevated blood glucose by age group</div>
              </div>

              {/* Fever Cluster Detection */}
              <div className={`rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3${compact ? " col-span-2" : ""}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="label">Fever Cluster Detection</div>
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">
                    6 cases today
                  </span>
                </div>
                <FeverBars values={FEVER_CASES} />
                <div className="mt-1.5 text-[10px] text-gray-400">fever cases per day · last 14 days</div>
              </div>

              {/* MCI Prevalence by Age Group */}
              <div className={`rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3${compact ? " col-span-2" : ""}`}>
                <div className="label mb-2.5">MCI Prevalence by Age Group</div>
                <div className="space-y-2">
                  {DEMENTIA_AGE.map((g) => {
                    const pct = Math.round((g.value / g.max) * 100);
                    return (
                      <div key={g.label}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[11px] text-gray-500">{g.label}</span>
                          <span className="font-mono text-[11px] text-gray-400">{g.value}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
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
                <div className="mt-2 text-[10px] text-gray-400">
                  share of elevated MCI scores · Wan Chai district
                </div>
              </div>

              {/* Memory Clinic Pipeline */}
              <div className={`rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3${compact ? " col-span-2" : ""}`}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="label">Memory Clinic Pipeline</div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                    next 30 days
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white border border-gray-100 px-2.5 py-2">
                    <div className="font-mono text-xl font-semibold text-gray-900">34</div>
                    <div className="text-[10px] text-gray-400">Triaged Cases</div>
                  </div>
                  <div className="rounded-lg bg-white border border-gray-100 px-2.5 py-2">
                    <div className="font-mono text-xl font-semibold text-accent">18</div>
                    <div className="text-[10px] text-gray-400">Appointments Saved</div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-gray-400">Waitlist reduction vs. baseline</div>
              </div>

            </div>
          </div>

          {/* Footer */}
          {network && (
            <div className="shrink-0 grid grid-cols-3 gap-2 border-t border-gray-100 px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="label">Buildings</span>
                <span className="font-mono text-sm font-medium text-gray-900">{network.totalBuildings}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="label">Robots</span>
                <span className="font-mono text-sm font-medium text-gray-900">{network.activeRobots}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="label">Alerts</span>
                <span className="flex items-center gap-1 font-mono text-sm font-medium text-red-500">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                  {network.alerts}
                </span>
              </div>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
