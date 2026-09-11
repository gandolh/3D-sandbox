# Task 03 — Solar time

## Context

The feature that makes this an architectural tool rather than a 3D viewer, and the
one that ties the whole stack together: solar time is a single scalar on the
document, so an animation-time tween over it *is* a sun-path study.

## Files you OWN

- `packages/solar/**`

## What to do

1. New workspace `@solstice/solar`, pinned `suncalc@2.0.2`.
2. Resolve a document's `site` + `solar` (date, local clock time, IANA timezone,
   latitude, longitude, `northOffset`) into sun **altitude** and **azimuth** in
   degrees, and into a unit direction vector in scene space.
3. Derive sky parameters — turbidity, sun position for `three/addons` `Sky` — and a
   sensible directional-light colour and intensity for the altitude.
4. Expose the sunrise/sunset/golden-hour bounds for the day, so the timeline can
   shade its daylight band from real values rather than a guess.

## Acceptance

- Given 44.4268 N, 26.1025 E, `Europe/Bucharest`, 2026-06-21 17:42, the resolved
  sun is **altitude 32.949°, azimuth 271.654°** (suncalc, refraction-corrected). These are the numbers the
  design artifact and the reference scene both use; they are the regression test.
- Timezone handling is correct across a DST boundary — test both sides of one.
- `northOffset` rotates azimuth in scene space without touching the true-north
  calculation.

---

## Outcome — 2026-09-11

Shipped. 22 new tests (83 across the repo).

**suncalc 2.0.2 is not the library the training data remembers.** Version 1.x
returned radians with azimuth measured from south; 2.x returns **degrees** with
azimuth already **north-based clockwise**. Writing the 1.x conversion would have
put the sun in the wrong quadrant while still producing plausible-looking numbers.
Its `getTimes` values are also nullable — above the polar circles there is no
sunrise to report — so `DayBounds` carries `alwaysUp`/`alwaysDown` and a test
pins Svalbard at the solstice.

**The canonical figures moved.** The design artifact and this brief both quoted
altitude 32.3° / azimuth 272.3°, computed by hand. suncalc — which corrects for
atmospheric refraction — gives **32.949° / 271.654°**. The hand figure was 0.6°
out. suncalc is now the authority, and the artifact, the reference scene and the
regression test all carry its numbers. The sun is still west-and-slightly-north,
so shadows still fall east and nothing drawn was wrong.

Timezone resolution is two-pass (guess the offset, re-read it at the corrected
instant), which is what makes times near a DST transition land correctly; there
are tests either side of the 2026-03-29 Bucharest boundary.

Deferred: the lighting model is a defensible starting point for the viewport, not
a photometric claim — the path tracer takes its real light from an HDRI.
