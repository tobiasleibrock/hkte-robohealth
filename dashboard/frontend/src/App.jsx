import { useEffect, useState, useCallback } from "react";
import MapView from "./components/MapView.jsx";
import MapFallback from "./components/MapFallback.jsx";
import LeftPanel from "./components/LeftPanel.jsx";
import SidePanel from "./components/SidePanel.jsx";
import { fetchNetwork, fetchBuildings, fetchBuilding } from "./api.js";

const MAPBOX_TOKEN = import.meta.env.mapbox_key;
const HAS_TOKEN = typeof MAPBOX_TOKEN === "string" && MAPBOX_TOKEN.startsWith("pk.");

export default function App() {
  const [network, setNetwork] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchNetwork(), fetchBuildings()])
      .then(([net, list]) => {
        setNetwork(net);
        setBuildings(list);
      })
      .catch((e) => setError(e.message));
  }, []);

  const handleSelect = useCallback((building) => {
    if (!building) {
      setSelectedId(null);
      setSelectedBuilding(null);
      return;
    }
    setSelectedId(building.id);
    setPanelLoading(true);
    fetchBuilding(building.id)
      .then((full) => setSelectedBuilding(full))
      .catch((e) => setError(e.message))
      .finally(() => setPanelLoading(false));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedId(null);
    setSelectedBuilding(null);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#06070b]">
      <div className="absolute inset-0">
        {buildings.length > 0 &&
          (HAS_TOKEN ? (
            <MapView buildings={buildings} selectedId={selectedId} onSelect={handleSelect} />
          ) : (
            <MapFallback
              buildings={buildings}
              selectedId={selectedId}
              onSelect={handleSelect}
              reason="No valid Mapbox token found — set mapbox_key in .env to load the live map."
            />
          ))}
      </div>

      <LeftPanel network={network} />
      <SidePanel building={selectedBuilding} loading={panelLoading} onClose={handleClose} />

      {!buildings.length && !error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          <p className="text-sm text-white/50">Connecting to robot network…</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <div className="max-w-sm rounded-2xl glass px-6 py-5 text-center">
            <p className="mb-1 font-medium text-signal-alert">Connection error</p>
            <p className="text-sm text-white/50">{error}</p>
            <p className="mt-3 text-[12px] text-white/40">Make sure the backend is running on port 4000.</p>
          </div>
        </div>
      )}
    </div>
  );
}
