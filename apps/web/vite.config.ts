import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Relative base so the built client works under a Caddy sub-path later
  // without a rebuild. Costs nothing now; saves a surprise at deploy time.
  base: process.env["SOLSTICE_BASE"] ?? "/",
  /**
   * Where `Save` writes. Defaults to the dev proxy below.
   *
   * An EMPTY value means "there is no API behind this build" — the static
   * sub-path deploy has no writer, and the project's own rule is that scene
   * files are authored in the repo, so there never will be one there. Without
   * this the save would POST into the host's 404 page, get a perfectly valid
   * HTML response back, and report a refusal the API never made; with it, Save
   * goes straight to downloading the canonical file.
   */
  define: {
    __API_BASE__: JSON.stringify(process.env["SOLSTICE_API_BASE"] ?? "/api"),
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:5174", changeOrigin: true } },
  },
  build: { target: "es2023", sourcemap: true },
});
