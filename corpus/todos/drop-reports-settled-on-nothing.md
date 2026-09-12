---
title: A drop reports "settled on nothing" when it settled on a slab
created: 2026-09-12
status: open
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
