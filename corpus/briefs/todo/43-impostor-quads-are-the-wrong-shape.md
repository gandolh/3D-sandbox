# Task 43 — Impostor quads are the wrong shape for what the baker drew

## Context

From the 2026-09-12 audit, round 3 (maths). The baker and the consumer disagree
about what an atlas cell contains, and neither knows it.

**What the baker draws.** `assets/bake/impostor.js:79` sets
`half = max(size.x, size.y, size.z) / 2` and renders an orthographic frustum of
±half in **both** axes into a square cell. So every cell represents a **square
S × S metres**, where `S = max(sx, sy, sz)`, centred on the bounding-box centre.

**What the quad assumes.** `packages/geometry/src/context/impostor.ts:37`
computes `aspect = max(sx, sz) / sy` and builds a quad `h` tall by `h * aspect`
wide, with its base at `y = 0`.

Those are only the same thing when the subject is exactly as wide as it is tall.

For the one asset actually baked — `tree_small_02`, `size: [2.9167, 4.5567,
4.2925]` — computed from both formulas:

```
baker cell        = 4.5567 m square
quad aspect used  = 0.94202  ->  9.000 x 8.478 m at field.height 9
subject fills     0.9420 of the cell width
so drawn w/h      = 0.8874
correct w/h       = 0.9420
```

**Every tree in the forest is 5.8 % too narrow for its height.**

That is the mild case, because the tree happens to be tallest in Y. Off that
case it falls apart: a shrub baked at `[6, 2, 6]` gives `S = 6` and
`aspect = 3.0`, so the quad is 2 m tall by 6 m wide — but the subject occupies
only `v ∈ [0.333, 0.667]` of the cell, so it draws from **y = 0.667 m to
y = 1.333 m**: two-thirds of a metre tall instead of two metres, hovering
above the ground, with empty atlas above and below it.

This is latent today only because one asset is baked and it is the forgiving
shape. The moment `pine_tree_01` or `fir_tree_01` is baked (a standing open
question) or any wide shrub is, it becomes obvious and wrong.

## Files you OWN

- `packages/geometry/src/context/impostor.ts`
- `assets/bake/impostor.js` — **only** if you decide the baker is the side to change
- `packages/geometry/test/impostor.test.ts`

## Files you must NOT touch

- `assets-src/**/impostor/*.json` — baked output. If the fix changes the meta
  format, regenerating is a separate, GPU-costly step and must be called out, not
  done silently.

## What to do

1. **Decide which side is authoritative and write it down.** Either the cell is a
   square of side `S` and the consumer must letterbox the subject inside it, or
   the baker should frame tightly and record the real extent. The first needs no
   re-bake and is the cheaper correct answer; the second wastes less atlas.
   The existing `impostor.json` already records `size`, so the consumer has
   everything it needs to do the first.
2. **Make the quad match the cell.** If the cell is `S × S` centred on the bbox
   centre, the quad must be square, scaled so `S` maps to `height * S / sy`, and
   positioned so the subject's base — not the cell's bottom — lands on `y = 0`.
3. **Test it with a deliberately non-cubic size**, e.g. `[6, 2, 6]`, and assert
   the drawn subject's height and ground contact, not just that a geometry came
   back. A bounding-box assertion will not catch this, which is why it survived.

## Acceptance

- A wide, short asset renders at its true size, standing on the ground.
- `tree_small_02` renders at w/h 0.9420, not 0.8874.
- `npm run check` exits 0.
