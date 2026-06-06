import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResidentCard from "./ResidentCard.jsx";
import { STATUS_COLORS, STATUS_LABELS } from "../api.js";

function BigStat({ label, value, suffix, accent }) {
  return (
    <div className="rounded-xl glass-soft px-3 py-2.5">
      <div className="label">{label}</div>
      <div className="font-mono text-2xl font-semibold leading-tight" style={{ color: accent || "#fff" }}>
        {value}
        {suffix && <span className="ml-0.5 text-xs font-normal text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function RiskBar({ tag, count, max }) {
  const pct = Math.round((count / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-300">{tag}</span>
        <span className="font-mono text-slate-500">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-base-800">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-accent-deep to-accent-glow"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function CommunityView({ c }) {
  const maxRisk = Math.max(...c.commonRisks.map((r) => r.count), 1);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <BigStat label="Active Users" value={c.activeUsers} accent="#5cf0d6" />
        <BigStat label="Completed Checks" value={c.completedChecks} />
        <BigStat label="Follow-up Needed" value={c.followUpPct} suffix="%" accent="#f5c451" />
        <BigStat label="High Risk" value={c.highRiskCount} accent="#ff5d73" />
      </div>

      <div>
        <div className="label mb-2">Average Vitals</div>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl glass-soft px-3 py-2.5">
            <div className="font-mono text-lg font-semibold text-white">{c.avgSystolic}/{c.avgDiastolic}</div>
            <div className="text-[10px] text-slate-500">mmHg · blood pressure</div>
          </div>
          <div className="rounded-xl glass-soft px-3 py-2.5">
            <div className="font-mono text-lg font-semibold text-white">{c.avgHeartRate}</div>
            <div className="text-[10px] text-slate-500">bpm · heart rate</div>
          </div>
          <div className="rounded-xl glass-soft px-3 py-2.5">
            <div className="font-mono text-lg font-semibold text-white">{c.avgSpo2}%</div>
            <div className="text-[10px] text-slate-500">SpO₂ · oxygen</div>
          </div>
        </div>
      </div>

      <div>
        <div className="label mb-2.5">Common Risk Patterns</div>
        <div className="space-y-2.5 rounded-xl glass-soft px-3.5 py-3">
          {c.commonRisks.length ? (
            c.commonRisks.map((r) => <RiskBar key={r.tag} tag={r.tag} count={r.count} max={maxRisk} />)
          ) : (
            <p className="text-[12px] text-slate-500">No notable risk clusters detected.</p>
          )}
        </div>
      </div>

      <div>
        <div className="label mb-2">Community Alerts</div>
        <div className="space-y-2">
          {c.alerts.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-xl border border-white/5 bg-base-800/50 px-3 py-2.5">
              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-accent shadow-glow" />
              <p className="text-[12px] leading-snug text-slate-300">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SidePanel({ building, loading, onClose }) {
  const [tab, setTab] = useState("community");
  const open = Boolean(building) || loading;
  const color = building ? STATUS_COLORS[building.status] : "#36e2c4";

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="panel"
          initial={{ x: 460, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 460, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="absolute right-0 top-0 z-30 flex h-full w-[420px] max-w-[92vw] flex-col border-l border-white/[0.07] bg-[#080b12]/85 backdrop-blur-xl"
        >
          {loading && !building ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            </div>
          ) : building ? (
            <>
              {/* Header */}
              <div className="relative shrink-0 overflow-hidden border-b border-white/10 px-5 pb-4 pt-5">
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-20"
                  style={{ background: `radial-gradient(55% 100% at 18% 0%, ${color}, transparent 72%)` }}
                />
                <div className="relative flex items-start justify-between">
                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                        style={{ background: `${color}1f`, color }}>
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                        {STATUS_LABELS[building.status]}
                      </span>
                      {building.robotActive && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          Robot Online
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-semibold tracking-tight text-white">{building.name}</h2>
                    <p className="text-[12px] text-slate-400">
                      {building.district} · {building.floors} floors
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
                    aria-label="Close panel"
                  >
                    <svg viewBox="0 0 16 16" className="h-4 w-4">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* Tabs */}
                <div className="relative mt-4 flex gap-1 rounded-xl bg-base-900/60 p-1">
                  {[
                    { id: "community", label: "Community" },
                    { id: "residents", label: `Residents · ${building.residents.length}` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className="relative flex-1 rounded-lg py-1.5 text-[12px] font-medium transition-colors"
                    >
                      {tab === t.id && (
                        <motion.span
                          layoutId="tab-pill"
                          className="absolute inset-0 rounded-lg bg-accent/15 ring-1 ring-accent/30"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <span className={`relative ${tab === t.id ? "text-accent" : "text-slate-400"}`}>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="scroll-area flex-1 overflow-y-auto px-5 py-4">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {tab === "community" ? (
                      <CommunityView c={building.community} />
                    ) : (
                      <div className="space-y-2">
                        {building.residents.map((r) => (
                          <ResidentCard key={r.id} resident={r} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          ) : null}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
