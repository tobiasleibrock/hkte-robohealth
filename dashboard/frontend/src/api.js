const BASE = "/api";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed: ${path} (${res.status})`);
  return res.json();
}

export const fetchNetwork = () => get("/network");
export const fetchBuildings = () => get("/buildings");
export const fetchBuilding = (id) => get(`/buildings/${id}`);

export const STATUS_COLORS = {
  stable: "#10b981",
  watch: "#f59e0b",
  alert: "#ef4444",
};

export const STATUS_LABELS = {
  stable: "Stable",
  watch: "Watch",
  alert: "Alert",
};

export const SEVERITY_COLORS = {
  low: "#10b981",
  moderate: "#f59e0b",
  high: "#ef4444",
};
