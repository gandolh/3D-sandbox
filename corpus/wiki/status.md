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

Four audit rounds on 2026-09-12 — twelve lenses in all — produced **24 briefs
(22–45)**. The full ranked lists are in [log.md](../log.md). Implementation
started the same day; **22, 23, 39, 40, 41 and 42 are done, and every live bug
the audit found is fixed.** What is left is structural work and hardening.

**Nothing in this repo can path-trace on the current machine.** WSL2 with no
hardware GL — the browser reports no `KHR_parallel_shader_compile`, and the
path-tracing shader's synchronous compile does not finish. The viewport, the
generator and everything headless are unaffected; only the render path cannot be
exercised end-to-end here. Brief 40's outcome has the detail.

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
| 22 | [Collider rotation units](../briefs/done/22-collider-rotation-units.md) | done |
| 23 | [Normals face outward](../briefs/done/23-normals-face-outward.md) | done |
| 24 | [Physics cache ignores sizes](../briefs/todo/24-physics-cache-ignores-sizes.md) | todo |
| 25 | [Defer the heavy half](../briefs/todo/25-defer-the-heavy-half.md) | todo |
| 26 | [Stop shipping source maps](../briefs/todo/26-stop-shipping-source-maps.md) | todo |
| 27 | [Arm the unproven rules](../briefs/todo/27-arm-the-unproven-rules.md) | todo |
| 28 | [Close the cross-origin surface](../briefs/todo/28-close-the-cross-origin-surface.md) | todo |
| 29 | [Writing a scene must not destroy one](../briefs/todo/29-writing-a-scene-must-not-destroy-one.md) | todo |
| 30 | [Give the document a ceiling](../briefs/todo/30-give-the-document-a-ceiling.md) | todo |
| 31 | [Contain the bake server](../briefs/todo/31-contain-the-bake-server.md) | todo |
| 32 | [Type-check the scenes](../briefs/todo/32-typecheck-the-scenes.md) | todo |
| 33 | [Make the README true](../briefs/todo/33-make-the-readme-true.md) | todo |
| 34 | [A truncated download is forever](../briefs/todo/34-a-truncated-download-is-forever.md) | todo |
| 35 | [The app cannot tell you what happened](../briefs/todo/35-the-app-cannot-tell-you-what-happened.md) | todo |
| 36 | [Reach Cancel without a mouse](../briefs/todo/36-reach-cancel-without-a-mouse.md) | todo |
| 37 | [A home for shared primitives](../briefs/todo/37-a-home-for-shared-primitives.md) | todo |
| 38 | [Tests that do not hold weight](../briefs/todo/38-tests-that-do-not-hold-weight.md) | todo |
| 39 | [Switching scenes keeps the first one's assets](../briefs/done/39-switching-scenes-keeps-the-first-ones-assets.md) | done |
| 40 | [Every render leaks the GPU](../briefs/done/40-every-render-leaks-the-gpu.md) | done |
| 41 | [A render can be undermined while it runs](../briefs/done/41-a-render-can-be-undermined-while-it-runs.md) | done |
| 42 | [Bring the fixture forward](../briefs/done/42-bring-the-fixture-forward.md) | done |
| 46 | [A house a real architect would draw](../briefs/done/46-a-house-a-real-architect-would-draw.md) | done |
| 43 | [Impostor quads are the wrong shape](../briefs/todo/43-impostor-quads-are-the-wrong-shape.md) | todo |
| 44 | [The dome and the render disagree after sunset](../briefs/todo/44-the-dome-and-the-render-disagree-after-sunset.md) | todo |
| 45 | [Scatter counts and seeds](../briefs/todo/45-scatter-counts-and-seeds.md) | todo |
