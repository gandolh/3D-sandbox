# Task 11 — Textures, and a vine that is not a slab

## Context

Every material resolves to a flat `MeshStandardMaterial` with a single colour.
`Material.source` and `slug` have pointed at Poly Haven and ambientCG since the
first commit and nothing has ever loaded a map. `baseColor` is the documented
stand-in — see [decisions-scene.md](../../wiki/decisions-scene.md) — and it is
carrying the entire look of both scenes.

The pergola's climber is the sharpest case: an opaque box, so it reads as a black
soffit across the top of the approach render instead of dappling light through.

**The path tracer already supports this.** `get_surface_record_function.glsl.js`
samples `alphaMap` and honours `alphaTest`, with stochastic transparency for
`transparent` materials. Foliage cut-outs need no engine work — only a loaded
texture. That is worth knowing before anyone proposes instanced leaf geometry.

Depends on **brief 10**: the manifest is how a texture set is found.

## Files you OWN

- `packages/geometry/src/materials.ts` — load maps, keep `baseColor` as fallback
- `packages/geometry/src/subject/runs.ts` — canopy as crossed alpha-cut planes
- `packages/schema/src/document.ts` — only if a map needs declaring
- `assets/manifest.ts` — texture sets alongside models
- `scenes/src/*.ts` — material slugs that resolve
- `apps/web/src/engine/PathTracer.ts` — only if texture arrays need feeding

## Files you must NOT touch

- `packages/physics`, `apps/api`.
- The `Run` geometry for hedges, fences and colonnades — this is the climber only.

## What to do

1. **Load PBR maps** for materials whose `source` is `polyhaven` or `ambientcg`,
   from the manifest. `baseColor` stays the fallback when maps are absent, so a
   scene still composes before anything is downloaded — that property is what
   makes the whole thing incremental and must not be lost.
2. **Decide the compression story once** and write it down: raw PNG/JPG versus
   KTX2. Note that 4k is already gitignored and 1k/2k are committed.
3. **The vine becomes crossed alpha-cut planes** with a leaf texture, rather than
   a solid box — the standard approach, and the one the tracer already samples.
   Instanced leaf geometry is rejected: heavier, and no better at the distance any
   shot views it from.
4. **Light the canopy's underside.** Part of why it reads black is that nothing
   bounces onto it; check this after the maps land, since it may simply resolve.

## Acceptance

- `npm run check` green; materials still resolve when no maps are present.
- The approach render shows light through the vine, not a black soffit.
- Verified on the GPU, and the render compared against the current one.
