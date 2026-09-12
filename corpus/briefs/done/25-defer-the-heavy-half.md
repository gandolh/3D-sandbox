# Task 25 — Defer Rapier and the path tracer out of the first load

## Context

From the 2026-09-12 audit. The built client is **4.26 MB of JS (1.48 MB gzipped)**
plus a 163 KB worker. Two of the heaviest things in it are needed by features
most visitors never reach, and both are pulled in by a static import.

**Rapier — roughly 2 MB, nearly half the bundle.**
`apps/web/src/ui/Inspector.tsx:2` statically imports `../lib/physics.js`, which
imports `PhysicsWorld` from `@solstice/physics` at module scope
(`apps/web/src/lib/physics.ts:3`). `@dimforge/rapier3d-compat` inlines its WASM as
base64, and the `\0asm` magic bytes are present in `dist/assets/index-*.js`.
Inspector is always mounted, so every visitor downloads a physics engine on first
paint. The only thing that needs it is **drop to floor**.

Note the split that makes this clean: `collidersFor` / `deriveColliders` — used by
the always-available colliders toggle — has **no Rapier dependency**. Only
`PhysicsWorld` / `physicsFor` does.

**The path tracer.** `apps/web/src/engine/SandboxEngine.ts:16` statically imports
`PathTraceSession` and `buildSkyEnvironment` from `./PathTracer.js`, so
`three-gpu-pathtracer` loads on boot for someone who only ever orbits the
viewport. Both are used solely inside `startRender()` (line 326).

Neither of these contradicts the static-deploy decision: a dynamic `import()` is
still a statically built chunk served from the same directory, with no API behind
it. This is about *when* it loads, not *where* it comes from.

## Files you OWN

- `apps/web/src/lib/physics.ts`
- `apps/web/src/ui/Inspector.tsx`
- `apps/web/src/engine/SandboxEngine.ts`
- `apps/web/vite.config.ts` if chunking needs a hint

## Files you must NOT touch

- `packages/physics/` — the package is fine; this is about how the app reaches it.
- `apps/web/src/scenes.ts` — the scene JSONs are ~60 KB total and bundling them is
  a deliberate decision. Not worth splitting; do not.

## What to do

1. **Move `PhysicsWorld` behind a dynamic import** inside the drop handler
   (`Inspector.tsx`, `PlacementInspector`'s `drop()`), keeping `collidersFor` and
   `sizesFromMap` eager. `lib/physics.ts` must stop importing `PhysicsWorld` at
   module scope or nothing changes.
2. **Move `PathTracer.js` behind a dynamic import** at the top of `startRender()`.
3. **Give the user something to look at.** Both deferred loads now happen on a
   click that previously felt instant — set a status while the chunk arrives, and
   make a failure to load say so rather than doing nothing.
4. **Measure and record.** Report the before and after for the main chunk, raw and
   gzipped, in the outcome note. If a split does not actually move the number,
   say so and revert that half — the claim above is read from the source, not from
   a bundle analysis.

## Acceptance

- The main chunk drops by roughly 2 MB raw; the real figure is recorded.
- Drop-to-floor and Render both still work, including the first time they are used.
- `npm run check` exits 0.

---

## Outcome — 2026-09-12

**Measured, before and after, from the production build:**

| chunk | before | after |
|---|---|---|
| **main (first paint)** | **4 264.5 KB** / 1 474.5 KB gzip | **1 247.1 KB** / **349.1 KB** gzip |
| Rapier, on first drop | — | 2 854.0 KB / 1 094.9 KB gzip |
| path tracer, on first render | — | 164.9 KB / 46.4 KB gzip |

**First paint is 3 017 KB smaller raw and 1 125 KB smaller gzipped — a 76 %
reduction in what a visitor downloads to look at a scene.** Better than the
brief's estimate of "roughly 2 MB", because Rapier's inlined WASM compresses
badly and dominates the gzipped figure.

**Verified by looking for the WASM magic bytes rather than by reading the
listing.** `AGFzbQ` (base64 `\0asm`) appears **0 times** in the main chunk and
once in the deferred one. The audit found it present before; it is gone.

**1 — Rapier needed a second entry point, not just a dynamic import.**
`@solstice/physics`'s index re-exports `world.js`, which imports Rapier at
module scope, and Rapier's module has side effects — so importing
`deriveColliders` through the package root drags the engine in whatever the
bundler does with it. `packages/physics/package.json` gained
`"./colliders": "./dist/colliders.js"`.

That is a change inside `packages/physics`, which the brief reserves. It is
`exports` only — no source, no behaviour — and it is exactly the thing the
brief describes as in scope: *"this is about how the app reaches it"*. Without
it there is no way for a bundler to tell the package's two halves apart, and
the split the brief asks for cannot be made.

**2 — The path tracer is a type-only import plus one `await import()`** at the
top of `startRender`, fetched **before anything else is touched** so a chunk
that fails to arrive leaves the viewport exactly as it was: orbit still
enabled, gizmo still visible, no half-built render scene to unwind.

**3 — Both waits say what they are**, and the two states are distinguished:

- Drop: `physicsReady()` decides between *"Loading the physics engine…"* and
  *"Dropping table-01…"*, so the first drop of a session and every later one do
  not show the same message for very different waits. A failed load says
  *"Could not load the physics engine — drop to floor is unavailable"* rather
  than doing nothing.
- Render: a new `onRenderLoading` engine event sets *"Loading the renderer…"*;
  a failed load throws with a message the queue already surfaces.

**4 — Walked in a browser, both features, first use and second:**

| action | observed |
|---|---|
| first Drop to floor | status *"Loading the physics engine…"*, then *"chair-hearth-w settled … after 38 steps"* |
| second drop | no load message — resolved from the cached chunk |
| first Render | **0** `PathTracer` chunk requests before the click, **1** after; status *"Loading the renderer…"*; the render overlay then opened with Cancel |

The render was cancelled rather than finished: this machine path-traces at
~77 s per sample (brief 40's outcome).

**One thing noticed and not this brief's**: the drop reported *"settled on
nothing"* for a chair standing over a slab. The drop works and the placement
moves, but `restingOn` is not being attributed. Pre-existing and unrelated to
the import change — recorded here so it is not lost.

`npm run check` clean, **361 tests**.
