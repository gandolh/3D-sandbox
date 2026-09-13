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
