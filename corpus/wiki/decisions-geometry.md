---
summary: Locked calls about how wall geometry is built and cached — the per-wall geometry cache and its whole-value key, and mitred wall ends where walls meet (2026-11-03). Read before changing walls.ts, the cache or the collider.
updated: 2026-11-03
---

# Decisions: wall geometry

Split from [decisions.md](decisions.md) on 2026-11-03, when that page passed
200 lines. Same rules: each entry is hard to reverse, surprising without
context, and a real trade-off.

## Derived geometry may be *cached*, but only per-wall and only by whole-value key
_2026-09-13_ — `GeometryCache` keeps wall geometry between generations. The key
is `JSON.stringify` of the entire `Wall` plus the two `Level` fields
`buildWall` reads, and callers always receive a **clone**.
Rejected: caching every entity kind; keying on object identity; keying on a
hand-listed set of fields.
**Why**: the generator still rebuilds the whole document on every revision, and
that stays — regenerating everything is what makes it impossible for the scene
graph to disagree with the document. What changed is that after the 2026-09-13 edit-path
fixes the remaining cost became *concentrated*: **23 of Greenhollow's 28 ms is
wall CSG**, 82 %, across the 11 walls that carry openings. Runs are 1.5 ms and
roofs 0.3 ms, so caching those would add a class of bug for a rounding error.

The key is the whole value and not a field list because a hand-written list is
exactly what went stale in the physics cache (2026-09-12) — add a property to `Wall` tomorrow and it
participates without anyone remembering. It costs 0.02 ms for 23 walls against
20 ms of CSG. Identity was rejected outright: `editDocument` structured-clones
the document, so every entity has a new identity after every edit and an
identity key would never hit.

Cloning on the way out is not an optimisation detail but the thing that makes
it safe: the generated scene disposes what it owns, and handing out the cached
object would let one generation's teardown blank the next one's walls.

- *Consequence*: measured 30.0 ms → **5.8 ms** for a one-wall edit on
  Greenhollow. End to end in the browser the edit's longest task is 61 ms, so
  the remainder is GPU upload and React — different problems.
- *Consequence*: the cache is bounded (256 entries, oldest evicted and
  disposed). A long session visits a new key on every nudge of every wall.
- *Consequence*: `SandboxEngine` owns and frees it, because it outlives every
  generated scene by design and nothing else would.

## Wall ends are mitred where walls meet
_2026-11-03_ — in a grill with the owner. Where two walls share an end, each
wall's end is cut along the bisector of the corner, in the mesh, the collider
and the plan drawing alike. That ends the square notch at every outside corner
(todo of 2026-10-27).
Rejected: extending each wall by half the thickness of the wall it meets.
**Why**: the extension is right only at 90°. The scenes' 38 walls are all at
0° or 90°, but the Wall tool snaps to 15° steps and allows free angles, so the
cheap fix would leave the notch, or an overshoot, on exactly the corners people
draw by hand. The cost: building a wall needs to know which walls share each of
its ends, so the per-wall geometry cache's key has to include those neighbours,
and every scene's geometry, plan snapshots and renders change once.
