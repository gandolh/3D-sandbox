# Task 72 — A compass that matches the world

## Context

From [open-questions.md](../../wiki/open-questions.md), raised by the
2026-09-12 audit and decided by the owner on 2026-10-06.

`packages/solar/src/index.ts` documents "+Z is north and +X is east". With +Y
up in a right-handed frame, that pair is a mirror image: for a physical ENU
frame `e × n = u`, but here `X × Y = e × u = −n`. Seen from above the scene's
sun sweeps counter-clockwise where the real one sweeps clockwise, and a site
plan transcribed from paper (x = east, z = north) is built as its mirror image.

The app is consistent with itself (`directionFrom` and `wallBearing` in
`packages/schema/src/derive/walls.ts` share the `atan2(x, z)` convention), so no
scene is wrong on its own terms. The owner chose to fix it anyway, **and to
mirror the three existing scenes so they look the same after the fix as
before.**

## Decision

Keep **+X = east** (so a paper plan transcribes as x = east without thinking)
and make **north −Z**, the right-handed choice with Y up. That is one sign, in
one place. Do not also flip east; changing both puts the mirror back.

## Files you OWN

- `packages/solar/src/index.ts`: `directionFrom` and its doc comment
- `packages/schema/src/derive/walls.ts`: `wallBearing` and the comment that
  explains the two conventions
- `scenes/src/*.ts` and the generated `scenes/*.scene.json` (elmsgate,
  greenhollow, villa-carpathia)
- Tests that pin a sun direction or a wall bearing
- `corpus/wiki/decisions.md`, `corpus/wiki/open-questions.md`, `corpus/CLAUDE.md`
  (the invariants line), `corpus/log.md`

## Files you must NOT touch

- The path tracer, the physics cache and the viewport, except where a test
  proves they carry their own copy of the convention. If one does, report it
  rather than silently patching a third place.

## What to do

1. Grep for every place the compass convention lives: `atan2(`, "north",
   "azimuth", `sceneAzimuth`, `bearing`. Brief 37 left one `wallBearing`; check
   nothing new has appeared since.
2. Change the convention so a sun in the west (azimuth 270°) still gives
   shadows that fall east, and a sun in the south at noon (northern
   hemisphere) gives shadows that fall towards −Z.
3. Mirror the three scenes across the X axis. Positions map `z → −z` and
   Y-axis rotations change sign. A field that already means a real-world
   compass bearing in degrees keeps its value: the mirror and the new
   convention cancel, which is the point. That includes `site.northOffset`
   (greenhollow 40°, elmsgate 12°, villa 0°): it stays as it is. Do it in
   `scenes/src/*.ts`, then rebuild the JSON with the scene build, never by
   hand-editing the JSON.

   Two traps. Mirroring a footprint or wall path reverses its winding, and
   brief 23 derives outward normals from winding, so reverse the point order
   of every closed footprint after mirroring or the walls face inward. And an
   asymmetric model (a placed asset) is not itself mirrored, only its position
   and rotation, so it will look like its unmirrored self. That is fine; say
   which placements it affects in the outcome.
4. Prove the mirror is right: render a fixed shot of each scene at a fixed
   time before and after, and compare. The images should match, with every
   shadow landing on the same façade it did before.
5. Record the decision in `decisions.md`, delete the entry from
   `open-questions.md`, and correct the convention in `corpus/CLAUDE.md`.

## Acceptance

- A unit test pins the four cardinal directions: azimuth 0/90/180/270 give
  −Z/+X/+Z/−X.
- Seen from above (+Y looking down, X to the right, north up the screen) the
  sun sweeps clockwise over a day.
- Each existing scene's before/after render matches, and `wallBearing` names
  the same façade for every wall it did before.
- `npm run check` exits 0.
