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
