# Task 08 — Shots render what they declare

## Context

A `Shot` is meant to be the reproducible unit of this project: a named camera, an
optional solar override, and a declared output size and sample budget. The whole
point of the tool is producing renders of a house, and a shot is how you say
*which* render.

Today it is half-wired. `Toolbar.tsx` reaches for `doc.shots[0]` and takes its
`render.width/height/samples` — and the comment there says "A Shot is the
reproducible unit, so its declared output size wins" — but:

- **The camera is ignored.** `SandboxEngine.startRender` passes `this.camera`, the
  live viewport camera. The button's tooltip claims it is rendering shot
  "South-west", and it renders wherever the user happened to orbit to.
- **The solar override is ignored.** `resolveSolar(doc, override?)` already takes
  an override; the engine never passes one. `garden-elevation` declares 07:15 and
  renders at the document's working time.
- **Only `shots[0]` is reachable.** `villa-carpathia` has two shots and the second
  cannot be rendered at all.
- **`focalLength` is never applied.** Shots declare 35 mm and 85 mm; the viewport
  camera is a fixed 50° vertical FOV.

So the one thing a shot is *for* — rendering the same framing twice and getting the
same image — does not work. This is the gap worth closing before any new subsystem.

## Files you OWN

- `apps/web/src/engine/shot.ts` (new) — pure shot → render-parameter helpers
- `apps/web/test/shot.test.ts` (new)
- `apps/web/src/engine/PathTracer.ts` — accept a camera rather than mutating the viewport's
- `apps/web/src/engine/SandboxEngine.ts` — render from a shot's camera and solar
- `apps/web/src/ui/Toolbar.tsx` — shot picker
- `apps/web/src/App.tsx` — wire the picker through
- `apps/web/src/state/store.ts` — selected shot id
- `corpus/wiki/*` — status, open questions

## Files you must NOT touch

- `packages/schema/src/document.ts` — the `Shot` schema is already right; this brief
  is about honouring it, not changing it.
- `packages/solar` — `resolveSolar` already accepts the override.
- Anything under `packages/geometry` or `packages/physics`.

## What to do

1. **Pure helpers in `engine/shot.ts`.**
   - `shotFov(focalLength, aspect)` → vertical FOV in degrees for a 35 mm-equivalent
     focal length. Full-frame is 36 × 24 mm; the vertical FOV must come from the
     *film height implied by the aspect ratio*, not from a fixed 24 mm, or every
     non-3:2 render is cropped wrong.
   - `shotCamera(shot)` → a `THREE.PerspectiveCamera` positioned, aimed and framed.
   - Both pure and unit-tested without a GPU.
2. **`PathTraceSession` takes the camera it should use** instead of mutating and
   restoring the viewport camera's aspect. The viewport camera should not be
   touched by a render at all.
3. **`SandboxEngine.startRender(request)`** where the request carries the optional
   shot. Build the render camera from the shot when there is one, fall back to a
   clone of the viewport camera when there is not. Resolve solar with the shot's
   override so the sun, the sky environment and the render agree.
4. **Shot picker in the toolbar.** List the document's shots plus a "Viewport"
   entry. The Render button renders the selection. Selecting a shot also frames the
   viewport camera to it, so what you see is what you will get.
5. **Update the corpus**: `status.md`, and delete the now-answered GPU line from
   `open-questions.md`.

## Acceptance

- `npm run check` green, with new tests covering `shotFov` and `shotCamera`.
- Rendering "Garden elevation" produces an 07:15 image from the garden side at
  2560 × 1440 — verified **in the browser on the GPU**, not merely typechecked.
- The viewport camera is where the user left it after a render finishes.

---

## Outcome (2026-09-11)

Done. Shots now render their own camera, focal length, output size, sample budget
and solar override; the picker lists every shot and frames the viewport to the
selection. The viewport camera is untouched by a render.

Two things surfaced that the brief did not anticipate:

- **`npm run check` never typechecked `apps/web`.** It is not a `tsc --build`
  project reference — Vite owns its build — so `tsc --build` walked straight past
  it, and Vite only strips types rather than checking them. Every engine and UI
  change since the project started had been going in unchecked. Added
  `typecheck:web` to the gate and widened the web tsconfig to cover `test/`.
- **A solar override is invisible in the output.** You cannot tell 07:15 from
  17:42 by looking at a render and being confident. The overlay now states what
  is being rendered — *"Garden elevation · 2560 × 1440 · 07:15"* — built from the
  **resolved** solar rather than from the shot, so it reports the time actually
  in effect instead of the time requested.

Also fixed a hardcoded `Perspective · 50 mm` in the viewport label, which lied
whenever a shot was framed.
