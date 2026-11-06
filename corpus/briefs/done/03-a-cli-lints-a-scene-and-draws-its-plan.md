# Brief 03 — A CLI lints a scene and draws its plan

## Context

Brief 02 compared SolidCraft and CADCraft with Solstice. The one idea worth
taking from both: every action reachable from outside the app, so an agent
gets a checked loop. On 2026-11-06 the owner chose **the CLI first**, with
MCP as a later "if wanted", not briefed.

Solstice already has the parts. A scene is validated JSON;
`lintScene` (`packages/schema/src/lint/index.ts`) explains what's wrong,
and `formatFinding` prints a finding on one line; `loadScene`
(`packages/schema/src/load.ts`) parses and lints; `planSvg`
(`packages/drawing/src/plan.ts`) draws a level's plan with no DOM and no
GPU. `scenes/build.ts` uses them for the builder scenes, with the asset
manifest arming the `asset-resolves` rule. Drawn scenes (a
`*.scene.json` with no TypeScript source, saved through `apps/api` into
`SOLSTICE_SCENES_DIR`) have no builder, so outside the browser and the API
nothing checks them today.

[decisions.md](../../wiki/decisions.md) "No LLM inside the application"
stays: the CLI calls no model. It is what an agent outside the app (Claude
Code in the repo) runs.

## Owner decisions

Settled on 2026-11-06 with brief 02: the CLI only, no MCP yet; no new
dependency. The two smaller calls, answered the same day:

1. **Where it lives.** **A package for the shared work, and a minimal
   CLI on top** (the owner's shape). A new workspace package (say
   `packages/scene-tools`, `@solstice/scene-tools`) holds reading a scene
   file, linting it with the build's options, and writing a level's plan.
   `apps/cli` (`@solstice/cli`) only parses arguments, calls the package
   and prints; it runs with plain `node`, as `scenes/build.ts` does, behind
   a root script `npm run solstice --`. A later MCP server would call the
   same package.
2. **What it checks against.** **The same options `scenes/build.ts`
   passes**, the real-asset list included, so the CLI and `npm run scenes`
   report the same findings for the same file. That setup moves into the
   package, and `scenes/build.ts` imports it from there instead of keeping
   its own copy.

## What to do

0. The package: `lintSceneFile(path)` (read, parse, `loadScene` with the
   build's options; never throws for a bad file, returns why) and
   `planSceneFile(path, levelId?)` (refuses a scene with lint errors,
   returns the SVG), plus the build's lint options moved out of
   `scenes/build.ts`, which then imports them. Its own tests.
1. `lint <file>`: through the package; print each finding with
   `formatFinding`, then a one-line count. Exit 0
   with no errors (warnings allowed), 1 with errors, 2 when the file can't
   be read or isn't JSON. `--json` prints the findings as JSON instead,
   for an agent.
2. `plan <file> [--level <id>] [--out <path>]`: through the package; write
   the level's plan (the first by default) to `--out`, or to stdout. A file
   with lint errors is refused with them printed, since a plan of a broken
   scene misleads.
3. `--help` and an unknown command print the usage; a missing argument
   says which.
4. Tests (Vitest): the package's two functions on one builder scene and
   one fixture with a known error; the CLI's exit codes and `--json`
   through a thin test of argument handling; a plan that matches
   `planSvg`'s output for the same input; `npm run scenes` unchanged after
   the options move.
5. Docs: a short section in the README's development part, and a page or
   section in `corpus/wiki/` naming the loop an agent runs (edit the JSON,
   `lint`, `plan`, look at the SVG). Log entry.

## Acceptance

- `npm run check` passes.
- `npm run solstice -- lint scenes/greenhollow.scene.json` prints the same
  findings as `npm run scenes` does for Greenhollow, and exits 0.
- `npm run solstice -- plan scenes/greenhollow.scene.json --out <tmp>.svg`
  writes an SVG that opens in a browser.
- A copy of a scene with an opening wider than its wall exits 1 with that
  finding named.

## Outcome (2026-11-06)

Built in `57e091d`. `npm run solstice -- lint <file>` (with `--json`) and
`plan <file> [--level <id>] [--out <path>]` run over a new package,
`@solstice/scene-tools` (`lintSceneFile`, `planSceneFile`,
`sceneLintOptions`), and `scenes/build.ts` imports its lint options from
there. `npm run scenes` printed the same lines before and after, and the
three scene files did not change. The loop for an agent is in
[scene-tools.md](../../wiki/scene-tools.md).

Decided while building:

- **The package ships source, not `dist/`.** It reads
  `assets/manifest.ts` and `assets/verified.json` where they are, one copy
  of each, and a compiled package cannot import outside its `src/`; so it
  runs under Node's type-stripping as `scenes/build.ts` does, with `.ts`
  relative imports. `npm run typecheck:tools` checks it and `apps/cli`, and
  `npm run check` now runs that.
- **Exit 2 also covers usage mistakes**, so exit 1 always means the scene
  needs fixing.
- **`plan` refuses an unknown `--level`.** `planSvg` falls back to the
  first level, which would draw the wrong plan without a word.
- **Run through npm with `-s` to read stdout**: npm prints its header on
  stdout. Relative paths resolve against the folder the command was typed
  in (`INIT_CWD`).

Acceptance, by hand: `lint scenes/greenhollow.scene.json` prints the same
(zero) findings as `npm run scenes` and exits 0; `plan ... --out` writes an
SVG that parses as SVG and equals `planSvg`'s output; a copy of Greenhollow
with `d-living` wider than its wall exits 1 naming `opening-fits-wall`.
`npm run check`'s light parts pass (lint, the four typechecks minus
`typecheck:web`, `npm run scenes`, the new tests, the corpus lint). Not run:
`typecheck:web`, the full `npm test` and `build:web`, to spare the shared
machine; nothing in the web app changed.
