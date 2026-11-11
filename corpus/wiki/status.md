---
summary: Dated snapshot (2026-11-02) of Solstice — what runs (three scenes, five packages, the API, the plan drawing), the audits of 2026-09-12 to 2026-10-01 and what they changed, the right-handed compass (2026-10-07), drawing the house in the browser (2026-10-27), the scene CLI (2026-11-06), what cannot be exercised on this machine, and what is open.
updated: 2026-11-06
---

# Status — 2026-11-02

`origin/main` is at `dbe161d`; the local commits after it (`f8f39a0` and the
briefs reset) are not pushed. `npm run check` is the gate and runs by hand.
Brief numbering restarted at 01 on 2026-11-02 (see [log.md](../log.md),
"Briefs reset"); brief 01 is open (2026-11-03).
Base UI is on 1.9.0, pinned exactly (brief 04, 2026-11-10).
The house style harness is in (brief 05, 2026-11-11): Prettier at width 120, typed ESLint, TypeScript 6.0.3, `check` and `check:fast`.

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
floor plan as SVG with no GPU. `npm run check` runs the whole suite; the count
is not repeated here, because a count in prose is the next number to drift.

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

## How it got here

Four audit rounds on 2026-09-12 — twelve lenses in all — produced 24 briefs,
plus four for the house and its drawings. The full ranked lists are in
[log.md](../log.md). All 28 were done by 2026-09-13.

An engineering audit on 2026-09-13 (performance, practices, structure) filed
ten briefs from 18 raw findings, plus one filed mid-run when `npm run api`
turned out not to start at all. All eleven were done the same day.

The repo gained a lint and format gate (Biome, replaced by Prettier and ESLint on 2026-11-11), CI (since removed, 2026-09-26 —
`npm run check` is now run by hand), a React testing
environment, `erasableSyntaxOnly`, and a wall-geometry cache. Greenhollow's
edit path went from **98 ms per keystroke** to **5.8 ms per committed edit**.
Measurements and the drop list are in [log.md](../log.md).

A further audit on 2026-09-20 filed eleven briefs, closed on 2026-10-01, all
with every fix verified by mutation. Two were data-loss or security: `POST`
could overwrite a hand-written scene, and a material slug could run shell
commands from `download.sh`. Several turned out bigger than filed: the impostor
bake was broken three ways, not one; the plan bug was live in Greenhollow's own
drawing; the drop probe needed a footprint grid, not just rotated corners. One
finding was smaller than filed: Chrome already coalesced the ARM fetches, so
what tripled was GPU uploads, not downloads. The committed download list was also stale, because nothing
checked material slugs; `material-slug-resolves` now does (2026-10-06).

A verification pass on 2026-09-13 re-read every acceptance criterion against the
code rather than against the outcome notes, and found **two that were not
actually met** — the scatter estimate agreed with the generator only for
rectangles, and the duplicate-id test exercised the wrong collision. Both closed. Worth
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
exercised end-to-end here ([running-on-a-gpu.md](running-on-a-gpu.md)).

The theme across the audit was one thing said three ways — this codebase's tests
asserted that output exists and is roughly the right size, not that it is
correct. Bounding boxes instead of directions, counts instead of associations,
silence on a good document instead of a finding on a bad one. Each fix attacked
that directly, and the impostor fix is the clearest case: a
bounding-box assertion could not catch it, so the test reads the **UVs** beside
the positions.

A second theme emerged while implementing, and is worth carrying forward: **four
times, a comment disagreed with the thing it described** — `overhang` meaning
three things in three scenes, the porch colonnade's missing south leg,
`roof-house`'s `ridgeBearing: 90` under a comment claiming the opposite, and the
physics cache's claim that keying on the revision "makes both impossible". Each
survived because a confident comment invites checking against your memory of the
design rather than against the code.

On 2026-10-07 the compass became right-handed: north is −Z and east is
+X, so the sun turns clockwise seen from above. The three scenes were mirrored
to keep their look, proven by renders, unchanged wall bearings and
byte-identical plans. Renders of the scenes are now the mirror images of
earlier ones, and the right way round.

On 2026-10-21 the owner chose to draw the house in Solstice, Revit-style, with
building parts only; on 2026-10-27 the plan view, undo, walls, openings, rooms,
floors and New house were built ([drawing.md](drawing.md)). Roofs come later.
On 2026-11-03 wall ends were mitred where walls meet, which closed the notch at
every outside corner in the mesh, the collider and the plan alike.

On 2026-11-06 a scene file became checkable outside the app:
`npm run solstice -- lint` and `plan`, over the `@solstice/scene-tools`
package that `npm run scenes` now shares, so a drawn scene with no builder
gets the same lint as a built one ([scene-tools.md](scene-tools.md)). No MCP
server yet.

The two unbaked conifers were dropped from villa's forest on 2026-10-06.

## Open

- **Roofs** cannot be drawn in the browser yet.
- **Path tracing needs the real GPU.** A headless browser under WSL2 falls back
  to software, where the path tracer's shader compile does not finish; the
  flags that reach the GPU through X11 are in
  [running-on-a-gpu.md](running-on-a-gpu.md).
