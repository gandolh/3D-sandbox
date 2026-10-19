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

## Outcome (2026-10-19)

Done as filed: `PlanView`'s outer div is now `flex min-h-0 min-w-0 flex-1 flex-col`. `Scroll.tsx`,
`App.tsx` and `packages/drawing` are untouched.

**Measured at 1440×900 in headless Chromium**, with `elementFromPoint` sampled across the timeline and
footer rows at three points along the pane:

| Scene | Sheet height | Pane | Before | After |
| --- | --- | --- | --- | --- |
| elmsgate | 1176 px | 713 px | scroll root 1224 px tall, timeline covered at all 12 samples, wheel does nothing | scroll root 713 px, 12/12 samples hit the timeline or footer, wheel scrolls 300 px |
| greenhollow | 776 px | 713 px | (same bug) | wheel scrolls the full 111 px overflow |
| villa-carpathia | 683 px | 742 px | fits | fits, nothing to scroll |

**Villa Carpathia does not overflow at 1440×900.** Its plan is wide, so `max-w-full` scales it down
until it is shorter than the pane. Elmsgate is the scene that reproduces the bug at this size, because
its ground floor is long and narrow on a 6.5 m lot. Villa was checked at 1440×640 instead, where it overflows by
249 px: the wheel and the scrollbar both scroll it, and the timeline stays clear.

**The scrollbar** was dragged by its thumb on each overflowing scene and moved the sheet (93, 138 and
122 px for an 80 px drag). **The viewport canvas** is the same element before and after Plan off and
on, on all three scenes, so the engine is not reloaded.

**The test** (`apps/web/test/plan-view.test.tsx`) can only pin the classes, because happy-dom does no
layout: the pane must be a shrinkable flex column, with the `Scroll` root as a `min-h-0 flex-1` child.
All three cases fail with the fix reverted. `npm run check` passes (549 tests).
