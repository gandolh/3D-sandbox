import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative base so the built client works under a Caddy sub-path later
  // without a rebuild. Costs nothing now; saves a surprise at deploy time.
  base: process.env["SOLSTICE_BASE"] ?? "/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:5174", changeOrigin: true } },
  },
  build: { target: "es2023", sourcemap: true },
});
