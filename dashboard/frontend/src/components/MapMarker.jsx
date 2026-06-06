import { useState } from "react";
import { Marker } from "react-map-gl/mapbox";
import { STATUS_COLORS } from "../api.js";

export default function MapMarker({ building, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[building.status] || STATUS_COLORS.stable;
  const active = hovered || selected;

  return (
    <Marker longitude={building.position.lng} latitude={building.position.lat} anchor="center">
      <div
        className="relative grid place-items-center"
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(building);
        }}
      >
        {/* Pulsing halo for active robots */}
        {building.robotActive && (
          <span
            className="absolute h-5 w-5 animate-pulse-ring rounded-full"
            style={{ backgroundColor: color, opacity: 0.5 }}
          />
        )}

        {/* Core dot */}
        <span
          className="relative rounded-full ring-2 ring-white/80 transition-all duration-200"
          style={{
            width: active ? 16 : 11,
            height: active ? 16 : 11,
            backgroundColor: color,
            boxShadow: `0 0 ${active ? 16 : 8}px ${color}`,
          }}
        />

        {/* Label */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/70 px-2 py-1 text-center backdrop-blur transition-all duration-150"
          style={{
            bottom: "calc(100% + 8px)",
            opacity: active ? 1 : 0,
            transform: `translate(-50%, ${active ? "0" : "4px"})`,
          }}
        >
          <div className="text-[11px] font-medium leading-tight text-white">{building.name}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-white/50">{building.district}</div>
        </div>
      </div>
    </Marker>
  );
}
