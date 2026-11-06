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
dependency. Two smaller calls, with the default this brief builds:

1. **Where it lives.** Default: a workspace of its own, `apps/cli`
   (`@solstice/cli`), run with plain `node` as `scenes/build.ts` is (Node
   22.12+ strips the types), plus a root script `npm run solstice --`.
2. **What it checks against.** Default: the same options `scenes/build.ts`
   passes, so the CLI and the build report the same findings for the same
   file. If sharing them means moving that setup out of `build.ts`, move it
   into the schema package's or the assets' module, not a copy.

## What to do

1. `lint <file>`: read the JSON, run `loadScene` with the build's options,
   print each finding with `formatFinding`, then a one-line count. Exit 0
   with no errors (warnings allowed), 1 with errors, 2 when the file can't
   be read or isn't JSON. `--json` prints the findings as JSON instead,
   for an agent.
2. `plan <file> [--level <id>] [--out <path>]`: write `planSvg` for the
   level (the first by default) to `--out`, or to stdout. Refuse a file
   with lint errors, printing them, since a plan of a broken scene
   misleads.
3. `--help` and an unknown command print the usage; a missing argument
   says which.
4. Tests (Vitest): each command on one builder scene and one fixture with a
   known error, the exit codes, `--json`, and a plan that matches
   `planSvg`'s output for the same input.
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
