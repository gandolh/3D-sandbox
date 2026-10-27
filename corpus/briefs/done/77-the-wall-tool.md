# Task 77 — The Wall tool

## Context

The owner settled brief 74 on 2026-10-21: drawing in Solstice feels like Revit or ArchiCAD. You
pick a tool, click points in the plan view, and type a length or an angle while drawing. The browser
draws building parts, never free geometry. See
[decisions.md](../../wiki/decisions.md#the-browser-draws-building-parts-never-free-geometry).

This brief is the first tool, and the one the others copy. It needs the plan view (75) and undo (76).

What a drawn wall has to be, from the code:

- A `Wall` (`packages/schema/src/document.ts`) is `id`, `start`, `end`, `thickness` (default
  0.24 m), an optional `height` (the level's height when absent), a required `material`, and
  `openings`.
- Walls that share an endpoint exactly form a **structure** ([glossary](../../wiki/glossary.md)),
  and `roof-covers-walls` judges a roof against the structure under it. So a corner is two walls
  whose ends are the same point, not two points that look close.
- Ids are readable (`W-03`) and must be unique across the document (`unique-ids`).
- `wall-not-degenerate` rejects a zero-length wall.

CADCraft's `docs/ui-parity.md` and its object-snap and polar-tracking commands are a fair reference
for how snapping should behave. Read them for behaviour only. Copy no code.

## What to do

1. **A tool bar in the plan view** with Select and Wall. Esc returns to Select. The chosen tool
   lives in the store.
2. **Drawing a chain.** With Wall chosen, each click places a point, and each pair of points becomes
   a wall. The next wall starts where the last one ended, at exactly the same coordinates.
   - Enter, a double-click or a right-click ends the chain. Esc cancels the wall in progress and
     writes nothing for it.
   - Clicking the chain's first point closes the loop and ends the chain.
   - A click on the same point twice is ignored, so no zero-length wall is written.
3. **Snapping**, shown with a marker and a word by the cursor ("End", "Middle", "On wall", "Grid").
   Tolerance is in screen pixels, about 10, so it behaves the same at every zoom. Priority, highest
   first: a wall end, a wall's midpoint, the nearest point on a wall's centreline, a grid
   intersection.
   - Angles snap to multiples of 15° near them. Holding Shift locks the wall to horizontal or
     vertical, as ortho does in CAD programs.
   - Write the snapping as a pure function from (pointer, walls, zoom, modifiers) to a point and a
     reason, with unit tests for the priority order.
4. **Typed input.** While a wall is in progress, typing a number opens a small field by the cursor
   for the length in metres. Tab moves to an angle field. Enter places the point at that length
   along the current direction, or at that angle.
   - Accept a comma or a dot as the decimal mark: "4,2" and "4.2" are both 4.2 m.
   - The wall in progress shows as a ghost with its live length, like a dimension line.
5. **What gets written.** Each placed wall is one `editDocument` call with the label "Add wall
   W-07", so one Ctrl+Z removes one wall and the 3D view updates as you draw.
   - New walls take the tool's options, shown in a small options bar: thickness (0.24 m), height
     (empty means the level's), and material, defaulting to the material most used by the level's
     walls, or the first in `doc.materials` on an empty level. With no materials at all, the tool is
     disabled and says why.
   - Ids continue the document's highest `W-NN`.
6. **Editing what exists.** With Select chosen, a selected wall shows grips at its ends. Dragging an
   end grip moves that end and every other wall end at the same point, so corners stay joined, with
   the same snapping. Delete removes the selected wall and its openings.

## Files you OWN

- `apps/web/src/ui/plan/` (tool bar, options bar, tool handlers)
- A pure module for snapping, typed-input parsing and id allocation, e.g.
  `apps/web/src/lib/drawing/`
- `apps/web/src/state/store.ts`, only for tool state
- Tests beside them

## Files you must NOT touch

- `packages/schema`: no new entity and no new field. The document already describes a wall.
- `packages/geometry`. How a wall's mesh is built is not this brief (see the note below).
- The linter. Its findings already show in the Inspector after every edit, and that is the feedback
  a drawn wall gets.

## Note on corners

The wall mesh is a box from `start` to `end`, `thickness` wide (`packages/geometry/src/subject/walls.ts`),
and `wallCorners` in `packages/drawing` draws the same rectangle. So two walls meeting at a shared end
probably leave a small notch at the outside corner, in today's scenes as well as in drawn ones. Check
it while building, and if it is real, file a todo for the geometry rather than fixing it here.

## Acceptance

- On an empty level, choose Wall, click a start point, type `8` Enter, `6` Enter, `8` Enter, and
  click the first point. The level now has four walls whose shared corners are exactly equal
  coordinates, the 3D view shows a closed box, and the Inspector shows no error.
- Each snap kind shows its marker and lands exactly on its target (unit tests, plus a browser check
  on Greenhollow).
- Shift draws only horizontal or vertical walls. "4,2" and "4.2" both give a 4.2 m wall.
- Esc mid-wall writes nothing. Four Ctrl+Z presses remove the four walls one by one.
- Dragging a shared corner grip moves both walls' ends together.
- Save, reload the scene, and the walls are identical.
- `npm run check` passes.

## Outcome (2026-10-27)

Built as filed. The pure half is `apps/web/src/lib/drawing/`: `snap.ts` (`snapPoint`, `directionOf`) and
`walls.ts` (the chain, `placePoint`, `nextWallId`, `defaultWallMaterial`, `parseDecimal`, `moveCorner`).
The UI is in `apps/web/src/ui/plan/`: `ToolBar.tsx` (the tool bar and the Wall options bar),
`useWallTool.tsx`, `useSelectTool.tsx` (click to select, grips, Delete), `SnapMarker.tsx`, and `tool.ts`,
the interface `PlanSurface` now hands every gesture but pan and zoom to. The store gained `planTool` and
`wallOptions`. `packages/schema`, `packages/geometry` and the linter are untouched; `PlanView.tsx` (75's)
mounts the two bars.

**Exact corners, by construction.** A new wall's `start` is the chain's last point copied verbatim; an end
snap returns the stored coordinates, never recomputed; a click on the chain's first point ends the loop on
that point's own numbers. Typed lengths go along `directionOf(bearing)`, which is exact at the four compass
points (`Math.cos(π/2)` is 6e-17, so a wall typed "6" north would otherwise end at 8.000000000000000367),
and the sum is cleaned of float noise. A test asserts the 8, 6, 8 box with `toEqual`; nudging the end snap
by 1e-12 fails three tests.

**Decisions made here.**

- The typed angle is a **bearing**, clockwise from north, the convention of the Inspector's Bearing field
  and the document, not CAD's counter-clockwise from east. A wall typed at 90 reads 90 when selected.
- Snap order is end, middle, on wall, grid, then **angle**: a direction within 3° of a multiple of 15°. A
  pixel tolerance made the 15° rays catch almost everywhere far from the start, and hid the grid.
- A free point (nothing snapped) is rounded to the centimetre, as the readout shows it.
- Esc with a wall in progress drops it and ends the chain, keeping the walls already written; Esc with
  nothing in progress returns to Select. Esc in the typed field only closes the field.
- A click back on the start after one wall is ignored: it would lay a second wall on the first.
- Grips move every wall end within 1e-6 m of the corner, the tolerance the sheet groups a structure by.
  Moving a `start` slides that wall's openings, since offsets run from `start`; the linter reports any
  that stop fitting.

**Checked in Chromium** (Playwright, dev server on :5181, `apps/api` on :5174 against a copy of `scenes/`
in a temp directory, so no committed scene was written). An empty level was added through the store,
since nothing in the UI adds a level until 79.

- The acceptance box: start, `8` Enter, `6` Enter, `8` Enter, click the first point. Four walls W-05 to
  W-08, (0, 0) → (8, 0) → (8, −6) → (0, −6) → (0, 0), every shared corner the same numbers; no findings
  on them; 0.24 m, no `height` key, Lime Plaster 04. The engine's four meshes close the rectangle.
- Save wrote 13,605 bytes; `GET /api/scenes/villa-carpathia`, parsed and loaded, gave walls identical to
  the ones drawn. Reopening from the picker waits for 79, which teaches the picker to read the API.
- Four Ctrl+Z: 4 → 3 → 2 → 1 → 0 walls. Esc mid-wall wrote nothing; a second Esc chose Select.
- "4,2" and "4.2" both gave 4.2 m; Shift drew (4.2, −4.2) → (1.3, −4.2).
- On Greenhollow, hovering by W-02 showed End, Middle, On wall and Grid with their markers, and a wall
  started on W-02's end began at exactly (5.5, −20).
- Dragging the W-01/W-02 corner grip moved both ends to (6, −19.5), as one undo step.

**The corner notch is real** and filed as
[a todo](../../todos/walls-leave-a-notch-at-every-outside-corner.md): the box's W-05 mesh spans z −0.12 to
0.12 from x 0, W-08's x −0.12 to 0.12 up to z 0, and the square between is in neither.

**603 → 642 tests** (25 pure, 14 through the component). `npm run check` passes.
