---
summary: Dated snapshot of what is built, what is in flight, and what is next — the living dashboard.
updated: 2026-09-12
---

# Status

_Snapshot: 2026-09-12_

## Where things stand

**It runs, it renders, and it is a place.** `apps/web` opens any of three bundled
scenes in WebGL2 — orbit, select, edit, relight, drop furniture onto the floor
below it, play a sun-path study, and path-trace a named shot or the whole shot
list unattended. Five packages behind it: `@solstice/schema` (document, Zod parse,
semantic linter), `@solstice/geometry` (document → three.js), `@solstice/solar`
(site + clock → sun, sky, light), `@solstice/physics` (derived colliders,
drop-to-rest) and `@solstice/animation` (headless track evaluation).
`apps/api` persists scenes over seven routes with files as truth and a
rebuildable `node:sqlite` index. **255 tests pass.**

**The scenes.** `greenhollow` is a smallholding — porch, vine pergola, garage,
hedges, walled front, kitchen garden, greenhouse, pond, orchard in rows.
`elmsgate` is a two-storey mid-terrace on a 6.5 m urban lot, authored to break
Greenhollow's assumptions; it is what proved `Subject.levels` really holds more
than one. `villa-carpathia` is the regression fixture.

**It runs on a real GPU.** Roughly a thousandfold over SwiftShader, but only
through X11 under WSL2 — see [running-on-a-gpu.md](running-on-a-gpu.md) for the
flags, and [render-performance.md](render-performance.md) for what a render
costs and why the denoiser ships off.

**The deploy is not this repo's work.** It lives in the `vps-deploy` estate and
is operated there by hand. Nothing in `apps/` or `packages/` waits on it.

## Next

A five-lens audit on 2026-09-12 produced **14 vetted findings** from 26 raw, and
six queued briefs (22–27). The full ranked list, including the Next and Watch
tiers that were not spec'd, is in [log.md](../log.md).

Two of the six are live bugs rather than improvements: **every road in every
scene renders black** from an inverted winding, and **placement colliders are
rotated in degrees** while both consumers read radians.

The theme across the audit is one thing said three ways — this codebase's tests
assert that output exists and is roughly the right size, not that it is correct.
Bounding boxes instead of directions, counts instead of associations, silence on
a good document instead of a finding on a bad one.

Still deliberately open, in [open-questions.md](open-questions.md): schema
migrations, and the two unbaked conifers that only the regression fixture uses.

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
| 08 | [Shots render what they declare](../briefs/done/08-shots-render-what-they-declare.md) | done |
| 09 | [The homestead scene](../briefs/done/09-the-homestead-scene.md) | done |
| 10 | [Asset manifest and models](../briefs/done/10-asset-manifest-and-models.md) | done |
| 11 | [Textures and foliage](../briefs/done/11-textures-and-foliage.md) | done |
| 12 | [Render convergence](../briefs/done/12-render-convergence.md) | done |
| 13 | [Vegetation impostors](../briefs/done/13-vegetation-impostors.md) | done |
| 14 | [Animation time](../briefs/done/14-animation-time.md) | done |
| 15 | [Finish a render](../briefs/done/15-finish-a-render.md) | done |
| 16 | [Denoiser](../briefs/done/16-denoiser.md) | done |
| 17 | [Repo honesty pass](../briefs/done/17-repo-honesty-pass.md) | done |
| 18 | [Finish the vegetation](../briefs/done/18-vegetation-finishing.md) | done (tree bakes deferred) |
| 19 | [Render the whole shot list](../briefs/done/19-render-the-whole-shot-list.md) | done |
| 20 | [A scene picker](../briefs/done/20-scene-picker.md) | done |
| 21 | [Elmsgate, a two-storey town house](../briefs/done/21-a-town-house.md) | done |
| 22 | [Collider rotation units](../briefs/todo/22-collider-rotation-units.md) | todo |
| 23 | [Normals face outward](../briefs/todo/23-normals-face-outward.md) | todo |
| 24 | [Physics cache ignores sizes](../briefs/todo/24-physics-cache-ignores-sizes.md) | todo |
| 25 | [Defer the heavy half](../briefs/todo/25-defer-the-heavy-half.md) | todo |
| 26 | [Stop shipping source maps](../briefs/todo/26-stop-shipping-source-maps.md) | todo |
| 27 | [Arm the unproven rules](../briefs/todo/27-arm-the-unproven-rules.md) | todo |
