---
summary: How drawing the house in the browser works (built 2026-10-27) — the plan view and its shared linework, undo and redo with grouped steps, the Wall tool's exact corners and snap order, doors, windows, rooms and floors (the linter as the fit check, faces from split walls), and New house with scenes read from the API; the calls made while building and the known corner notch.
updated: 2026-11-03
---

# Drawing the house

The owner's call (2026-10-21) is in [decisions.md](decisions.md#the-browser-draws-building-parts-never-free-geometry):
the browser draws building parts the way Revit and ArchiCAD do (pick a tool,
click points in a plan, type a length or an angle) and never free geometry.
Everything below was built on 2026-10-27. Roofs are not drawn yet.

## The plan view

`apps/web/src/ui/PlanView.tsx` and `apps/web/src/ui/plan/`, with the pure
transform in `apps/web/src/lib/plan-view.ts`. It is a surface in world metres;
the 1:100 sheet (`planSvg`) stays beside it, because `planSvg` throws on a
level with no walls and refits its sheet on every call.

- **One set of marks.** `wallSolids` and `openingMark` live in
  `packages/drawing/src/linework.ts`, in metres; the sheet projects them to
  paper and the plan view to pixels. `packages/drawing/test/plan-unchanged.test.ts`
  holds `planSvg` byte-identical to the output from before the move.
- **It draws every wall on the level**, boundary walls included, since this is
  where walls are selected; Fit on Greenhollow frames the whole plot. A level
  change keeps the view. Line weights are the sheet's, doubled, with a 0.6 px
  floor; room labels drop out when the room is narrower than its name. Slabs are
  drawn faintly so a floor can be selected.
- **Selection** resolves to the `data-entity` of the mark under the click: an
  opening wins over its wall, a room sits under both, bare ground clears.
- **The pointer readout is a strip at the foot of the plan, `aria-live="off"`.**
  The app footer is a polite live region, so a coordinate there would be read
  aloud on every move, and `setStatus` would clear a standing alert.
- The wheel zooms about the pointer; a middle drag or Space + drag pans and keeps
  the selection.

## Undo and redo

`editDocument(mutate, { label, group })` keeps an undo and a redo stack in the
store, capped at `HISTORY_LIMIT` = 100 (about 68 KB a step on Greenhollow, so
the cap is cheap). Undo restores a document through the normal edit path:
re-lint, bump the revision. A load clears both stacks; a rejected edit leaves
them alone.

- **Grouping**: the last edit's group is module state, ended by undo, redo or a
  load. The sun slider and the paused playhead scrub share `solar`; every
  Inspector field groups by entity and field (`W-01:thickness`), so two commits
  to one field with nothing between are one step. The gizmo commits once, at
  the end of a drag.
- **Keys** (`ui/useUndoKeys.ts`): Ctrl or Cmd with Z, Shift+Z and Y on
  `window`. Text fields keep their own undo; a range input does not, because
  after a slider drag the focus is on the slider and Ctrl+Z must undo the drag.

## The Wall tool

The pure half is `apps/web/src/lib/drawing/` (`snap.ts`, `walls.ts`); the UI is
`ui/plan/` (`ToolBar.tsx`, `useWallTool.tsx`, `useSelectTool.tsx` with grips and
Delete, `SnapMarker.tsx`, and `tool.ts`, which `PlanSurface` hands every gesture
but pan and zoom).

- **Exact corners by construction.** A new wall starts on the chain's last point
  copied verbatim; an end snap returns stored coordinates; closing the loop
  reuses the first point's numbers. Typed lengths go along `directionOf(bearing)`,
  exact at the four compass points (`Math.cos(π/2)` is 6e-17), and the sum is
  cleaned of float noise. A test asserts the 8 × 6 box with `toEqual`.
- **The typed angle is a bearing**, clockwise from north, as in the Inspector
  and the document; not CAD's counter-clockwise from east.
- **Snap order**: end, middle, on wall, grid, then angle (within 3° of a multiple
  of 15°). A pixel tolerance for angles caught almost everywhere far from the
  start and hid the grid. A free point is rounded to the centimetre.
- Esc mid-wall drops that wall and ends the chain; Esc again returns to Select.
  A click back on the start after one wall is ignored. "4,2" and "4.2" both
  parse. Grips move every wall end within 1e-6 m of the corner; moving a
  `start` slides that wall's openings, since offsets run from `start`.

**Known issue:** walls leave a square notch at every outside corner, because each
wall's mesh stops square at its end
(brief 01 mitres the ends, [decisions-geometry.md](decisions-geometry.md)).

## Doors, windows, rooms and floors

`lib/drawing/openings.ts` and `faces.ts`, with `ui/plan/useOpeningTool.tsx` and
`useAreaTools.tsx`.

- **The red ghost asks the linter.** `openingProblems` runs the three opening
  rules from `RULES` on the document with the candidate appended last to its
  wall and keeps the errors that point at it; nothing re-implements their
  arithmetic.
- **Faces.** Every wall is split wherever another meets or crosses it, so a
  partition ending mid-length on an outer wall still closes its rooms. A room is
  the smallest bounded face round the click, each edge moved in by its own
  wall's half thickness; a floor is the group's outside moved out. Walls with a
  free end are dropped from the outline.
- Ids: openings number from the document's highest `d-N` / `w-N` with no padding,
  rooms `r-<n>`, slabs `slab-<n>`. A new floor takes the level's most used slab
  material, then the document's. The Inspector finds openings and rooms.

## New house, and scenes from the API

`apps/web/src/lib/api.ts`, `lib/scene-source.ts` and `ui/SceneDialogs.tsx`.

- **One path in.** First load, the picker, New house and a reload after a stale
  save all call `openScene`, which takes the API's copy when the API lists the
  id and the bundled one otherwise, through `SceneDocument.safeParse` either
  way. The listing gives up after 1.5 s, and a non-OK answer counts as down,
  because Vite's proxy answers 500 when the API is stopped.
- **`x-scene-mtime` on PUT and POST.** Without it the version kept from the read
  went stale on the first save and the second save was refused.
- A drawn house is a `*.scene.json` with no TypeScript builder (`hasBuilder:
  false` in `GET /api/scenes`); `npm run scenes` leaves it byte-identical.
  Drawing in a scene that has a builder warns once, because the next
  `npm run scenes` would erase the drawing.
- The id is the title lowercased, accents stripped, words hyphenated
  ("Căsuța" → `casuta`); a title that cannot start with a letter is refused.
  "Save as a new house" copies the whole open document, unsaved edits included.
  A new house copies all the open scene's materials, so one made from
  Greenhollow starts with `materials-are-used` warnings until it uses them.
- With no API in the build, or the API stopped, the bundled scenes still open
  and New house is disabled with the reason in its title.
