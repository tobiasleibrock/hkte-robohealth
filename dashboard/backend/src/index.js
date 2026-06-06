import express from "express";
import cors from "cors";
import { buildingsSummary, getBuilding, network } from "./data.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "hk-health-robot-dashboard", time: new Date().toISOString() });
});

// Network-wide overview for the top status bar.
app.get("/api/network", (_req, res) => {
  res.json(network);
});

// Lightweight building list used to render the 3D map.
app.get("/api/buildings", (_req, res) => {
  res.json(buildingsSummary);
});

// Full detail for a single building (residents + community insights).
app.get("/api/buildings/:id", (req, res) => {
  const building = getBuilding(req.params.id);
  if (!building) {
    return res.status(404).json({ error: "Building not found" });
  }
  res.json(building);
});

app.listen(PORT, () => {
  console.log(`HK health-robot API listening on http://localhost:${PORT}`);
});
