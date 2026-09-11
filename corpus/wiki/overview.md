---
summary: What Solstice is, who authors what, and the top-level layout — read this first if you have never seen the project.
updated: 2026-09-11
---

# Overview

**Solstice** is a parametric architectural scene editor and path-traced renderer
that runs in the browser. You describe one house plus its yard and ambient
surroundings as a typed JSON document; the app derives geometry from it, lights it
by real sun position, and renders photoreal stills.

## The division of labour

Authoring is a **repo-time activity**. Scene documents are written here, in
TypeScript, by a human and Claude working together — there is deliberately **no
LLM inside the running app**. The browser's job is to *tweak, light and look*: a
transform gizmo, an inspector, parametric sliders, and a render button. It does
not originate scenes, and there are no freehand CAD drawing tools.

That constraint is what makes the document format load-bearing. It has to be
hand-authorable, diffable, and strictly validated, because the thing writing it is
a language model and the thing reading it is a geometry generator.

## Top level

| Path | What it is |
|---|---|
| `packages/schema/` | Scene document types, Zod validation, and the linter |
| `scenes/` | Authored scenes — TypeScript sources plus generated `.scene.json` |
| `packages/geometry/` | Document → three.js meshes. Pure CPU; no WebGL context |
| `packages/solar/` | Site + clock → sun position, sky and lighting |
| `packages/physics/` | Colliders derived from the document; drop-to-rest |
| `apps/web/` | Browser editor and path-traced renderer |
| `apps/api/` | Fastify persistence API |
| `assets/` | Manifest, download-list generator, impostor bake harness |
| `corpus/` | This wiki |

## What it can do today

Open any of three bundled scenes, orbit it, select and edit walls and
placements, watch the sun move across a real day, drop furniture onto the floor
it is standing over, and path-trace a named shot — or the whole shot list
unattended — at its own camera, clock and resolution. Trees and
shrubs are real models — the heavy ones as baked impostors — and surfaces carry
real PBR maps.

Solar time is also a track you can **play**: a keyframed sun-path study runs on
a timeline, and the render captures whatever instant you stop on. What it cannot
do is render a *sequence* — one shot, one still, one frozen moment.
See [status.md](./status.md).

## Where to go next

- How it is put together → [architecture.md](./architecture.md)
- Why it is put together that way → [decisions.md](./decisions.md)
- What the words mean → [glossary.md](./glossary.md)
- What is actually built → [status.md](./status.md)
