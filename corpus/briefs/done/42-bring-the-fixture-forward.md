# Task 42 — The regression fixture predates two decisions, and grows trees through houses

## Context

From the 2026-09-12 audit, round 4. `villa-carpathia` is the regression fixture
and the least-looked-at scene in the repo — it only became openable yesterday,
when brief 20 added the scene picker. Looking at it turned up four things.

**1 — Every textured material is missing both `baseColor` and `textureScale`.**
Verified from the built JSON:

| material | slug | baseColor | textureScale |
|---|---|---|---|
| `plaster-lime-04` | `clay_plaster` | **none** | **none** |
| `roof-clay-tile` | `roof_tiles_14` | **none** | **none** |
| `slab-concrete` | `Concrete034` | **none** | **none** |
| `grass-meadow` | `leafy_grass` | **none** | **none** |
| `asphalt-road` | `Asphalt026A` | **none** | **none** |

`decisions-scene.md` settled on 2026-09-11 that **every** material declares its
dominant colour whether or not it names a texture, precisely so a scene composes
before the maps are downloaded. Villa was written earlier and never brought
forward, so with no assets on disk the walls, roof, ground and road all render as
the same neutral grey — in the scene whose job is to exercise the full schema.

Missing `textureScale` is the same story: geometry here is boxes and extrusions
carrying 0–1 UVs per face whatever its size, so without a world-metre scale one
clay-plaster repeat smears across a whole 9.6 m wall and the 140×140 m meadow
gets a single blade of grass. Greenhollow and Elmsgate declare both on every
textured material.

**2 — The forest grows through all six neighbouring houses.** The `forest`
scatter covers `[[-60,-60],[60,-60],[60,60],[-60,60]]` at 2.1 instances per
100 m², and excludes exactly one box: `[[-14,-16],[14,-16],[14,16],[-14,16]]` —
the house clearing. Every `context.masses` entry sits outside it:

```
n-01 x -46..-35 z 22..31    n-04 x   6..16 z 24..32
n-02 x -30..-20 z 24..32    n-05 x  23..34 z 22..32
n-03 x -13.. -1 z 23..32    n-06 x  40..49 z 25..33
```

n-03 is 12 × 9 m = 108 m², so ~2.3 trees are expected *inside its walls*.

**3 — Greenhollow's porch colonnade covers one edge of two.**
`porch-posts` is a single segment `[[-9.5,23],[-9.5,31]]` — the west edge only —
while the comment above it says "posts along its open west and south edges".
`roof-porch` is flat, has no walls beneath it, and the colonnade is its only
support, so the south corner reads as cantilevered.

**4 — Two roofs disagree with their own `overhang`.** Elmsgate's `roof-house`
footprint is exactly `HOUSE`, so the computed overhang is **0.000 m** on all four
sides despite `overhang: 0.15` — including the street and yard elevations, which
are the subject of two of its three shots. Greenhollow's `roof-greenhouse`
computes **0.300 m** on every side against a declared `0.15`, while `roof-house`
and `roof-garage` in the same document match their declared values exactly.

This is worth a moment's thought rather than a blind fix: **is `overhang` what
the generator applies, or a description of a footprint the author already
oversized?** `buildRoof` ignores it and builds straight from `footprint`; the
linter uses it as a tolerance (and gets the direction wrong — briefs 27 and the
audit's Next tier). Three scenes use it three different ways, which means the
field's meaning was never settled.

## Files you OWN

- `scenes/src/villa-carpathia.ts`
- `scenes/src/greenhollow.ts` — the colonnade path only
- `scenes/src/elmsgate.ts` — the roof footprint only
- `scenes/*.scene.json` — regenerated, never hand-edited

## Files you must NOT touch

- `packages/geometry`, `packages/schema` — **except** to write down what
  `overhang` means, if item 4 settles it. If fixing it needs a generator change,
  that is a separate brief; this one may only change documents.

## What to do

1. Give villa's five textured materials a `baseColor` and a `textureScale`,
   matching the equivalents in Greenhollow so the two are comparable.
2. Exclude the six neighbour footprints from the forest — with a margin, so trees
   do not touch the walls either.
3. Add the south segment to `porch-posts`.
4. **Settle what `overhang` means** and write it into `decisions-scene.md`, then
   make all three scenes consistent with that answer. If it means "the generator
   oversails the footprint by this much", `buildRoof` is wrong and that is a new
   brief — say so rather than quietly editing footprints to hide it.
5. Re-render one shot from each scene and look at it before calling this done.

## Acceptance

- `npm run scenes` builds all three clean.
- No tree intersects a building in villa.
- `overhang` means one thing, recorded, and every scene agrees with it.
- `npm run check` exits 0.

---

## Outcome — 2026-09-12

All four items done, and the fourth needed the decision the brief asked for
rather than a fix.

**1 — Villa's five textured materials** now declare `baseColor` and
`textureScale`, values matched to Greenhollow's so the two scenes are
comparable. The scene had been written before the rule and never brought
forward.

**2 — The forest.** The six neighbours are now a single `NEIGHBOURS` array that
both `context.masses` and the scatter's `exclude` read, each grown by a 2 m
skirt so trees do not touch the walls either. Two hand-copied lists of the same
six rectangles is how they drift apart in the first place.

Instance count 284 → 260. The old test asserted the count, which could never
have caught this — 284 trees with two inside a neighbour's rooms is still 284.
So there is now a second test that checks the property: no instance falls within
any mass's footprint.

**3 — The porch colonnade** gained its south leg. The comment above it had
described two edges since it was written; the path had one.

### 4 — `overhang` means the drawing, not the generator

Recorded in `decisions-scene.md` and on the field itself:

> `Roof.overhang` is the **least** the declared `footprint` oversails the walls
> beneath it, on any one side. Descriptive, not generative.

That is the only reading consistent with `buildRoof`, which builds straight from
`footprint` and never reads the field. **Making it generative was considered and
rejected for a concrete reason**, not for scope: a single scalar cannot express
a mid-terrace, flush at the party walls and eaved front and back, nor a hip
roof's overhang following the eave line rather than a bounding box. Generating
from one number would make the schema unable to describe buildings it can
currently draw.

Under that meaning, all three scenes now agree:

| roof | before | after |
|---|---|---|
| villa `roof-main` | 0.4 declared, 0.4 drawn | unchanged — it was already right |
| greenhollow `roof-greenhouse` | 0.15 declared, 0.3 drawn | declares 0.3; the drawing was deliberate and symmetric |
| elmsgate `roof-house` | 0.15 declared, **0.0 drawn** | footprint gains 0.15 of eave to street and yard, stays flush at the party walls; declares 0 |

**One thing this surfaced and did not fix**, because it is a `packages/schema`
change the brief reserves: `roof-covers-walls` passes `overhang` to
`boundsContain` as a *tolerance*, which loosens containment in the wrong
direction — it permits a roof **smaller** than its walls by that much. Under
this decision it should assert the footprint extends at least `overhang` beyond
the walls. Recorded in the decision and belongs to brief 27.

**5 — Looked at, in the viewport rather than a render.** This machine cannot
path-trace (brief 40's outcome has the detail), so the check was a viewport
screenshot of each scene. Villa: 260 instances, the six neighbours standing
clear of the trees, meadow and tile reading as themselves rather than as grey.

`npm run scenes` builds all three clean; `npm run check` clean, 267 tests.
