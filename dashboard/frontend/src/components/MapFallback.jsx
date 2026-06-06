import { STATUS_COLORS } from "../api.js";

// Shown when no valid Mapbox token is configured. Lays the fleet out on an
// abstract board using their real coordinates so the dashboard stays usable.
export default function MapFallback({ buildings, selectedId, onSelect, reason }) {
  const lngs = buildings.map((b) => b.position.lng);
  const lats = buildings.map((b) => b.position.lat);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const pad = 0.12;

  const project = (b) => {
    const x = ((b.position.lng - minLng) / (maxLng - minLng || 1)) * (1 - pad * 2) + pad;
    const y = 1 - (((b.position.lat - minLat) / (maxLat - minLat || 1)) * (1 - pad * 2) + pad);
    return { left: `${x * 100}%`, top: `${y * 100}%` };
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#06070b]">
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(120,150,200,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(120,150,200,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {buildings.map((b) => {
        const color = STATUS_COLORS[b.status];
        const isSel = selectedId === b.id;
        return (
          <button
            key={b.id}
            onClick={() => onSelect?.(b)}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={project(b)}
          >
            <span
              className="block rounded-full ring-2 ring-white/70 transition-all"
              style={{
                width: isSel ? 16 : 11,
                height: isSel ? 16 : 11,
                background: color,
                boxShadow: `0 0 ${isSel ? 16 : 9}px ${color}`,
              }}
            />
            <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] text-white/60 opacity-0 transition group-hover:opacity-100">
              {b.name}
            </span>
          </button>
        );
      })}

      <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-center text-[12px] text-white/70 backdrop-blur">
        {reason || "Add a valid Mapbox token to load the live Hong Kong map."}
      </div>
    </div>
  );
}
