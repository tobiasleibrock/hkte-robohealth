import { useCallback, useEffect, useRef, useState } from "react";
import MapGL, { Layer, NavigationControl } from "react-map-gl/mapbox";
import MapMarker from "./MapMarker.jsx";

const BUILDING_SOURCE = { source: "composite", sourceLayer: "building" };

const MAPBOX_TOKEN = import.meta.env.mapbox_key;

const BUILDING_MIN_ZOOM = 11;
const BUILDING_FADE_END_ZOOM = 13;

const PITCH_PAN = 55;
const PITCH_EASE_MS = 800;
const LEFT_PANEL_W = 300;   // px — matches LeftPanel w-[300px]
const RIGHT_PANEL_FRACTION = 0.42; // fraction of viewport width

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
      "case",
      ["boolean", ["feature-state", "highlight"], false], "#93C5FD",
      ["==", ["feature-state", "status"], "alert"],       "#ff5d73",
      ["==", ["feature-state", "status"], "watch"],       "#f5c451",
      ["==", ["feature-state", "status"], "stable"],      "#22c55e",
      ["interpolate", ["linear"], ["get", "height"],
        0, "#2a2f3a", 60, "#454a55", 160, "#646a76", 320, "#8b919c"],
    ],
    "fill-extrusion-height": [
      "interpolate", ["linear"], ["zoom"],
      BUILDING_MIN_ZOOM, 0,
      BUILDING_FADE_END_ZOOM, ["get", "height"],
    ],
    "fill-extrusion-base": ["get", "min_height"],
    "fill-extrusion-opacity": 0.95,
  },
};

// Returns the list of mapbox feature IDs for a selection group (building or raw id).
function groupFeatureIds(group) {
  return group?.mapboxFeatureIds?.length ? group.mapboxFeatureIds : [group];
}

export default function MapView({ buildings, selectedId, onSelect }) {
  const mapRef = useRef(null);
  const flyingRef = useRef(false);
  const [labelLayerId, setLabelLayerId] = useState(undefined);

  // featureId (number) → building object for mapped buildings
  const featureToBuildingRef = useRef(new Map());

  const hoveredGroupRef = useRef(null);
  const selectedGroupRef = useRef(null);
  const flyTargetRef = useRef(null);


  const setFState = useCallback((id, state) => {
    mapRef.current?.getMap?.()?.setFeatureState({ ...BUILDING_SOURCE, id }, state);
  }, []);

  // Apply status colors to all mapped buildings on load.
  const initFeatureStates = useCallback(() => {
    const lookup = new Map();
    buildings.forEach((b) => {
      b.mapboxFeatureIds?.forEach((fid) => {
        lookup.set(fid, b);
        setFState(fid, { status: b.status });
      });
    });
    featureToBuildingRef.current = lookup;
  }, [buildings, setFState]);

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

    initFeatureStates();
  }, [initFeatureStates]);

  // Re-apply if buildings update after map is already loaded.
  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (map?.isStyleLoaded()) initFeatureStates();
  }, [initFeatureStates]);

  const handleMouseMove = useCallback((e) => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    const featureId = e.features?.[0]?.id ?? null;
    const building = featureId != null ? (featureToBuildingRef.current.get(featureId) ?? null) : null;
    // Only highlight buildings that are in the dataset
    const group = building ?? null;

    const prev = hoveredGroupRef.current;
    if (group === prev) return;

    // Clear previous hover, but keep highlight if it's the selected building.
    if (prev != null && prev !== selectedGroupRef.current) {
      groupFeatureIds(prev).forEach((fid) => setFState(fid, { highlight: false }));
    }

    hoveredGroupRef.current = group;

    if (group != null) {
      groupFeatureIds(group).forEach((fid) => setFState(fid, { highlight: true }));
      map.getCanvas().style.cursor = "pointer";
    } else {
      map.getCanvas().style.cursor = "";
    }
  }, [setFState]);

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const prev = hoveredGroupRef.current;
    if (prev != null && prev !== selectedGroupRef.current) {
      groupFeatureIds(prev).forEach((fid) => setFState(fid, { highlight: false }));
    }
    hoveredGroupRef.current = null;
    map.getCanvas().style.cursor = "";
  }, [setFState]);

  const handleClick = useCallback((e) => {
    const featureId = e.features?.[0]?.id ?? null;
    if (featureId != null) {
      const building = featureToBuildingRef.current.get(featureId) ?? null;
      if (!building) return; // ignore unmapped buildings
      const group = building;
      const prev = selectedGroupRef.current;

      if (prev === group) {
        // Toggle off — only clear highlight if not currently hovered
        if (hoveredGroupRef.current !== group) {
          groupFeatureIds(group).forEach((fid) => setFState(fid, { highlight: false }));
        }
        selectedGroupRef.current = null;
        onSelect?.(null);
      } else {
        // Deselect previous if not hovered
        if (prev != null && hoveredGroupRef.current !== prev) {
          groupFeatureIds(prev).forEach((fid) => setFState(fid, { highlight: false }));
        }
        selectedGroupRef.current = group;
        groupFeatureIds(group).forEach((fid) => setFState(fid, { highlight: true }));
        // Compute centroid of clicked feature polygon for flyTo
        const coords = e.features[0]?.geometry?.coordinates?.[0];
        if (coords?.length) {
          flyTargetRef.current = {
            lng: coords.reduce((s, c) => s + c[0], 0) / coords.length,
            lat: coords.reduce((s, c) => s + c[1], 0) / coords.length,
          };
        } else {
          flyTargetRef.current = null;
        }
        if (building) onSelect?.(building);
      }
      return;
    }

    // Click on empty space
    const prev = selectedGroupRef.current;
    if (prev != null && hoveredGroupRef.current !== prev) {
      groupFeatureIds(prev).forEach((fid) => setFState(fid, { highlight: false }));
    }
    selectedGroupRef.current = null;
    onSelect?.(null);
  }, [setFState, onSelect]);

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

  useEffect(() => {
    if (selectedId) return;
    const prev = selectedGroupRef.current;
    if (prev != null && hoveredGroupRef.current !== prev) {
      groupFeatureIds(prev).forEach((fid) => setFState(fid, { highlight: false }));
    }
    selectedGroupRef.current = null;
  }, [selectedId, setFState]);

  useEffect(() => {
    if (!selectedId) return;
    const b = buildings.find((x) => x.id === selectedId);
    const map = mapRef.current?.getMap?.();
    if (!b || !map) return;
    flyingRef.current = true;
    const clear = () => { flyingRef.current = false; map.off("moveend", clear); };
    map.on("moveend", clear);
    const w = map.getContainer().clientWidth;
    // Center the target in the visible area between the left and right panels.
    const visibleCenter = LEFT_PANEL_W + (w * (1 - RIGHT_PANEL_FRACTION) - LEFT_PANEL_W) / 2;
    const offsetX = visibleCenter - w / 2;
    const target = flyTargetRef.current ?? b.position;
    map.flyTo({ center: [target.lng, target.lat], zoom: 16.5, pitch: 30, duration: 1500, offset: [offsetX, 30], essential: true });
    return () => { map.off("moveend", clear); };
  }, [selectedId, buildings]);

  return (
    <MapGL
      ref={mapRef}
      mapboxAccessToken={MAPBOX_TOKEN}
      initialViewState={INITIAL_VIEW}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ position: "absolute", inset: 0 }}
      antialias
      maxPitch={70}
      interactiveLayerIds={["hk-3d-buildings"]}
      onLoad={handleLoad}
      onDragEnd={handleDragEnd}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      attributionControl={false}
    >
      <Layer {...buildingLayer} beforeId={labelLayerId} />

      {buildings.filter((b) => !b.mapboxFeatureIds?.length).map((b) => (
        <MapMarker key={b.id} building={b} selected={selectedId === b.id} onSelect={onSelect} />
      ))}

      <NavigationControl position="bottom-right" showCompass={false} visualizePitch={false} />

    </MapGL>
  );
}
