# Task 24 — The physics world caches away the colliders it just gained

## Context

From the 2026-09-12 audit.

`apps/web/src/lib/physics.ts:23` caches one physics world per document revision:

```ts
if (cached !== null && cached.revision === revision) return cached.world;
```

`sizes` is a second input and it changes **independently of `revision`**.
`setAssetSizes` (`apps/web/src/state/store.ts:138`) does not bump the revision,
and neither does `engine.setAssets`. Asset sizes arrive asynchronously, long
after the first world is built.

And placement colliders exist only when sizes do — `packages/physics/src/colliders.ts:55`
skips any placement whose asset has no size, deliberately, because "a collider
built from a guess is worse than none".

So: open Greenhollow, and before the models finish loading use **drop to floor**
on anything. A world is cached at revision 1 with an empty size map and therefore
**no placement colliders at all**. The models then load. `revision` is still 1.
Every later drop reuses that world, so `bench-vine` dropped over `table-garden`
falls straight through the table and the status line reports it settled on
terrain.

The function's own doc comment claims the opposite: keying on the revision
"makes both impossible".

The same root cause has a second symptom, and this brief owns both:
`apps/web/src/ui/Viewport.tsx:275` builds the collider overlay from
`sizesFromMap(assetSizes)` but lists deps `[doc, revision, showColliders]`. Turn
colliders on before the models land and the overlay never shows a placement box —
indefinitely. The overlay exists (`SandboxEngine.ts:219`) to make collider/mesh
divergence visible, so it under-reports exactly the colliders that are newest.

## Files you OWN

- `apps/web/src/lib/physics.ts`
- `apps/web/src/ui/Viewport.tsx` — the collider-overlay effect only.
- `apps/web/test/` — new coverage.

## Files you must NOT touch

- `packages/physics/src/colliders.ts` — skipping unsized placements is correct
  and deliberate.
- `apps/web/src/state/store.ts` — do **not** make `setAssetSizes` bump `revision`
  to paper over this. Revision means "the document changed", and asset loading is
  not a document change; conflating them would regenerate the whole scene when
  models arrive.

## What to do

1. **Key the cache on what it actually depends on** — the revision *and* the size
   map's identity or generation. Whatever you pick, the invalidation must be
   impossible to get wrong by adding a third input later.
2. **Correct the doc comment.** It currently states a guarantee the code does not
   provide, which is how this survived.
3. **Add `assetSizes` to the overlay effect's dependencies.**
4. **Test both**: a world built with no sizes must not be handed back once sizes
   exist, and the overlay must gain placement boxes when sizes arrive.

## Acceptance

- Dropping a placement onto another placement works regardless of whether the
  drop happened before or after models loaded.
- The collider overlay gains placement boxes when asset sizes arrive.
- `npm run check` exits 0.
