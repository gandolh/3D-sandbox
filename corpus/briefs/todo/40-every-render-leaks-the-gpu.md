# Task 40 — Every render leaks GPU memory, and a shot list compounds it

## Context

From the 2026-09-12 audit, round 4, verified against `node_modules`.

**1 — `WebGLPathTracer.dispose()` does not dispose most of what it allocates.**
`PathTraceSession.dispose()` (`apps/web/src/engine/PathTracer.ts:192`) delegates
to it, and upstream (`three-gpu-pathtracer/src/core/WebGLPathTracer.js:496`) that
disposes only `_quad`, `_quad.material` and `_pathTracer`. Left allocated:

- `PhysicalPathTracingMaterial` — `FullScreenQuad.dispose()` frees only the
  mesh's geometry, so the material survives, and with it `material.bvh` (the
  whole BVH as DataTextures), `material.attributesArray` (every triangle's
  normals/tangents/uv/colour as a DataArrayTexture), `material.textures` (a
  `RenderTarget2DArray`, one 1024×1024 RGBA layer **per scene texture**),
  `envMapInfo`, `lights`, `iesProfiles`.
- **`_lowResPathTracer`** — an entire second `PathTracingRenderer` (four float
  targets, a sobol target, two quads, a second material). `SandboxEngine.ts:118`
  sets `dynamicLowRes = true`, so it is sized and actively used, and nothing ever
  disposes it.

Run "Render all" on four shots: each builds a fresh BVH and a fresh texture array
over the same scene, and **nothing from shots 1–3 is freed.** VRAM climbs
monotonically; the later shots thrash, the sample rate collapses, and on a
mid-range GPU the tab loses its WebGL context part-way through — which is exactly
the failure the queue's file-writing was designed to survive, except here the
images stop because the GPU is gone.

**2 — The cloned render scene leaks an instance buffer per scatter field.**
`buildRenderScene` does `this.generated.root.clone()`; `InstancedMesh.copy()`
allocates a **new** `Float32Array` for `instanceMatrix`, which the renderer
uploads as a new VBO. `renderScene.clear()` only detaches children — it dispatches
no `dispose` event, so the VBO is never released. Greenhollow has six scatter
fields, so that is six leaked instance buffers per render.
**Careful**: the clone's geometries and materials are *shared with the live
scene*. Disposing those would blank the viewport. Only the clone's own
`instanceMatrix` may be freed.

**3 — `SandboxEngine.dispose()` leaves most of the engine behind**
(`SandboxEngine.ts:490`): `this.sky` (a `Mesh` with a `ShaderMaterial` whose
compiled program the renderer holds), `this.selectionBox` (`BoxHelper` —
geometry + material), `this.sun.shadow` (a 2048×2048 depth target; `.dispose()`
never called), and the collider overlay's children (correctly disposed on each
*rebuild*, but not on teardown). `renderer.dispose()` in three 0.185 never calls
`forceContextLoss()`, so the canvas keeps its WebGL context. With Vite HMR
active, a dozen edits to `Viewport.tsx` exhaust the browser's ~16-context cap and
the viewport goes black with no error — indistinguishable from the black-render
bug this file already documents.

**4 — `disposePhysics` is exported and never called.** `grep` finds exactly one
reference: its own definition. A Rapier world built by one drop stays resident in
the WASM heap across every later scene and the Viewport unmount.

**5 — The `AbortSignal` reaches only the first fetch.** `AssetLoader.ts:40`
forwards it to `index.json`; the glTF loads, the impostor meta fetches and both
texture loads take no signal. So an unmount lets the full 135 MB complete, builds
every geometry and texture, and then the guarded `.then` **discards them with no
handle to dispose** — while a second mount starts the whole download again.

## Files you OWN

- `apps/web/src/engine/PathTracer.ts`
- `apps/web/src/engine/SandboxEngine.ts`
- `apps/web/src/engine/AssetLoader.ts`
- `apps/web/src/lib/physics.ts`
- `apps/web/src/ui/Viewport.tsx` — the cleanup path

## Files you must NOT touch

- `node_modules` — do not patch the library. Dispose what it leaves behind, from
  our side, and leave a comment naming the upstream line so the workaround can be
  removed if it is ever fixed.
- `packages/geometry`'s `GeneratedScene.dispose` — correct for what it owns
  (except the impostor materials, already recorded in the audit).

## What to do

1. **Measure first.** Take a `renderer.info.memory` reading before and after a
   render, and after three renders. Land the numbers in the outcome note — this
   brief's claims come from reading library source, and a measurement is what
   turns that into a fact.
2. Dispose the tracer's materials and the low-res tracer explicitly after
   `WebGLPathTracer.dispose()`.
3. Dispose the clone's `instanceMatrix` buffers — **and only those**.
4. Complete `SandboxEngine.dispose()`: sky, selection box, shadow map, overlay
   children, and `forceContextLoss()` on the canvas.
5. Call `disposePhysics` from the Viewport cleanup, or delete it if the cache
   should genuinely outlive the component — but do not leave an exported
   function nobody calls.
6. Thread the `AbortSignal` through every load, so an aborted load stops rather
   than completing into a discarded result.

## Acceptance

- `renderer.info.memory` is flat across repeated renders of the same shot; the
  before/after numbers are in the outcome note.
- A four-shot queue completes without the sample rate degrading between shots.
- `npm run check` exits 0.
