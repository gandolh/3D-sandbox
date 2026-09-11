---
summary: Dated snapshot of what is built, what is in flight, and what is next — the living dashboard.
updated: 2026-09-11
---

# Status

_Snapshot: 2026-09-11_

## Where things stand

Design is fully settled ([decisions.md](./decisions.md)). Three packages built:
`@solstice/schema` (document, validation, linter), `@solstice/geometry`
(document → three.js meshes) and `@solstice/solar` (site + clock → sun position,
sky and lighting). All three are headlessly testable; 83 tests pass. `scenes/`
holds the reference scene, which round-trips through the builder into canonical
JSON.

Nothing renders on a screen yet — there is no `apps/web` and no `apps/api`. The
generator produces a correct scene graph that nothing has yet drawn.

**Blocked:** `git push` has no credentials on this machine — no `gh`, no
credential helper, no GitHub SSH key. Commits are accumulating locally on `main`.

## Briefs

| # | Brief | State |
|---|---|---|
| 01 | [Scene document schema and linter](../briefs/done/01-schema-and-linter.md) | done |
| 02 | [Geometry generator](../briefs/done/02-geometry-generator.md) | done |
| 03 | [Solar time](../briefs/done/03-solar.md) | done |
| 04 | [Viewport and app shell](../briefs/todo/04-viewport-shell.md) | todo |

## Next

Brief 04 (**viewport and app shell**) next — the first thing a human can look at.
Everything it needs now exists: a validated document, a scene graph, and a sun.

The canonical solar moment is **21 Jun 2026 17:42 EEST at 44.4268 N, 26.1025 E →
altitude 32.949°, azimuth 271.654°**. That figure is pinned by a test and quoted
in the design artifact; if it ever moves, the two have diverged.

Known constraint, already surfaced: the scene tree, inspector and timeline each
need an independent scroll container (`@base-ui/react` Scroll Area) from the first
commit of the shell, not retrofitted once panels start clipping.
