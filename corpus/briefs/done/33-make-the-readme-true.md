# Task 33 — The README's quickstart does not work

## Context

From the 2026-09-12 audit, round 2. Four separate false statements, one of which
means a new contributor cannot start.

**1 — The documented quickstart fails on a fresh clone.** README says:

```bash
npm install
npm run dev          # the editor, on :5173
```

Every workspace package's only entry point is `./dist/index.js`
(`packages/*/package.json` `exports`), `dist/` is gitignored (`.gitignore:2`), and
`npm install` does not build. So `npm run dev` cannot resolve `@solstice/schema`,
`@solstice/geometry`, `@solstice/solar`, `@solstice/physics` or
`@solstice/animation`, and dies before the editor opens. `npm run api` has the
same problem. **The missing step is `npm run build`.**

**2 — Two different asset sizes, five lines apart.** README:25 says "17 assets
are 135 MB"; README:30 says `# ~88 MB: models, textures` for the same command.
The generated, authoritative `assets-src/DOWNLOADS.md` says 89.8 MB. The stale
135 MB figure is also copied into `apps/web/vite.config.ts:13` and `.gitignore:9`.

**3 — "207 tests".** It is 255.

**4 — No Node version.** `package.json` declares `"engines": { "node": ">=22.12" }`
and the scripts depend on Node's native type stripping (`node build.ts`,
`node --watch src/server.ts`). `.npmrc` has no `engine-strict`, so `npm install`
emits a soft warning and proceeds; on Node 20 the scripts then fail with a raw
syntax error that names nothing useful.

**5 — Editing a scene appears to do nothing.** `apps/web/src/scenes.ts` imports
the committed `.scene.json`; nothing watches `scenes/src/`. A developer who edits
`greenhollow.ts` with the dev server running sees no change and has no way to
know `npm run scenes` exists — the quickstart never mentions it.

## Files you OWN

- `README.md`
- `apps/web/vite.config.ts` and `.gitignore` — the copied 135 MB figure only
- `.npmrc` — if you decide to enforce the engine

## Files you must NOT touch

- Anything else. This is a truthfulness pass, not a refactor.

## What to do

1. **Fix the quickstart so it works**, verified by actually running it on a clean
   checkout: `git clone` to a temp directory, `npm install`, then the documented
   steps. Do not fix it by reasoning — run it.
2. **Take the asset figure from the generated source**, not from memory, and
   correct all three copies. Better: stop quoting a number that drifts, and point
   at `assets-src/DOWNLOADS.md`, which is regenerated.
3. **Stop quoting a test count**, or take it from the suite. A number that is
   wrong three commits later is worse than no number.
4. **State the Node version** in the quickstart, and consider `engine-strict=true`
   so the failure is a clear message instead of a syntax error.
5. **Document the two-step scene workflow** — author in `scenes/src`, run
   `npm run scenes`, reload — because there is no watcher.

## Acceptance

- A clean clone followed by the README, literally, produces a running editor.
  Say in the outcome note that you ran it.
- No number in the README contradicts a generated artefact or another line.

---

## Outcome — 2026-09-12

All five fixed, and the quickstart was **verified by running it**, not by
reasoning — which is what the brief insisted on and it was right to.

**1 — The broken quickstart, proven.** Cloned the repo to a temp directory, ran
`npm install`, and then:

```
node -e "import('@solstice/schema')"
FAILED: ERR_MODULE_NOT_FOUND
  Cannot find module '…/node_modules/@solstice/schema/dist/index.js'
```

`packages/schema/` on a fresh clone contains `package.json src test tsconfig.json`
and no `dist`. Then `npm run build` in the same clone: `RESOLVED, exports: 56`,
and the dev server serves `/` and `/src/main.tsx` with 200. So the missing step
is exactly `npm run build`, and it now has its own line with the reason beside
it.

**2 — The asset figures are gone rather than corrected.** The README said 135 MB
in one paragraph and ~88 MB five lines later; the generated file says 89.8 MB.
Rather than pick one, it now points at `assets-src/DOWNLOADS.md`, which
`npm run assets` regenerates — a number that drifts is worse than a pointer to
one that cannot. The stale 135 MB is also gone from `vite.config.ts` and
`.gitignore`.

**3 — The test count is gone**, for the same reason. `npm run check`'s comment
now lists what it does, not how many of it there are.

**4 — Node 22.12 is stated** above the quickstart, and `.npmrc` gained
`engine-strict=true` so an old Node fails with a clear message instead of a raw
syntax error pointing at a type annotation — which names nothing useful and
looks like a bug in the code.

**5 — The scene workflow has its own section.** Edit `scenes/src/*.ts`, run
`npm run scenes`, reload. Nothing watches those files; editing one with the dev
server running and expecting the viewport to change is the first thing everyone
tries, and it does nothing.
