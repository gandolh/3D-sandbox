# Task 75 — A plan view to draw in

## Context

On 2026-10-21 the owner settled brief 74: the house is drawn in Solstice itself, the way Revit and
ArchiCAD draw, by picking a tool and clicking points in a plan view. See
[decisions.md](../../wiki/decisions.md#the-browser-draws-building-parts-never-free-geometry). This
brief builds the surface every drawing tool works on. It draws nothing new into the document.

The existing Plan toggle cannot be that surface. `PlanView.tsx` shows `planSvg(doc)` as a string
through `dangerouslySetInnerHTML`, and `planSvg` (`packages/drawing/src/plan.ts`):

- fits the sheet to the extent of the level's walls on every call, so the frame moves each time a
  wall is added;
- throws `"planSvg: the level has no walls"`, so an empty level cannot be shown at all;
- draws the first level unless told otherwise, and the app never tells it, so Elmsgate's upper floor
  is unreachable;
- has no pan or zoom. It is a 1:100 sheet, which is the right thing to read and the wrong thing to
  draw on.

**Decided here: the plan view is a 2D SVG surface in world metres, not the 3D viewport with a
top-down camera.** `plan.ts` already gives the reason: a camera pointing down sees a roof, and a plan
is a section cut at 1.2 m. An SVG in metres also maps a pointer to world coordinates exactly
(`getScreenCTM`), and the drawing logic stays testable without a GPU, the same argument that made
`planSvg` headless. The 3D viewport stays mounted under it, as today, for looking at the result.

Build order for the drawing work: 75, then 76 (undo), 77 (walls), 78 (openings, rooms, floors),
79 (a new house). This one has no dependencies.

## What to do

1. **The view transform**, as a pure module with unit tests: world metres to screen pixels and back,
   zoom about a point, pan, and fit-to-extent. World axes follow the compass decision
   ([decisions.md](../../wiki/decisions.md#the-compass-x-east-z-north)): +X east to the right, −Z
   north up the screen.
2. **The surface.** `PlanView` becomes the editable view: an SVG whose coordinates are metres, on a
   white ground (the plan stays a black-on-white drawing, as the component comment explains).
   - A grid: 1 m minor and 5 m major lines, thinning out as you zoom away so it never turns grey.
   - Wheel zooms about the pointer. Middle-button drag pans, and so does Space plus drag, for a
     trackpad. A Fit button zooms to the level's walls, or to a 20 × 20 m square around the origin
     on an empty level.
   - The pointer's position in metres, to the centimetre, shows in the footer while over the plan.
   - A level picker when the scene has more than one level. The chosen level lives in the store.
3. **What it shows.** The chosen level cut at 1.2 m, drawn with `@solstice/drawing`'s own pieces
   (`wallCorners`, `openingPlan`, `cutsThrough`, `INK`, `WEIGHT`), so it reads like the sheet. If the
   plan view needs the same linework `planSvg` draws, extract it into one function both call, and
   prove `planSvg`'s output is byte-identical for the three scenes before and after.
4. **Selection.** Clicking a wall, an opening or a room selects it through the store's `select`, so
   the Inspector and the scene tree follow, and a selection made elsewhere is highlighted here.
5. **The sheet stays.** A Sheet toggle inside the plan view shows today's 1:100 `planSvg` drawing,
   scrollable as brief 73 left it. The toolbar's Plan button still opens the plan view. The owner
   confirmed this split (Plan opens the editable view, the drawing moves behind Sheet) on 2026-10-21.

## Files you OWN

- `apps/web/src/ui/PlanView.tsx`, and new files under `apps/web/src/ui/plan/`
- A pure transform module, e.g. `apps/web/src/lib/plan-view.ts`
- `apps/web/src/state/store.ts`, only to add plan-view state (chosen level, view transform if it
  must outlive the component)
- `packages/drawing/src/`, only for an extraction that leaves `planSvg`'s output unchanged
- Tests: `apps/web/test/plan-view.test.tsx` and new ones beside it, `packages/drawing` tests

## Files you must NOT touch

- `apps/web/src/engine/` and `Viewport.tsx`. The 3D view is unchanged.
- `packages/schema`. Nothing in the document changes.
- The keep-the-viewport-mounted arrangement in `App.tsx` (see its comment).
- `Scroll.tsx`, which every panel uses.

## Acceptance

- The three scenes open in the plan view on every level, and a document with an empty level shows
  the grid and no error.
- Hovering a known wall end shows that wall's `start` or `end` in the footer, to the centimetre.
- Zooming with the wheel keeps the point under the pointer still (unit test, plus a browser check).
- Clicking a wall selects it in the Inspector; selecting it in the scene tree highlights it here.
- The Sheet toggle shows the 1:100 drawing as before, and `planSvg`'s output is byte-identical for
  the three scenes (test).
- Toggling Plan off and on keeps the same viewport canvas element (no engine reload).
- `npm run check` passes.

## Outcome (2026-10-27)

Built as filed, in `apps/web/src/ui/PlanView.tsx`, `apps/web/src/ui/plan/` (`PlanSurface`, `LevelDrawing`,
`Grid`, `PlanSheet`) and the pure transform `apps/web/src/lib/plan-view.ts`. The store gained `planLevelId`,
`planView`, `planSheet` and `planPointer`; `loadDocument` resets the first two, because a level id and a
framing from one scene mean nothing in another. The engine, `Viewport.tsx`, `packages/schema`, `Scroll.tsx`
and `App.tsx` are untouched.

**One shared set of marks.** `wallSolids` and `openingMark` moved from `plan.ts` into
`packages/drawing/src/linework.ts`, in world metres; the sheet projects them to paper and the plan view to
pixels. `packages/drawing/test/plan-unchanged.test.ts` holds `planSvg` byte-identical against fixtures
written by the code before the move, on all four levels of the three scenes. Flipping the door leaf to the
other side fails three of the four; the fourth, Elmsgate's first floor, has no door.

**The pointer readout is in a strip at the foot of the plan view, not in the app footer.** The app footer is
a polite live region (`role="status"`, `aria-atomic`), so a coordinate there would be read aloud at every
pointer move, and `setStatus` clears a standing alert. The strip is `aria-live="off"`.

**What it draws.** Every wall on the level, boundary walls included, since this is where walls are selected;
the sheet still frames the house alone. So Fit on Greenhollow frames the whole plot and the house is small.
A level change keeps the view, as a CAD program does. Room labels drop out when the room is narrower on
screen than its name. Line weights are the sheet's, doubled to pixels with a 0.6 px floor.

**Selection.** A click resolves to the `data-entity` of the mark under it, so an opening wins over its wall
and a room sits under both; bare ground clears the selection, a pan does not. Openings and rooms select by
id, but the Inspector shows its "Select something" line for them, because `findEntity` resolves walls,
slabs, roofs and placements only and `lib/entities.ts` was not this brief's. Brief 78, which edits openings
in the plan, is where that matters.

**Checked in Chromium** (Playwright, dev server on :5181, 1440×900):

- Every level of the three scenes draws one mark per wall, opening and room (56, 11, 8 and 9), with no
  alert. An empty level added through the store shows the grid and nothing else.
- Hovering W-02's ends reads `x 5.50 m · z -20.00 m` and `x 5.50 m · z -32.00 m`, its `start` and `end`.
- A wheel notch at (700, 420) zoomed 14.73 → 23.10 px/m with the world point under the pointer unchanged
  to four decimals (0.0679, −21.1317).
- Clicking W-02 put it in the Inspector; clicking P-bed3 in the scene tree highlighted it in the plan.
- Middle drag and Space + drag both panned by exactly the pointer's travel and kept the selection.
- Sheet showed the 1:100 drawing; Plan off and on kept the same canvas element.

The wheel, the hover and the pan are also unit-tested in happy-dom. **549 → 584 tests**; `npm run check`
passes.

**Seen while building, for brief 77:** the plan shows the corner notch its note predicted, on Elmsgate's
first floor among others, where two walls meet at a shared end and each stops square.
