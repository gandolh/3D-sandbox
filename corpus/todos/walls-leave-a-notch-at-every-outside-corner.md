---
title: Walls leave a notch at every outside corner
created: 2026-10-27
status: open
tags: [geometry, drawing, walls]
---

# Walls leave a notch at every outside corner

A wall's mesh is a box from `start` to `end`, `thickness` wide, with square
ends (`wallSolid` in `packages/geometry/src/subject/walls.ts`), and
`wallCorners` in `packages/drawing` draws the same rectangle on the sheet and
in the plan view. Two walls that share an end therefore overlap on the inside
of the corner and leave a square of nothing, half a thickness on each side, at
the outside.

## How it surfaced

Brief 77's note on corners predicted it, and both briefs built on 2026-10-27
saw it: brief 75's plan view shows the notch on Elmsgate's first floor, and
brief 77 measured it. Drawing the 8 × 6 m box from
77's acceptance, the four wall meshes span x 0 to 8 and z −0.12 to 0.12 for
W-05, and x −0.12 to 0.12 and z −6 to 0 for W-08: the square from (−0.12, 0)
to (0, 0.12) is in neither. Every corner of every scene has it, builder-made
or drawn: a square half the wall's thickness on a side.

## Shape of a fix

Not decided, and not 77's to decide (it must not touch `packages/geometry`).
Two directions:

- Extend each wall's box by half the thickness of the wall it meets at each
  shared end, so the two overlap on the outside as well as the inside. Cheap,
  and it changes the mesh, the collider (`packages/physics` rotates the same
  box) and `wallCorners` together, which they must.
- Mitre the ends: cut each wall's end along the bisector of the corner. Right
  for walls meeting at any angle, and it needs the structure (which walls share
  the end) at build time, which `wallSolid` does not have today.

Either one changes every scene's geometry, so the plan fixtures from brief 75
(`packages/drawing/test/__snapshots__/`) would change too, and the renders.
