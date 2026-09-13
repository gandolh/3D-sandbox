# Task 58 — Two things recomputed sixty times a second that cannot change

## Context

From the 2026-09-13 audit. Two instances of one mistake, in the same loop, both
cheap to fix — bundled deliberately because they are the same finding twice and
neither is worth its own brief.

**1 — Sunrise and sunset, recomputed every animation frame.**
`apps/web/src/ui/Timeline.tsx:52`:

```ts
const solarState = useMemo(() => {
  const solar = { ...doc.solar, time: minutesToClock(minutes) };
  return {
    position: sunPosition(doc.site, solar),
    bounds: dayBounds(doc.site, solar),
    clock: solar.time,
  };
}, [doc, minutes]);
```

`minutes` changes on every `requestAnimationFrame` during playback — the Player
drives `setPlayhead` per tick. So this memo re-runs ~60 times a second, which
is correct for `sunPosition` and wrong for `dayBounds`: that function
(`packages/solar/src/index.ts:104`) opens by pinning its own time to noon —

```ts
const noonish = localToUtc(solar.date, "12:00", site.timezone);
```

— so it depends only on `solar.date` and the site. Four astronomical
calculations (sunrise, sunset, solar noon, golden hour) are redone every frame
for an answer that is identical all day.

**2 — The selection outline, rebuilt every frame whether or not it moved.**
`apps/web/src/engine/SandboxEngine.ts:590`:

```ts
this.orbit.update();
if (this.selectionBox.visible && this.gizmo.object !== undefined) {
  this.selectionBox.setFromObject(this.gizmo.object);
}
```

`BoxHelper.setFromObject` traverses the object's subtree and recomputes its
bounding box from geometry. This runs whenever **anything is selected** — not
only while it is being dragged. Select a placement backed by a multi-mesh glTF
and leave it selected, and that traversal runs 60 times a second for an object
that is not moving, for as long as it stays selected.

## Files you OWN

- `apps/web/src/ui/Timeline.tsx`
- `apps/web/src/engine/SandboxEngine.ts` — the frame loop and the gizmo hooks
- `apps/web/test/`

## Files you must NOT touch

- `packages/solar`. `dayBounds` is correct and its signature is fine; the bug
  is in how often the caller asks.
- `sunPosition` per frame. That one genuinely changes every frame and is the
  reason the memo exists.

## What to do

1. **Split the memo** so `dayBounds` depends on `[doc.site, doc.solar.date]`
   and `sunPosition` keeps `[doc, minutes]`.
2. **Update the selection box on change, not on tick.** It needs recomputing
   when the selection changes and while the gizmo is dragging — three-js
   `TransformControls` emits `objectChange` for exactly this. Drive it from
   that and leave the frame loop alone.
3. **Test what you can at the seam**: `dayBounds` called with two different
   times on the same date returns the same object contents, which is the
   property that makes hoisting it safe.

## Acceptance

- Scrubbing the timeline no longer recomputes `dayBounds` per frame.
- The selection outline still tracks a dragged object exactly as it does now.
- `npm run check` exits 0.

---

## Outcome — 2026-09-13

**1 — `dayBounds` hoisted out of the per-frame memo.** It now keys on
`[doc?.site, doc?.solar]` while `sunPosition` keeps `[doc, minutes]`, which is
the only one of the two that genuinely changes per frame.

The justification is in `dayBounds` itself: it opens with
`localToUtc(solar.date, "12:00", …)`, pinning its own time to noon, so the
clock it is handed cannot affect its answer. A new test in
`packages/solar/test/bounds.test.ts` asserts exactly that property — the same
date at 00:00, 06:30, 17:42 and 23:59 gives a byte-identical result — plus the
converse, that a different date *does* change it. That pair is what makes the
hoist safe rather than merely faster.

**2 — The selection outline moved from the frame loop to `objectChange`.**
`TransformControls` emits that event when it actually moves something, so the
box is rebuilt on a drag and on a change of selection, and not otherwise.

The frame loop is now two lines: `orbit.update()` and `render()`. Previously it
also called `BoxHelper.setFromObject`, which traverses the selected object's
subtree and rebuilds its bounding box from geometry — for as long as *anything*
was selected, dragging or not. Selecting a placement backed by a multi-mesh
glTF and then simply orbiting ran that traversal 60 times a second for an
object standing perfectly still.

`npm run check` clean, **454 tests**.
