# Task 66 — A rotated placement drops on the wrong footprint

## Context

From the 2026-09-20 audit. Drop-to-rest reports success and writes a wrong
number into the document.

`deriveColliders` correctly gives every placement collider a rotation
(`packages/physics/src/world.ts:65`):

```ts
.setRotation(quaternionFromY(collider.rotationY)),
```

But the dynamic body `dropToRest` creates never gets one
(`packages/physics/src/world.ts:106`):

```ts
RAPIER.RigidBodyDesc.dynamic()
  .setTranslation(...)
  .lockRotations(),
```

and `surfaceBelow` probes the four corners of that same unrotated box. So the
drop tests a footprint the object does not have.

**Verified by execution during the audit.** A 3.0 × 0.4 m bench at x = 1.2 with
`rotationY: 90` really occupies x ∈ [1.0, 1.4] and cannot reach a 1 × 1 m table
at the origin. `Inspector.drop()` passes `half = [1.5, 0.2, 0.2]` — the
*unrotated* AABB — and Rapier drops a box spanning x ∈ [−0.3, 2.7], which lands
on the table. Result: `settled: true, restingOn: "table"`, and **y = 1.000
written into the document** — the bench is persisted hovering a metre above the
floor while the status line reports that it settled on the table.

The same defect in reverse makes a rotated chair miss the table it genuinely is
standing on, and fall through to the floor.

Note the irony worth carrying into the fix: `surfaceBelow`'s own comment reasons
carefully about "a 0.78 × 0.83 armchair turned 152°" having a 1.08 m footprint —
and then computes its ray origins from the unrotated half-extents. This is the
fifth instance in this repo of a confident comment describing something the code
beneath it does not do.

## Files you OWN

- `packages/physics/src/world.ts` — `dropToRest` and `surfaceBelow`
- `packages/physics/test/world.test.ts`

## Files you must NOT touch

- `deriveColliders` in `packages/physics/src/colliders.ts` — it already rotates
  correctly, and `apps/web/test/shared-primitives.test.ts` asserts that against
  `wallAngle`. The bug is that the *dropped* body does not match the *derived*
  collider.
- The degrees-on-disk / radians-internally boundary.
- `Inspector.drop()`'s centre-vs-base conversion (`position[1] - half[1]`) — the
  audit traced it against the collider comment and confirmed it is correct.

## What to do

1. Give the dropped body the placement's `rotationY`, so the shape that falls is
   the shape that exists. Keep `lockRotations()` — the object should not tumble;
   it should fall in the orientation it was authored with.
2. Make `surfaceBelow` probe the **rotated** footprint. Its own comment already
   describes the right behaviour; make the code do what it says, and fix the
   comment if the approach differs.
3. **Test with a rotated object where rotation changes the answer** — that is the
   whole point. The bench-and-table case above is a ready-made fixture: at
   `rotationY: 0` it lands on the table, at `rotationY: 90` it must land on the
   floor. A test that only checks an axis-aligned box cannot fail on this bug,
   which is why none did.
4. Add the mirror case: an object that *should* land on a surface and only does
   once rotation is accounted for.

## Acceptance

- A 3.0 × 0.4 m bench at x = 1.2 with `rotationY: 90` settles on the **floor**,
  not the table, and the document records the floor's height.
- An object whose rotated footprint does overlap a surface still settles on it.
- Both tests fail if the rotation is removed from the dropped body — verify by
  mutation.
- `npm run check` exits 0.
