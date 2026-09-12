# Task 22 — Placement colliders are rotated in degrees, read as radians

## Context

From the 2026-09-12 audit. **The most severe finding, and it silently corrupts
the one feature that exists to be trusted.**

`packages/physics/src/colliders.ts:70` copies `placement.rotationY` straight into
`CuboidCollider.rotationY`:

```ts
rotationY: placement.rotationY,
```

`Placement.rotationY` is `Degrees` (`packages/schema/src/document.ts:111`). But
the same field is filled from radians for walls — `colliders.ts:128` does
`Math.atan2(-(z2 - z1), x2 - x1)` — and **both consumers read it as radians**:

- `packages/physics/src/world.ts:59` — `quaternionFromY(collider.rotationY)`
- `apps/web/src/engine/SandboxEngine.ts:252` — `lines.rotation.y = collider.rotationY`

Meanwhile the mesh path gets it right: `packages/geometry/src/index.ts:191` does
`THREE.MathUtils.degToRad(placement.rotationY)`.

So a placement's collider and its mesh are in different orientations. Elmsgate's
`bench-yard` declares `rotationY: 180`; its mesh sits at 180°, its collider at
180 **radians** ≡ 233.2°. Villa's `chair-01` at 24 becomes 295°.

The smoking gun: `degToRad` is imported on `colliders.ts:1` and re-exported on
line 187, and **never called**.

Consequences: "drop to floor" settles onto surfaces that are not where the
collider says, `overlaps()` reports collisions that are not there, and the
collider overlay draws every placement box at a yaw its own mesh contradicts.

The test suite **locks the inconsistency in**: `colliders.test.ts:166` asserts
`rotationY === 30` for a placement while `:99` asserts `-Math.PI / 4` for a wall.

## Files you OWN

- `packages/physics/src/colliders.ts`
- `packages/physics/test/colliders.test.ts`

## Files you must NOT touch

- `packages/schema/src/document.ts` — the document is right. Degrees on disk is a
  locked decision; the bug is the boundary not converting.
- `packages/geometry/` — the mesh path already converts correctly.
- `apps/web/src/engine/SandboxEngine.ts` and `packages/physics/src/world.ts` —
  both consumers are right to expect radians. Do not "fix" them to expect degrees;
  that would break wall colliders, which are already radians.

## What to do

1. **Convert at the boundary**: `rotationY: degToRad(placement.rotationY)`. The
   import is already there.
2. **Say the unit in the type.** Rename the field or document it explicitly on
   `CuboidCollider` — `/** Yaw in radians. */` — so the next person filling it
   from a degrees source has to notice. A field that silently accepted two units
   is what made this possible.
3. **Fix the test that pinned the bug.** `colliders.test.ts:166` asserts the
   wrong value; it should assert `degToRad(30)`.
4. **Add a test that would have caught it**: a placement at `rotationY: 90` whose
   collider yaw equals the yaw the geometry generator applies for the same
   placement. Assert against `degToRad(90)`, not against a literal.

## Acceptance

- `npm run check` exits 0.
- A test asserts the collider's yaw agrees with the mesh's yaw for the same
  placement, and fails if the conversion is removed.
- No remaining raw use of a `Degrees` document field as radians in `packages/physics`.

---

## Outcome — 2026-09-12

Done as specified. `colliders.ts:70` now reads
`rotationY: degToRad(placement.rotationY)`, and `CuboidCollider.rotationY`
carries a doc comment saying the unit out loud and why it is stated — the field
silently accepted two units, which is the whole mechanism.

The test that pinned the bug asserted a bare `30`. Replacing it with
`degToRad(30)` would have been a tautology: the test would only prove the
implementation calls the function the test calls. So the new test turns the yaw
back into a **direction**, using the same rotation three applies to the geometry
for the same placement — `(x, z) → (x·cos + z·sin, −x·sin + z·cos)`. A placement
at `rotationY: 90` must send the box's local +X axis to −Z. Passing the degrees
through sends it to roughly `(−0.45, 0, −0.89)`, which is what shipped.

Verified by removing the conversion again: two tests fail, including the new
one. Restored, 17 pass.
