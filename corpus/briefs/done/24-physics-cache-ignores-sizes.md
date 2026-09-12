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

---

## Outcome — 2026-09-12

**1 — The cache is keyed on everything it derives from, and generically.**
`physicsFor` now takes one `PhysicsInputs` object and compares the cached
inputs to the new ones **field by field, over the object's own keys**:

```ts
const keys = Object.keys(a) as (keyof PhysicsInputs)[];
return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
```

Written that way rather than as `a.doc === b.doc && a.revision === b.revision
&& a.sizes === b.sizes` deliberately: the brief asks that the invalidation be
impossible to get wrong by adding a third input later, and a hand-written
conjunction is precisely what goes stale. **Adding a fourth field to
`PhysicsInputs` now participates in invalidation without anyone remembering
to.**

**The signature had to change for this to work.** The old call passed
`sizesFromMap(getState().assetSizes)`, and `sizesFromMap` returns a fresh
adapter object every call — comparing that by identity would make every lookup
a cache *miss*, the opposite failure and just as wrong. `PhysicsInputs` takes
the store's raw map and adapts it inside.

**Identity and not a deep compare**, because the store replaces the map when
sizes change and hands back the same reference otherwise. A test pins that
choice: an equal-but-distinct map must not rebuild, so nobody swaps in a deep
comparison that walks every asset on every drop.

**2 — The doc comment no longer claims a guarantee the code does not provide.**
It said keying on the revision "makes both impossible". That sentence is how
this survived: it is the kind of claim a reader checks against their memory of
the design rather than against the code. It now states the actual invariant,
and names the reason `setAssetSizes` must *not* bump the revision — the
revision means "the document changed", and conflating asset loading with that
would regenerate the whole scene when models arrive.

**3 — The overlay's deps were already fixed**, during brief 41's work on the
same file, with the reason written beside them. Verified present, not redone.

**4 — Tested, and the tests were checked against the old behaviour.** Six
tests: reuse, rebuild on revision, **rebuild on sizes at the same revision**,
no rebuild for an equal-but-distinct map, and disposal of the world being
replaced. Reverting the key to `cached.inputs.revision === inputs.revision`
turns **two** of them red, including the one that names the bug.

`PhysicsWorld.create` is stubbed rather than run: what is under test is *which
inputs cause a rebuild*, and standing up Rapier's WASM heap to count calls
would make the test slower without making it say more.

The overlay half is covered at the level it can be — `collidersFor` with an
empty map yields no placement colliders and with a populated one yields them,
which is the behaviour the effect depends on. That the dependency array lists
`assetSizes` is verified by reading; there is no React renderer in this
project's test setup and adding one for a four-element array would be a large
dependency for a small assertion.

`npm run check` clean, **361 tests** (was 355).
