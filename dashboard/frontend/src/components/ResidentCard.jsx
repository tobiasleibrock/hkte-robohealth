import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Sparkline from "./Sparkline.jsx";
import { SEVERITY_COLORS } from "../api.js";

const DIABETES_COLORS = { Normal: "#36e2c4", "Prä-Diabetisch": "#f5c451", Diabetisch: "#ff5d73" };
const MCI_COLORS      = { Normal: "#36e2c4", Grenzwertig: "#f5c451", Auffällig: "#ff5d73" };
const FRAILTY_COLORS  = { Robust: "#36e2c4", "Prä-Frail": "#f5c451", Frail: "#ff5d73" };

function Chip({ label, value, color }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium"
      style={{ background: `${color}18`, color }}
    >
      <span className="opacity-60">{label}</span>
      {value}
    </span>
  );
}

function MetricRow({ label, value, unit, accent, maturity }) {
  const mColor = maturity === "A" ? "#36e2c4" : maturity === "B" ? "#f5c451" : "#a78bfa";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400">{label}</span>
        {maturity && (
          <span className="rounded px-1 py-0.5 text-[9px] font-semibold" style={{ background: `${mColor}18`, color: mColor }}>
            {maturity}
          </span>
        )}
      </div>
      <span className="font-mono text-[12px] font-medium" style={{ color: accent || "#e8edf6" }}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] text-slate-500">{unit}</span>}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl bg-base-800/50 px-3.5 py-2.5">
      <div className="label mb-2">{title}</div>
      {children}
    </div>
  );
}

function GaugeBar({ value, max, color }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-base-800">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

export default function ResidentCard({ resident }) {
  const [open, setOpen] = useState(false);
  const color = SEVERITY_COLORS[resident.severity];
  const bp = `${resident.vitals.systolic}/${resident.vitals.diastolic}`;
  const { diabetes, dementia, bodyComposition } = resident;

  const diabetesColor = DIABETES_COLORS[diabetes?.status] ?? "#36e2c4";
  const mciColor      = MCI_COLORS[dementia?.mciStatus] ?? "#36e2c4";
  const frailtyColor  = FRAILTY_COLORS[dementia?.frailtyStatus] ?? "#36e2c4";

  return (
    <div className="overflow-hidden rounded-xl glass-soft transition-colors hover:border-accent/30">
      {/* ── Collapsed header ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
      >
        <span
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold"
          style={{ background: `${color}1f`, color }}
        >
          {resident.name.split(" ").map((n) => n[0]).join("")}
        </span>

        <div className="min-w-0 flex-1">
          {/* Name row */}
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-white">{resident.name}</span>
            <span className="shrink-0 text-[10px] text-slate-500">· {resident.age}y · {resident.unit}</span>
          </div>

          {/* Vitals row */}
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
            <span className="font-mono" style={{ color }}>{bp}</span>
            <span className="text-slate-600">mmHg</span>
            <span className="inline-block h-1 w-1 rounded-full bg-slate-700" />
            <span className="font-mono">{resident.vitals.heartRate} bpm</span>
            <span className="inline-block h-1 w-1 rounded-full bg-slate-700" />
            <span className="font-mono">SpO₂ {resident.vitals.spo2}%</span>
          </div>

          {/* Risk chips row */}
          {diabetes && dementia && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <Chip label="Diabetes:" value={diabetes.status}   color={diabetesColor} />
              <Chip label="MCI:"      value={dementia.mciStatus} color={mciColor} />
              <Chip label="Frailty:"  value={dementia.frailtyStatus} color={frailtyColor} />
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
            style={{ background: `${color}1f`, color }}
          >
            {resident.severity}
          </span>
          <motion.svg
            animate={{ rotate: open ? 180 : 0 }}
            className="h-3.5 w-3.5 text-slate-500"
            viewBox="0 0 16 16"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        </div>
      </button>

      {/* ── Expanded detail ── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-2.5 border-t border-white/5 px-3.5 pb-3.5 pt-3">

              {/* A1 – Vitalzeichen */}
              <Section title="A1 · Vitalzeichen">
                <MetricRow label="Blutdruck"         value={bp}                           unit="mmHg" accent={color}     maturity="A" />
                <MetricRow label="Herzfrequenz"       value={resident.vitals.heartRate}    unit="bpm"                    maturity="A" />
                <MetricRow label="SpO₂"               value={resident.vitals.spo2}         unit="%"                      maturity="B" />
                <MetricRow label="Hauttemperatur"     value={resident.vitals.temperature}  unit="°C"                     maturity="A" />
                {resident.vitals.stressIndex != null && (
                  <MetricRow label="HRV / Stress-Index" value={resident.vitals.stressIndex} unit="/10"                  maturity="B" />
                )}

                {/* Systolic sparkline */}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-base-800/60 px-3 py-2">
                  <div>
                    <div className="label">Systolisch Verlauf</div>
                    <div className="text-[10px] text-slate-500">{resident.totalChecks} Checks · zuletzt {resident.lastCheck}</div>
                  </div>
                  <Sparkline values={resident.history.map((h) => h.systolic)} color={color} />
                </div>
              </Section>

              {/* A2 – Körperzusammensetzung */}
              {bodyComposition && (
                <Section title="A2 · Körperzusammensetzung">
                  <MetricRow label="Körperfettanteil" value={bodyComposition.bodyFat}    unit="%" maturity="A" />
                  <MetricRow label="Muskelanteil"      value={bodyComposition.muscleMass} unit="%" maturity="A" />
                  <MetricRow label="Wasseranteil"      value={bodyComposition.waterPct}   unit="%" maturity="A" />
                  <MetricRow
                    label="Viszerales Fett"
                    value={bodyComposition.visceralFat}
                    unit=" / 20"
                    accent={bodyComposition.visceralFat > 13 ? "#ff5d73" : bodyComposition.visceralFat > 9 ? "#f5c451" : "#36e2c4"}
                    maturity="A"
                  />
                </Section>
              )}

              {/* B – Demenz / Kognition */}
              {dementia && (
                <Section title="B · Demenz / Kognition">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">MCI-Wahrscheinlichkeit</span>
                    <span className="font-mono text-[12px] font-semibold" style={{ color: mciColor }}>
                      {(dementia.mciProb * 100).toFixed(0)}%
                      <span className="ml-1.5 text-[10px] font-normal" style={{ background: `${mciColor}18`, borderRadius: 4, padding: "1px 5px" }}>
                        {dementia.mciStatus}
                      </span>
                    </span>
                  </div>
                  <GaugeBar value={dementia.mciProb} max={1} color={mciColor} />
                  <div className="mt-2.5 space-y-0">
                    <MetricRow
                      label="Ganggeschwindigkeit"
                      value={dementia.walkingSpeed}
                      unit=" m/s"
                      accent={dementia.walkingSpeed < 0.8 ? "#ff5d73" : "#e8edf6"}
                      maturity="A"
                    />
                    <MetricRow
                      label="Frailty-Index"
                      value={dementia.frailtyIndex}
                      unit=" / 1.0"
                      accent={frailtyColor}
                      maturity="A"
                    />
                    <MetricRow
                      label="Hyposmie-Score"
                      value={`${dementia.hyposmiaScore} / 3`}
                      accent={dementia.hyposmiaScore < 2 ? "#ff5d73" : "#36e2c4"}
                      maturity="A"
                    />
                  </div>
                </Section>
              )}

              {/* C – Diabetes / Metabolisch */}
              {diabetes && (
                <Section title="C · Diabetes / Metabolisch">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">HbA1c</span>
                    <span className="font-mono text-[12px] font-semibold" style={{ color: diabetesColor }}>
                      {diabetes.hba1c}%
                      <span className="ml-1.5 text-[10px] font-normal" style={{ background: `${diabetesColor}18`, borderRadius: 4, padding: "1px 5px" }}>
                        {diabetes.status}
                      </span>
                    </span>
                  </div>
                  <GaugeBar value={Math.min(diabetes.hba1c, 10)} max={10} color={diabetesColor} />
                  <div className="mt-2.5 space-y-0">
                    <MetricRow label="Nüchternglukose" value={diabetes.fastingGlucose} unit=" mg/dL"
                      accent={diabetes.fastingGlucose >= 126 ? "#ff5d73" : diabetes.fastingGlucose >= 100 ? "#f5c451" : "#36e2c4"}
                      maturity="A" />
                    <MetricRow label="Time in Range (70–180)"  value={diabetes.timeInRange}   unit="%"
                      accent={diabetes.timeInRange < 70 ? "#ff5d73" : diabetes.timeInRange < 85 ? "#f5c451" : "#36e2c4"}
                      maturity="A" />
                  </div>
                </Section>
              )}

              {/* Risks */}
              {resident.risks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {resident.risks.map((r) => (
                    <span key={r} className="rounded-md bg-base-800/80 px-2 py-1 text-[10px] text-slate-300 ring-1 ring-white/5">
                      {r}
                    </span>
                  ))}
                </div>
              )}

              {/* Recommendation */}
              <div className="space-y-1 rounded-lg border border-accent/15 bg-accent/5 px-3 py-2.5">
                <div className="label text-accent/80">Empfehlung</div>
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
