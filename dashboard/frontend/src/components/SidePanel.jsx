import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ResidentCard from "./ResidentCard.jsx";
import { STATUS_COLORS } from "../api.js";

const ACCENT = "#10b981";

function BigStat({ label, value, suffix, accent }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
      <div className="label">{label}</div>
      <div className="font-mono text-2xl font-semibold leading-tight text-gray-900" style={accent ? { color: accent } : {}}>
        {value}
        {suffix && <span className="ml-0.5 text-xs font-normal text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function SymptomBar({ tag, count, max }) {
  const pct = Math.round((count / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-gray-700">{tag}</span>
        <span className="font-mono text-gray-400">{count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
        <motion.div
          className="h-full rounded-full"
          style={{ background: ACCENT }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function CommunityView({ c }) {
  const maxSymptom = Math.max(...c.commonRisks.map((r) => r.count), 1);
  const healthScore = Math.max(
    0,
    Math.min(100, Math.round(100 - c.followUpPct * 0.4 - (c.highRiskCount / Math.max(c.activeUsers, 1)) * 60))
  );
  const scoreColor = healthScore >= 75 ? "#10b981" : healthScore >= 50 ? "#f59e0b" : "#ef4444";
  const avoidsVisits = Math.round(c.completedChecks * 0.18);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <BigStat label="Active Users" value={c.activeUsers} />
        <BigStat label="Completed Checks" value={c.completedChecks} />
        <BigStat label="Follow-up Needed" value={c.followUpPct} suffix="%" accent="#f59e0b" />
        <BigStat label="High Risk" value={c.highRiskCount} accent="#ef4444" />
      </div>

      {/* Community Health Score */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3">
        <div className="label mb-2">Community Health Score</div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-3xl font-semibold" style={{ color: scoreColor }}>
            {healthScore}
          </span>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <motion.div
                className="h-full rounded-full"
                style={{ background: scoreColor }}
                initial={{ width: 0 }}
                animate={{ width: `${healthScore}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <div className="mt-1 text-[10px] text-gray-400">out of 100 · based on follow-up & risk scores</div>
          </div>
        </div>
      </div>

      {/* Top Symptoms */}
      <div>
        <div className="label mb-2.5">Top Symptoms</div>
        <div className="space-y-2.5 rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3">
          {c.commonRisks.length ? (
            c.commonRisks.map((r) => (
              <SymptomBar key={r.tag} tag={r.tag} count={r.count} max={maxSymptom} />
            ))
          ) : (
            <p className="text-[12px] text-gray-400">No notable symptoms detected.</p>
          )}
        </div>
      </div>

      {/* Doctor visits avoided */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-3">
        <div className="label mb-1">Doctor Visits Avoided</div>
        <div className="mt-1 flex items-end gap-2">
          <span className="font-mono text-3xl font-semibold text-accent">
            {avoidsVisits.toLocaleString()}
          </span>
          <span className="mb-1 text-xs text-gray-400">consultations</span>
        </div>
        <div className="mt-1 text-[10px] text-gray-400">estimated from early detection rate × checks</div>
      </div>

      {/* Alerts */}
      <div>
        <div className="label mb-2">Community Alerts</div>
        <div className="space-y-2">
          {c.alerts.map((a, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
            >
              <span
                className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ background: ACCENT }}
              />
              <p className="text-[12px] leading-snug text-gray-700">{a}</p>
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
  const color = building ? STATUS_COLORS[building.status] : ACCENT;

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="panel"
          initial={{ x: "110%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "110%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="absolute right-4 top-4 bottom-4 z-30 flex w-[42vw] min-w-[420px] max-w-[640px] flex-col rounded-2xl bg-white border border-gray-100 shadow-panel overflow-hidden"
        >
          {loading && !building ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
            </div>
          ) : building ? (
            <>
              {/* Header */}
              <div className="shrink-0 border-b border-gray-100 px-5 pb-4 pt-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-gray-900">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      {building.name}
                    </h2>
                    <p className="mt-0.5 text-[12px] text-gray-400">
                      {building.district} · {building.floors} floors
                      {building.robotActive && (
                        <span className="ml-2 text-accent">· Robot active</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="ml-3 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gray-200 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700"
                    aria-label="Close panel"
                  >
                    <svg viewBox="0 0 16 16" className="h-4 w-4">
                      <path
                        d="M4 4l8 8M12 4l-8 8"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>

                {/* Tabs */}
                <div className="relative mt-4 flex gap-1 rounded-xl bg-gray-100 p-1">
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
                          className="absolute inset-0 rounded-lg bg-white shadow-sm"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <span className={`relative ${tab === t.id ? "text-gray-900" : "text-gray-400"}`}>
                        {t.label}
                      </span>
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
                    transition={{ duration: 0.18 }}
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
