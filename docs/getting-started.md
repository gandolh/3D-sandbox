# Getting started

## Prerequisites

- Node 22.12 or later. The scripts run TypeScript through Node's built-in type stripping, and `.npmrc` sets `engine-strict=true`, so `npm install` stops on an older Node instead of failing later with a syntax error.
- A browser with WebGL2 for the editor.
- For path-traced renders, a GPU the browser can actually reach. See [Rendering on a GPU](#rendering-on-a-gpu).

## 1. Install and build

```bash
npm install
npm run build
```

The build is not optional on a fresh clone. Every workspace package's only entry point is `./dist/index.js`, and `dist/` is gitignored, so without it `npm run dev` and `npm run api` both stop on `ERR_MODULE_NOT_FOUND: @solstice/schema`. Run it again after changing anything under `packages/`.

## 2. Run the editor

```bash
npm run dev
```

Vite serves the editor on <http://localhost:5173>. The port is set in `apps/web/vite.config.ts`; to use another one for a single run:

```bash
npm run dev --workspace @solstice/web -- --port 5301
```

Greenhollow opens first. The scene picker at the top left switches to Elmsgate or Villa Carpathia, and the shot menu next to Render moves the camera to a named shot.

## 3. Run the API (optional)

```bash
npm run api
```

It starts a Fastify server on <http://127.0.0.1:5174> and prints the scenes folder and index file it uses. The Vite dev server proxies `/api` to that port. With the API running, Save writes the scene back to its `scenes/*.scene.json`, and the API validates and lints the document before it touches the file. Without it, Save downloads the canonical JSON instead.

The API reads and writes `scenes/*.scene.json`; those files are the truth. The SQLite index in `apps/api/.data/` only lists them and is rebuilt by rescanning.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5174` | Port the API listens on |
| `HOST` | `127.0.0.1` | Address the API listens on |
| `SOLSTICE_SCENES_DIR` | `scenes/` | Folder holding the `*.scene.json` files |
| `SOLSTICE_INDEX_DB` | `apps/api/.data/index.db` | The derived SQLite index |
| `SOLSTICE_ALLOWED_ORIGINS` | `localhost` and `127.0.0.1` on 5173 and 5174 | Comma-separated origins allowed by CORS |

Two variables shape the web build:

| Variable | Default | Purpose |
|---|---|---|
| `SOLSTICE_BASE` | `/` | Vite's base path, for serving under a sub-path |
| `SOLSTICE_API_BASE` | `/api` | Where Save writes. Empty means the build has no API, and Save downloads the file |

## 4. Edit a scene

Scenes are TypeScript in `scenes/src/`, compiled to the `*.scene.json` the app imports. Nothing watches them, so the loop has three steps:

```bash
$EDITOR scenes/src/greenhollow.ts
npm run scenes       # rebuilds and lints all three scene documents
# then reload the browser
```

Editing the `.ts` with the dev server running and expecting the viewport to change is the first thing everyone tries. It does nothing until `npm run scenes` has run.

## 5. Fetch the assets

The scenes name CC0 models and textures from Poly Haven and ambientCG. The files are not committed, so fetch them:

```bash
bash assets-src/download.sh         # models and textures
bash assets-src/download-heavy.sh   # only if you are re-baking tree impostors
npm run assets                      # regenerate the download list after a scene names a new asset
```

Sizes are in [`assets-src/DOWNLOADS.md`](../assets-src/DOWNLOADS.md), which `npm run assets` regenerates from the scenes. They are not repeated here because a copied size drifts; an earlier README gave two different figures five lines apart, and both were wrong.

Everything works without the downloads. Materials fall back to their declared colour and models to proxy geometry, so the scene looks like a diagram rather than a place. In dev, Vite serves `assets-src/` at `/assets-src/`; a production build ships no models.

## 6. Check your work

```bash
npm run check
```

That runs Biome, the three typechecks, the Vitest suite, the scene build, the web build and the corpus lint, in that order. There is no CI, so run it by hand before committing. The pieces are also separate scripts: `npm run lint`, `npm run typecheck`, `npm test`, `npm run scenes`, `npm run build:web` and `npm run lint:corpus`. `npm run format` applies Biome's fixes.

## Rendering on a GPU

Under WSL2 a headless browser silently falls back to SwiftShader and renders about a thousand times slower. Chromium looks for GPUs through `/dev/dri`, which WSL2 does not have. A headed browser on WSLg's X server reaches the real GPU with these flags:

```
--ozone-platform=x11 --use-gl=angle --use-angle=gl --ignore-gpu-blocklist
```

Check `WEBGL_debug_renderer_info` before trusting any render timing. `SwiftShader` in the renderer string means you are measuring software. Measurements and the full story: [corpus/wiki/running-on-a-gpu.md](../corpus/wiki/running-on-a-gpu.md) and [corpus/wiki/render-performance.md](../corpus/wiki/render-performance.md).

## Common problems

| Symptom | Cause |
|---|---|
| `ERR_MODULE_NOT_FOUND: @solstice/schema` | `npm run build` has not run since the clone or since a package changed |
| A scene edit does not show up | Run `npm run scenes`, then reload |
| Trees are cones and walls are flat colour | The assets are not downloaded; see step 5 |
| Save says "API unreachable — downloaded instead" | The API is not running, which is fine; start it with `npm run api` to write files in place |
| A render crawls or never finishes | The browser is on SwiftShader; see [Rendering on a GPU](#rendering-on-a-gpu) |

## Deploy

The deploy lives in the separate `vps-deploy` repo, in `stacks/solstice.ts`. It ships the static client only, under `/solstice/`, built with `SOLSTICE_API_BASE` empty so Save downloads. The API is deliberately left out, because an unauthenticated writer in front of the scene files would let anyone overwrite them. The site was not answering on 2026-10-09.
