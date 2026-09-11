# Task 13 — Vegetation impostors

## Context

Poly Haven's trees cannot be scattered. Not "are heavy" — cannot:

| asset | triangles |
|---|---|
| `pine_tree_01` | 17,427,094 |
| `fir_tree_01` | 7,853,731 |
| `tree_small_02` | 4,652,585 |
| the whole Greenhollow scene today | 3,130 |

Villa's forest is 284 instances. At 17.4 M each that is 4.9 billion triangles.
Downloading a smaller variant does not help — the mesh is 904.9 MB at 1k exactly
as at 8k, because resolution only ever described the textures — and the `lods:
true` the info API advertises is a Blender-addon feature, not a served file.

The decision — [decisions-scene.md](../../wiki/decisions-scene.md) — is
**impostors**, not decimation. Decimation is the obvious answer and the wrong one
for foliage: leaves are thousands of disconnected alpha cards, and the ~250×
reduction needed here shreds them. The path tracer already samples `alphaMap` and
honours `alphaTest`, so the renderer needs no change.

Depends on **brief 10** (the loader, so a tree can be loaded to be baked at all)
and shares machinery with **brief 11** (alpha-cut materials).

## Files you OWN

- `assets/impostor.ts` (new) — bake a glTF to an angle atlas
- `packages/geometry/src/context/impostor.ts` (new) — the quad and its material
- `packages/geometry/src/context/scatter.ts` — use impostors for trees
- `packages/schema/src/document.ts` — only if a field is genuinely needed
- `assets/manifest.ts` — record baked impostors alongside sources
- tests

## Files you must NOT touch

- `apps/web/src/engine/PathTracer.ts` — it already does what is needed. If it
  turns out not to, that is a finding and a separate brief, not a quiet edit.
- The subject tier's placement path. Subject uses the real asset by design.

## What to do

1. **Bake**: load the source glTF, render it from N azimuths (and a couple of
   elevations) to an RGBA atlas, write the atlas plus a small JSON descriptor
   next to it. This needs a GPU — see
   [running-on-a-gpu.md](../../wiki/running-on-a-gpu.md) for why that means
   headed Chromium under WSL, not headless.
2. **Commit the bake, not the source.** The whole point is that a 905 MB tree
   becomes a few MB of atlas. `download-heavy.sh` fetches the source when
   somebody needs to re-bake; the atlas is what the repo carries.
3. **Render**: a camera-facing quad per instance, sampling the atlas slice
   nearest the view angle, alpha-tested. Verify in the real-time viewport *and*
   in a path trace — they take different paths through the material and the
   second is the one that matters.
4. **Choose the angle count by looking.** Too few and the tree visibly pops as
   the camera orbits. Do not pick 8 because it is a round number; orbit it.
5. **Keep the proxy cone** for an asset with no bake yet. Falling back to
   something obviously fake is right; falling back to something subtly wrong is
   not.

## Acceptance

- Villa's 284-instance forest renders, in the viewport and path-traced, with a
  triangle count in the tens of thousands rather than billions.
- Orbiting the viewport does not show the impostors popping.
- An un-baked asset still yields the proxy cone, with a test.
- Verified on the GPU, with a before/after triangle count recorded in the wiki.
