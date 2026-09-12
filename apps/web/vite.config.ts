import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { readManifest } from "../../assets/manifest.ts";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Serve `assets-src/` at `/assets-src/` in dev.
 *
 * The downloads live at the repo root, outside this app, and they are
 * gitignored — the light asset set is around 90 MB (see `assets-src/DOWNLOADS.md`). Copying them into `public/` would
 * duplicate that and put it in the bundle; serving them from where they already
 * are costs nothing.
 *
 * **Dev only.** A production build ships no models, so the deployed client falls
 * back to proxies. That is the honest state until vegetation impostors (brief
 * 13) make the asset set small enough to bundle — a static deploy carrying every asset is
 * worse than grey boxes.
 */
function assetsSrc(): Plugin {
  const root = resolve(import.meta.dirname, "..", "..", "assets-src");
  const types: Record<string, string> = {
    ".gltf": "model/gltf+json",
    ".glb": "model/gltf-binary",
    ".bin": "application/octet-stream",
    ".jpg": "image/jpeg",
    ".png": "image/png",
  };

  return {
    name: "solstice-assets-src",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/assets-src", (req, res, next) => {
        // The index is served rather than generated into a file: a committed
        // index of gitignored downloads would be wrong on every fresh clone.
        if ((req.url ?? "").startsWith("/index.json")) {
          void readManifest(root).then((entries) => {
            res.setHeader("content-type", "application/json");
            res.end(
              JSON.stringify({
                models: entries
                  .filter((e) => e.gltf !== undefined)
                  .map((e) => ({ id: e.id, path: `${e.source}/${e.slug}/${e.gltf}` })),
                materials: entries
                  .filter((e) => e.maps !== undefined)
                  .map((e) => ({
                    id: e.id,
                    maps: Object.fromEntries(
                      Object.entries(e.maps!).map(([role, file]) => [
                        role,
                        `${e.source}/${e.slug}/${file}`,
                      ]),
                    ),
                  })),
                impostors: entries
                  .filter((e) => e.impostor !== undefined)
                  .map((e) => ({
                    id: e.id,
                    atlas: `${e.source}/${e.slug}/${e.impostor!.atlas}`,
                    meta: `${e.source}/${e.slug}/${e.impostor!.meta}`,
                  })),
              }),
            );
          });
          return;
        }
        const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"));
        const file = join(root, rel);
        // Never serve outside the asset root, whatever the request says.
        if (!file.startsWith(root)) {
          res.statusCode = 403;
          res.end();
          return;
        }
        stat(file)
          .then((info) => {
            if (!info.isFile()) return next();
            res.setHeader("content-type", types[extname(file).toLowerCase()] ?? "application/octet-stream");
            createReadStream(file).pipe(res);
          })
          .catch(() => next());
      });
    },
  };
}

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
  plugins: [react(), tailwindcss(), assetsSrc()],
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://localhost:5174", changeOrigin: true } },
  },
  build: {
    target: "es2023",
    /**
     * No maps in the production build.
     *
     * They were 11.2 MB against a 4.3 MB bundle — nearly three times the app,
     * for a deployment that is a static folder on a VPS with no error
     * reporting to consume them. Nobody would ever read one.
     *
     * This is not a secrecy argument: the repo is the user's own and the source
     * is not a secret. It is a bytes argument, and if error reporting ever
     * lands, the answer is `"hidden"` — maps generated and uploaded to the
     * reporter but not served beside the bundle — rather than back to `true`.
     * Dev keeps its maps; Vite serves those regardless of this flag.
     */
    sourcemap: false,
  },
});
