import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  // Read environment variables from the repository root .env so the existing
  // `mapbox_key` entry is picked up. `envPrefix` exposes it to the client.
  envDir: fileURLToPath(new URL("..", import.meta.url)),
  envPrefix: ["VITE_", "mapbox_"],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
