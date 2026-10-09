# Task 73 — Plan view draws over the timeline

## Context

Found during the 2026-10-09 README refresh. Bug brief only: nothing was fixed when this was written.

At 1440×900, with the Plan toggle on, the floor-plan sheet is taller than the pane that holds it and
its bottom edge paints over the timeline strip underneath instead of scrolling.

## Reproduce

1. `npm run dev` (web app), open a scene with a large plan (Villa Carpathia).
2. Set the window to 1440×900. Toggle Plan.
3. The white sheet runs past the bottom of the middle row and covers the timeline. The wheel does not
   scroll the sheet, because the scroll area never gets a bounded height.

## Evidence (re-checked on 2026-10-09)

- [`apps/web/src/ui/PlanView.tsx:49-50`](../../../apps/web/src/ui/PlanView.tsx#L49-L50): the outer div is
  `min-w-0 flex-1 bg-viewport`. It is a flex item of the middle row but is not itself a flex
  container.
- [`apps/web/src/ui/Scroll.tsx:13`](../../../apps/web/src/ui/Scroll.tsx#L13): `ScrollArea.Root` is
  `min-h-0 flex-1`. `flex-1` and `min-h-0` only act when the parent is a flex container. Here the parent is a
  plain block div, so the root takes its content height and the viewport's `h-full` has nothing to
  resolve against.
- Where the row comes from: [`App.tsx:93-107`](../../../apps/web/src/App.tsx#L93-L107), `flex min-h-0 flex-1`
  above `<Timeline />`. The sibling panels get this right: `Inspector.tsx:18` and `SceneTree.tsx:126`
  are `flex ... flex-col`, and `Scroll` sits inside them.
- The two early returns at `PlanView.tsx:32` and `:42` centre their message and are unaffected.

## What to do

Make the outer div a column that can shrink: add `flex flex-col` (and `min-h-0`) to the div at
`PlanView.tsx:50`, so `Scroll`'s `min-h-0 flex-1` limits the height and the sheet scrolls inside the pane.
Check the viewport pane is not affected: it is a separate `hidden`/`flex` wrapper in `App.tsx`.

## Files you OWN

- `apps/web/src/ui/PlanView.tsx`
- A test or UI check if the repo has a pattern for layout (the web app's component tests)

## Files you must NOT touch

- `packages/drawing` (the SVG is right; the pane is wrong).
- `Scroll.tsx`, which every panel uses. Fix the parent, not the shared component, unless the fix is
  shown to be needed there.
- App layout in `App.tsx`, and the plan's white-sheet-on-dark-chrome decision in the component comment.

## Acceptance

- At 1440×900 with Plan on, the timeline and the footer are fully visible and unobstructed.
- The sheet scrolls vertically inside its pane (wheel and scrollbar), on the three scenes.
- Toggling Plan off and on still keeps the viewport canvas mounted (no engine reload).
- `npm run check` passes.
