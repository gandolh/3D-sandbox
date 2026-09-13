# Task 54 — A scene can typecheck green and then crash on the syntax it used

## Context

From the 2026-09-13 audit, verified empirically by the finder.

`scenes/build.ts` and `assets/download-list.ts` are run **directly by Node**
(`node build.ts`), relying on Node's native type-stripping. Stripping is not
compiling: it deletes annotations and refuses anything that would need code
generated for it.

So this typechecks cleanly under the repo's exact settings:

```ts
enum Direction { North, South }
```

`tsc --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes ...`
exits **0**. Then `npm run scenes` runs it and gets:

```
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]:
TypeScript enum is not supported in strip-only mode
```

The same applies to namespaces with runtime members and to parameter
properties. Brief 32 already made `scenes/` typecheck at all — this closes the
gap between "it typechecks" and "it runs", which is the gap that brief's whole
premise was about.

TypeScript 5.9.3 is pinned here and has supported `erasableSyntaxOnly` since
5.8, so `tsc` can be the gate before `node` ever sees the file.

## Files you OWN

- `tsconfig.base.json`
- `apps/web/tsconfig.json`, `scenes/tsconfig.json` — if they need it separately
- any source that the new flag rejects

## Files you must NOT touch

- The decision that TypeScript authors scenes and JSON ships.
- Node's type-stripping itself. Running `node build.ts` with no build step is
  deliberate.

## What to do

1. **Add `"erasableSyntaxOnly": true`** to `tsconfig.base.json`.
2. **Check every config that does not inherit it.** `apps/web/tsconfig.json`
   does not extend the base at all (brief 57) — until that is fixed, this flag
   has to be added there by hand or it will not apply to the largest workspace.
3. **Fix anything it rejects**, and say in the outcome whether it found
   anything already present. If it found nothing, that is worth stating: the
   flag is then a guard rather than a fix.

## Acceptance

- A file containing an `enum` fails `npm run typecheck` rather than
  `npm run scenes`.
- `npm run check` exits 0.

---

## Outcome — 2026-09-13

`"erasableSyntaxOnly": true` in `tsconfig.base.json`.

**Verified both directions on a real probe.** An `enum` dropped into
`scenes/src/` now fails `npm run typecheck:scenes`:

```
scenes/src/_probe.ts(1,6): error TS1294: This syntax is not allowed
when 'erasableSyntaxOnly' is enabled.
```

and the same file still dies under `node`, which is the point — the gate moved
to the place that can catch it before the crash.

**It was not a guard. It found seven live instances**, all parameter
properties, which need code generated for the assignment:

| file | what |
|---|---|
| `packages/physics/src/world.ts` | `private constructor(readonly colliders: …)` |
| `apps/api/src/store/files.ts` | `StalePreconditionError`'s two |
| `apps/web/src/engine/PathTracer.ts` | four, on the `PathTraceSession` constructor |
| `apps/web/src/engine/Player.ts` | two |
| `apps/web/src/engine/SandboxEngine.ts` | two |

**One of those was a live hazard, not a latent one.** `apps/api` is run
straight from source — its `dev` script is `node --watch src/server.ts` — so
`files.ts`'s parameter properties were in a file Node strips rather than
compiles.

The `apps/web` ones only surfaced because brief 57 had just made that workspace
extend the base. On the old config they would have been invisible.

All rewritten as explicit fields and assignments, each with a comment saying
why, so nobody restores the shorter form.

**Found while verifying this, and filed separately as brief 60**: `npm run api`
does not start at all. It fails with `ERR_MODULE_NOT_FOUND` for `./app.js` —
Node's type-stripping does not remap a `.js` specifier onto a `.ts` file. The
README documents the command. That is a different defect from this one and gets
its own brief.

`npm run check` clean, 452 tests.
