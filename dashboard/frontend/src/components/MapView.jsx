import { useCallback, useEffect, useRef, useState } from "react";
import Map, { Layer, NavigationControl } from "react-map-gl/mapbox";
import MapMarker from "./MapMarker.jsx";
import { STATUS_COLORS } from "../api.js";

const MAPBOX_TOKEN = import.meta.env.mapbox_key;

const BUILDING_MIN_ZOOM = 11;
const BUILDING_FADE_END_ZOOM = 13;

const INITIAL_VIEW = {
  longitude: 114.16,
  latitude: 22.282,
  zoom: 15.0,
  pitch: 56,
  bearing: -28,
};

// Grey skyline by default; operated buildings get their status colour applied via
// feature-state once we've matched each fleet point to a rendered polygon.
const buildingLayer = {
  id: "hk-3d-buildings",
  type: "fill-extrusion",
  source: "composite",
  "source-layer": "building",
  minzoom: BUILDING_MIN_ZOOM,
  filter: ["==", ["get", "extrude"], "true"],
  paint: {
    "fill-extrusion-color": [
      "case",
      ["==", ["feature-state", "status"], "stable"],
      STATUS_COLORS.stable,
      ["==", ["feature-state", "status"], "watch"],
      STATUS_COLORS.watch,
      ["==", ["feature-state", "status"], "alert"],
      STATUS_COLORS.alert,
      [
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
  const [labelLayerId, setLabelLayerId] = useState(undefined);
  const [zoom, setZoom] = useState(INITIAL_VIEW.zoom);
  const [taggedIds, setTaggedIds] = useState(() => new Set());

  const handleLoad = useCallback((e) => {
    const map = e.target;
    // Place the extrusion layer beneath the first text label for a clean look.
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

  // Match each operated building to the nearest rendered polygon and paint it
  // via feature-state. Re-runs on `idle` because tile loads can introduce new
  // features that need the same treatment.
  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const apply = () => {
      if (!map.isStyleLoaded()) return;
      let next = null;
      for (const b of buildings) {
        const pixel = map.project([b.position.lng, b.position.lat]);
        const bbox = [
          [pixel.x - 6, pixel.y - 6],
          [pixel.x + 6, pixel.y + 6],
        ];
        const feats = map.queryRenderedFeatures(bbox, { layers: ["hk-3d-buildings"] });
        if (!feats.length) continue;
        const feat = feats[0];
        if (feat.id == null) continue;
        map.setFeatureState(
          { source: "composite", sourceLayer: "building", id: feat.id },
          { status: b.status }
        );
        if (!taggedIds.has(b.id)) {
          if (!next) next = new Set(taggedIds);
          next.add(b.id);
        }
      }
      if (next) setTaggedIds(next);
    };

    map.on("idle", apply);
    apply();
    return () => {
      map.off("idle", apply);
    };
  }, [buildings, taggedIds]);

  const handleZoom = useCallback((e) => {
    setZoom(e.viewState.zoom);
  }, []);

  // Smoothly focus the selected building.
  useEffect(() => {
    if (!selectedId) return;
    const b = buildings.find((x) => x.id === selectedId);
    if (b && mapRef.current) {
      mapRef.current.flyTo({
        center: [b.position.lng, b.position.lat],
        zoom: 15.2,
        pitch: 58,
        duration: 1500,
        offset: [-200, 30],
        essential: true,
      });
    }
  }, [selectedId, buildings]);

  const buildingsRenderedIn = zoom >= BUILDING_FADE_END_ZOOM;

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
      onZoom={handleZoom}
      onClick={() => onSelect?.(null)}
      attributionControl={false}
    >
      <Layer {...buildingLayer} beforeId={labelLayerId} />

      {buildings.map((b) => {
        // Hide the dot only once the 3D footprint is both faded in AND coloured
        // for this building; otherwise keep the marker as the visible cue.
        if (buildingsRenderedIn && taggedIds.has(b.id)) return null;
        return (
          <MapMarker key={b.id} building={b} selected={selectedId === b.id} onSelect={onSelect} />
        );
      })}

      <NavigationControl position="bottom-right" showCompass={false} visualizePitch={false} />
    </Map>
  );
}
