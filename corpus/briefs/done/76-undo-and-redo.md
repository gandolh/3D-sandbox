# Task 76 — Undo and redo

## Context

Brief 74 (settled 2026-10-21) lists undo as one of the CAD habits Solstice lacks, and drawing walls
without it would be miserable. It comes second so the drawing tools (77, 78) land with it already in
place. It is useful on its own too: today a gizmo drag or an Inspector edit cannot be taken back.

Every document change already goes through one function, `editDocument(mutate)` in
`apps/web/src/state/store.ts`. It structured-clones the document, applies the edit, re-parses it
through the schema and replaces `state.document`. The old document object is never mutated.

**Decided here: undo keeps whole-document snapshots, not patches.** The snapshot is free: each edit
already produces a fresh, parsed, immutable document, so keeping a reference to the previous one is
an exact undo step with no diffing. Patches would need a diff library and an inverse for every kind
of edit. The scene files are 12–49 KB on disk, so a capped history is cheap. Measure it (step 4).

## What to do

1. **History in the store.** `editDocument` pushes the document it replaces onto an undo stack, and
   any new edit clears the redo stack. Cap the history at 100 steps, dropping the oldest.
   `loadDocument` clears both stacks, because a different scene is not a step back.
2. **Labels and grouping.** `editDocument` takes an optional second argument:
   - `label`, the step's name for the button tooltip, e.g. "Move P-03" or "Add wall W-07";
   - `group`, a key: consecutive edits with the same group fold into one step until a different
     edit arrives. The Timeline's sun slider calls `setSolar` on every input event
     (`apps/web/src/ui/Timeline.tsx`), and without a group one drag would be a hundred steps.
   Check the Inspector's fields and the gizmo (`Viewport.tsx`'s `onTranslate`) for the same problem,
   and group them where an edit fires per keystroke or per frame.
3. **Undo and redo actions.** Undo puts the previous document back through the same path a load or
   edit uses: re-lint, bump `revision` so the engine regenerates. If the selected entity no longer
   exists afterwards, clear the selection.
   - Keys: Ctrl+Z to undo, Ctrl+Shift+Z or Ctrl+Y to redo, Cmd on a Mac. Not while focus is in a text
     field, which keeps its own undo.
   - Toolbar buttons, disabled when there is nothing to undo or redo, with the step's label in the
     tooltip ("Undo Move P-03").
   - Not while a render runs (`state.rendering`), the same rule that already guards the scene picker
     and Save.
4. **Measure** the heap cost of 100 Greenhollow steps in the browser and record it in the outcome.
   If it is large, lower the cap and say why.

## Files you OWN

- `apps/web/src/state/store.ts`
- `apps/web/src/ui/Toolbar.tsx` (the two buttons) and a keyboard hook where the app's other global
  keys live
- Callers of `editDocument` (`Inspector.tsx`, `Viewport.tsx`, `Timeline.tsx`), only to pass a label
  or a group
- `apps/web/test/store.test.ts` and new tests beside it

## Files you must NOT touch

- `packages/schema` and the API. Undo lives in the browser session only. It is not saved.
- `SandboxEngine`. It already regenerates on a revision bump, and undo must use that path, not a
  second one.

## Acceptance

- Unit tests: undo then redo returns the identical document; a new edit clears redo; the cap drops
  the oldest step; grouped edits make one step; `loadDocument` clears history; undo of the last
  step disables the button.
- In the browser: drag a placement with the gizmo, change a wall's thickness in the Inspector, and
  drag the sun slider. Three Ctrl+Z presses undo them in reverse order, and the 3D view and the plan
  follow each one. Ctrl+Shift+Z redoes them.
- Ctrl+Z inside an Inspector text field undoes the typing, not the document.
- `npm run check` passes.

## Outcome (2026-10-27)

Built as filed. `editDocument(mutate, { label, group })` keeps `undoStack` and `redoStack` in the store
(`HistoryStep` is the document to go back to and the step's name), capped at `HISTORY_LIMIT` = 100.
`undo` and `redo` restore a document by re-linting and bumping the revision, the path every edit takes,
so `SandboxEngine` is untouched. `loadDocument` and `setLoadError` clear both stacks. A rejected edit
leaves history alone. `packages/schema` and the API are untouched.

**Grouping.** The group of the last edit is module state, and undo, redo and a load end it. Three callers
needed one:

- the sun slider (`setSolar`, now `group: "solar"`), one call per input event;
- the paused playhead scrub in `Viewport.tsx`, which commits the sun per drag event, in the same group;
- every Inspector field, grouped by entity and field (`W-01:thickness`). A spinner commits once per press.
  The consequence is that two separate commits to the same field with nothing in between are one step.

The gizmo commits once, at the end of a drag (`commitDrag`), so `Move <id>` needs no group. Drop to floor
is `Drop <id>`, ungrouped.

**Keys and buttons.** `useUndoKeys` (`apps/web/src/ui/useUndoKeys.ts`) binds Ctrl or Cmd with Z,
Shift+Z and Y on `window`, mounted from the toolbar beside the buttons it presses; there was no central
place for global keys. It leaves text fields alone, but not a range input: after a drag of the sun slider,
focus is on the slider, and Ctrl+Z there has to undo the drag. Undo and Redo sit before Save, disabled
when empty or during a render, titled "Undo Move table-garden (Ctrl+Z)".

**Checked in Chromium** (Playwright, :5181). On Greenhollow: dragged `table-garden` with the gizmo's XZ
handle by real pointer events (2.40, −33.80 → −0.19, −33.85), set W-01's thickness to 360 mm in the
Inspector, and dragged the sun slider from 17:20 to 14:54. With the plan view open, three Ctrl+Z undid
them in reverse: the time went back, then W-01's mesh and its plan outline went from 0.36 to 0.30 m, then
the table's mesh moved back. Three Ctrl+Shift+Z redid them in order. Typing into the Thickness field and
pressing Ctrl+Z took "3005" back to "300" with the undo stack unchanged.

**Heap, 100 Greenhollow steps:** about 6.8 MB in Chromium (`performance.memory` with forced GC, history
held against history cleared), 68 KB a step; 10.3 MB in Node for 100 parsed documents. The scene is 49 KB
on disk. Small, so the cap stays at 100.

**549 → 603 tests across 75 and 76** (19 here: store history, toolbar buttons, keys). Turning grouping off
fails two of them; treating number inputs as non-text fails the text-field one. `npm run check` passes.
