---
summary: The agent loop outside the app (built 2026-11-06) — `npm run solstice -- lint` and `plan` over the `@solstice/scene-tools` package, which the scene build shares; the exit codes, why the package ships source rather than dist/, and the traps of running it through npm.
updated: 2026-11-06
---

# Scene tools and the CLI

Built 2026-11-06, the CLI half of "Agents get a CLI; no constraint solver"
([decisions.md](decisions.md#agents-get-a-cli-no-constraint-solver)). No
model is called anywhere: the CLI is what an agent outside the app, such as
Claude Code in this repo, runs ("No LLM inside the application" stands).

## The loop an agent runs

1. Edit the scene JSON (a drawn scene's `*.scene.json` is its only source;
   a builder scene is edited in `scenes/src/*.ts` and rebuilt with
   `npm run scenes`).
2. `npm run -s solstice -- lint <file>`: every finding on one line
   (`formatFinding`), then a count. `--json` prints
   `{ file, errors, warnings, findings }` instead.
3. `npm run -s solstice -- plan <file> --out <path>.svg`: the first level's
   plan, or `--level <id>`. Without `--out` the SVG goes to stdout.
4. Look at the SVG, and go back to 1.

Exit codes: **0** no lint errors (warnings allowed) or the plan was drawn;
**1** lint errors, or no plan drawn; **2** the file can't be read or isn't
JSON, or the command line is wrong. Exit 1 always means "fix the scene";
exit 2 means the command never got as far as the scene.

`plan` refuses a scene with lint errors and prints them, since a plan of a
broken scene misleads. It also refuses a level id the scene doesn't have:
`planSvg` quietly draws the first level for an unknown id, which in a loop
is the wrong drawing with no warning.

## Where the code is

- **`packages/scene-tools`** (`@solstice/scene-tools`): `sceneLintOptions()`
  (the asset lists below), `lintSceneFile(path)` and
  `planSceneFile(path, levelId?)`. Neither function throws for a bad file;
  each returns a tagged result (`unreadable`, `linted`, `refused`, `plan`).
  A file that is valid JSON but the wrong shape is `linted`, with `schema`
  findings, because `loadScene` reports it that way.
- **`apps/cli`** (`@solstice/cli`): `run.ts` parses arguments with
  `node:util`'s `parseArgs`, calls the package and prints; `solstice.ts`
  wires it to the process. Tests call `run` with a fake terminal.
- **`scenes/build.ts`** imports `sceneLintOptions()` instead of keeping its
  own copy, so `npm run scenes` and `lint` report the same findings for the
  same file. Its output did not change.

`sceneLintOptions()` arms both asset rules at all times:
`asset-resolves` gets `assets/verified.json`'s assets plus whatever
`assets/manifest.ts` finds under `assets-src/`, and `material-slug-resolves`
the same for materials ([assets.md](assets.md) has why it is "known to be
real", not "downloaded"). It rescans on every call, so a long-running caller
sees new downloads.

Dependency direction: `scene-tools → schema, drawing`, plus the two files in
`assets/`. `scenes` and `apps/cli` depend on it; nothing in `packages/` does,
and `apps/web` and `apps/api` don't. It is not a shared primitive in the
sense of [decisions.md](decisions.md#shared-primitives-live-in-solsticeschemaderive-not-a-new-package):
it works on a file, not on a document entity.

## Why the package ships source, not dist/

The asset lists live in `assets/`, outside the workspaces, and the build's
options must be read from there, not copied. A compiled package (`rootDir:
src`, `dist/`) cannot import a file outside its `src/`. So `scene-tools`
does what `scenes/build.ts` already did: its `exports` point at
`src/index.ts`, Node strips the types when it runs, and its relative imports
name `.ts` files, as `scenes/` and `assets/` do. The compiled packages keep
`.js`. Node does strip types in a workspace package, because it resolves the
`node_modules/@solstice/scene-tools` symlink to its real path first.

Typechecking: the root `tsc --build` covers only the compiled projects, so
`npm run typecheck:tools` checks `packages/scene-tools` and `apps/cli`, each
with a `noEmit` tsconfig like `scenes/tsconfig.json`; `npm run check` runs
it. Rejected: moving `readManifest` into a compiled package, which would
have moved a file the asset scripts and `vite.config.ts` own and made the
dev server wait on a build.

A later MCP server would call this package. It would have to run under
Node's type-stripping too, or the package would have to start compiling.

## Traps

- **`npm run` prints its header on stdout.** Use `npm run -s solstice --`
  when reading stdout (`--json`, or `plan` without `--out`), or call
  `node apps/cli/src/solstice.ts` directly.
- **Run it from the repo root, or a folder that isn't a workspace.** From
  `scenes/` or `apps/*`, npm looks for the script in that workspace's
  `package.json` and says "Missing script". From the root or `corpus/`,
  relative paths resolve against the folder the command was typed in
  (`INIT_CWD`), not the root npm starts the script in.
