# Task 53 — 12 000 lines of TypeScript with no lint or format gate

## Context

From the 2026-09-13 audit.

There is **no `.eslintrc*`, `eslint.config.*`, `.prettierrc*`, `biome.json` or
any other lint or format configuration anywhere in the repo** — confirmed by
search. `npm run check` runs three typechecks, the tests, the scene build and
`corpus/lint.sh`, and nothing that reads the code as *code*.

The codebase is 12 379 lines of TS/TSX. `tsc` is doing real work here — the
strictness settings are better than most repos carry (`noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax` are
all on) — but a type checker does not report:

- an unused local, which in `scenes/src/*.ts` means **a room or a wall that was
  built and never spread into the document**, silently absent from the output
  with no signal anywhere (`noUnusedLocals` is also currently off);
- a `catch` that swallows without rethrowing;
- an unreachable branch, a duplicated `case`, a promise never awaited in a
  non-async context;
- formatting at all, so every file's style depends on who last touched it.

This repo invests heavily in gates elsewhere — `corpus/lint.sh` checks the
wiki's frontmatter and links, `assets/download-list.ts` checks its own
downloads, the scene build refuses invalid documents. Code style and code smell
are the one surface with no gate.

## Files you OWN

- a lint/format config at the repo root
- `package.json` — the scripts, and the `check` chain
- source files, **only** for what the first run mechanically fixes

## Files you must NOT touch

- `tsconfig.base.json`'s existing strictness. It is already right; do not
  relax anything to make the linter quieter.
- Exact pinned versions. Whatever tool you add is pinned exactly, like
  everything else (`decisions.md`).

## What to do

1. **Pick one tool and say why in the commit.** The audit's reading of the
   current landscape: **Biome** is the fit here — one dependency and one config
   replacing both linter and formatter, native-speed, and at this size the
   speed difference against Oxlint is irrelevant while the formatter is not.
   ESLint's plugin depth is the reason to choose it and this repo needs none of
   it. Disagree if you have grounds, but record the choice.
2. **Turn on `noUnusedLocals` and `noUnusedParameters`** in
   `tsconfig.base.json` at the same time. They catch the scene-authoring case
   above, which is the one with a real failure mode, and they belong with this
   change rather than in a brief of their own.
3. **Format the repo in one commit, separate from any rule fixes**, so the
   diff that matters is readable.
4. **Wire it into `npm run check`** — a gate nobody runs is not a gate.
5. **Fix what it finds, or silence it deliberately with a reason.** A config
   with twenty inline disables is worse than no config.

## Acceptance

- `npm run check` fails on a lint error and on an unformatted file.
- The repo passes cleanly.
- The tool and its version are pinned exactly.
