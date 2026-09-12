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

---

## Outcome — 2026-09-12

**1 — The clamp was doing two jobs and now does one.** `aimSun()` is the
directional light's guard and nothing else: it keeps `y ≥ 1` so the shadow
camera is not degenerate, and — the honest guard below the horizon — sets
`visible = false` rather than hoisting a light into a sky it has set behind.
The `Sky` shader's `sunPosition` gets the **true** direction.

Both the viewport and the render scene call `aimSun`, so the two cannot drift;
they used to build the light twice, which is how this class of bug arrives.

**2 — The test the brief said *is* the brief**, and it fails on the old code:
for a sun below the horizon, the dome's vector and the environment's vector
are the same vector to 12 decimal places. Around it, the measured symptom is
pinned rather than described — the clamp turned **−11.61° into +0.49°**, and a
test asserts exactly that of the light's own position, so it stays clear that
the clamp still exists and is simply no longer consulted by the dome.

The almanac is pinned separately (`altitude ≈ −11.61°` at Bucharest,
2026-06-21 22:30), so the rest of the file tests the engine rather than
`@solstice/solar` — which the audit had already verified against suncalc.

**3 — Night is night in both paths, and this needed a small split.** Below the
horizon three's `Sky` drives its entire result from
`sunIntensity(dot(sun, up))`, which is 0 there — so handing it the true
direction would have made the dome **black** while the environment map painted
a dim blue night. Two different disagreements is not a fix.

So `skyGradient(sunY, turbidity)` came out of `skyRadianceMap`: the dome colour
without building the dome. `skyRadianceMap` now calls it, and below the horizon
the viewport hides `Sky` and paints that gradient's zenith directly. One
function, both sides — brief 37's shape again.

The viewport could not simply build the same `DataTexture`: 256 × 128 is
131 072 iterations, and solar changes once per frame while someone scrubs the
timeline.

**The residual difference, stated rather than papered over**: the environment
is a gradient from horizon to zenith and the viewport's night background is a
flat zenith colour. They agree on hue, brightness and "this is night"; they are
not pixel-identical. Making them identical means putting the radiance map in
the viewport, which is the 131 072-iterations-per-frame problem above and wants
its own brief if it ever matters.

**Looked at, at both ends of the band:**

| clock | altitude | viewport |
|---|---|---|
| 06:00 | **−12.1°** | deep blue night, house and terrain in silhouette — not black, no glow |
| 07:40 | **+4.6°** | sun disc on the horizon, warm, long shadows cast across the ground |

The second is the check the brief asked for explicitly: shadows above the
horizon are unchanged, tested at 1–3° in code and seen at 4.6°.

**Not verified here**: that a *render* of the post-sunset shot matches. This
machine cannot path-trace (brief 40's outcome). What is verified is that both
paths are handed the same vector and read the same gradient function, which is
the mechanism the disagreement came from.

`npm run check` clean, **324 tests** (was 317).
