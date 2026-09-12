# Task 46 — Give the house a plan a real architect would draw

## Context

Asked for directly on 2026-09-12: research American and European domestic
architecture, and make Greenhollow's house respect what those traditions
actually do — with a **big living room and fireplace, a kitchen, a bathroom and
three bedrooms**.

The house was four external walls around an empty 11 × 10 m box. It had windows
and two doors and nothing else: no partitions, no rooms, no hearth. Every
interior shot was of a shed.

## What the research said

Two traditions, consulted because the brief named both, and they converge:

**The Banat village house.** Greenhollow's site is 45.75 N, 21.21 E — Timișoara.
The regional type is a linear plan organised around the *tindă*, an entry hall
that reaches every room and the attic, with a *prispă* — a covered veranda —
down the long flank, and the **gable end presented to the street**. The stove
sits against an internal wall and the bed goes beside it, in the warmest part of
the room.

**The American Foursquare.** Four rooms per floor around a central core, 24–30
by 26–32 ft. Different century, different continent, same move: on a squarish
plan, a central hall is the shortest circulation that still gives every room two
external walls.

**Hearth placement** is not a matter of taste. A flue inside the envelope keeps
its mass in the house, drafts better for staying warm, and penetrates the roof
near the ridge where the flashing is simplest. A stack strapped to a gable is a
later convenience.

## What was done

**The footprint grew, because the brief demanded it.** A 98 m² interior cannot
hold a big living room, a kitchen, a bathroom and three bedrooms — the
arithmetic runs out at two bedrooms, and every arrangement that fits three makes
the living room 25 m², which is not "big". So the house went from 11 × 10 to
**11 × 12 m**, southward, the only direction free: the porch holds the west, the
garage the east, the kitchen garden and pond the north. Interior 118.6 m².

The plan is a **central hall type** — the *tindă* and the Foursquare core
arriving at the same answer:

| room | clear size | area |
|---|---|---|
| Living room, with the hearth | 7.2 × 4.3 | 31.0 m² |
| Bedroom 3 (master, north-east) | 3.2 × 4.3 | 13.8 m² |
| Hall / *tindă* | 1.8 × 7.1 | 12.8 m² |
| Bedroom 1 (south-west) | 4.6 × 3.6 | 16.6 m² |
| Bedroom 2 (west) | 4.6 × 3.5 | 16.1 m² |
| Kitchen (south-east) | 4.0 × 4.0 | 16.0 m² |
| Bathroom (east) | 4.0 × 3.1 | 12.4 m² |
| | | **118.7 m²** |

- **Served and servant.** Kitchen and bathroom are stacked on the east, back to
  back across one wall, so the plumbing is a single run rather than two.
- **The living room takes the north gable** — the pond, the orchard and the
  evening are there — with a door onto the terrace and a second door straight
  off the porch, which is the move the *prispă* type is built around.
- **Bedrooms** take the quiet west flank and the north-east corner. None is
  entered through another; that is what the hall is for, and a test asserts it.
- **The chimney** is a 1.4 × 0.7 masonry stack carried to 8.4 m, placed
  *internally* on the living room's south wall a metre off the ridge, back to
  back with the hall so one mass warms both.

**Fenestration follows the plan, not the elevation.** The front door is not
centred on the street gable — it lands on the hall, which sits east of centre —
and the living-room windows are spaced about the living room's own centre. A
front symmetric about a room it does not contain is the commonest tell of a plan
drawn elevation-first. The bathroom gets a small high window; the kitchen a wide
one where a sink goes; the garden gable gets everything oversized.

### The ridge was turned, and the comment had been right all along

`roof-house` carried `ridgeBearing: 90` under a comment reading *"Ridge runs
east–west, so the gable ends face the road and the garden and the long eaves
shelter the porch side."* Bearing 90 is a ridge running east–west, which puts
the gables over the **porch and the alley** and the eaves over the road and the
garden — the exact opposite of the sentence above it. The drawing had
contradicted its own description since it was written.

`0` is both what the comment meant and what the type wants: gable to the street,
eaves down the long flanks, and **an eave over the porch** — a gable there would
shed its water down the veranda's open edge.

### What was not faked

Poly Haven has no fireplace, no stove and no bed. The firebox and the three
bedrooms are therefore unfurnished rather than filled with proxies — the same
call the pond's absent fountain got. The living room's hearth end has two
armchairs and a table turned to face the chimney breast, because a masonry mass
with nothing addressing it reads as a pier, not a fireplace.

## Consequences

- Four shot cameras re-aimed; `approach` now sits on the pergola's new
  centreline at x = 1.2 and targets the gable at z = 20 instead of a point three
  metres inside the living room.
- The pergola and its bench moved 1.2 m east to meet the door.
- 13 walls → 22, 13 openings → 23.

## Acceptance

- `npm run scenes` builds all three clean; `npm run check` clean, 270 tests.
- Three tests pin the plan: the chimney clears the ridge (and by less than
  1.5 m), every room has its own door off the hall, and partitions are thinner
  than the envelope.

## Outcome — 2026-09-12

Done as described. The chimney test is the one that earns its place: there is no
chimney primitive, so the stack's height is a literal that must agree with a
roof height nothing computes for it. Change the width, the pitch or the eave and
the stack ends up *inside* the roof — still rendered, still lit, and wrong in a
way no bounding box or triangle count would show. Measured: ridge 7.688 m, stack
8.4 m, clearance 0.71 m.

Looked at in the viewport rather than rendered — this machine cannot path-trace
(brief 40).
