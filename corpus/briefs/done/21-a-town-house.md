# Task 21 — Elmsgate, a two-storey town house

## Context

Greenhollow is a free-standing house in the middle of a deep plot. Every spatial
assumption the document format has been tested against comes from it, and the
open question after the 2026-09-11 audit was whether the format *generalises* or
is quietly shaped like one smallholding.

The largest untested surface is not subtle: **`Subject.levels` is an array and no
scene has ever put two things in it.** Greenhollow is one storey, villa is one
storey, and that has been true since brief 01. Roofs have only ever been `gable`
or `flat`.

So the second scene is chosen to break those assumptions rather than to restate
them: a **terraced town house on a narrow urban lot** — party walls hard on both
boundaries, the front wall on the pavement, two storeys, a small walled rear
yard. It inverts the plot (shallow and narrow, not deep and open), the setback
(zero, not 22 m), the massing (stacked, not spread), and the boundary condition
(shared structure, not hedge).

**Nothing here is designed to justify a feature.** Hip roofs stay parked and
stairs stay unbuilt — this is a renderer, nothing walks between floors, and a
second storey does not need a stair to be rendered. If the scene turns out to
want either, that is a finding and gets its own brief.

## Files you OWN

- `scenes/src/elmsgate.ts` — new.
- `scenes/elmsgate.scene.json` — generated; do not hand-edit.
- `apps/web/src/scenes.ts` — add the entry (brief 20 creates it).

## Files you must NOT touch

- `packages/geometry`, `packages/schema` — **not up front.** The point of the
  exercise is to find out what breaks. If something does, stop and write down
  what, then fix it as its own change with its own test, so the finding is on
  the record rather than absorbed silently into a scene commit.

## What to do

1. **The lot.** Roughly 6.5 m wide by 30 m deep, the front wall on the pavement
   at z = 0, the street to the south. Neighbours are `BuildingMass` context on
   both sides, touching — that is what makes it a terrace rather than a
   detached house on a thin plot.
2. **Two levels.** Ground at 0, first at ~3.0, each with its own walls and
   slabs. The first-floor slab is what proves a level above zero renders at all.
3. **Openings that read as a town house** — a door and a bay to the street, tall
   sashes above, glazed doors to the yard.
4. **A walled rear yard** — brick boundary walls, a small paved terrace, a tree.
5. **Shots that test what the scene is for**: a street elevation (which is the
   only way to see a terrace as a terrace), a rear-yard three-quarter, and an
   oblique down the street showing the party-wall junction. 600 samples,
   1920 × 1080, matching the measured budget.
6. **Record what broke.** A findings section in the outcome note, whether or not
   anything did. "Nothing broke" is a real result and the one worth having.

## Acceptance

- `npm run scenes` builds it: Zod parse and every lint rule clean.
- `npm run check` exits 0.
- One end-to-end: open it in the app, confirm two levels render with the upper
  storey where it belongs, and take one cheap screenshot — not a path trace.

---

## Outcome — 2026-09-11

Done. `scenes/src/elmsgate.ts` builds clean: 11 walls, 8 openings, 3 shots, two
levels, 32,611 triangles. **The document format generalised** — a two-storey
terrace on a 6.5 m lot needed no new entity type, and `Subject.levels` holding
two things worked the first time.

What did **not** work was found by looking at it. Four findings, in the order
they surfaced:

1. **`Run` built every fence as two rows of posts.** Correct for a pergola and a
   colonnade, which you walk through and whose `width` is a span; wrong for a
   fence, whose `width` is a thickness. A 0.07 m railing got a duplicate row
   70 mm away. `run-is-well-formed` had been *warning* about this — "narrower
   than its own posts" — and the honest reading of that warning was that the
   geometry was wrong, not the number. Fences now stand on one line with a top
   and a mid rail; the rule no longer applies to them. Greenhollow has no fence,
   which is why it never showed.

2. **`BuildingMass` could not declare a ridge bearing.** `Roof` could. So a
   context neighbour always fell back to the long-axis guess, and for a terrace
   that guess is wrong by ninety degrees: 6.5 m wide by 9.2 m deep puts the
   ridge front-to-back and presents a gable end to the street, while the
   subject's roof runs along the row. A terrace could never line up. Added as an
   optional field with `Roof`'s exact semantics — additive, so not a bump.

3. **Both gable builders wound the ridge-along-X branch backwards.** The slope
   normals came out `(0, −0.79, ±0.62)` — pointing *into* the building. The
   other branch is correct and nothing had ever asserted a direction, so this
   had been true since the roof builder was written. It is not an Elmsgate bug:
   **Greenhollow's `roof-house` and `roof-garage` both declare `ridgeBearing: 90`
   and have been inside out in every render of the reference scene.** Found
   because Elmsgate's roof rendered solid black and the cause had to be chased;
   confirmed headlessly by measuring the normals, fixed in `subject/roofs.ts`
   and `context/masses.ts`, and pinned by a test over all four bearings plus the
   undeclared case.

4. **An upper floor's slab z-fights through the facade.** A slab drawn on the
   wall centrelines puts its own edge exactly in the plane of the outside wall,
   and the two fight as a stripe across the whole elevation. Ground slabs never
   showed it because they sit below grade — it took a storey above ground. Fixed
   in the scene by insetting to the walls' inner face, which is where a floor
   actually stops. Not a code change: the document was wrong, not the generator.

The one thing the brief predicted and got right: stairs were not needed. Nothing
walks between the floors.
