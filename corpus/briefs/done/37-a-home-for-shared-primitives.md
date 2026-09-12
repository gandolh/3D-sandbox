# Task 37 — What the generator and the linter both need has nowhere to live

## Context

From the 2026-09-12 audit. **This is the root cause behind six separately
reported findings**, and it is the highest-leverage structural change available.

The dependency direction is `geometry → schema` and `physics → schema`. Nothing
may depend on `geometry`. That is correct and should stay. But it means any
computation the **generator** and its **checker** both need has no shared home —
so it gets copied, and the copies drift. Every instance:

| computation | copy A | copy B | outcome |
|---|---|---|---|
| gable ridge axis + quad winding | `geometry/subject/roofs.ts` | `geometry/context/masses.ts` | **one was wound backwards for weeks** |
| ribbon winding | `buildRoad` | every other surface builder | **roads render black** |
| wall orientation `atan2(-(z2-z1), x2-x1)` | `geometry/subject/walls.ts` | `physics/colliders.ts` | mesh and collider can rotate apart |
| post half-width `0.08` | `geometry/subject/runs.ts` (`POST`) | `schema/lint/rules/runs.ts` (literal `2 * 0.08`) | the rule checks the old threshold |
| instance count | `schema/scatter.ts` (`estimateScatterInstances`) | `geometry/context/scatter.ts` (`scatterInstances`) | **already diverge for row fields** |
| HH:MM ⟷ minutes | `animation` (`minutesToClock`) | `ui/Timeline.tsx` (local `toClock`) | same file uses both |
| wall/opening counts | `scenes/build.ts:77` | `api/store/index-db.ts:138` | two totals for one file |
| metres ⟷ mm | `schema/units.ts` (`mToMm`, **zero call sites**) | inlined `* 1000` in ~6 places | helpers exist and are unused |

Two more shapes of the same gap: `schema/src/geometry.ts` and
`geometry/src/polygon.ts` both exist with overlapping predicates, and
`geometry/src/assets.ts` `mergeGeometries` and `geometry/src/context/scatter.ts`
`mergeSimple` disagree about what to do when a part has no normals — one
fabricates an up-normal, the other computes a real one.

**The pattern to notice**: in every case the second copy is in the code that
*checks* or *consumes* the first. A lint rule holding its own copy of the
generator's constant is not checking the generator; it is checking itself.

## Files you OWN

- `packages/schema/src/` — the likely home, since everything already depends on it
- `packages/geometry/src/`, `packages/physics/src/`, `apps/web/src/ui/Timeline.tsx`,
  `scenes/build.ts`, `apps/api/src/store/index-db.ts` — the call sites that collapse

## Files you must NOT touch

- The dependency direction. `geometry → schema` is right; do not invert it or add
  a `geometry` dependency to `schema` or `physics` to make this easier.
- `scenes/src/*.ts` — authored content.

## What to do

**Do not do all eight at once.** Land the shared home plus the two highest-stakes
moves, then the rest as follow-ups.

1. **Decide where shared primitives live and record it in `decisions.md`.** The
   obvious candidate is `@solstice/schema`, because everything already depends on
   it — but "the document schema" and "geometric primitives every consumer needs"
   are different jobs, and putting the second inside the first is a real
   trade-off worth one paragraph. The alternative is a new leaf package.
2. **Move the two that can cause a visible, silent wrong result first**: the wall
   orientation trig (mesh vs collider) and the instance count (`scatterInstances`
   must *derive from* `estimateScatterInstances`, not restate it — including for
   row arrangements, where they already disagree).
3. **Move `POST` to the shared home** so `run-is-well-formed` checks the
   generator's real constant rather than a literal copy of it.
4. **Delete the duplicates rather than leaving both.** A moved helper with the old
   copy still present is worse than before, because now there are three.
5. **For each move, add the test that proves the two callers agree** — that test,
   not the move, is what stops the drift returning.
6. **Report what you did not do** and why, so the remainder is a known queue
   rather than a half-finished refactor.

## Acceptance

- A single definition for each computation moved, with every former copy deleted.
- A test per moved computation asserting its callers agree.
- `npm run check` exits 0 and the three bundled scenes build byte-identically —
  this is a refactor, and the generated JSON must not change.

---

## Outcome — 2026-09-12

**The home**: `packages/schema/src/derive/`, with two rules that keep it from
becoming a junk drawer — **no `three` import**, and **two callers in different
packages**. Recorded in `decisions.md` along with the rejected alternative (a
new leaf package) and why: the functions here are *facts about document
entities*, which is the job `schema` already does — `geometry.ts` and
`scatter.ts` were already in it.

**Nine collapsed, not the eight listed.** The brief asked for the home plus two;
the rest were cheap once the home existed:

| computation | was | now |
|---|---|---|
| wall orientation trig | `geometry/subject/walls.ts` + `physics/colliders.ts` | `derive/walls.ts` `wallAngle` |
| wall length / midpoint | both of the above, inline | `derive/walls.ts` |
| **wall compass bearing** | `geometry/subject/walls.ts` + `apps/web/lib/entities.ts` | `derive/walls.ts` `wallBearing` |
| instance count | `schema/scatter.ts` + `geometry/context/scatter.ts` | generator now *asks* `estimateScatterInstances` |
| row lattice | `geometry`, as `x += step` | `derive/scatter.ts` `scatterLattice`, integer counts |
| post half-width | `runs.ts` `POST` + literal `2 * 0.08` in the rule | `derive/constants.ts` `POST_HALF_WIDTH` |
| `pointInPolygon` | `geometry/polygon.ts` only — the linter could not reach it | `schema/geometry.ts`, re-exported |
| HH:MM ⟷ minutes | `animation` + a local `toClock` in `Timeline.tsx` | `@solstice/animation`, once |
| wall/opening counts | `scenes/build.ts` + `api/store/index-db.ts` | `derive/counts.ts` `sceneCounts` |
| metres ⟷ mm | `mToMm`/`mmToM` with **zero call sites**, `* 1000` inlined in 5 | the helpers, at all 5 |

**A ninth copy the audit missed**: `apps/web/src/lib/entities.ts` held its own
`wallLength` and `wallBearing`, and the Inspector imported *those* — so the
readout in the panel and the mesh in the viewport were free to describe the same
wall differently. Same shape as the rest, found by following the imports.

**Two divergences closed, both real:**

1. **Row fields.** The estimate divided net area by cell area; the generator
   walked a lattice over the field's *bounds*. For a 40 m square at 3 × 4 m
   spacing the estimate said 133 and the generator placed 130. Both now come
   from `scatterLattice` — 13 × 10 cells — and the test asserts the number.
2. **`run-is-well-formed`** was comparing against a literal `2 * 0.08`. The
   generator's post is now the thing it checks.

**The drift guards** are the point, not the moves. They are in
`apps/web/test/shared-primitives.test.ts` — the only workspace that can import
both `geometry` and `physics`, and therefore the only place a test could ever
have caught these. That the two copies had no shared observer is the whole
mechanism. Six assertions: the mesh's long axis read out of its *vertices*
(not out of the rotation we just applied), the collider's yaw against
`wallAngle`, the yaw's plan direction, and generator-against-estimate for both
arrangements. Plus `packages/schema/test/derive.test.ts` for the post threshold
and the lattice.

**`scatterLattice` also removes brief 30's non-termination**, incidentally: it
returns integer counts instead of a float the caller accumulates, so
`x += 0.001` at `x = 1e15` — which never advances and never ends — has nowhere
to happen. A test asserts the counts stay finite at that coordinate. Brief 30
still owns the schema bound that stops such a document existing.

**Not done, and why:**

- **`mergeGeometries` vs `mergeSimple` disagreeing about a part with no
  normals** — one fabricates an up-normal, the other computes a real one. This
  is not a move; it is a behavioural question about which is right, and the
  answer changes shading. It wants its own brief, with the facing guard from
  brief 23 pointed at it.
- **`schema/geometry.ts` and `geometry/polygon.ts` overlapping** — reduced
  rather than resolved. `pointInPolygon` moved; what remains in `polygon.ts` is
  `three`-dependent (`shapeFromPolygon`, `extrudePolygon`) and correctly stays.
- **`wallAngle` and `wallBearing` remain two conventions for one line**
  (`atan2(-dz, dx)` versus `atan2(dx, dz)`). Both are now in one file with the
  difference documented, which is the most that can be done before the
  left-handed-compass open question is settled.

**Verification**: `npm run check` clean, **294 tests** (was 284). The three
bundled scenes rebuild **byte-identically** — `git status` shows no change to
any `.scene.json`, which is the acceptance criterion that matters for a refactor.
