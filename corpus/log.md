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
