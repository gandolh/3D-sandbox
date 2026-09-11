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

`apps/api` persists scenes: seven routes, files as truth, a `node:sqlite` index
that is rebuilt by rescanning. `Save` writes through it. **121 tests pass.**

**Render works.** `three-gpu-pathtracer` accumulates samples behind an explicit
Render action, lit by a sky radiance map computed from the sun; the result
downloads. **132 tests pass.**

⚠️ It has only ever run on software WebGL, where it managed 0.22 samples in 74
seconds. Nobody has seen it on a GPU yet — that is the first thing to check on
real hardware.

**Blocked:** `git push` has no credentials on this machine — no `gh`, no
credential helper, no GitHub SSH key. Commits are accumulating locally on `main`.

## Briefs

| # | Brief | State |
|---|---|---|
| 01 | [Scene document schema and linter](../briefs/done/01-schema-and-linter.md) | done |
| 02 | [Geometry generator](../briefs/done/02-geometry-generator.md) | done |
| 03 | [Solar time](../briefs/done/03-solar.md) | done |
| 04 | [Viewport and app shell](../briefs/done/04-viewport-shell.md) | done |
| 05 | [Fastify persistence API](../briefs/done/05-persistence-api.md) | done |
| 06 | [Path-traced render](../briefs/done/06-path-traced-render.md) | done |

## Next

Brief 07 (**physics as an authoring aid**) is the last of the agreed sequence:
rapier during editing so placement is physical — drop a chair and it settles,
objects cannot interpenetrate walls — with colliders derived from the semantic
document and never persisted.

Before that, **run a render on a machine with a GPU**. Everything downstream of
that (denoising, sample budgets, shot selection) is guesswork until someone has.

The canonical solar moment is **21 Jun 2026 17:42 EEST at 44.4268 N, 26.1025 E →
altitude 32.949°, azimuth 271.654°**. That figure is pinned by a test and quoted
in the design artifact; if it ever moves, the two have diverged.

Known constraint, already surfaced: the scene tree, inspector and timeline each
need an independent scroll container (`@base-ui/react` Scroll Area) from the first
commit of the shell, not retrofitted once panels start clipping.
