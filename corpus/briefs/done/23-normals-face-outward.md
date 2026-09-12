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

---

## Outcome — 2026-09-12

Road fixed, the guard written once, every hand-wound builder swept — and the
brief's fourth instance turned up, by a mechanism nobody was looking for.

**The road.** `a1, a2, b2` / `a1, b2, b1` became `a1, b2, a2` / `a1, b1, b2`.
`n` is the left perpendicular of the travel direction, which fixes the
handedness, so the same winding crosses to +Y whichever way the centreline
runs — tested straight, round a bend, reversed and diagonal. Confirmed in the
viewport at 13:00: Greenhollow's road reads as lit grey asphalt where it was
black. Reverting the winding fails the test.

**The guard**, in `packages/geometry/test/normals.ts`. It reads **positions, not
the normal attribute** — winding is the thing that was wrong, and a normal
attribute is downstream of it:

- `downwardFaces` — an open horizontal surface (a road) with any triangle
  facing the ground.
- `inwardFaces` — a closed convex solid with any triangle facing its own
  bounding-box centre. Per triangle, never summed: a signed volume or a mean
  normal lets one inverted face hide behind fifty correct ones, which is how the
  gable bug survived.
- `normalsAgainstWinding` — for geometry that authors its own normals.
- `slopes` — moved here verbatim from `geometry.test.ts`, so the gable tests and
  the new ones share one definition rather than two.

**Swept, with what each turned out to be:**

| Builder | Result |
|---|---|
| `buildRoad` | **broken** — every triangle −Y. Fixed. |
| `buildMass`, gable and flat | clean (fixed 2026-09-11, now under the shared guard) |
| `buildRoof` | clean (same) |
| `extrudePolygon` | clean |
| `wallSolid` | clean |
| `buildRun` — fence, pergola, hedge structure | clean, all parts |
| `mergeSimple` | clean, and now pinned: it preserves winding by construction, which is the kind of claim that stops being true silently |
| `prepareAsset` | same copy-in-order merge; covered by the `mergeSimple` pin |
| `buildImpostorGeometry` | authored normals **agree** with the winding — checked by hand: the quad crosses to `(sin θ, 0, cos θ)`, which is exactly what it declares |
| `proxyTreeGeometry` | three's own cylinder and cone; the six triangles `inwardFaces` flags are the cylinder's top cap, an interior face of a non-convex merge. A limit of the heuristic, not a bug — so the guard is applied to convex solids only, and says so. |
| pergola climber leaves | **broken, differently** — see below |

**The fourth instance: a facing bug with no inverted triangle in it.** The
climber is crossed `PlaneGeometry` quads, deliberately, so foliage reads from
any direction. Nothing is wound backwards. But every material this package
builds is three's default `FrontSide`, and a plane's back is culled — so half of
every cluster was invisible, and from underneath the canopy the approach shot
showed **sky straight through the pergola**. Screenshotted before and after:
scattered white holes, then a continuous canopy.

Fixed by cloning the material two-sided for that one mesh — `attach` gained a
`twoSided` option — rather than setting `side` on the shared material, which
every other surface naming the same id would have inherited. The test asserts
the climber is `DoubleSide` *and* that nothing else became so: a solid rendered
from both sides costs fill rate and hides inversions from the eye.

`npm run check` clean, 263 tests.
