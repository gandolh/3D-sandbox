# Log

## [2026-09-11] decision | Architecture and visual direction settled

Full grilling session before any code existed. Settled: parametric-semantic scene
document, imperative three.js on WebGL2, two fidelity tiers, files-are-truth
persistence, no LLM in the app, Darkroom visual direction. See
[wiki/decisions.md](./wiki/decisions.md) for the locked calls and their reasons,
and the design artifact at
https://claude.ai/code/artifact/e2be0838-6bae-4731-898e-6a1a77609d20
for the three UI directions that were compared.

## [2026-09-11] done | Brief 01 — Scene document schema and linter

Monorepo scaffolded (npm workspaces, exact pins, one lockfile). `packages/schema`
ships the Zod document schema, twelve semantic lint rules, `loadScene`
(parse → lint → throw), and TypeScript authoring helpers. `scenes/` holds the
reference scene `villa-carpathia`, authored in TypeScript and compiled to
canonical JSON by `node scenes/build.ts` — Node 24 strips the types natively, so
no `tsx` and no compile step.

39 tests pass; `npm run check` runs build → typecheck → test → scene build →
corpus lint as one gate.

Two traps worth remembering. Zod 4's `.default({})` hands back the literal value
**without re-parsing it**, so nested defaults never applied and every consumer read
`undefined` — `.prefault({})` is the one that parses. And `corpus/lint.sh` reported
clean while printing a failure, because its link check ran inside a pipe subshell
where the failure flag was lost; it now uses process substitution.

Brief: [01-schema-and-linter.md](./briefs/done/01-schema-and-linter.md).

## [2026-09-11] done | Brief 02 — Geometry generator

`@solstice/geometry` compiles a scene document into three.js objects: wall solids
with openings subtracted via `three-bvh-csg`, extruded slabs, gable and flat
roofs, terrain, and a `context` tier of seeded `InstancedMesh` scatter, extruded
building masses and road ribbons. Returns a `THREE.Group` split by tier, per-tier
triangle statistics, and `dispose()`.

No WebGL context is created anywhere in the package, which is what makes the 22
new tests possible — including a raycast that proves an opening is genuinely cut
(a ray through the hole misses, a ray beside it hits) rather than inferring it
from a triangle count.

The two-tier decision is now measured rather than predicted: **321 subject
triangles against 10 896 of context**, and that is with proxy trees of ~38
triangles. Real Poly Haven models would make those same 284 instances 14–57
million.

Brief: [02-geometry-generator.md](./briefs/done/02-geometry-generator.md).

## [2026-09-11] blocker | Cannot push — no GitHub credentials on this machine

`origin` is `https://github.com/gandolh/3D-sandbox.git`, but there is no `gh` CLI,
no git credential helper, no `GH_TOKEN`/`GITHUB_TOKEN`, and no GitHub SSH key
(`~/.ssh` holds GitLab and VPS keys only; `ssh -T git@github.com` is denied).
Commits accumulate locally on `main`. Resolving this needs a human — a token, a
credential helper, or a deploy key.

## [2026-09-11] done | Brief 03 — Solar time

`@solstice/solar` resolves a site and a wall-clock moment into sun altitude and
azimuth, a scene-space direction vector, day bounds, and a viewport lighting
model. Timezone handling is two-pass so times near a DST transition resolve
correctly, with tests either side of the 2026-03-29 Bucharest boundary.

Two findings. **suncalc 2.0.2 differs from 1.x in both units and convention** —
degrees rather than radians, azimuth north-based clockwise rather than from
south. The remembered 1.x conversion would have put the sun in the wrong quadrant
while still looking plausible; reading the shipped `index.d.ts` caught it.

And **the canonical sun figures moved**: hand-computed 32.3° / 272.3° became
**32.949° / 271.654°** once refraction was accounted for. The artifact, the scene
and the regression test now agree on suncalc's numbers.

Brief: [03-solar.md](./briefs/done/03-solar.md).

## [2026-09-11] done | Brief 04 — Viewport and app shell

`apps/web` renders the reference scene: Vite 8, React 19.3, Tailwind 4,
`@base-ui/react` 1.8.0, and an imperative `SandboxEngine` that owns renderer,
camera, orbit and gizmo. React renders chrome only and never drives the loop.

Verified in a real browser rather than only by build output — and that caught two
bugs the build could not. `extrudePolygon` both mirrored footprints about X and
lifted solids by `base + height` instead of `base`, so every neighbouring building
mass floated a storey above the ground; and context masses had open gable ends you
could see through. Both fixed, with regression tests on the extrusion bounds.

`LintFinding` gained `entities` — the chain of ids enclosing its path, resolved
centrally in `lintScene`. The inspector had been filtering findings by grepping the
entity id out of the prose message, which worked and would have broken silently on
the first reworded error.

Brief: [04-viewport-shell.md](./briefs/done/04-viewport-shell.md).

## [2026-09-11] done | Brief 05 — Fastify persistence API

`apps/api`: seven routes, files as truth, a derived index rebuilt by rescanning.
Every write goes through `loadScene`, so a document with errors returns 422 and
the file on disk is untouched — verified live, not just in tests. Path traversal
is rejected at the id, which is the security boundary because the id becomes a
filename.

Uses Node's built-in `node:sqlite` rather than a native driver — see
[decisions.md](./wiki/decisions.md). Zero native dependencies matters more than a
stable API for a cache that can be deleted at will.

Two defects found and fixed on the way: `loadScene` let Zod's own error escape, so
a malformed payload returned 500 instead of 422; and the API's scene summary
computed scatter counts separately from the lint rule and got them wrong
(2 instead of 284). `estimateScatterInstances` is now one shared function.

Brief: [05-persistence-api.md](./briefs/done/05-persistence-api.md).

## [2026-09-11] done | Brief 06 — Path-traced render

The feature the WebGL2 decision was made for. `three-gpu-pathtracer@0.0.24`
accumulates samples behind an explicit Render action, with BVH build progress, a
sample counter, cancel, and a PNG download at the shot's declared size.

Three failures, all found by running it rather than building it: `setSceneAsync`
needs a BVH worker registered first; the path tracer cannot sample the viewport's
`Sky` shader mesh, hemisphere light or gizmo helpers, so renders get a
purpose-built scene; and `scene.environment` must be an equirectangular texture
with readable pixels, which a PMREM render target is not.

That last one produced `skyRadianceMap` in `@solstice/solar` — a sky dome as
pure arithmetic over a `Float32Array`, testable without a GPU, replaced by a real
HDRI when assets land.

**It has only run on software WebGL** (0.22 samples in 74 s at 960 × 540). That
is an environment limit, not a measurement — but nobody has seen this on real
hardware, and the shot defaults are untested at speed.

Brief: [06-path-traced-render.md](./briefs/done/06-path-traced-render.md).

## [2026-09-11] done | Brief 07 — Physics as an authoring aid

`@solstice/physics` derives rapier colliders from the scene document and answers
two questions while someone is placing things: where would this land, and does it
overlap anything. Nothing it computes is persisted.

**Openings are cut out of wall colliders** — solid spans either side of a door,
a lintel above, a spandrel under a window. One box per wall would have made a
doorway impassable. Because openings are positioned along their wall by offset,
this is arithmetic rather than geometry, which is the semantic document paying
for itself.

Three fixes on the way: ray probes must run after the dropped body is removed, or
they hit it at time-of-impact zero; a floor slab and the ground beneath it are
coplanar so all ray hits are gathered and a named entity beats the terrain; and
rapier lets a settled body sink into what it rests on, so resting positions are
snapped to the probed surface.

Also fixed: the generator produced **nothing at all** for placements. They now get
proxy boxes, and the reference scene has three.

This completes the agreed sequence. All seven briefs done, 163 tests.

Brief: [07-physics-authoring.md](./briefs/done/07-physics-authoring.md).

## 2026-09-11 — The path tracer runs on a real GPU

Answered "can the agent browser use the GPU under WSL2": yes, but only headed.

Chromium enumerates GPUs through `/dev/dri`, which WSL2 does not have — it
exposes `/dev/dxg` instead, which Chromium has no concept of. So headless falls
back to SwiftShader silently, whatever GPU flags are passed. WSLg's X server on
`:0` already has Mesa bound to the `d3d12` driver, so a headed browser with
`--ozone-platform=x11 --use-gl=angle --use-angle=gl` inherits that context.

Measured on `villa-carpathia`: **3.2 samples/sec** against 0.003 on SwiftShader.
A 2,000-sample shot is ~10 minutes, not effectively never.

Wrote [wiki/running-on-a-gpu.md](wiki/running-on-a-gpu.md) and cleared the
warning in [wiki/status.md](wiki/status.md). No code changed — this was an
environment finding, not a defect.
