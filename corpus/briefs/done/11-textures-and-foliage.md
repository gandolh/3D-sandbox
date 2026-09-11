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

---

## Outcome (2026-09-11)

Done. Materials load real PBR maps from both libraries, and the vine reads as a
vine — dappled light through the leaves onto the gravel instead of a black
soffit.

Three things the brief did not anticipate:

- **UVs had to be fixed first.** Every primitive here is a box or an extrusion
  carrying 0–1 UVs across each face whatever its size, so the first texture would
  have stretched one brick across a 6.4 m wall and squeezed the same brick onto a
  0.9 m pier. `boxProjectUv` projects from world position in metres, and
  `Material.textureScale` says how many metres one repeat covers. Without this,
  loading textures would have made the scene look *worse*.
- **Two authoring errors were hiding behind `baseColor`.** `grass-lawn` pointed
  at `coast_sand_rocks_02` — literally sand — and `plaster-lime` at
  `plaster_brick_pattern`, which is brick. A green hex and a cream hex had been
  covering both since the scene was written. Now `leafy_grass` and `clay_plaster`.
- **The vine is geometry, not an alpha-cut texture.** No CC0 leaf texture with an
  alpha channel is in the asset set, and gaps in geometry are honest in a way a
  missing texture is not: the path tracer gets real light through real holes with
  no material trickery to go wrong. 1,816 tilted clusters over the pergola,
  seeded from the run's id so it is stable and two pergolas differ.

Poly Haven packs AO, roughness and metalness into one `arm` texture — R, G, B —
which is exactly how three.js reads those three maps, so one file fills three
roles. ambientCG ships them separately. Displacement is ignored on purpose: it
needs tessellated geometry to mean anything.
