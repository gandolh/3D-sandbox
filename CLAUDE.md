# Solstice

A scene sandbox for architectural drawings and renders: scene documents (JSON),
a Fastify API that indexes them, and a React and three.js editor around them.
Read [corpus/index.md](corpus/index.md) first.

## Commands

- `npm run dev`: the web app (Vite, port 5173). `npm run api`: the API (port 5174).
- `npm run check`: lint, format check, the five typechecks, conventions, tests,
  the scene build, the web build and the corpus lint. Run it before every hand-back.
- `npm run check:fast`: the typecheck, then ESLint on the changed files. The
  Stop hook runs it.
- `npx vitest run <file>`: one test file.
- `npm run scenes`: rebuild the three scene files. It must change nothing.
- `npm run solstice -- lint <file>`: lint a scene file and draw its plan.
- `npm run format`: Prettier writes every file it covers (Markdown stays out).

## Places that mislead

- `npm test` runs `pretest` first (`tsc --build`): the tests import the
  packages' built `dist/`, which a fresh clone does not have.
- `assets-src/` is gitignored apart from the download scripts. `npm run assets`
  regenerates them; a clone has no models until you run them.
- The GPU needs X11 under WSL2: see
  [corpus/wiki/running-on-a-gpu.md](corpus/wiki/running-on-a-gpu.md).
- Five typechecks, not one: `tsc --build` (the packages and the API),
  `typecheck:web`, `typecheck:scenes`, `typecheck:tools` and `typecheck:tests`.
- `vendor/house-style/` is a generated copy. Never edit it;
  `npm run house-style:sync` refreshes it.

## Invariants (deliberate; do not "fix")

- **WebGL2 only.** No `three/webgpu`, no TSL. `three-gpu-pathtracer` forces it.
- **No React Three Fiber.** React renders chrome only; the scene graph is imperative.
- **Exact version pins.** No `^` or `~` anywhere. `.npmrc` sets `save-exact=true`.
- **No `@anthropic-ai/sdk` in the app.** Authoring is a repo-time activity.
- **Scene JSON files are truth**; SQLite is a derived, rebuildable index.
- **Degrees in documents, radians internally.** Metres, Y-up, right-handed:
  +X is east and -Z is north, so bearings turn clockwise seen from above.
- **ESM everywhere**, `"type": "module"`, `.js` extensions in relative imports.
- **Zod: `.prefault()`, not `.default()`, for object defaults.**

## Hard rules

- **No CI.** Don't add GitHub Actions, runners or other GitHub-specific automation.
- **No pushes.** Commit locally. The owner pushes.
- **Runtime behaviour stays put in a formatting or lint change.** `npm run scenes`
  leaves `scenes/*.scene.json` unchanged and `planSvg` output byte-identical.

## brief-board

Brief progress goes on brief-board. Run `brief-board guide` before you
start or resume a brief, and follow it.
