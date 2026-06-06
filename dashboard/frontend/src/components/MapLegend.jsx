import { STATUS_COLORS, STATUS_LABELS } from "../api.js";

export default function MapLegend({ liveMap }) {
  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-20 flex flex-col gap-2.5">
      <div className="pointer-events-auto flex items-center gap-4 rounded-xl glass px-3.5 py-2.5">
        {Object.keys(STATUS_COLORS).map((key) => (
          <div key={key} className="flex items-center gap-1.5 text-[11px] text-white/70">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: STATUS_COLORS[key], boxShadow: `0 0 6px ${STATUS_COLORS[key]}` }}
            />
            {STATUS_LABELS[key]}
          </div>
        ))}
      </div>
      <p className="max-w-[230px] text-[11px] leading-relaxed text-white/35">
        {liveMap
          ? "Drag to pan · scroll to zoom · click a marker to open its health profile"
          : "Click a marker to open its health profile"}
      </p>
    </div>
  );
}
