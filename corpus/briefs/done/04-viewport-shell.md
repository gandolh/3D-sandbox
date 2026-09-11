# Task 04 — Viewport and app shell

## Context

The first thing a human can look at. An imperative `SandboxEngine` owns renderer,
scene, camera and loop; React renders chrome only and talks to the engine through a
thin command surface.

Visual direction is **Darkroom**, settled and mocked up:
https://claude.ai/code/artifact/e2be0838-6bae-4731-898e-6a1a77609d20

## Files you OWN

- `apps/web/**`

## What to do

1. Vite 8 + React 19.3 + Tailwind 4 (`@tailwindcss/vite`, CSS-first `@theme`) +
   `@base-ui/react@1.8.0`. Exact pins.
2. `SandboxEngine` — `WebGLRenderer`, `OrbitControls` and `TransformControls` from
   `three/addons`, a resize observer, and a render loop React does not own.
3. Shell in Darkroom: toolbar, scene tree split by tier, inspector, timeline with
   the solar readout. Dark default, light theme per the artifact — chrome lightens,
   viewport keeps its dark matte.
4. Load `villa-carpathia.scene.json`, generate it with `@solstice/geometry`, light
   it with `@solstice/solar`.
5. Selection and the transform gizmo; inspector edits write back to the document
   in memory and re-derive affected geometry.

## Acceptance

- The reference scene renders, orbits, and relights when solar time changes.
- **Scene tree, inspector and timeline each scroll independently** — `@base-ui/react`
  Scroll Area, from the first commit. The mockups clipped precisely because this was
  missing, and a wall with eight openings will overflow any fixed height.
- Editing a wall's length in the inspector re-derives its openings rather than
  orphaning them.
- Works at 1280×720 without clipping; no horizontal page scroll.

## Out of scope

Persistence (brief 05), path-traced rendering, physics.

---

## Outcome — 2026-09-11

Shipped and verified in a real browser, not only by build output. The reference
scene renders in WebGL2 at 11,217 triangles / 284 instances — **the same figures
the headless generator reports**, which is the cheapest proof that the browser and
the tests are looking at the same scene.

Verified interactively: selecting `W-03` from the tree fills the inspector with its
real geometry (length 6.40 m, height 2.70 m, thickness 240 mm, bearing 270°);
shrinking it to 5.40 m raises `opening-fits-wall` in the inspector *and* the status
bar within one frame, and restoring the length clears it; dragging the solar slider
to 07:00 moves the sun from altitude 32.9° to 13.3°; the light theme applies; and
there is no horizontal page scroll.

Two bugs found by looking at it, which no amount of building would have caught:

- **`extrudePolygon` was wrong in two ways at once.** `rotateX(-π/2)` mirrored every
  footprint about the X axis, and the translation lifted solids by `base + height`
  instead of `base` — so the six neighbouring building masses floated a full storey
  above the treeline as black slabs. The code comment described the correct
  behaviour while the code did something else. Four regression tests now pin the
  bounds, including an off-origin footprint.
- **Context masses were see-through.** The extruded walls stopped at `height` and
  the pitched roof sat above them with nothing closing the gable ends. Cheap context
  geometry is fine; see-through context geometry is not.

One design improvement made while wiring the inspector: **`LintFinding` now carries
`entities`**, the chain of ids enclosing its path, resolved centrally in `lintScene`
rather than set per rule. The inspector had been filtering findings by
string-matching the entity id inside the prose message — which worked, and would
have broken silently the first time a message was reworded.

Deferred: the gizmo translates walls and commits on drag end, but does not rotate
or scale; `Render` is disabled pending brief 06; `Save` downloads the canonical
file rather than writing through an API (brief 05).
