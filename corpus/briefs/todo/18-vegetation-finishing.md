# Task 18 — Finish the vegetation

## Context

Two loose ends from [brief 13](../done/13-vegetation-impostors.md) and
[brief 11](../done/11-textures-and-foliage.md). Both are cosmetic, both are
visible, and neither is hard now that the machinery exists.

- **Only `tree_small_02` is baked.** `pine_tree_01` and `fir_tree_01` are not, so
  villa's forest falls through to the one atlas and is 284 copies of the same
  species. The bake harness works; this is 1.4 GB of download and two runs of it.
- **The vine reads as scattered leaves from directly underneath at close range.**
  At 26 clusters/m² the canopy is right from the alley and thin from beneath it.
  Either the density rises or a cluster becomes a multi-leaf sprite rather than a
  single quad.

## Files you OWN

- `assets-src/polyhaven/{pine_tree_01,fir_tree_01}/impostor/`
- `packages/geometry/src/subject/runs.ts` — canopy density and cluster shape
- `corpus/wiki/assets.md`

## Files you must NOT touch

- `packages/geometry/src/context/impostor.ts` — the crossed-quad design is
  settled and tested; this brief feeds it more atlases, it does not change it.

## What to do

1. **Bake the two trees.** `bash assets-src/download-heavy.sh` fetches the
   sources; `assets/bake/serve.ts` and a headed GPU browser do the rest. Note
   that `pine_tree_01` is a 905 MB `.bin` — if the browser cannot load it, that is
   a finding worth recording, and the fallback is to bake `fir_tree_01` and
   accept two species.
2. **Delete the sources after baking.** They are gitignored, they are 1.4 GB, and
   the atlas is the artefact.
3. **Thicken the vine**, and judge it from underneath at eye height on the alley —
   which is where the approach shot puts the viewer, and the only angle where the
   current version is wrong.
4. **Re-check the triangle count.** The canopy is already the largest single
   contributor in `greenhollow`; raising density has a cost worth knowing.

## Acceptance

- Villa's forest shows more than one species, verified on the GPU.
- The vine reads as a vine from directly beneath, in a path trace, not just from
  the gate.
- The atlases are committed and the sources are not.
