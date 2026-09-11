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
