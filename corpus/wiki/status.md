---
summary: Dated snapshot of what is built, what is in flight, and what is next — the living dashboard.
updated: 2026-09-13
---

# Status

_Snapshot: 2026-09-13_

## Where things stand

**It runs, it renders, and it is a place.** `apps/web` opens any of three bundled
scenes in WebGL2 — orbit, select, edit, relight, drop furniture onto the floor
below it, play a sun-path study, and path-trace a named shot or the whole shot
list unattended. Five packages behind it: `@solstice/schema` (document, Zod parse,
semantic linter), `@solstice/geometry` (document → three.js), `@solstice/solar`
(site + clock → sun, sky, light), `@solstice/physics` (derived colliders,
drop-to-rest) and `@solstice/animation` (headless track evaluation).
`apps/api` persists scenes over seven routes with files as truth and a
rebuildable `node:sqlite` index, and `@solstice/drawing` renders a measured
floor plan as SVG with no GPU. **459 tests pass.**

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
(22–45)**, plus **46–49** for the house and its drawings. The full ranked lists
are in [log.md](../log.md). **All 28 are done** and `corpus/briefs/todo/` is
empty.

An engineering audit on 2026-09-13 (performance, practices, structure) filed
**briefs 50–59**: 18 raw findings, 10 vetted, plus **60** filed mid-run when
`npm run api` turned out not to start at all. **All eleven are done.**

The repo gained a lint and format gate (Biome), CI, a React testing
environment, `erasableSyntaxOnly`, and a wall-geometry cache. Greenhollow's
edit path went from **98 ms per keystroke** to **5.8 ms per committed edit**.
Measurements and the drop list are in [log.md](../log.md).

A verification pass on 2026-09-13 re-read every acceptance criterion against the
code rather than against the outcome notes, and found **two that were not
actually met** — 45's estimate agreed with the generator only for rectangles,
and 27's duplicate-id test exercised the wrong collision. Both closed. Worth
repeating on any batch of briefs closed quickly.

The suite went **255 → 389 tests** across that work, and the change in *kind*
matters more than the count: a shared `FIRES` registry that fails when a lint
rule is added without a test proving it fires; cross-package agreement tests in
`apps/web/test/`, the only workspace that can see both `geometry` and `physics`
and therefore the only place the duplicated computations could ever have been
caught; a contrast test that parses `styles.css` and computes WCAG ratios; a
shell test that lifts the real `fetch_one` out of the generated `download.sh`.
Several were verified by **mutation** — reverting the fix and confirming the
test goes red — rather than by inspection.

The first-paint bundle went **4 264 KB → 1 247 KB** raw, **1 474 KB → 349 KB**
gzipped, by deferring Rapier and the path tracer out of it.

**Nothing in this repo can path-trace on the current machine.** WSL2 with no
hardware GL — the browser reports no `KHR_parallel_shader_compile`, and the
path-tracing shader's synchronous compile does not finish. The viewport, the
generator and everything headless are unaffected; only the render path cannot be
exercised end-to-end here. Brief 40's outcome has the detail.

The theme across the audit was one thing said three ways — this codebase's tests
asserted that output exists and is roughly the right size, not that it is
correct. Bounding boxes instead of directions, counts instead of associations,
silence on a good document instead of a finding on a bad one. Each closed brief
attacked that directly, and the impostor fix is the clearest case: a
bounding-box assertion could not catch it, so the test reads the **UVs** beside
the positions.

A second theme emerged while implementing, and is worth carrying forward: **four
times, a comment disagreed with the thing it described** — `overhang` meaning
three things in three scenes, the porch colonnade's missing south leg,
`roof-house`'s `ridgeBearing: 90` under a comment claiming the opposite, and the
physics cache's claim that keying on the revision "makes both impossible". Each
survived because a confident comment invites checking against your memory of the
design rather than against the code.

Still deliberately open, in [open-questions.md](open-questions.md): schema
migrations, the two unbaked conifers that only the regression fixture uses, and
the left-handed compass. Captured as a new todo: a drop reports *"settled on
nothing"* when it settled on a slab.

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
| 24 | [Physics cache ignores sizes](../briefs/done/24-physics-cache-ignores-sizes.md) | done |
| 25 | [Defer the heavy half](../briefs/done/25-defer-the-heavy-half.md) | done |
| 26 | [Stop shipping source maps](../briefs/done/26-stop-shipping-source-maps.md) | done |
| 27 | [Arm the unproven rules](../briefs/done/27-arm-the-unproven-rules.md) | done |
| 28 | [Close the cross-origin surface](../briefs/done/28-close-the-cross-origin-surface.md) | done |
| 29 | [Writing a scene must not destroy one](../briefs/done/29-writing-a-scene-must-not-destroy-one.md) | done |
| 30 | [Give the document a ceiling](../briefs/done/30-give-the-document-a-ceiling.md) | done |
| 31 | [Contain the bake server](../briefs/done/31-contain-the-bake-server.md) | done |
| 32 | [Type-check the scenes](../briefs/done/32-typecheck-the-scenes.md) | done |
| 33 | [Make the README true](../briefs/done/33-make-the-readme-true.md) | done |
| 34 | [A truncated download is forever](../briefs/done/34-a-truncated-download-is-forever.md) | done |
| 35 | [The app cannot tell you what happened](../briefs/done/35-the-app-cannot-tell-you-what-happened.md) | done |
| 36 | [Reach Cancel without a mouse](../briefs/done/36-reach-cancel-without-a-mouse.md) | done |
| 37 | [A home for shared primitives](../briefs/done/37-a-home-for-shared-primitives.md) | done |
| 38 | [Tests that do not hold weight](../briefs/done/38-tests-that-do-not-hold-weight.md) | done |
| 39 | [Switching scenes keeps the first one's assets](../briefs/done/39-switching-scenes-keeps-the-first-ones-assets.md) | done |
| 40 | [Every render leaks the GPU](../briefs/done/40-every-render-leaks-the-gpu.md) | done |
| 41 | [A render can be undermined while it runs](../briefs/done/41-a-render-can-be-undermined-while-it-runs.md) | done |
| 42 | [Bring the fixture forward](../briefs/done/42-bring-the-fixture-forward.md) | done |
| 46 | [A house a real architect would draw](../briefs/done/46-a-house-a-real-architect-would-draw.md) | done |
| 47 | [The ground between the buildings](../briefs/done/47-the-ground-between-the-buildings.md) | done |
| 48 | [Rooms are implied and nothing can name them](../briefs/done/48-rooms-are-implied-and-nothing-can-name-them.md) | done |
| 49 | [A drawing, not a screenshot](../briefs/done/49-a-drawing-not-a-screenshot.md) | done |
| 50 | [A dragged placement springs back](../briefs/done/50-a-dragged-placement-springs-back.md) | done |
| 51 | [Every keystroke rebuilds the scene](../briefs/done/51-every-keystroke-rebuilds-the-scene.md) | done |
| 52 | [The vine allocates four thousand geometries](../briefs/done/52-the-vine-allocates-four-thousand-geometries.md) | done |
| 53 | [No linter, no formatter](../briefs/done/53-no-linter-no-formatter.md) | done |
| 54 | [Scenes typecheck green and crash](../briefs/done/54-scenes-typecheck-green-and-crash.md) | done |
| 55 | [No test can touch the interface](../briefs/done/55-no-test-can-touch-the-interface.md) | done |
| 56 | [Nothing runs the gate](../briefs/done/56-nothing-runs-the-gate.md) | done |
| 57 | [The largest workspace opted out of the base config](../briefs/done/57-the-largest-workspace-opted-out-of-the-base-config.md) | done |
| 58 | [Work repeated every frame that cannot change](../briefs/done/58-work-repeated-every-frame-that-cannot-change.md) | done |
| 59 | [One wall moves and the whole scene is rebuilt](../briefs/done/59-one-wall-moves-and-the-whole-scene-is-rebuilt.md) | done |
| 60 | [npm run api does not start](../briefs/done/60-npm-run-api-does-not-start.md) | done |
| 43 | [Impostor quads are the wrong shape](../briefs/done/43-impostor-quads-are-the-wrong-shape.md) | done |
| 44 | [The dome and the render disagree after sunset](../briefs/done/44-the-dome-and-the-render-disagree-after-sunset.md) | done |
| 45 | [Scatter counts and seeds](../briefs/done/45-scatter-counts-and-seeds.md) | done |
