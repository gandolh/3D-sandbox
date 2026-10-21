# Task 78 — Doors, windows, rooms and floors

## Context

Second half of the drawing tools the owner chose on 2026-10-21 (brief 74,
[decisions.md](../../wiki/decisions.md#the-browser-draws-building-parts-never-free-geometry)). It
builds on the Wall tool (77) and copies its habits: a tool bar entry, an options bar, snapping with
a visible reason, typed numbers with a comma or a dot, one `editDocument` call per placed part with
a label for undo (76).

What the document already says, so nothing new is invented:

- An `Opening` is `kind` (`door` or `window`), `offset` (from the host wall's `start` to the
  opening's near edge), `width`, `height` and `sill` (0 for doors). It lives in its wall's
  `openings`. The linter checks it with `opening-fits-wall`, `opening-fits-height` and
  `openings-do-not-overlap`.
- A door swings to the left of its wall, walking from `start` to `end` (the comment on `rect` in
  `packages/schema/src/builder/index.ts`). There is no swing field.
- A `Room` is `name`, `use` (an enum) and `polygon`, the **clear internal outline** to the faces of
  the walls, not the centrelines. Its area is derived, never stored. `rooms-are-habitable` checks it.
- A `Slab` is a `polygon`, `thickness` (0.25 m default) and `material`.

**Roofs are not in this brief.** A roof carries a footprint, an eave height, a pitch, an overhang and
a ridge bearing, and `roof-covers-walls` judges it against a structure. That is a tool of its own and
gets a later brief.

## What to do

1. **Door and Window tools.** Hovering a wall shows the opening as a ghost on it, at the pointer.
   - The offset snaps to the wall's centre, and to 0.05 m steps. Typing a number sets the distance
     from the nearer wall end.
   - Sizes come from the options bar: a door 0.9 × 2.1 m with sill 0, a window 1.2 × 1.2 m with sill
     0.9 m. All are editable.
   - A ghost that would break `opening-fits-wall`, `opening-fits-height` or
     `openings-do-not-overlap` turns red, and a click on it places nothing. Check with the linter's
     own rule functions, not a copy of their logic.
   - Ids follow the scenes' own pattern, `d-<n>` for doors and `w-<n>` for windows, unique across
     the document. The builders name them by position (`w-f1`, `d-front`), so a drawn opening only
     needs a free number.
   - Swing side: the door swings to the wall's left. Flipping it would mean reversing the wall, which
     changes every other opening's `offset` on it. Leave flipping out, and say so in the options bar
     tooltip.
2. **Room tool.** Clicking inside an area closed by walls on the current level makes a room.
   - Find the closed face around the click from the walls' centrelines (a planar graph of the
     level's walls, split where they meet), then inset each edge by its wall's half thickness to get
     the clear internal outline.
   - A small popover asks for the name and the `use`. The plan labels the room with its name and
     derived area, as the sheet does.
   - A click that is not inside a closed face places nothing and says "Not inside a closed set of
     walls".
3. **Floor tool.** Clicking inside a structure makes a `Slab` under its outer outline, with the
   options bar's thickness and material.
4. **Editing.** Select an opening in the plan and drag it along its wall, or type its offset in the
   Inspector. Delete removes the selected opening, room or slab.

## Files you OWN

- `apps/web/src/ui/plan/` (the three tools and their options)
- The pure drawing module from 77 (`apps/web/src/lib/drawing/` or wherever 77 put it): opening
  placement, the face finder, the inset
- Tests beside them

## Files you must NOT touch

- `packages/schema`. No swing field, no new entity.
- The lint rules themselves. Call them; don't change them.
- `packages/geometry`.

## Acceptance

- On the box drawn in 77's acceptance, place a door and two windows by typing distances. The 3D view
  cuts them, the plan draws them, and the Inspector shows no error.
- A window ghost over an existing door turns red and placing it does nothing.
- A click inside the box makes a room whose polygon is the inner faces (for 0.24 m walls, 0.12 m in
  from each centreline), with the right area on the plan label. A click outside makes nothing.
- The Floor tool makes a slab under the box's outer outline.
- Each placed part is one Ctrl+Z step.
- Unit tests for the face finder on a rectangle, an L shape and a room split by a partition.
- `npm run check` passes.
