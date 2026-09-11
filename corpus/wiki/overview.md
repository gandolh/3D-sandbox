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
| `apps/web/` | Browser editor and renderer (not yet built) |
| `apps/api/` | Fastify persistence API (not yet built) |
| `corpus/` | This wiki |

## Where to go next

- How it is put together → [architecture.md](./architecture.md)
- Why it is put together that way → [decisions.md](./decisions.md)
- What the words mean → [glossary.md](./glossary.md)
- What is actually built → [status.md](./status.md)
