# Task 39 — Every scene after the first renders with the wrong assets

## Context

From the 2026-09-12 audit, round 4. **A live bug in the scene picker shipped
yesterday** (brief 20), which nothing checked because switching scenes was new.

`apps/web/src/ui/Viewport.tsx:229` loads assets in a mount effect with `[]`
dependencies — once per mount:

```ts
void loadAssets(assetLoad.signal).then((loaded) => {
  const doc = getState().document;
  engine.setAssets(loaded.assets, loaded.materialsFor(doc), …);
  // …and a `sizes` map built from doc.subject.placements
  setAssetSizes(sizes);
});
```

`materialsFor(doc)` (`AssetLoader.ts:126`) builds a map **keyed by that
document's own material ids** — it is the only place that knows both the
document's names and the library's `<source>/<slug>` names. `setAssets` stores it
on `this.materials`, and `setDocument` threads that same object into every later
`generateScene`. **Nothing ever rebuilds it.**

So the binding attaches to whichever document was open when the load resolved —
Greenhollow, the default — and every scene switched to afterwards is looked up
with Greenhollow's keys.

Greenhollow's textured ids: `plaster-lime`, `roof-clay-tile`, `slab-concrete`,
`concrete-wall`, `grass-lawn`, `gravel-alley`, `asphalt-road`.
Elmsgate's: `render-stucco`, `ground-urban`, `pavement-stone`, `paving-yard`,
`grass-yard`, `asphalt-road`. **Only `asphalt-road` matches.** Everything else
falls back to flat `baseColor` — and the path-traced render inherits it, so an
hour of GPU produces an untextured image.

Switching back to Greenhollow makes it correct again, which is what makes it hard
to notice: the scene you started from is the only right one, and the only user
remedy is a full page reload.

**`setAssetSizes` has the same shape and a worse consequence.** It is built once
from the first document's placements. `deriveColliders` skips any placement with
no known size — deliberately, so nothing rests on a guess. So in a switched-to
scene, placements whose assets the first scene did not use get **no collider at
all**: nothing in the overlay, and drop-to-rest falls through to the terrain.

## Files you OWN

- `apps/web/src/ui/Viewport.tsx`
- `apps/web/src/engine/SandboxEngine.ts` — `setAssets` / `setDocument`
- `apps/web/src/engine/AssetLoader.ts` — if the shape needs to change
- `apps/web/test/`

## Files you must NOT touch

- `packages/geometry`, `packages/physics` — both are correct; they are handed
  stale inputs.
- The asset **download** happening once. Re-fetching 135 MB per scene switch would
  be a worse bug. Only the *mapping* is per-document; the loaded resources are
  shared and must stay shared.

## What to do

1. **Separate the loaded library from the per-document view of it.** The library
   (geometries, atlases, texture maps keyed by `<source>/<slug>`) is loaded once
   and shared. The `MaterialSource` and the size map are **derived per document**
   and must be recomputed whenever the document changes — not when assets load.
2. **Recompute on document change, not on asset arrival**, so both orderings work:
   assets-then-switch and switch-then-assets.
3. **Note the interaction with brief 24.** That brief fixes the physics cache
   ignoring `sizes`; this one fixes `sizes` being wrong in the first place. Doing
   24 without 39 leaves the cache correctly keyed on a wrong table.
4. **Test the ordering both ways** headlessly: a document whose material ids
   differ from the first must resolve its own textures, and its placements must
   get colliders.

## Acceptance

- Switching scenes yields correct textures and correct placement colliders in
  every scene, in any order.
- Assets are still downloaded exactly once per session.
- `npm run check` exits 0.
