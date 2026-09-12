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

---

## Outcome — 2026-09-12

All six items done. **The measurement the brief asked for first could not be
taken, and that is stated rather than worked around** — see the last section.

**1 — The tracer's materials and the low-res tracer.** `disposeTracerInternals`
runs after `WebGLPathTracer.dispose()` and frees both `PathTracingRenderer`s'
materials — walking their uniforms rather than naming them — then disposes
`_lowResPathTracer`, which upstream never touches. The walk is the safer shape:
it keeps working when upstream adds a uniform, and it cannot free a shared
singleton because there are none (tested).

**2 — The clone's instance buffers.** `renderScene.traverse` disposes every
`InstancedMesh` in the clone before `clear()`. Verified in three 0.185's
`WebGLObjects.onInstancedMeshDispose` that this removes `instanceMatrix` (and
`instanceColor`) from the attribute cache and touches neither geometry nor
material — which is what makes it safe, since the clone shares both with the
live scene.

**3 — `SandboxEngine.dispose()`** now frees the sky mesh and its shader
material, the selection box, the sun's 2048² shadow map, and the collider
overlay's children — the last by extracting `clearColliderOverlay`, which the
rebuild path already did and teardown did not.

**4 — `disposePhysics`** is called from the Viewport cleanup. It had exactly one
reference in the repo: its own definition.

**5 — The `AbortSignal`** reaches the impostor metadata fetch, and every load
stage now checks it between steps. three's loaders take no signal, so an
in-flight transfer cannot be cancelled — but the next one can be skipped, and a
texture that lands after an abort is disposed instead of dropped on the floor.

### Two things the brief got wrong, found by doing it

**`forceContextLoss()` broke the app on the first HMR update.** The brief asks
for it unconditionally. It is **permanent for that canvas** — and the canvas
belongs to React, which keeps the same node across a Fast Refresh, so the next
engine's `new WebGLRenderer({ canvas })` failed outright and the viewport threw.
Measured, not reasoned: it took the app down immediately. It is now called only
if the canvas has actually left the document, checked a turn later because React
runs the cleanup *before* it detaches the node. A reused canvas reuses its
context, so there is nothing to reclaim in that case anyway.

**Disposal ran before ownership was released, and that turned a throw into a
hang.** `startRender`'s `finally` disposed first and set `this.render = null`
after. When `disposeTracerInternals` threw — it did, reaching into library
privates — `this.render` stayed set and the frame loop went on calling `step()`
on a half-disposed session at full rate, forever. The tab pegged a core and
stopped answering CDP. Ownership is now released first, and the internals walk
is wrapped: the cost of it failing should be the leak we already had, never the
engine.

### The measurement, and why there isn't one

The brief's step 1 asks for `renderer.info.memory` before and after one render
and after three. **This machine cannot complete a path trace.** It is WSL2 with
no hardware GL: the browser reports `KHR_parallel_shader_compile extension not
supported`, and the path-tracing shader's synchronous compile did not finish in
over ten minutes at 256×144 with a single sample, across four attempts. Numbers
from that would be fiction.

What *can* be measured without a GL context is measured, in
`apps/web/test/path-tracer-teardown.test.ts`, and it is the load-bearing half of
the claim:

- A `PhysicalPathTracingMaterial` holds **nine disposable GPU resources** in its
  uniforms — the BVH, the attribute array, the material-index attribute, the
  materials texture, the scene texture array, the IES profiles, the environment
  map info and two sampling textures.
- `material.dispose()` frees **none of them** — asserted with spies, not read
  off the source.
- Our walk frees all nine, exactly once each.
- Two materials share none of them, so the walk cannot break the next render.
- `WebGLPathTracer.prototype.dispose`'s source mentions `_pathTracer` and not
  `_lowResPathTracer`. **When that assertion fails, upstream has fixed it** and
  the workaround should be deleted rather than the test.

Two materials per session, so eighteen resources per render that upstream frees
none of, plus an entire second `PathTracingRenderer`. The VRAM figure is
unmeasured here; the count of things not freed is not.

`npm run check` clean, 266 tests.
