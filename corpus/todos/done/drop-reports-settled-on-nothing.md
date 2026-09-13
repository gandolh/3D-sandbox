---
title: A drop reports "settled on nothing" when it settled on a slab
created: 2026-09-12
status: done
tags: [physics, viewport]
---

# A drop reports "settled on nothing" when it settled on a slab

Dropping `chair-hearth-w` in Greenhollow moves the placement and comes to rest,
but the status line reads `chair-hearth-w settled on nothing after 38 steps` —
`restingOn` is `null` even though the chair is standing on the ground floor's
slab.

## Context

Noticed while walking brief 25's deferred Rapier import in a browser. Unrelated
to that change: the drop itself works, and the same message appears on the
second drop with the engine already loaded.

`dropToRest` returns `restingOn` from the contact it finds; either the contact
is not being attributed to a document entity, or the chair is resting on
something the mapping does not name. `deriveColliders` gives slabs
`id: "slab:<id>"` and `entity: <id>`, so the name exists to be reported.

## Acceptance

A drop onto a slab, a wall or another placement names that entity; a drop onto
the terrain says terrain. "Nothing" should mean the object never came to rest.

---

## Done — 2026-09-13

**One ray, from the middle.** `surfaceBelow` cast a single downward ray from
the box's centre, so it could only ever find what was under the box's *middle*
— and a box does not have to rest on its middle. Anything holding up a corner
was invisible, and the drop reported "settled on nothing" while sitting
perfectly still on something.

It probes the **footprint** now: the centre plus the four corners, inset 20 mm
so an edge ray does not skim past. All five share one origin height, so the
smallest time-of-impact is the highest surface — which is what the box is
actually resting on.

**Why it showed up in a real scene and not a contrived one.** Placement
colliders carry a `rotationY`, and a rotated box has a wider footprint than its
own sides: Greenhollow's armchairs are 0.78 × 0.83 but turned 152°, so they
occupy about **1.08 m** across — 38 % more. At 1.05 m from the coffee table
that looked like clearance and was not.

**Which means the fix immediately reported a second, real fault**: with the
probe working, `table-hearth` came back as *"settled on chair-hearth-e"*. It
was true — the table was resting on a chair arm. The chairs are 1.45 m either
side now, and the whole group reports `slab-house`.

The original symptom is gone at the original call site: dropping
`chair-hearth-w` in the browser reads **"chair-hearth-w settled on slab-house
after 43 steps"**.

Three tests, in `packages/physics/test/world.test.ts`: a box supported only at
a corner names its support and snaps to it; a box that clears entirely still
reports the floor; and a box bridging two supports of different heights names
the taller. Plus one that pins the rotated-footprint arithmetic, since that is
the part that made this a scene bug rather than a theoretical one.
