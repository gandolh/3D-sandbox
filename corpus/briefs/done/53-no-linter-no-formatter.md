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

---

## Outcome — 2026-09-13

**Biome 2.5.13**, pinned exactly, one config replacing both linter and
formatter. Chosen over ESLint because this repo needs none of ESLint's plugin
depth, and over Oxlint because at 12 000 lines the speed difference is
irrelevant while a production formatter is not. It checks 144 files in **65 ms**.

**`lineWidth: 110`, and the reasoning is worth keeping.** The repo's own p99
line is 101, so 100 looked like the honest number — but the lines that exceed
it are almost all *data rows* in `scenes/src`, and 100 explodes a five-field
placement into a seven-line block. A file meant to read as a schedule becomes
materially worse. 110 keeps those rows intact and still wraps anything
genuinely long. Measured before choosing: 100 was +864/−299 lines, 110 is
+684/−525, 120 started re-joining signatures the author had split deliberately.

**It found three pieces of dead code, two of which I had written this
session:**

- `CANOPY = 0.22` in `runs.ts`, orphaned by brief 52's instancing;
- `gross` in `derive/scatter.ts`, orphaned by the verification pass that made
  the row estimate walk the lattice;
- an unused `buildMaterials` import in `geometry/index.ts`.

**And two real dependency-array findings**, which is the class brief 24 was
about: `revision` was redundant in the collider-overlay effect (`doc` gets a
new identity on every edit, because `editDocument` clones), and my own
`bounds` memo from brief 58 was keying on `[doc?.site, doc?.solar]` where
`[doc]` is both correct and simpler. Removing the first then exposed a dead
`useStore` subscription — caught immediately by `noUnusedLocals`, which went on
in the same change.

**Two rules turned off, with reasons rather than by reflex:**

- `useIterableCallbackReturn` — all 19 hits were `forEach` callbacks calling
  void functions. None was a `some`/`every`/`map`, and **TypeScript already
  rejects those** under `strict`, so in a strictly-typed codebase the rule's
  only remaining output is noise.
- `noUselessStringRaw` — `assets/download-list.ts` builds a shell script with
  `String.raw`. It is technically useless *today* and defensive against the
  first backslash anyone adds to a shell template.

One inline suppression, in `PlanView`: the SVG comes from `planSvg` over this
repo's own document. The reason was already written above the prop; the
`biome-ignore` had to become a single line to be recognised.

**Biome's own unsafe autofix broke something, which is worth recording.** It
rewrote `items.findIndex((el) => el === document.activeElement)` as
`items.indexOf(document.activeElement)` — correct in general, wrong here
because `activeElement` is `Element | null` against an `HTMLElement[]`. `tsc`
caught it. That is the argument for running `--unsafe` fixes behind a
typecheck rather than trusting them.

**`noUnusedLocals` and `noUnusedParameters`** are on in `tsconfig.base.json`,
per the brief.

**One process miss, stated rather than hidden**: the brief asked for formatting
and rule fixes in separate commits. They landed together in `08719b6`, because
the lint fixes were already made by the time I formatted and the two are
interleaved within the same files. The formatting half is the bulk of the
101-file diff; the rule fixes are the ~8 files named above.

`npm run lint` and `npm run format` exist, and `lint` runs **first** in
`npm run check` — it is the cheapest gate in the chain, so it should fail
before a typecheck or a test suite has been paid for.

`npm run check` clean, 454 tests.
