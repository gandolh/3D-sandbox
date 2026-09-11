# Task 07 — Physics as an authoring aid

## Context

The last of the agreed sequence. [decisions.md](../../wiki/decisions.md) settled
that physics is an **authoring aid, not a simulation feature**: rapier runs while
you edit so placement is physical — drop a chair and it settles on the floor,
objects cannot be pushed through a wall — and nothing about it is persisted.

The reason this is cheap is the same reason the document is parametric: **a wall
*is* a box**, so colliders fall out of the semantics for free. Deriving them from
arbitrary CSG output would have been a different project.

## Files you OWN

- `packages/physics/**`
- `packages/geometry/src/index.ts` (placements are currently generated as nothing)
- `scenes/src/villa-carpathia.ts`, `apps/web/src/**`

## What to do

1. New workspace `@solstice/physics`, pinned `@dimforge/rapier3d-compat@0.20.0`.
2. **Derive colliders from the document**, as a pure function returning plain
   descriptors before rapier is involved — so the derivation is testable without
   a physics engine, and the engine is testable against known descriptors.
3. **Cut openings out of wall colliders.** A wall with a door should let a chair
   through the doorway. This is the semantic advantage the parametric document
   was chosen for; a single box per wall throws it away.
4. `dropToRest` — settle a shape under gravity and report where it came to rest
   and what it landed on. `overlaps` — would a shape at this transform
   interpenetrate anything.
5. **Placements currently generate no geometry at all** — the generator silently
   ignores them. Give them proxy boxes so there is something to place, and put a
   few in the reference scene.
6. Viewport: a collider overlay so derived colliders are visible, and a drop
   action for a selected placement.

## Acceptance

- `npm run check` passes.
- Headless rapier tests: a box dropped above the floor rests on it; a box dropped
  where a wall stands rests on the wall; dropping through a doorway reaches the
  floor, and dropping against the wall beside it does not.
- Collider derivation is tested without instantiating rapier.
- Nothing physics-related is written to a scene document.

---

## Outcome — 2026-09-11

Shipped. 31 new tests (163 across the repo), all headless — `@dimforge/rapier3d-compat`
runs in Node, so the whole physics layer is tested without a browser.

**Openings are cut out of wall colliders**, which is the point of the brief. A
wall with a door becomes solid spans either side plus a lintel above; a window
also gets a spandrel below. One box per wall would have been simpler and would
have made a doorway impassable — and the reason this is arithmetic rather than
geometry is that openings are already positioned along their wall by offset. This
is the semantic document paying for itself.

Tests prove the distinction rather than assert it: a box dropped in the doorway
reaches the floor, the same box dropped a metre to the side is stopped by the
wall, and dropped directly above the door it is stopped by the lintel.

Three things found while building it:

- **Ray probes must run after the dropped body is removed.** A downward ray from
  just inside the box's own underside hits the box at time-of-impact zero, so
  "what did it land on" was always `null`.
- **A floor slab and the ground it sits on are coplanar by construction** — both
  top out at the level's finished floor — so the first ray hit is whichever the
  broad phase happened to return. All hits are gathered and a named entity wins
  over the terrain: "it landed on slab-ground" is useful, "it landed on terrain"
  is merely also true.
- **Rapier lets a settled body sink a centimetre or two** into what it rests on.
  Correct for a solver, wrong for an authoring aid — a chair placed on the floor
  should be *on* the floor. Resting positions are now snapped to the surface the
  probe found, and a test pins the box to exactly its own half-height.

Also fixed: **the generator was silently producing nothing for placements.** They
now get proxy boxes, and the reference scene has three, deliberately floating so
the drop aid has something to do.

The viewport gained a collider overlay — worth seeing rather than trusting, since
a wall whose mesh has an opening but whose collider does not is exactly the kind
of divergence nobody notices until something falls through it.

Deferred: no continuous simulation (the "play" mode remains out of scope by
decision); colliders derive only static geometry, so placements do not collide
with each other; slab colliders use polygon bounds, which over-covers an L-shaped
floor by a corner.
