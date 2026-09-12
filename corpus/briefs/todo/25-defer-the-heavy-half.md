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
