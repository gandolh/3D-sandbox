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
downloads.

**The reference scene is a place.** `greenhollow` — a smallholding with a
porch, a vine pergola from the gate to the front door, a garage, hedges, a
walled front with a gate, a kitchen garden, greenhouse, pond and an orchard in
rows — replaced the box-in-a-field as the scene the app loads. Authoring it is
what turned up `Run`, row-planted scatter, per-planting heights and materials,
and the fact that `roof-covers-walls` assumed one building per level.
`villa-carpathia` stays as the regression fixture.

**Physics works** as an authoring aid: colliders derived from the semantic
document with openings cut out of walls, drop-to-rest that snaps to the surface,
and a collider overlay. **184 tests pass.**

**It has now run on a real GPU** — 3.2 samples/sec at 511×759 (538 samples in
168 s), against 0.22 samples in 74 s on SwiftShader, roughly a thousandfold. The
GPU is reachable from WSL2, but only through X11: see
[running-on-a-gpu.md](running-on-a-gpu.md) for why headless falls back to
software and what flags avoid it.

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
| 07 | [Physics as an authoring aid](../briefs/done/07-physics-authoring.md) | done |

## Next

**The agreed sequence is complete.** Document model → editor and viewport →
solar time → path-traced render → physics, all seven briefs done, 163 tests.

Two things want doing before new features:

1. **Run a render on a machine with a GPU.** It has only ever run on software
   WebGL. Denoising, sample budgets and shot selection are all guesswork until
   someone has seen it at speed.
2. **Push.** Seven commits are stranded on local `main` for want of GitHub
   credentials — see the blocker entry in [log.md](../log.md).

After that, the honest backlog is in
[open-questions.md](./open-questions.md): hip roofs, schema migrations, and the
asset manifest that turns proxy boxes into furniture.

The canonical solar moment is **21 Jun 2026 17:42 EEST at 44.4268 N, 26.1025 E →
altitude 32.949°, azimuth 271.654°**. That figure is pinned by a test and quoted
in the design artifact; if it ever moves, the two have diverged.

Known constraint, already surfaced: the scene tree, inspector and timeline each
need an independent scroll container (`@base-ui/react` Scroll Area) from the first
commit of the shell, not retrofitted once panels start clipping.
