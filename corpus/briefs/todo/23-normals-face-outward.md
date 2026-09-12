# Task 23 — Roads render black, and nothing guards a surface's facing

## Context

From the 2026-09-12 audit. This is **the third instance of one bug class**, and
the brief is mostly about the class, not the instance.

`packages/geometry/src/context/masses.ts:91` — `buildRoad` winds both triangles
of every road quad backwards, so every road normal is `(0, −1, 0)`. Measured on
the shipped build:

```
road  triangles: 2 | normal Y per triangle: -1.000, -1.000
bend  triangles: 4 | normal Y: -1.000, -1.000, -1.000, -1.000
```

Confirmed in the viewport: **Greenhollow's road and alley render pure black**
against lit terrain. That blackness was visible in screenshots taken during
briefs 19 and 21 and was read as "asphalt is dark". It is not. Seven roads across
the three bundled scenes are affected.

The other two instances were found and fixed on 2026-09-11, both in the gable
builders — `subject/roofs.ts` and `context/masses.ts`. **All three were invisible
to a passing test suite for the same reason**: the tests assert bounding boxes,
and a bounding box is identical whether a surface faces the sky or the ground.

So fixing the road alone would leave the class intact. `mergeSimple`,
`buildImpostorGeometry`, the run builders and anything else assembling triangles
by hand have the same exposure and the same absence of a guard.

## Files you OWN

- `packages/geometry/src/context/masses.ts` — the `buildRoad` winding.
- `packages/geometry/test/geometry.test.ts` — the shared guard.
- Any other hand-wound builder the guard proves wrong.

## Files you must NOT touch

- The two gable builders' winding, fixed on 2026-09-11 and already covered by
  "gable slopes face the sky". Bring them **under the shared guard** rather than
  leaving a second bespoke test.
- `scenes/` — no document is wrong here. The generator is.

## What to do

1. **Fix `buildRoad`'s winding** so road normals point `+Y`. The current order is
   `a1, a2, b2` / `a1, b2, b1`; for a segment running `+X` with `n = (0, half)`
   the cross product comes out `(0, −2·half·len, 0)`.
2. **Write the guard once, in one place** — a test helper that takes a geometry
   and asserts every triangle whose normal is meaningfully non-vertical faces
   outward, and every ground-plane surface faces up. Reuse the slope/cap
   filtering already worked out for "gable slopes face the sky" rather than
   inventing a second version.
3. **Apply it to every hand-wound builder**, not only the one that is broken:
   roads, both gable paths, impostor quads, run posts/rails/canopy, proxy
   geometry, and anything that calls `setAttribute("position", …)` directly. An
   inventory pass is part of this brief — say in the outcome what you swept.
4. **Report what else it catches.** If the guard turns up a fourth instance, fix
   it here; that is the brief working, not scope creep.

## Acceptance

- Road normals point up; Greenhollow's road and alley render lit, not black.
- One shared assertion covers every hand-wound builder, and removing the fix in
  `buildRoad` fails a test.
- `npm run check` exits 0.
- The outcome note lists every builder swept, including the ones that were fine.
