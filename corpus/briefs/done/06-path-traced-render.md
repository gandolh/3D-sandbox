# Task 06 — Path-traced render

## Context

The feature the whole stack was arranged around. `three-gpu-pathtracer` being
WebGL2-only is why [decisions.md](../../wiki/decisions.md) gave up WebGPU and TSL;
this brief is what that trade bought.

The workflow is the arch-viz one: the viewport stays real-time for work, and
**Render** is an explicit action that leaves the real-time path entirely and
accumulates samples until the image resolves.

## Files you OWN

- `apps/web/src/engine/**`, `apps/web/src/ui/**`

## What to do

1. Pin `three-gpu-pathtracer@0.0.24`, `three-mesh-bvh@0.9.15`, `xatlas-web@0.1.0`.
2. A render session wrapping `WebGLPathTracer`: async scene build with BVH
   progress, sample accumulation driven from the engine's existing loop, cancel,
   and a blob of the finished image.
3. Honour the **Shot**: its camera pose, its solar moment, and its declared
   output size. A shot is the reproducible unit; a render that ignores it is a
   screenshot.
4. Image-based lighting without an HDRI on disk — generate a PMREM environment
   from the procedural sky, so the path tracer has something to gather light from
   before the asset library exists.
5. Progress UI: sample count against target, BVH build progress, elapsed time,
   Cancel, and Save image. The result downloads; nothing is stored server-side.

## Acceptance

- `npm run check` passes.
- Pressing Render produces a visibly different, better-lit image than the
  viewport, and the sample counter climbs.
- Rendering at a shot's declared size produces an image of exactly that size,
  and the viewport returns to its previous size afterwards.
- Cancel stops accumulation and restores the real-time viewport.
- Verified in a real browser, with a screenshot.

---

## Outcome — 2026-09-11

Shipped and confirmed path-tracing in a real browser. 11 new tests (132 across
the repo).

**Three failures on the way, each found by running it rather than building it:**

1. **`setSceneAsync` refuses to run without a BVH worker.** Registered
   `GenerateMeshBVHWorker` from `three-mesh-bvh/worker`; upstream constructs it
   as `new Worker(new URL(…), { type: "module" })`, which Vite bundles natively
   into its own 163 kB chunk with no worker plugin.
2. **The path tracer cannot sample the viewport's furniture.** The `Sky` shader
   mesh, the hemisphere light, the transform gizmo and the selection box all live
   in the viewport scene, and the sky in particular failed deep inside a colour
   lookup rather than being skipped. Renders now get a purpose-built scene: the
   generated geometry, the sun, and an environment map. Nothing else.
3. **`scene.environment` must be an equirectangular texture with readable
   pixels.** A PMREM render target has none, and handing one over fails inside
   `EquirectHdrInfoUniform.updateFrom` with an error that names nothing useful.
   Replaced with `skyRadianceMap` in `@solstice/solar` — pure arithmetic over a
   `Float32Array`, so the maths is tested without a GPU and the web app only
   wraps it in a `DataTexture`.

A fourth suspicion turned out to be wrong but worth keeping: geometry attributes
were inconsistent across builders (hand-built roofs and roads had no `uv` while
three's primitives did). That did *not* cause this failure, but it would have
broken the merge eventually, so `ensureStandardAttributes` now guarantees
position/normal/uv everywhere, with a test that sweeps the whole generated scene.

**Performance, stated honestly.** Verified in a browser with no GPU (software
WebGL), where it managed 0.22 of a sample in 74 seconds at 960 × 540. That is an
environment limit, not a measurement of the renderer — but it does mean **nobody
has yet seen this run on real hardware**, and the shot defaults (2 000 samples at
1920 × 1080) are untested at speed. First thing to check on a machine with a GPU.

Deferred: no denoiser; `bounces` is fixed at 5 and not exposed; renders always use
the live camera rather than letting you pick a shot from a list; the shot's own
solar override is stored but not applied to the render.
