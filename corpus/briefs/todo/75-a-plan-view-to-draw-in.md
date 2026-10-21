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
   scrollable as brief 73 left it. The toolbar's Plan button still opens the plan view.

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
