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
  sun is **altitude ≈ 32.3°, azimuth ≈ 272.3°** (±0.3°). These are the numbers the
  design artifact and the reference scene both use; they are the regression test.
- Timezone handling is correct across a DST boundary — test both sides of one.
- `northOffset` rotates azimuth in scene space without touching the true-north
  calculation.
