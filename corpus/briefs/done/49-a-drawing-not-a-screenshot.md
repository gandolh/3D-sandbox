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

---

## Outcome — 2026-09-13

**`packages/drawing`** — a new leaf package producing SVG from a
`SceneDocument`. No `three`, no DOM, no GPU: pure string building, for the same
reason `skyRadianceMap` is pure arithmetic. The payoff is that every convention
the drawing claims to follow can be **asserted** rather than eyeballed — a
screenshot cannot tell you whether a door has a swing arc.

**1 — A section, not a top view, and the tests prove the difference.** Walls are
cut at 1.2 m: above a sill, below a head, which is why that is the convention.
Two tests turn on it — at 1.2 m every door is a hole with jambs and a swing; at
2.5 m nothing is cut, so the doors become dashed thresholds and the swing count
drops to **zero**. A top view cannot make that distinction at all.

**2 — ISO 128-2 line weights**, four steps, 2:1 minimum between thickest and
thinnest, asserted in a test:

| mm | draws |
|---|---|
| 0.70 | what the section cuts |
| 0.35 | what is seen below it |
| 0.25 | door leaves, glazing |
| 0.18 | swing arcs, dimensions, hatching |

**The hierarchy inverted itself on the first render**, which is the kind of
thing only looking catches. At 1:100 a 120 mm partition is 1.2 mm on paper, and
a 0.7 mm stroke down each side leaves nothing between them — so partitions came
out solid black while 300 mm external walls came out grey with thin edges,
exactly backwards. The stroke is now capped at a third of the wall's drawn
width, which keeps poché visible at any thickness.

**3 — Door swings.** Struck from the hinge through 90°, with the SVG sweep flag
chosen from the sign of a cross product so the arc always takes the short way
round. The arc is the most information-dense mark on a plan: clear width, swing
direction, and what the door will foul — none of which a rectangle in a wall
carries. Ten doors, ten arcs, asserted against the document's own count.

**4 — Windows** are both reveals plus a glazing line, drawn at `seen` and
`symbol` weight rather than `cut`, because the wall is what the plane passes
through and the glass is what it sees.

**5 — Room labels** are name and derived area, from brief 48's `Room`. Eight
rooms, eight labels, each asserted by name.

**6 — Which building the plan is of took two attempts, and the first one was
wrong in an instructive way.** A level holds every wall on the site — house,
garage, greenhouse, and a 32 m boundary wall — so something has to choose.
Grouping by shared corners finds **envelopes**, and I shipped that first: it
drew the house as four blank walls and silently lost **six of its ten doors**,
because a partition shares a corner with nothing. `P-hall-w` runs from
(−0.6, 20.3) to (−0.6, 27.4) and neither end touches anything.

So it is two steps now: pick the envelope by **enclosed area** — which also
discards a boundary wall, a single straight run enclosing nothing — then adopt
every wall lying inside it. "A partition is a wall inside a building's
footprint" is a definition rather than a heuristic. There is a test for the
missing-doors case specifically.

**7 — Dimensions, scale bar, north point.** Overall strings in millimetres
(11300 × 12300), surveyor's 45° ticks rather than arrowheads, a 5 m scale bar so
the drawing survives being printed at the wrong size, and a north point that
**turns with `site.northOffset`** — Greenhollow's plot is 40° off the compass
and the arrow says so. A north point that ignores the site's own rotation is
worse than none.

The arrow was redrawn once: a kite carries more ink in its tail than its tip, so
the eye reads it as pointing the wrong way. It is a shaft with a solid head now,
and the head is the only filled part.

**8 — In the app**, as a `PLAN` toggle. `planSvg` is a pure function of the
document, so `PlanView` is a `useMemo` and nothing else — no canvas, no engine,
no lifecycle. The viewport stays **mounted underneath** rather than being
swapped out: unmounting it disposes the engine, the WebGL context and every
loaded asset, so toggling twice would cost a full scene reload.

White sheet in both themes, deliberately. Darkroom is locked for the chrome
because a render cannot be judged against a light surround — but a *drawing* is
a black-on-white document, and inverting it would make it a diagram of a plan
rather than a plan.

`npm run check` clean, **426 tests** (was 412).
