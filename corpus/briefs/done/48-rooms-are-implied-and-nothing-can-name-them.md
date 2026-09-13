# Task 48 — The plan has rooms; the document does not

## Context

Asked for: *"top view of the rooms"*, and *"rationalize and think about space
management and segregation of areas"*.

Brief 46 gave Greenhollow's house a real plan — central hall, served/servant
zoning, three bedrooms, a big living room with a fireplace. **But the rooms
exist only as the negative space between partitions.** Nothing in the document
names them, nothing knows their area, and the constants that define them are
bare numbers in `scenes/src/greenhollow.ts`:

```ts
const BED_1_2 = 23.9;  // between the two west bedrooms
const WET = 24.3;      // kitchen | bathroom, the one plumbing wall
```

The consequences are concrete:

- **The schedule of areas is a comment.** Brief 46's outcome quotes "118.6 m²,
  and the schedule closes to 118.7" — worked out by hand, checked by nobody, and
  already only approximately true.
- **Nothing can check the programme.** The brief asked for three bedrooms, a
  bathroom, a kitchen and a big living room. A linter cannot tell whether the
  house still has them, because it cannot see a room.
- **Nothing can label a plan.** A top view without room names and areas is a
  diagram of walls, not a floor plan.
- **No rule can say a bedroom is too small**, or that a room has no window, or
  that the bathroom opens off the living room — the checks that make a plan
  *architecturally* rather than geometrically valid.

## Files you OWN

- `packages/schema/src/document.ts` — a room entity
- `packages/schema/src/lint/rules/` — a new rule file for habitability
- `packages/schema/src/derive/` — area and containment helpers if shared
- `scenes/src/greenhollow.ts`, `scenes/src/elmsgate.ts` — naming the rooms
- the corresponding tests

## Files you must NOT touch

- The partitions themselves. A room is a **claim about** the space walls make,
  not a replacement for the walls. Do not generate walls from rooms.

## What to do

1. **Add `Level.rooms`** — `{ id, name, use, polygon }`, where `use` is an enum
   (`living`, `bed`, `kitchen`, `bath`, `hall`, `store`, `utility`). The `use`
   is what makes a rule possible; a free-text name alone is unlintable.
2. **Derive the area** rather than storing it. A stored area is a second copy of
   the polygon and they will disagree — this repo has learned that four times.
3. **Lint what a plan must satisfy**, and pick checks that catch real mistakes:
   - a room's polygon must lie inside its level's external walls;
   - rooms must not overlap each other;
   - a habitable room (`living`, `bed`, `kitchen`) needs a window;
   - a bedroom below a floor area a person would call a bedroom is a warning.
4. **Name Greenhollow's rooms** to match the plan brief 46 drew, and let the
   linter confirm the programme — three bedrooms, a bathroom, a kitchen, a
   living room — rather than a comment claiming it.
5. **Report the schedule** from `npm run scenes`, so the areas are printed by
   the thing that computes them.

## Acceptance

- Greenhollow declares every room, and the printed schedule agrees with the
  footprint to within the wall thicknesses.
- A room outside the envelope, two overlapping rooms, and a windowless bedroom
  are each a finding.
- `npm run check` exits 0.

---

## Outcome — 2026-09-13

**1 — `Level.rooms`**: `{ id, name, use, polygon }`. `use` is an enum, and that
is what makes the rules possible — "Dormitor 2" tells a linter nothing,
`use: "bed"` tells it the space needs daylight and a plausible floor area. The
name is for the drawing; the use is for the checks.

**Area is derived, never stored.** `scheduleOfAreas` computes it from the
polygon. A stored area is a second copy of the outline and the two drift, which
this repo has now watched happen five times.

**2 — The room outlines are derived from the plan constants**, not transcribed
from them: `SPINE_W + PART`, `WET - PART`, and so on. Move `WET` and the kitchen
and the bathroom follow. Typing the outlines by hand would have made a second
copy of the plan — the exact thing brief 37 spent a day undoing.

**3 — It found a real bug in its first five minutes, and a bad one.**

The chimney stood from x −0.4 to 1.0 on the `DAY` line. `d-living` — the **only**
door into the living room — spans x −0.3 to 0.9 on that same line. The 1.4 m
masonry mass was built across **100 % of the 1.2 m door**. The living room had
no way in, and had not had one since brief 46 drew it.

Nothing caught it because nothing in the document knew there was a room on
either side of that wall. That is precisely what `Room` is for, and it is the
bug that found it while I was working out what the living room's polygon was.

The chimney moved west to x −3.6…−2.2, which keeps brief 46's own argument
intact — still on an **internal** wall (`P-day-w`), so the mass stays inside the
envelope where it gives its heat back, still penetrating near the ridge. The
hearth furniture moved with it, because a masonry mass with nothing facing it
reads as a pier.

**4 — The programme is now checked rather than claimed.** Brief 46's outcome
asserted *"118.6 m², and the schedule closes to 118.7"* — worked out by hand and
verified by nobody. The computed schedule, printed by `npm run scenes`:

| room | use | m² |
|---|---|---|
| Hall | hall | 12.1 |
| Bedroom 1 | bed | 17.3 |
| Bedroom 2 | bed | 15.9 |
| Kitchen | kitchen | 16.7 |
| Bathroom | bath | **7.3** |
| Larder | store | **4.4** |
| Living Room | living | 31.6 |
| Bedroom 3 | bed | 14.4 |
| | **total** | **119.7** |

The hand-worked figure was out by 1.6 m².

**5 — One room was rationalised, which is what the schedule was for.** The
servant side was a single **12.2 m² "bathroom"** — roughly twice what a bathroom
is — and the house had nowhere to keep food. A *cămară* is not a nicety in a
farmhouse with a kitchen garden and an orchard; it is where the year's produce
lives. Split **north–south rather than east–west** so both halves keep the east
external wall: a bathroom with no window and a larder with no ventilation are
each worse than the oversized room they replaced.

**6 — Four checks that the geometry cannot make**, all tested:

- a room outside the envelope is an **error**;
- two overlapping rooms are an **error**, measured on **net intersection area**
  rather than on bounding boxes — two interlocking L-shapes have overlapping
  bounds and share no floor, and there is a test for exactly that;
- a habitable room with no window is a **warning**;
- a room too small to be what it is called is a **warning**.

The window test walks each wall's openings and probes both faces, using the same
`wallAngle` the mesh and the collider use. It reaches 300 mm past the face
rather than a hair past it, because a room outline is drawn to the inner face by
*convention* and not by rule — a scene with a few centimetres of slack would
otherwise report every window as belonging to no room. The first version reached
50 mm and did exactly that; the test fixture caught it.

**7 — Brief 27's arming guard fired on schedule.** Registering
`rooms-are-habitable` failed the suite with *"no firing document for
'rooms-are-habitable' — add one to FIRES"*, a day after that mechanism was
built, on a rule it had never seen. That is the mechanism working exactly as
specified rather than in principle.

`npm run check` clean, **412 tests**.
