# Task 47 — The ground between the buildings is all lawn, and some of it is a path

## Context

Asked for directly: *"from the front gate you should have a path to the garage,
which is not grass. Same under the vine because if it rains you don't want to
have your shoes stuck in dirt."*

Greenhollow has two gravel ribbons — `alley` and `alley-garage` — and slabs
under the four buildings. **Everything else on a 32 × 62 m plot is lawn**,
including the ground people actually walk on.

Three specific failures, measured from the scene:

1. **The pergola is half on grass.** `pergola-vine` runs at x = 1.2, width 3.6,
   so it covers x ∈ [−0.6, 3.0]. The alley runs at x = 0, width 3.2, covering
   x ∈ [−1.6, 1.6]. The eastern **1.4 m** of the vine walk is lawn — and gravel
   is the wrong surface under a vine anyway: loose stone plus rain plus foot
   traffic pumps mud up through it.
2. **There is no pedestrian route to the front door.** The only way in is the
   car track. A visitor walks up the drive.
3. **No apron at the garage door, no threshold at the gate, and no path to the
   greenhouse or the kitchen garden** — all destinations, all reached across
   grass.

**The research, and it points somewhere specific.** Banat courtyards are
traditionally *"paved with brick and stone, for letting the earth breathe, and
not by cement, which brings dampness to the houses"*. That is not decoration:
it is a permeable-paving argument made two centuries before the term existed,
and it settles the material question for the courtyard. Gravel is correct for
the **car** track (cheap, permeable, and it does not migrate below about a 1:20
gradient, which a flat plot is) and wrong for the **walking** surface.

## Files you OWN

- `packages/schema/src/document.ts` — a paving entity in the context tier
- `packages/geometry/src/context/` — generating it
- `scenes/src/greenhollow.ts` — the layout
- the corresponding tests

## Files you must NOT touch

- `Roof`, `Slab`, `RoadNetwork` — paving is none of the three. A slab is a
  building's floor and is checked against the roof over it; a road is a ribbon
  from a centreline. Paving is a polygon on the ground.
- The two-tier decision. Paving is **context**: it is site, not building.

## What to do

1. **Add `context.paving`** — `{ id, polygon, material, thickness }`. Additive,
   so no schema version bump (see `decisions-scene.md`).
2. **Generate it** as a thin extruded polygon proud of the terrain, with the
   facing guard from brief 23 pointed at it — a downward-facing paving slab is
   invisible and is exactly the bug that file exists to catch.
3. **Lay out the ground properly**, and say what each surface is *for*:
   - the **courtyard** under the pergola, brick, the full width of the vine;
   - the **car track** to the garage, gravel, with an apron at the door;
   - a **footpath** to the front door that is not the drive;
   - a **garden path** to the greenhouse and the kitchen garden, narrower;
   - a **threshold** at the gate.
4. **Use real widths.** A single-car drive is 2.7–3.7 m; a footpath is
   0.9–1.2 m; a garden path can be narrower. A path the width of a road reads
   as a road.
5. **Keep the scatter off the paving.** Every paved area is an exclusion, or
   the forest grows through the courtyard.

## Acceptance

- Every surface a person walks on is paved, and the material fits the use.
- No instance is planted on paving.
- The facing guard passes on the new geometry.
- `npm run check` exits 0 and all three scenes build.

---

## Outcome — 2026-09-13

**1 — `context.paving`**: a polygon, a material and a thickness, in the context
tier. Not a slab (a slab is a building's floor and `roof-covers-walls` reads it)
and not a road (a ribbon swept from a centreline, which cannot describe a
courtyard with a corner off it). Additive, so no version bump.

`thickness` defaults to 40 mm and is capped at 0.5 m. Non-zero on purpose:
coplanar with the terrain is z-fighting, and a laid surface really does stand a
few centimetres above the earth beside it.

**2 — The facing guard earned its keep immediately.** `buildPaving` first read
`extrudePolygon(polygon, -thickness, thickness)` — which is the version that
*feels* right, because the surface is the thing being positioned. It buries the
paving: `extrudePolygon` puts the solid at `y ∈ [base, base + height]`, so that
lands the walking surface exactly coplanar with the lawn. The guard caught it
before it was ever looked at, which is the first time that file has caught a bug
in new work rather than in old.

The test had to be written differently from the road one, and the difference is
the point: paving is a thin **solid**, so `downwardFaces` correctly finds its
underside. The assertion that matters is about the face you walk on — every
triangle at the top of the box must point at the sky — plus the same check on a
polygon wound the other way round and on an L.

**3 — The gate became two gates, and that is the move the layout turns on.**

A single 4 m opening made the car and the person share one entrance, and
everything inside then fought for the same ground: either the drive swung around
the vine walk or the vine walk crossed the drive. The Banat answer — and the
central-European one generally — is the *poartă mare* and the *portiță*: a
carriage gate and a pedestrian wicket.

So the **wicket** sits on the house's own axis at x = 1.2, which is already the
front door's centreline and the vine's, and the **carriage gate** sits east at
x = 6.0, on the line a drive needs to reach a garage at x 7…14. **Neither route
crosses the other at any point between the road and its destination.** That is
the segregation the plot was missing, and it cost one extra opening in a wall
that already existed.

**4 — Two materials, split by use rather than by taste.**

| surface | material | why |
|---|---|---|
| courtyard, paths, aprons | **red clay pavers, herringbone** | Banat yards are paved *"with brick and stone, for letting the earth breathe, and not by cement, which brings dampness to the houses"* — a permeable-paving argument made long before the phrase existed, and a real constraint for a house with no damp course. Herringbone is not decoration: courses at 45° to travel spread a wheel load across neighbours instead of letting one paver rock, which is why it is the historic bond for a yard a cart uses. |
| car track | **gravel** | Cheap, drains, and stays put — loose stone migrates at about 1 in 20 and this plot is 1 in nothing. |

`ambientcg/PavingStones137`, which is tagged *red*, *herringbone* and *garden*.

**5 — Eight paved areas, each with a stated job.** The courtyard runs the full
3.6 m width of the vine and the full 18 m of its length, so there is nowhere
under the pergola where you step off brick — which was the whole complaint: a
covered walk over grass is a covered mud strip. Plus a threshold through the
wicket, an apron at the garage door (gravel migrates under a turning wheel and
comes indoors on your shoes), a 1.1 m link so someone getting out of the car
does not walk back down the drive, and paths to the porch, the greenhouse and
the kitchen beds.

Widths are what the use dictates: 3.0 m drive (a single car is 2.7–3.7), 1.1 m
paths. A path drawn at road width reads as a road.

**6 — `keepOff()` is given to every planting, not to the ones that overlap
today.** Exactly one field currently needs it. Move a bed or widen a path and
the next one would grow through the brick with nothing to say so. Brief 45's
clipping makes over-applying free: an exclusion outside a field contributes
nothing, and one that straddles the edge counts only where it overlaps.

**7 — A rule that had the same shape as brief 37's bug, found while doing
this.** Adding paving made `materials-are-used` report every paving material as
unused — so the new feature looked like the defect. The cause: `material-resolves`
and `materials-are-used` each walked the document's tiers by hand, so a new tier
had to be added in two places. They now share `materialReferences(doc)`, a
generator in `derive/`, and adding a tier is one edit.

**Looked at**, from the wicket and from above: the brick runs unbroken from the
gate to the front door under the vine, the gravel holds east of it to the garage
apron, and the two never touch.

`npm run check` clean, **400 tests**. All three scenes build.
