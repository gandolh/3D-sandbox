# Solstice

A parametric architectural scene editor and path-traced renderer, in the browser.

You describe a house, its yard and its surroundings as a typed JSON document.
The app derives geometry from it, lights it by real sun position for a real date
and place, and path-traces photoreal stills.

Scenes are authored **in the repo**, in TypeScript — there is deliberately no LLM
inside the running app. The browser's job is to tweak, light and look.

```bash
npm install
npm run dev          # the editor, on :5173
npm run api          # the persistence API, on :5174 — optional
npm run check        # build, typecheck, 207 tests, scene build, corpus lint
```

`npm run dev` alone is enough to open a scene and render it. Without the API,
**Save** downloads the canonical JSON instead of writing through it.

## Assets

The scenes name CC0 models and textures from Poly Haven and ambientCG. The
binaries are not committed — 17 assets are 135 MB, and the trees are 1.5 GB more —
so fetch them:

```bash
npm run assets                      # regenerate the download list from the scenes
bash assets-src/download.sh         # ~88 MB: models, textures
bash assets-src/download-heavy.sh   # only if you are re-baking tree impostors
```

Everything works without this: materials fall back to their declared colour and
models to proxy geometry. It just looks like a diagram rather than a place.

## Rendering on a GPU

Under WSL2 a **headless** browser silently falls back to SwiftShader and renders
about a thousand times slower, because Chromium enumerates GPUs through
`/dev/dri`, which WSL2 does not have. A headed browser on WSLg's X server reaches
the real GPU:

```
--ozone-platform=x11 --use-gl=angle --use-angle=gl --ignore-gpu-blocklist
```

Check `WEBGL_debug_renderer_info` before trusting any render timing —
`SwiftShader` in the string means you are measuring software. Details in
[corpus/wiki/running-on-a-gpu.md](corpus/wiki/running-on-a-gpu.md).

## Layout

| Path | What it is |
|---|---|
| `packages/schema` | The scene document, Zod validation, and the semantic linter |
| `packages/geometry` | Document → three.js meshes. Pure CPU, no WebGL |
| `packages/solar` | Site + clock → sun position, sky, lighting |
| `packages/physics` | Colliders derived from the document; drop-to-rest |
| `apps/web` | The editor and renderer |
| `apps/api` | Fastify persistence. Files are truth; SQLite is a rebuildable index |
| `scenes` | Authored scenes: TypeScript sources, generated `.scene.json` |
| `assets` | Manifest, download-list generator, impostor bake harness |
| `corpus` | The project wiki — decisions, status, and why things are as they are |

Start with [corpus/wiki/overview.md](corpus/wiki/overview.md), then
[decisions.md](corpus/wiki/decisions.md) before changing anything structural.

## Licence

Assets are CC0 from their respective sources. The code has no licence declared
yet.
