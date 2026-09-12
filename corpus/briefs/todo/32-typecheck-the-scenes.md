# Task 32 — 1,200 lines of scene authoring are never type-checked

## Context

From the 2026-09-12 audit, round 2.

`scenes/` is an npm workspace (`@solstice/scenes`) with **no `tsconfig.json`**,
and it is **absent from the root project-reference graph** (`tsconfig.json` lists
schema, geometry, solar, animation, physics and apps/api — not `scenes`, and not
`apps/web`, which is covered separately by `typecheck:web`).

So `scenes/build.ts` and `scenes/src/*.ts` — 1,200 lines including
`greenhollow.ts` (564) and `elmsgate.ts` (424) — are compiled by **nothing**.
`node build.ts` uses Node's type stripping, which discards types without
checking them.

Scene authoring is the part of this project a human actually writes by hand, and
it is the only part with no type checking at all. A typo'd `SceneDocument` field
or a stale `@solstice/schema` API passes `npm run check`'s three TypeScript
passes in silence and surfaces as a runtime crash or, worse, a silently wrong
`.scene.json`.

**And the three passes are themselves wasteful.** `check` is:

```
build            → tsc --build            (composite graph)
typecheck        → tsc --build --force    (the SAME graph, from scratch)
typecheck:web    → tsc --noEmit -p apps/web/tsconfig.json
test
scenes
build:web        → tsc --noEmit -p tsconfig.json && vite build   (apps/web AGAIN)
```

Four `tsc` invocations for two independent results: `--force` discards the
`.tsbuildinfo` that `build` just wrote, and `apps/web` is checked twice.

## Files you OWN

- `scenes/tsconfig.json` — new
- `tsconfig.json` — the reference graph
- `package.json` — the `check` script
- `apps/web/package.json` — its `build` script, if the duplicate check moves

## Files you must NOT touch

- `scenes/src/*.ts` — **unless type-checking them turns up a real error.** If it
  does, that is a finding: report it, and fix it here, because a scene that never
  compiled is exactly what this brief exists to surface.

## What to do

1. **Give `scenes/` a `tsconfig.json`** with project references to the packages it
   imports, and add it to the root graph so `tsc --build` covers it.
2. **Run it and report what it finds.** "Nothing was wrong" is a real and
   valuable outcome; so is a list of errors that have been latent for weeks.
3. **Collapse the redundant passes.** Keep one composite build and one web check.
   Do not keep `--force` in `check` — its only effect is to throw away work that
   was just done. If `--force` was there to defend against a stale
   `.tsbuildinfo`, say so in a comment and remove the *other* pass instead.
4. **Record the before and after wall-clock time** of `npm run check` in the
   outcome note.

## Acceptance

- `npm run check` type-checks `scenes/` and still exits 0.
- TypeScript runs twice, not four times, and the outcome note says what that saved.
- A deliberate type error in `scenes/src/elmsgate.ts` fails `npm run check`.
