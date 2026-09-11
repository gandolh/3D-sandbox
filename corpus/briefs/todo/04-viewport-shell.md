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
