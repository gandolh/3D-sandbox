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

---

## Outcome — 2026-09-12

**1 — The field id is folded into the seed.** `scatterSeed(field)` in
`packages/schema/src/derive/`, hashing the id into the author's `seed` the way
`runs.ts` has always hashed a run's id — the same function, shared rather than
copied a second time. `seed` keeps working as the author's dial: same id and
same seed still reproduce exactly, which is the only reason a render can be
re-made from its document.

The test is the strict one. It does not assert that the two fields *differ*;
it asserts that **not one instance coincides** between an `oaks` field and a
`birches` field over the same polygon with `seed` omitted. "Some differ" would
have passed on a hash that only perturbed the tail.

**2 — mulberry32 is warmed before first use.** The measured defect, since the
brief quoted it: `mulberry32(0)` → 0.266429, **0.000330**, 0.223272;
`mulberry32(1)` → 0.627074, **0.002736**. A field consuming draws as (x, z)
therefore put its first accepted instance within 0.03 % of `bounds.minZ`,
standing hard against the southern boundary, for any low seed. Four draws are
discarded at construction — seed 0's fifth output is 0.467328.

Discarded **inside `mulberry32`** rather than at the scatter call site, which is
a deliberate widening: the defect belongs to the generator, and `runs.ts` seeds
a pergola's canopy from it. A pergola's foliage has therefore moved too. The
test walks seeds 0–3 and asserts the first instance clears the edge by a metre.

**3 — Exclusions are clipped, and this needed a real primitive.**
`polygonNetArea(outer, holes)` in `schema/geometry.ts`. The obvious
`area(field) − Σ area(exclude)` is wrong twice: a hole half outside the field
removes the half that was never there, and two overlapping holes remove their
overlap twice.

It is **exact, not sampled**. Cut the plane into horizontal slabs at every
vertex *and every edge-edge crossing*; inside one slab no edge begins, ends, or
swaps sides with another, so each crossing's x moves linearly in z, the covered
length does too, and the integral of a linear function over an interval is its
midpoint value times the width. One evaluation per slab is the entire answer.

Sutherland–Hodgman was the cheaper candidate and was rejected: it clips against
a **convex** polygon only, and fields are not guaranteed convex. A sampled
quadtree was rejected for giving a bounded error where an exact answer is
available for the same order of work. Verified against seven hand-computed
cases, all exact to the last digit — including an L-shaped field, which is
precisely the shape Sutherland–Hodgman would have got wrong:

| case | expected | got |
|---|---|---|
| 50 × 50 hole half outside a 100 × 100 field | 8 750 | 8 750 |
| two 20 × 20 holes overlapping by 10 × 10 | 9 300 | 9 300 |
| L-shaped field, 4 × 4 hole on its inner corner | 63 | 63 |

The brief's own worked example now holds: that straddling field plants **350**
instances, not 300.

**4 — Shared, not repeated.** `estimateScatterInstances` is the single
definition and the generator asks it — brief 37 did that; this brief put the
correct arithmetic inside it. The row disagreement the brief flagged was fixed
there too.

**What moved in the shipped scenes.** Every instance in every scene has new
coordinates — expected, and the reason the brief asked for a look. Counts:

| scene | field | before | after |
|---|---|---|---|
| elmsgate | yard-planting | 4 | 4 |
| greenhollow | roses-west / roses-east / kitchen-garden | 9 / 9 / 4 | unchanged |
| greenhollow | orchard (rows) | 16 | **15** |
| villa-carpathia | forest | 260 | 260 |

Only the orchard's number changes, and it changes to the truth: the generator
always placed 15, and the estimate was quoting 16. No bundled scene has a
straddling or overlapping exclusion, so nothing else moves in count — the
clipping fix is latent in these three and correct for the next one.

**Looked at**: villa-carpathia in the viewport — 260 instances, 28 947 tris,
forest re-shuffled and still well-formed, the clearing intact and all six
neighbours standing clear of the trees. Not a path-traced render; this machine
cannot (brief 40's outcome).

`npm run check` clean, **306 tests** (was 294).

### Verification pass — 2026-09-13

**One acceptance criterion was not met and is now met.** *"The estimate and the
generator return the same number for every arrangement."* The first pass tested
a rectangle, where the estimate happened to be exact, and the outcome note above
says so — but "exact for a rectangle, the right approximation for anything else"
is not what the brief asked for. On an L-shaped row field the estimate quoted
**130 against 100 placed — 30 % over**.

It cannot be fixed analytically: the generator jitters each point *before*
testing containment, so which lattice cells survive depends on the RNG. The only
number that agrees with the generator is the generator's own. So the placement
half of `context/scatter.ts` — pure arithmetic over the document, no `three` —
moved to `schema/src/derive/scatter.ts` along with `mulberry32`, and the row
estimate now walks the same lattice the generator walks.

Affordable because a lattice is bounded: `rowSpacing` has a floor, coordinates
have a ceiling, and past `MAX_INSTANCES` cells the estimate returns the cell
count — an over-estimate that correctly trips the error band without walking
anything and without throwing inside the linter.

Seven cases now agree, and the concave count is **pinned at 100** so "they
agree" cannot be satisfied by both being wrong:

| case | before | after |
|---|---|---|
| rows, rectangle | 130 / 130 | 130 / 130 |
| rows, with an exclusion | 122 / 122 | 122 / 122 |
| **rows, concave field** | **130 / 100** | **100 / 100** |
| scattered, all four shapes | agreed | agreed |
