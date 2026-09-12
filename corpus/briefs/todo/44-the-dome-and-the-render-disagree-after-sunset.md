# Task 44 — After sunset the viewport shows dusk and the render comes back black

## Context

From the 2026-09-12 audit, round 3 (maths). A WYSIWYG break in exactly the hours
someone would reach for it.

`apps/web/src/engine/SandboxEngine.ts:202` positions the sun for the **real-time
viewport**:

```ts
this.sun.position.set(
  position.direction.x * distance,
  Math.max(1, position.direction.y * distance),   // clamped above the horizon
  position.direction.z * distance,
);
```

and line 215 feeds `sun.position.normalize()` into the `Sky` shader's
`sunPosition` uniform. But `buildSkyEnvironment` — which builds the **path
tracer's** environment map — receives the *unclamped* `position.direction`
(`SandboxEngine.ts:412`, `PathTracer.ts:233`).

So below the horizon the two disagree. At Bucharest, 2026-06-21 22:30 local,
`sunPosition` gives **altitude −11.61°**:

- The **dome** is handed a vector whose elevation is
  `asin(1 / hypot(x·120, 1, z·120))` ≈ **+0.49°**, so it paints a full sunset
  glow on the north-west horizon.
- `skyRadianceMap` sees `sun.y = sin(−11.61°) = −0.201`, so
  `day = clamp01(−0.201 × 2.2) = 0`, the `sun.y > 0` disc-and-glow branch never
  runs, and the environment is a **night sky**. `sunLighting.intensity` is 0 too.

Scrub the timeline past sunset, see dusk, press Render, get black. The comment at
`SandboxEngine.ts:398` promises the sun, the sky and the pixels all agree; below
the horizon they do not.

The clamp is harmless above the horizon — an altitude of 0.3° becomes 0.48° — and
wrong only below it. It exists because a directional light at or under `y = 0`
casts no useful shadows, which is a real problem and must not be reintroduced by
a careless fix.

## Files you OWN

- `apps/web/src/engine/SandboxEngine.ts`
- `apps/web/src/engine/PathTracer.ts` — only if the environment side is the fix
- `apps/web/test/`

## Files you must NOT touch

- `packages/solar` — `sunPosition` is correct and the audit verified its
  convention against `suncalc` explicitly. The bug is in what the engine does
  with a correct answer.

## What to do

1. **Separate the two things the clamp is doing.** It is protecting the *shadow
   light* from a degenerate direction, and it is incidentally lying to the *sky
   dome*. The dome should get the true direction; only the `DirectionalLight`
   needs the guard, and below the horizon the honest guard is to turn it **off**,
   not to lift it.
2. **Make night look like night in both paths.** Decide what the viewport should
   show after sunset and make the environment map agree — including the ambient
   term, so the viewport does not go pure black either.
3. **Test the disagreement directly**: for a sun below the horizon, assert that
   the dome's direction and the environment's direction are the same vector. That
   assertion is the whole brief; everything else is implementation.

## Acceptance

- At a post-sunset clock, the viewport and a render of the same shot agree.
- Shadows above the horizon are unchanged — check a low sun, ~1–3° altitude.
- `npm run check` exits 0.
