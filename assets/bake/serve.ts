/**
 * Dev server for the impostor bake.
 *
 * Vite rather than a bare `http` server purely so the page's `three` import
 * resolves — the bake page is a module with bare specifiers, and writing an
 * import map by hand to avoid one dependency would be a worse trade.
 *
 * Serves `assets-src/` alongside the page and accepts the finished atlas on
 * `POST /bake`, writing it next to its source. Uploading it back is the simplest
 * way out of the browser: reading a multi-megabyte canvas through the automation
 * channel as base64 is not.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
// `.ts`, not `.js`: this file is run by `node` directly, whose type-stripping
// does not remap a `.js` specifier onto a `.ts` file — with `.js` the server
// did not start at all. `assets/` is not compiled by any tsconfig.
import { insideRoot } from "./paths.ts";
import { BakeTargetError, writeImpostor } from "./write.ts";

const here = dirname(fileURLToPath(import.meta.url));
const assetsRoot = resolve(here, "..", "..", "assets-src");
const insideAssets = (path: string): boolean => insideRoot(assetsRoot, path);

const TYPES: Record<string, string> = {
  ".gltf": "model/gltf+json",
  ".glb": "model/gltf-binary",
  ".bin": "application/octet-stream",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

const server = await createServer({
  root: here,
  configFile: false,
  logLevel: "warn",
  // Loopback explicitly. This server writes files into the repo on an
  // unauthenticated POST; it must never be reachable from the network, and
  // Vite's default host has changed between major versions before.
  server: { host: "127.0.0.1", port: 5199, strictPort: true },
  plugins: [
    {
      name: "bake-endpoints",
      configureServer(vite) {
        vite.middlewares.use("/assets-src", (req, res, next) => {
          const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/"));
          const file = resolve(assetsRoot, `.${rel.startsWith("/") ? rel : `/${rel}`}`);
          if (!insideAssets(file)) {
            res.statusCode = 403;
            res.end();
            return;
          }
          stat(file)
            .then((info) => {
              if (!info.isFile()) return next();
              res.setHeader("content-type", TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
              createReadStream(file).pipe(res);
            })
            .catch(() => next());
        });

        vite.middlewares.use("/bake", (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          const chunks: Buffer[] = [];
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", () => {
            void (async () => {
              try {
                const body = new Response(Buffer.concat(chunks), {
                  headers: { "content-type": req.headers["content-type"] ?? "" },
                });
                const form = await body.formData();
                const asset = String(form.get("asset"));
                const meta = String(form.get("meta"));
                const atlas = form.get("atlas") as File;

                // Inside the asset's own directory, which is what the
                // manifest scan picks up and what gets committed — see
                // `impostorDir`.
                const outDir = await writeImpostor(
                  assetsRoot,
                  asset,
                  Buffer.from(await atlas.arrayBuffer()),
                  meta,
                );

                console.log(`✓ ${asset} → ${outDir}`);
                res.statusCode = 200;
                res.end("ok");
              } catch (error) {
                if (error instanceof BakeTargetError) {
                  res.statusCode = 400;
                  res.end(error.message);
                  return;
                }
                console.error("✗ bake upload failed", error);
                res.statusCode = 500;
                res.end("failed");
              }
            })();
          });
        });
      },
    },
  ],
});

await server.listen();
console.log("bake server on http://localhost:5199/impostor.html");
