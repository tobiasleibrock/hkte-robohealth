import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sparkline from "./Sparkline.jsx";
import { SEVERITY_COLORS } from "../api.js";

function Vital({ label, value, unit, accent }) {
  return (
    <div className="rounded-lg bg-base-800/60 px-2.5 py-1.5">
      <div className="label">{label}</div>
      <div className="font-mono text-sm font-medium" style={{ color: accent || "#e8edf6" }}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

export default function ResidentCard({ resident }) {
  const [open, setOpen] = useState(false);
  const color = SEVERITY_COLORS[resident.severity];
  const bp = `${resident.vitals.systolic}/${resident.vitals.diastolic}`;

  return (
    <div className="overflow-hidden rounded-xl glass-soft transition-colors hover:border-accent/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold"
          style={{ background: `${color}1f`, color }}>
          {resident.name.split(" ").map((n) => n[0]).join("")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-white">{resident.name}</span>
            <span className="text-[10px] text-slate-500">· {resident.age}y · Unit {resident.unit}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="font-mono" style={{ color }}>{bp}</span>
            <span className="text-slate-600">mmHg</span>
            <span className="inline-block h-1 w-1 rounded-full bg-slate-600" />
            <span className="font-mono">{resident.vitals.heartRate} bpm</span>
          </div>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
          style={{ background: `${color}1f`, color }}>
          {resident.severity}
        </span>
        <motion.svg animate={{ rotate: open ? 180 : 0 }} className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 16 16">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-white/5 px-3.5 py-3">
              <div className="grid grid-cols-4 gap-2">
                <Vital label="BP" value={bp} unit="mmHg" accent={color} />
                <Vital label="Heart" value={resident.vitals.heartRate} unit="bpm" />
                <Vital label="SpO₂" value={resident.vitals.spo2} unit="%" />
                <Vital label="Temp" value={resident.vitals.temperature} unit="°C" />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-base-800/60 px-3 py-2">
                <div>
                  <div className="label">Systolic Trend</div>
                  <div className="text-[10px] text-slate-500">{resident.totalChecks} checks · last {resident.lastCheck}</div>
                </div>
                <Sparkline values={resident.history.map((h) => h.systolic)} color={color} />
              </div>

              {resident.risks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {resident.risks.map((r) => (
                    <span key={r} className="rounded-md bg-base-800/80 px-2 py-1 text-[10px] text-slate-300 ring-1 ring-white/5">
                      {r}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 rounded-lg border border-accent/15 bg-accent/5 px-3 py-2">
                <div className="label text-accent/80">Recommendation</div>
                <p className="text-[12px] leading-snug text-slate-200">{resident.recommendation}</p>
                <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-slate-400">
                  <span className="label">Follow-up</span>
                  <span className="font-medium text-white">{resident.followUp}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
