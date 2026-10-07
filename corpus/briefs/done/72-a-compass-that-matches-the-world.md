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

---

## Outcome (2026-10-07)

Shipped in `c739a96`. North is −Z and east is +X. `directionFrom` and
`wallBearing` share the convention, a solar test holds them together, and the
three scenes are mirrored in `scenes/src/*.ts` and rebuilt.

**Three more places carried the old sign**, and changed with it. The plan
drawing negated z and drew door swings to the old "left". The inspector's
`setWallBearing` is `wallBearing`'s inverse. `rect()` now starts at the
south-west corner, so `wallsFromFootprint` still numbers W-01 as the south
wall. The path tracer, the physics cache and the viewport carry no copy: they
read the sun vector and the document's coordinates.

**Two departures from the brief's recipe, both to keep the scenes the same.**

- *Point order is kept.* Nothing in 3D reads winding: `ExtrudeGeometry`
  handles either, roofs and colliders use bounds, and roads use each segment's
  own left. The one reader was the plan's door swing, fixed at the source.
  Reversing would have swapped W-02 and W-04, moved every opening to the other
  end of its wall, and turned every bearing by 180°.
- *Yaw becomes 180° − θ, not −θ.* Measured on the glTF, `ArmChair_01` and
  `painted_wooden_bench` are symmetric left to right but not front to back, so
  a model's mirror image across the X axis is the model turned half a turn.
  The armchair faces +Z, and −θ would have turned the hearth chairs away from
  the chimney.

**Scatter.** Anchored at `minZ`, the samplers drew a fresh forest after the
mirror, with a tree in front of villa's `sw-threequarter` camera. They now start
at the south edge (`maxZ`) and yaw by 180° − θ. All six fields reproduce their
old 296 instances exactly, mirrored.

**How the mirror was proven.**

- The rebuilt JSON equals the old JSON mirrored by script (z → −z, yaw →
  180° − θ), to 1e-9, for all three scenes.
- All 38 walls give the same `wallBearing` as before.
- At every scene time, the sun's new direction is the old one with z negated.
- Every level's plan SVG is byte-identical before and after.
- Renders, on the GPU via [running-on-a-gpu.md](../../wiki/running-on-a-gpu.md):
  villa `sw-threequarter` at 17:42, elmsgate `row-oblique` at 11:30, greenhollow
  `overview` at 17:20, each 960 × 540 at 64 samples. A mirrored scene seen by a
  mirrored camera is the mirrored picture, so each after image is compared with
  its before image flipped left to right. RMS over 8 × 8 blocks: 10.9, 3.5 and
  3.9, against a noise floor of 5.7, 3.1 and 1.6 (two before renders), and 50 to
  66 unflipped. The excess is in the trees. Every shadow lands on the same
  facade: villa's west wall lit with its shadow thrown east, elmsgate's street
  front lit, greenhollow's house and garage shadows where they were.

**Asymmetric placements.** Moved and turned, not mirrored: `table-terrace`
(elmsgate) and `table-garden` (greenhollow), both
`outdoor_table_chair_set_01`, which is symmetric on neither axis. The planter
boxes are symmetric to within a centimetre. Scattered `tree_small_02` and
`shrub_01` to `04` stand where their mirrors stood but show their unmirrored
selves.

**The renders now show the world the right way round.** Before, a camera
facing north had west on its right. Greenhollow's overview comment ("garage
right, porch and greenhouse left") was false in the old render and is true
now. The garden shot's "greenhouse to the left" now says right.

**Left as they were.** The pergola's vine is drawn across the run in its own
frame, so its leaves come out reflected about the centreline: same spread,
different leaves. Two scene comments name the wrong side, before the mirror as
well as after: villa's "W-01 faces the street" (W-03 does), and greenhollow's
porch posts on "its open west and south edges" (the second leg is the north
edge).
