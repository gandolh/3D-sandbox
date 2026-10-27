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

## Outcome (2026-10-27)

Built as filed. The pure half joined 77's in `apps/web/src/lib/drawing/`: `openings.ts` (the wall under the
pointer, the offset snap, typed distances, `openingProblems`) and `faces.ts` (`planarFaces`, `roomOutline`,
`floorOutline`). The tools are `useOpeningTool.tsx` (Door and Window) and `useAreaTools.tsx` (Room and
Floor) in `apps/web/src/ui/plan/`, with their options bars in `ToolBar.tsx`. `packages/schema`, the lint
rules and `packages/geometry` are untouched.

**The red ghost asks the linter.** `openingProblems` runs the three rules from `RULES` on the document with
the candidate appended last to its wall, which is where `openings-do-not-overlap` reports a pair, and keeps
the errors whose path resolves to the candidate. Nothing re-implements their arithmetic.

**Faces.** Every wall is split wherever another meets or crosses it, so a partition ending mid-length on an
external wall (a T, which shares no end) still closes its rooms. Faces are walked with the inside on the
left; bounded faces come out positive, each group's outside negative. A room is the smallest bounded face
round the click with each edge moved in by its own wall's half thickness, a floor the group's outside moved
out; walls with a free end are dropped from the outline. Tested on a rectangle, an L, a box split by a
120 mm partition meeting both walls mid-length, and a stub wall inside a room.

**Two files outside the brief's list.** "Type its offset in the Inspector" needs the Inspector to find a
selected opening, and `findEntity` did not resolve openings or rooms (brief 75 noted the gap). It now does,
and `Inspector.tsx` shows an opening's own four fields and a room's name, use and area. Opening ids number
from the document's highest `d-N` and `w-N` with no padding (Villa's `d-01` gives `d-2`). Rooms are `r-<n>`,
slabs `slab-<n>`. A new floor takes the level's most used slab material, then the document's, before the
walls'. The plan view now draws slabs, faintly, so a floor can be seen, selected and deleted.

**Checked in Chromium** (Playwright, :5181) on 77's box, drawn with the Wall tool on an empty level of Villa:

- Typed distances cut `d-2` at 1 m and `w-23` at 1.5 m from W-05's far end (offset 5.3), and `w-24` at 2 m
  on W-06. The document has no errors; the plan draws all three; W-05's mesh went from 12 to 110
  triangles and W-06's from 12 to 66, so the 3D view cuts them.
- A window at 1.45 m on W-05 showed a red ghost ("Does not fit"); the click placed nothing and the footer
  said `Not placed: opening "w-25" overlaps "d-2" on wall "W-05"`.
- A click outside the box made nothing and said "Not inside a closed set of walls". Inside, the popover
  made Living, polygon (0.12, −0.12) to (7.88, −5.88), labelled 44.7 m² on the plan.
- The Floor tool laid `slab-1` from (−0.12, 0.12) to (8.12, −6.12).
- Five Ctrl+Z took back the slab, the room and the three openings one at a time; five Ctrl+Shift+Z put
  them back.

In happy-dom too: dragging `d-2` along W-05, a drag onto `w-23` put back, the Inspector's Offset field
taking 4.8, and Delete on an opening, a room and a slab. **642 → 665 tests.** `npm run check` passes.
