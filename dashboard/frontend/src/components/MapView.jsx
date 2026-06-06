import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Layer, NavigationControl } from "react-map-gl/mapbox";
import MapMarker from "./MapMarker.jsx";

const MAPBOX_TOKEN = import.meta.env.mapbox_key;

const BUILDING_MIN_ZOOM = 11;
const BUILDING_FADE_END_ZOOM = 13;

// Panning the map smoothly eases the pitch toward PITCH_PAN.
// flyTo (building focus) lands at 30° (handled inline below).
const PITCH_PAN = 55;
const PITCH_EASE_MS = 800;
// The side panel occupies the right ~42% of the viewport; offset the flyTo
// target so the building lands centered in the remaining map area.
const PANEL_FRACTION = 0.42;

const INITIAL_VIEW = {
  longitude: 114.1735,
  latitude: 22.2800,
  zoom: 16.2,
  pitch: PITCH_PAN,
  bearing: -28,
};

const buildingLayer = {
  id: "hk-3d-buildings",
  type: "fill-extrusion",
  source: "composite",
  "source-layer": "building",
  minzoom: BUILDING_MIN_ZOOM,
  filter: ["==", ["get", "extrude"], "true"],
  paint: {
    "fill-extrusion-color": [
      "interpolate",
      ["linear"],
      ["get", "height"],
      0,
      "#2a2f3a",
      60,
      "#454a55",
      160,
      "#646a76",
      320,
      "#8b919c",
    ],
    "fill-extrusion-height": [
      "interpolate",
      ["linear"],
      ["zoom"],
      BUILDING_MIN_ZOOM,
      0,
      BUILDING_FADE_END_ZOOM,
      ["get", "height"],
    ],
    "fill-extrusion-base": ["get", "min_height"],
    "fill-extrusion-opacity": 0.95,
  },
};

export default function MapView({ buildings, selectedId, onSelect }) {
  const mapRef = useRef(null);
  const flyingRef = useRef(false);
  const [labelLayerId, setLabelLayerId] = useState(undefined);

  const handleLoad = useCallback((e) => {
    const map = e.target;
    const layers = map.getStyle().layers || [];
    const symbol = layers.find((l) => l.type === "symbol" && l.layout?.["text-field"]);
    setLabelLayerId(symbol?.id);

    map.setFog({
      range: [0.6, 12],
      color: "#0a0e18",
      "high-color": "#16233e",
      "horizon-blend": 0.18,
      "space-color": "#05070d",
      "star-intensity": 0.08,
    });
  }, []);

  // Each pan gesture eases pitch + zoom back to the initial overview and drops
  // any active selection. Skipped while a flyTo is in flight.
  const handleDragEnd = useCallback((e) => {
    if (flyingRef.current) return;
    if (e.originalEvent == null) return;
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const needsPitch = Math.abs(map.getPitch() - PITCH_PAN) > 0.5;
    const needsZoom = Math.abs(map.getZoom() - INITIAL_VIEW.zoom) > 0.05;
    if (needsPitch || needsZoom) {
      map.easeTo({ pitch: PITCH_PAN, zoom: INITIAL_VIEW.zoom, duration: PITCH_EASE_MS });
    }
    onSelect?.(null);
  }, [onSelect]);

  // Smoothly focus the selected building, holding a gentle 30° pitch on arrival.
  useEffect(() => {
    if (!selectedId) return;
    const b = buildings.find((x) => x.id === selectedId);
    const map = mapRef.current?.getMap?.();
    if (!b || !map) return;
    flyingRef.current = true;
    const clear = () => {
      flyingRef.current = false;
      map.off("moveend", clear);
    };
    map.on("moveend", clear);
    // Visible map area is the left (1 - PANEL_FRACTION) of the viewport.
    // Its centre sits at -PANEL_FRACTION/2 of the viewport width from the map centre.
    const w = map.getContainer().clientWidth;
    const offsetX = -(PANEL_FRACTION / 2) * w;
    map.flyTo({
      center: [b.position.lng, b.position.lat],
      zoom: 16.2,
      pitch: 30,
      duration: 1500,
      offset: [offsetX, 30],
      essential: true,
    });
    return () => {
      map.off("moveend", clear);
    };
  }, [selectedId, buildings]);

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={INITIAL_VIEW}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ position: "absolute", inset: 0 }}
      antialias
      maxPitch={70}
      onLoad={handleLoad}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect?.(null)}
      attributionControl={false}
    >
      <Layer {...buildingLayer} beforeId={labelLayerId} />

      {buildings.map((b) => (
        <MapMarker key={b.id} building={b} selected={selectedId === b.id} onSelect={onSelect} />
      ))}

      <NavigationControl position="bottom-right" showCompass={false} visualizePitch={false} />
    </Map>
  );
}
