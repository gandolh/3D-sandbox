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
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { ASSET_ID, insideRoot } from "./paths.js";

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
          const file = resolve(assetsRoot, "." + (rel.startsWith("/") ? rel : `/${rel}`));
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

                if (!ASSET_ID.test(asset)) {
                  res.statusCode = 400;
                  res.end("asset must be <source>/<slug>");
                  return;
                }

                // Beside the source, under `impostor/`, which is what the
                // manifest scan will pick up and what gets committed.
                const outDir = resolve(assetsRoot, dirname(asset), "impostor");
                // Belt and braces: the pattern above already makes this
                // unreachable, and it is one line to guarantee rather than
                // argue that no future edit to the pattern reopens it.
                if (!insideAssets(outDir)) {
                  res.statusCode = 400;
                  res.end("outside the assets root");
                  return;
                }
                await mkdir(outDir, { recursive: true });
                await writeFile(join(outDir, "atlas.png"), Buffer.from(await atlas.arrayBuffer()));
                await writeFile(join(outDir, "impostor.json"), `${meta}\n`);

                console.log(`✓ ${asset} → ${outDir}`);
                res.statusCode = 200;
                res.end("ok");
              } catch (error) {
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
