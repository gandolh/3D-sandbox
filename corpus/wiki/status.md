---
summary: Dated snapshot of what is built, what is in flight, and what is next — the living dashboard.
updated: 2026-09-11
---

# Status

_Snapshot: 2026-09-11_

## Where things stand

**It runs.** `apps/web` renders the reference scene in WebGL2 — orbit, select,
edit, relight — in the Darkroom direction, dark and light. Three packages behind
it: `@solstice/schema` (document, validation, linter), `@solstice/geometry`
(document → three.js meshes) and `@solstice/solar` (site + clock → sun position,
sky, lighting). All headlessly testable; **93 tests pass**.

The browser reports the same 11,217 triangles / 284 instances the headless
generator does, which is the cheapest check that tests and app agree.

No persistence API yet, and `Render` is disabled — path tracing is brief 06.

**Blocked:** `git push` has no credentials on this machine — no `gh`, no
credential helper, no GitHub SSH key. Commits are accumulating locally on `main`.

## Briefs

| # | Brief | State |
|---|---|---|
| 01 | [Scene document schema and linter](../briefs/done/01-schema-and-linter.md) | done |
| 02 | [Geometry generator](../briefs/done/02-geometry-generator.md) | done |
| 03 | [Solar time](../briefs/done/03-solar.md) | done |
| 04 | [Viewport and app shell](../briefs/done/04-viewport-shell.md) | done |

## Next

Brief 05 (**Fastify persistence API**) next: scene files are truth, SQLite is a
derived index, `Save` writes through instead of downloading. Then 06 (path-traced
render) and 07 (physics).

The canonical solar moment is **21 Jun 2026 17:42 EEST at 44.4268 N, 26.1025 E →
altitude 32.949°, azimuth 271.654°**. That figure is pinned by a test and quoted
in the design artifact; if it ever moves, the two have diverged.

Known constraint, already surfaced: the scene tree, inspector and timeline each
need an independent scroll container (`@base-ui/react` Scroll Area) from the first
commit of the shell, not retrofitted once panels start clipping.
