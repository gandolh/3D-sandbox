# Task 57 — The biggest workspace hand-copies the strictness it should inherit

## Context

From the 2026-09-13 audit.

Every workspace `tsconfig.json` extends `tsconfig.base.json` — except
`apps/web/tsconfig.json`, which has **no `extends` at all** and instead
re-declares eight flags by hand:

```json
"strict": true,
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
"noImplicitOverride": true,
"noFallthroughCasesInSwitch": true,
"isolatedModules": true,
"verbatimModuleSyntax": true,
"skipLibCheck": true,
```

They currently match the base exactly, so nothing is wrong *today*. The failure
is in the next change: **any flag added to `tsconfig.base.json` silently does
not apply to `apps/web`** — 3 601 lines, the largest workspace in the repo, and
the one a contributor is most likely to be working in.

That is not hypothetical. Brief 54 adds `erasableSyntaxOnly` to the base; brief
53 adds `noUnusedLocals` and `noUnusedParameters`. All three would skip
`apps/web` unless someone remembers to copy them a second time — and the whole
point of the base config is that nobody has to remember.

There is a real reason it diverges: the web app needs `module: ESNext`,
`moduleResolution: bundler`, `jsx: react-jsx`, DOM libs and `noEmit`, none of
which suit a Node package. But those are **overrides**, and `extends` exists
precisely so a config can inherit a policy and override the mechanics.

## Files you OWN

- `apps/web/tsconfig.json`
- `tsconfig.base.json`, if something genuinely has to move

## Files you must NOT touch

- The other workspace configs. They already extend correctly.
- Any flag's *value*. This brief changes where the values come from, not what
  they are — `npm run typecheck:web` must report exactly what it reports now.

## What to do

1. **Make it extend the base** and keep only what genuinely differs: the module
   and resolution mode, `jsx`, `lib`, `types`, `noEmit`,
   `allowImportingTsExtensions`, and the `include`.
2. **Prove nothing changed.** Run `tsc --showConfig -p apps/web/tsconfig.json`
   before and after and diff the resolved options. Anything that moves is either
   a flag the app was quietly missing — which is a finding worth recording — or
   a mistake in the rewrite.
3. **If a base flag genuinely cannot apply to the web app**, override it there
   explicitly with a comment saying why, rather than by omission.

## Acceptance

- `apps/web/tsconfig.json` extends `tsconfig.base.json`.
- The resolved config is unchanged except for anything deliberately recorded.
- `npm run check` exits 0.

---

## Outcome — 2026-09-13

`apps/web/tsconfig.json` extends `tsconfig.base.json` now and keeps only what
genuinely differs: `lib` with the DOM, `module: ESNext` and
`moduleResolution: bundler` (Vite resolves and bundles; `NodeNext` would demand
extensions it does not want), `jsx`, `noEmit`, `types` and
`allowImportingTsExtensions`.

**The before/after `--showConfig` diff found four flags the app was quietly
missing**, which is exactly what the brief expected to be there:

```
+ "declaration": true
+ "declarationMap": true
+ "forceConsistentCasingInFileNames": true
+ "sourceMap": true
```

Three are emit options and inert under `noEmit`. The fourth is not:
**`forceConsistentCasingInFileNames`** catches importing `./Toolbar` as
`./toolbar` — which works on a case-insensitive filesystem and breaks the
moment it is built anywhere else. The largest workspace in the repo had been
running without it.

**It paid for itself immediately.** Brief 54 added `erasableSyntaxOnly` to the
base minutes later; before this change it would have silently skipped
`apps/web`, and the four parameter properties in `PathTracer`, `Player` and
`SandboxEngine` would still be there — in the one workspace where nobody would
have thought to look.

`npm run typecheck:web` reports exactly what it did before. `npm run check`
clean, 452 tests.
