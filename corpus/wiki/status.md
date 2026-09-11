---
summary: Dated snapshot of what is built, what is in flight, and what is next — the living dashboard.
updated: 2026-09-11
---

# Status

_Snapshot: 2026-09-11_

## Where things stand

Design is fully settled ([decisions.md](./decisions.md)). Two packages built:
`@solstice/schema` (document, validation, linter) and `@solstice/geometry`
(document → three.js meshes, headlessly testable). `scenes/` holds the reference
scene, which round-trips through the builder into canonical JSON.

Nothing renders on a screen yet — there is no `apps/web` and no `apps/api`. The
generator produces a correct scene graph that nothing has yet drawn.

**Blocked:** `git push` has no credentials on this machine — no `gh`, no
credential helper, no GitHub SSH key. Commits are accumulating locally on `main`.

## Briefs

| # | Brief | State |
|---|---|---|
| 01 | [Scene document schema and linter](../briefs/done/01-schema-and-linter.md) | done |
| 02 | [Geometry generator](../briefs/done/02-geometry-generator.md) | done |
| 03 | [Solar time](../briefs/todo/03-solar.md) | todo |
| 04 | [Viewport and app shell](../briefs/todo/04-viewport-shell.md) | todo |

## Next

Brief 03 (**solar time**) next — small, headless, and testable against the
altitude 32.3° / azimuth 272.3° figure the design artifact and the reference scene
both already use. Then brief 04, the viewport shell, which is the first thing a
human can look at.

Known constraint, already surfaced: the scene tree, inspector and timeline each
need an independent scroll container (`@base-ui/react` Scroll Area) from the first
commit of the shell, not retrofitted once panels start clipping.
