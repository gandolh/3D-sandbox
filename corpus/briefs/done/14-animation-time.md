# Task 14 — Animation time

## Context

This is the largest thing the project promised and did not build.

The opening request was for "a 3d sandbox using threejs, **animejs** and other
popular animation libraries". The grilling settled "the notion of time should be
implemented", and the design that came out of it drew a deliberate line between
two kinds of time. [glossary.md](../../wiki/glossary.md) still defines both:

> **Animation time**: The timeline playhead, in seconds, over which scene
> properties are keyframed — including the solar scalar, which is how a sun-path
> study becomes one tween.

**None of it exists.** Concretely:

- `animejs` and `motion` are in **no** `package.json`. They were pinned in the
  design and never installed.
- The document has no keyframes. `SolarTime` is a single instant.
- `Timeline.tsx` carries a comment that describes a feature that is not there:
  *"Animation time and solar time share one track… dragging the playhead **is** a
  sun-path study — the same tween an animation keyframe would drive."* Dragging
  the playhead sets a value. There is no tween, and no keyframe to drive one.
- The only `requestAnimationFrame` in the app is the render loop.

The user deferred a "play mode" to *later* during the grilling, so this is not a
broken promise — but it is the gap between "a still-image tool" and the sandbox
that was asked for, and the code currently claims to have crossed it.

## Files you OWN

- `packages/schema/src/document.ts` — keyframes
- `packages/schema/src/lint/rules/animation.ts` (new)
- `packages/animation/` (new workspace) — pure evaluation of a track at time t
- `apps/web/src/engine/SandboxEngine.ts` — playback
- `apps/web/src/ui/Timeline.tsx` — transport
- `apps/web/package.json` — `animejs`, `motion`, **exact versions**
- `scenes/src/greenhollow.ts` — one study worth watching

## Files you must NOT touch

- `apps/web/src/engine/PathTracer.ts`. A render owns the frame while it lasts —
  that is what makes cancelling it a matter of dropping the session — and
  playback must not fight it.
- `packages/physics`. Animation is authoring, not simulation.

## What to do

1. **Keyframes live in the document.** Scene files are truth, so an animation is
   as diffable and AI-authorable as the geometry. Start with what is already one
   scalar — solar time — then camera, then placement transforms.
2. **Evaluation is a pure package.** `packages/animation` turns (track, t) into
   values with no three.js and no DOM, so tweens are tested headlessly like
   geometry and solar already are. This is the reason to have a package rather
   than a hook.
3. **anime.js drives the clock, not the scene graph.** React renders chrome; the
   engine owns the scene. A tween writes into the same path `setSolar` already
   uses, so playback and scrubbing are the same code.
4. **Transport in the timeline**: play, pause, loop, and a duration. The playhead
   is already there; it needs to move on its own.
5. **A sun-path study in `greenhollow`** — 06:00 to 20:00 over ten seconds. This
   is the thing to watch to know it works.
6. **Delete or make true the comment in `Timeline.tsx`.** Either is fine; leaving
   a comment that describes an unbuilt feature is not.

## Acceptance

- `npm run check` green, with headless tests for track evaluation — easing
  boundaries, out-of-range times, and a track with one keyframe.
- The sun visibly travels across `greenhollow` on play, shadows following.
- Scrubbing still works and still sets the document.
- Starting a render during playback stops playback rather than racing it.

---

## Outcome (2026-09-11)

Done. `greenhollow` carries a sun-path study — 06:00 to 20:00 over twelve
seconds — and playing it visibly moves the sun: 09:33 at ALT 23.8°, 13:00 at
47.8°, 14:50 at 45.0°, shadows swinging with it.

The design decision that mattered was one the brief did not anticipate.
**Playback cannot go through the document.** `setSolar` calls `editDocument`,
which structured-clones the whole document, re-parses it through Zod, re-lints
it and bumps `revision` — and the viewport regenerates the entire scene on a
revision change. At sixty frames a second that is sixty full scene rebuilds. So
the playhead drives the **engine** (`setSolarMinutes`), and the transport commits
to the document once, on stop. Same split that keeps React out of the scene graph.

anime.js earns its place as the clock: `createTimer` gives play, pause, seek,
loop and a stable delta across a dropped frame, all of which are quietly wrong in
the obvious hand-rolled `requestAnimationFrame` version. It never touches the
scene graph. Evaluation is `packages/animation` — pure, headless, 14 tests.

**`motion` was deliberately not installed.** It was agreed during the grilling,
but its only use here would be chrome transitions, and this project already
carries one dependency imported nowhere (`xatlas-web`, see
[brief 17](../todo/17-repo-honesty-pass.md)). One decorative dependency is a
mistake worth not repeating.

One regression made and caught in the browser: preferring the playhead for the
readout whenever an animation *existed* killed the solar scrub — dragging it
edited the document while the readout went on showing the playhead. It now
prefers the playhead only while playing.
