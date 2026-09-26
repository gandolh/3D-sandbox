# Task 67 — The plan draws a window through solid wall

## Context

From the 2026-09-20 audit. `packages/drawing` exists so a drawing can be
*asserted* rather than eyeballed (see `architecture.md`). This defect makes the
drawing lie to a builder, and a current test asserts the lie.

`solidSpans` only removes an opening from the poché when the section plane
actually cuts it (`packages/drawing/src/plan.ts:195`):

```ts
.filter((o) => cutsThrough(o, cut))
```

`openingSymbol`'s **door** branch handles the not-cut case explicitly and
correctly — a door below the plane is drawn as a dashed threshold with no swing
(`plan.ts:262`). The **window** branch, at `plan.ts:251`, returns its reveals and
glazing line **unconditionally**, before that check is ever reached:

```ts
if (opening.kind === "window") {
  // Both reveals, plus the glazing between them.
  out.push( ...edges..., ...glazing... );
  return out;
}

// A door below the cut plane … is seen, not cut …
if (!cutsThrough(opening, cut)) { ... }
```

So a window above or below the 1.2 m cut plane is drawn as a hole in a wall the
section shows as solid. The comment above it — "The reveal lines close the hole
at the cut" — describes a hole that is not there.

**Verified by execution during the audit.** A wall with a clerestory window
(`sill: 1.8`, `height: 0.6`, head at 2.4 m in a 2.7 m wall): the poché path count
is **4 — identical to the same wall with no openings at all**, so no hole is cut,
yet one glazing line and two reveal lines are still emitted across unbroken
masonry. The drawing tells a builder there is an opening at cutting height where
there is 300 mm of solid wall.

**A test currently locks this in.** `packages/drawing/test/plan.test.ts:48`
("draws glazing in every window") asserts
`expect(glazing).toHaveLength(windows.length)` — a count, with no reference to
whether the section cuts the window. It is a clean example of the theme
`status.md` names: asserting that output exists and is roughly the right size,
not that it is correct.

## Files you OWN

- `packages/drawing/src/plan.ts` — `openingSymbol`
- `packages/drawing/test/plan.test.ts`

## Files you must NOT touch

- `solidSpans` and `cutsThrough` — they are already right; the symbol path is
  what ignores them.
- The decision that `packages/drawing` is parallel to `packages/geometry` and
  needs no GPU.
- The line-weight hierarchy and its test.

## What to do

1. Decide what a window **not** cut by the plane should look like, and write the
   reason down. A window whose head is below the plane is seen-not-cut and takes
   a dashed line like the door threshold; a window entirely above the plane is
   conventionally shown dashed as an overhead element, or omitted. Either is
   defensible — an unqualified glazing line across solid poché is not.
2. Move the `cutsThrough` guard so it governs **both** kinds, rather than
   duplicating it into the window branch.
3. Fix the "closes the hole at the cut" comment to match what the code does.
4. **Replace the count-based glazing test with one that fails on this bug.** It
   must distinguish a window the plane cuts from one it does not — e.g. a
   clerestory at `sill: 1.8, height: 0.6` in a 2.7 m wall, asserting the poché is
   unbroken *and* that no full-weight glazing line crosses it. Keep a test that a
   normal window still draws glazing, so the fix cannot be "stop drawing glazing".

## Acceptance

- A clerestory window above the cut plane leaves the poché unbroken and emits no
  glazing line across it.
- A window the plane does cut is drawn exactly as it is today.
- The new test fails if the guard is removed — verify by mutation.
- `npm run check` exits 0.
