import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/** The FastAPI backend (backend/). In development Vite forwards /api to it. */
const API = process.env.PAPER2LAB_API ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: { proxy: { "/api": { target: API, changeOrigin: true } } },
  preview: { proxy: { "/api": { target: API, changeOrigin: true } } },
  test: { environment: "node" },
});
