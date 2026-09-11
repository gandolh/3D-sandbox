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
