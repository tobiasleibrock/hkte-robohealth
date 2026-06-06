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
  stable: "#36e2c4",
  watch: "#f5c451",
  alert: "#ff5d73",
};

export const STATUS_LABELS = {
  stable: "Stable",
  watch: "Watch",
  alert: "Alert",
};

export const SEVERITY_COLORS = {
  low: "#36e2c4",
  moderate: "#f5c451",
  high: "#ff5d73",
};
