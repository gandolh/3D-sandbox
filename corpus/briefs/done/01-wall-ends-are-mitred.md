# Brief 01 — Wall ends are mitred where walls meet

## Context

A wall's mesh is a box from `start` to `end`, `thickness` wide, with square
ends (`wallSolid` in `packages/geometry/src/subject/walls.ts`), and
`wallCorners` in `packages/drawing` draws the same rectangle on the sheet and
in the plan view. Two walls that share an end therefore overlap on the
inside of the corner and leave a square of nothing, half a thickness on each
side, at the outside. Every corner of every scene has it, builder-made or
drawn. Measured on 2026-10-27 with the 8 × 6 m box: W-05 spans x 0 to 8 and
z −0.12 to 0.12, W-08 spans x −0.12 to 0.12 and z −6 to 0, and the square
from (−0.12, 0) to (0, 0.12) is in neither.

Decided with the owner on 2026-11-03
([decisions-geometry.md](../../wiki/decisions-geometry.md), "Wall ends are
mitred where walls meet"): cut each wall's end along the bisector of the
corner, in the mesh, the collider and the plan drawing alike. Rejected:
extending each wall by half the other's thickness, which is right only at
90°, while the Wall tool snaps to 15° steps and allows free angles.
Promoted from the todo `walls-leave-a-notch-at-every-outside-corner`.

## Files you OWN

- `packages/geometry/src/subject/walls.ts` (`wallSolid`, and finding which
  walls share each end)
- `packages/geometry/src/cache.ts` (the key)
- the wall collider in `packages/physics/src/colliders.ts`
- `packages/drawing/src/geometry.ts` (`wallCorners`) and whatever in
  `plan.ts` / `linework.ts` reads it
- `packages/drawing/test/__snapshots__/` (regenerated once)
- the tests of those packages
- `corpus/wiki/drawing.md` and `corpus/wiki/status.md` (the "known issue"
  lines go)

## Files you must NOT touch

- The document schema: which walls meet is derived from shared end points,
  not stored.

## What to do

1. Find, for each end of a wall, the walls that share that end point (the
   same tolerance the Wall tool snaps to). One neighbour: mitre along the
   bisector of the two walls' directions. No neighbour: square end, as
   today. Three or more: pick the simplest rule that leaves no gap and no
   overshoot (for example a mitre with the nearest-angle neighbour), and
   say which in the outcome.
2. Build the mitred end in the mesh, cut the collider the same way, and
   make `wallCorners` return the same outline, so mesh, collider and plan
   agree to the millimetre.
3. Include the neighbours in the per-wall cache key (the decision says why
   the key stays a whole value): moving one wall must invalidate the walls
   it meets.
4. Openings near a mitred end still cut the right wall.
5. Regenerate the plan snapshots once and look at them: corners closed,
   nothing else moved.

## Acceptance

- The 8 × 6 m box's four corners have no gap: a test checks that the
  corner square from the measurement above is inside the meshes.
- A test at 45° and one at a 15°-step angle: two walls meeting there leave
  no gap and no overshoot outside the corner.
- Moving one wall rebuilds its neighbours (a cache test).
- The collider and `wallCorners` give the same outline as the mesh.
- The regenerated plan snapshots show closed corners; one look at
  Greenhollow in the browser shows them closed too. No render series or
  timing runs.
- Typecheck, lint and the tests of the packages changed pass.
