# Task 45 — Two scatter fields can place identical forests, and every field under-plants

## Context

From the 2026-09-12 audit, round 3 (maths). Two defects in the same function.

**1 — `seed` defaults to 0 and is never mixed with the field's id.**
`packages/schema/src/document.ts:157` gives `ScatterField.seed` a default of `0`,
and `packages/geometry/src/context/scatter.ts:31` and `:71` call
`mulberry32(field.seed)` with nothing else folded in. Instance positions derive
only from the seed, `bounds(field.area)` and `pointInPolygon(field.area)`.

So **two fields over the same polygon that both omit `seed` place every instance
at exactly the same coordinates** — an `oaks` field and a `birches` field over
one bed become one co-incident, z-fighting thicket with twice the geometry. That
is a natural authoring pattern and nothing warns about it.

`packages/geometry/src/subject/runs.ts:191` already does this correctly: it hashes
the entity id into the seed (`seed = (seed * 31 + charCode) >>> 0`) *precisely so
two pergolas cannot collide*. The scatter tier is the one that skipped it.

Currently latent — all three shipped scenes hand-pick distinct seeds (7, 11, 12,
20, 21, 31, 20260621) — which is exactly how it will stay invisible until someone
omits one.

Secondary, same line: `mulberry32`'s **second** output is badly distributed for
tiny seeds. `mulberry32(0)` yields `0.266429, 0.000330, 0.223272`;
`mulberry32(1)` yields `0.627074, 0.002736, …`. With a low seed the first
accepted instance has its z pinned to within 0.03 % of `bounds.minZ` — hard
against the polygon's southern edge.

**2 — Exclusions are subtracted whole, unclipped.**
`packages/geometry/src/context/scatter.ts:25`:

```ts
const net = Math.max(0, area(field.area) - field.exclude.reduce((s, p) => s + area(p), 0));
```

`area()` is `Math.abs(signedArea())`, and nothing clips an exclusion against the
field boundary or against a sibling exclusion. A 100 × 100 m field with one
50 × 50 m exclusion straddling the edge — only half of it inside — computes
`10 000 − 2 500 = 7 500 m²` where the plantable area is `8 750 m²`. At density 4
per 100 m² that places **300 instances where 350 belong, 14 % under**. Two
20 × 20 m exclusions overlapping by 10 × 10 m subtract 800 m² for a 700 m² hole.

The rejection sampling below uses the *true* polygons, so the planting is the
right shape — just too sparse. And because `packages/schema/src/scatter.ts:20`
repeats the identical expression, **the linter and the API report the same wrong
number**, so nothing can flag the discrepancy.

## Files you OWN

- `packages/schema/src/document.ts` — the seed default
- `packages/schema/src/scatter.ts`
- `packages/geometry/src/context/scatter.ts`
- the corresponding tests

## Files you must NOT touch

- `scenes/` — but note that **fixing the seed will move every instance in every
  scene**. That is expected and correct; say so in the outcome note, and check a
  render of each scene afterwards so nobody mistakes it for a regression.
- `packages/geometry/src/subject/runs.ts` — already correct, and the model to copy.

## What to do

1. **Fold the field id into the seed**, the way `runs.ts` does. Keep `seed`
   meaningful as an author's dial — same id and same seed must still reproduce —
   but two fields with different ids must never collide.
2. **Discard `mulberry32`'s first few outputs**, or mix the seed harder, so a low
   seed does not pin the first instance to an edge.
3. **Clip exclusions before subtracting** — intersect each against the field
   polygon, and union them against each other, so overlaps count once.
4. **Share the result with `estimateScatterInstances` rather than repeating it**
   — this is brief 37's shape, and it is the same expression written twice. Note
   the two already disagree outright for row arrangements.
5. **Test the straddling-exclusion case with real numbers**, and test that two
   fields with the same area and default seed now differ.

## Acceptance

- Two fields sharing a polygon and omitting `seed` place different instances.
- A straddling exclusion yields the geometrically correct count.
- The estimate and the generator return the same number for every arrangement.
- `npm run check` exits 0; scene renders are re-checked and the movement is noted.
