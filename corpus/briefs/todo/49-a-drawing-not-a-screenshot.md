# Task 49 — There is no plan drawing, and a top-down screenshot is not one

## Context

Asked for: *"windows, doors, top view of the rooms"*, and for the house to look
*"like coming from a specialized architecture app/tool"*.

The app can only produce a perspective of shaded solids. Pointing the camera
straight down would give a **roof**, and hiding the roof would give a picture of
wall tops — neither is a floor plan. A floor plan is a **horizontal section**,
conventionally cut about 1.2 m above the floor, drawn with a specific graphic
language that this project produces none of:

| convention | what it means | present? |
|---|---|---|
| poché | cut walls filled solid | no |
| line-weight hierarchy | cut heaviest, surface lightest | no |
| door swing arc | which way it opens, and the clear width | no |
| window symbol | frame and glazing in the reveal | no |
| room label | name + area to inner faces | no (brief 48) |
| dimension strings | the numbers the plan is *for* | no |

**The line weights are a standard, not a preference.** ISO 128-2 draws from
0.18 / 0.25 / 0.35 / 0.5 / 0.7 mm, and the rule is a four-step hierarchy:
heaviest for what the section cuts, medium for what is seen but not cut, light
for surface and material, faintest for hatching and dimensions — with at least
2:1 between thick and thin. That hierarchy *is* the thing that makes a drawing
read as a drawing.

The document already holds everything needed: walls with thickness, openings
with offset, width, height and sill, and — after brief 48 — named rooms.

## Files you OWN

- a new `packages/drawing/` (or equivalent) producing SVG from a `SceneDocument`
- `apps/web/src/ui/` — showing it
- the corresponding tests

## Files you must NOT touch

- `packages/geometry` — this is not a three.js job. A plan is 2D vector output
  and must be generatable **headlessly**, without a GPU, which is the same
  reason `skyRadianceMap` is pure arithmetic.

## What to do

1. **Cut a section, do not project a view.** Walls crossing the cut plane are
   poché; anything below it is drawn light; anything above (a beam, the roof
   edge) is dashed if drawn at all.
2. **Draw the openings as symbols.** A door is a gap, a leaf line and a 90°
   swing arc struck from the hinge — the arc is what tells a reader the clear
   width and which way the door goes. A window is the reveal with frame and
   glazing lines across it.
3. **Label every room** with its name and derived area, placed inside its own
   polygon and not overlapping a wall.
4. **Dimension the plan** — at minimum an overall string per side.
5. **Use the ISO line weights** and say in a comment which weight means what,
   so the next person changing one knows what it is for.
6. **Scale honestly.** Output at a real scale (1:100 or 1:50) with a scale bar
   and a north point, both of which the document can supply — `site.northOffset`
   already exists.

## Acceptance

- Greenhollow's ground floor renders as a plan a builder could read.
- Every door shows a swing; every window shows a reveal.
- Room names and areas are present and legible.
- Generated headlessly, in a test, with no GPU.
- `npm run check` exits 0.
