# Task 05: The house style and the quality harness

**Depends on:**

- In 3D-sandbox: brief 04, so a failing check is never blamed on the Base UI bump.
- In the owner's skills library:
  - brief 27, *A house style, and a quality harness that enforces it*: the `house-style` package, the skill, and the plugin's `Stop` and `PostToolUse` hooks;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: how the convention checkers are wired and when they run `--warn-only`.
- The owner's grilling of 2026-11-10 (Q4: no pull requests, work on `main`), and the skills library's open questions Q5-Q14.

**Runs before:** 06 and 07. Formatting first gives one clean reformat commit, and the formatter hook keeps every later diff formatted.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The owner's call of 2026-11-09: the researched conventions are enforced in every repo. This repo differs from the rest of the estate in three ways, and each changes the brief:

1. **It already has a gate, and it is Biome.** `package.json` runs `lint` as `biome check .` and `format` as `biome check --write .`, and `npm run check` already chains typecheck, tests, the scene build, the web build and the corpus lint. The estate keeps one toolchain, so this brief moves the repo to the house harness (Prettier, and ESLint with typescript-eslint) and **removes Biome in the same step**. That is the controller's technical call of 2026-11-10; the owner's Q8 left the formatter open.
2. **It has the strictest tsconfig in the estate**, so the tsconfig step adds nothing. It closes two typecheck gaps instead.
3. **It is a game with an editor around it.** Runtime behaviour must not change. The corpus records what has to hold: `npm run scenes` leaves the three scene files byte-identical ([wiki/drawing.md](../../wiki/drawing.md)), `planSvg` output is byte-identical (`packages/drawing/test/plan-unchanged.test.ts`), and scatter determinism has real tests ([wiki/architecture.md](../../wiki/architecture.md)). This brief proves all three as commands.

### What the repo has today (read 2026-11-10)

- **`biome.json`:** Biome 2.5.13 (`package.json` devDependencies). Line width 110, double quotes, trailing commas `all`, semicolons. Rules: `recommended`, plus `useImportType` and `noParameterProperties` as errors, `noExplicitAny` as an error, and four rules off: `noNonNullAssertion`, `useIterableCallbackReturn`, `noForEach` and `noUselessStringRaw`. It covers `**/*.ts`, `**/*.tsx` and `**/*.json`, and skips `dist`, `scenes/*.scene.json`, `assets-src` and the lockfile. `npx biome check .` checks 193 files in 189 ms and reports one deprecation notice (`recommended` is deprecated) and no errors.
- **`tsconfig.base.json`** has every house flag already: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `isolatedModules`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`. **Keep every one. Add none.**
- **TypeScript 5.9.3**, Vitest 5.0.5, no ESLint, no Prettier.
- **Scripts** (`package.json`): `check` is `lint && typecheck && typecheck:web && typecheck:scenes && typecheck:tools && test && scenes && build:web && lint:corpus`. `test` is `vitest run` with no `pretest`.
- **No root `CLAUDE.md` and no `.claude/`.** The invariants (WebGL2 only, no React Three Fiber, exact pins, degrees in documents, `.prefault()`) live only in [corpus/CLAUDE.md](../../CLAUDE.md), which loads only once an agent reads under `corpus/`.
- **`.npmrc`** has `save-exact=true` and `engine-strict=true`.
- **Workspaces:** `packages/*`, `scenes`, `apps/*`. The server is `apps/api`, the web app `apps/web`, and the shared schema is `packages/schema`. The house skills assume `server/`, `web/` and `shared/`, so the rules files map them.
- **12 `biome-ignore` comments** in source. They are listed in step 4.

### Measured on 2026-11-10

Taken on a scratch copy with Prettier 3.9.10, ESLint 9.39.5, typescript-eslint 8.72.2, eslint-plugin-react-hooks 7.1.1, eslint-plugin-n 18.5.0, eslint-plugin-import-x 4.18.1, @vitest/eslint-plugin 1.6.28, eslint-plugin-jsx-a11y and eslint-plugin-simple-import-sort, on Node 24.22.1.

**Prettier churn** (`--trailing-comma all`, otherwise default) over the 197 tracked `.ts`, `.tsx`, `.js`, `.html`, `.css` and `.json` files except the lockfile, `assets-src/` and `scenes/*.scene.json`. "Lines" is `-` plus `+` lines of `diff -U0`, so it is twice a one-sided count:

| `printWidth` | Files changed | Lines changed |
|---|---|---|
| 100 | 105 | 1,460 |
| **110** | **3** | **36** |
| 120 | 80 | 783 |
| 130 | 92 | 1,192 |
| 150 | 108 | 1,905 |

110 is Biome's own width. At 110 the three changed files are `assets/bake/impostor.html` (19), `assets/bake/impostor.js` (10) and `packages/scene-tools/test/fixtures/opening-wider-than-wall.scene.json` (7). Biome never formatted the first two, and formats the third differently. **TypeScript and TSX churn at 110 is zero.** That is the least churn measured in the estate, and it bears on the skills library's Q51 (one width or one per repo).

**TypeScript.** `npx tsc --build` takes about 5 s. TypeScript 6.0.3 fails the build with one error: `packages/geometry/src/index.ts:262` "Cannot find name 'console'". TypeScript 6 no longer includes `@types/*` on its own, and only `apps/api/tsconfig.json` sets `types`. Adding `"types": ["node"]` to `packages/geometry/tsconfig.json` fixed it. With 6.0.3 the web, scenes, scene-tools and cli typechecks passed.

**Two typecheck gaps, found by probe configs** (`include` of the paths below, extending the base):

- Six `packages/*/tsconfig.json` files and `apps/api/tsconfig.json` include only `src/**/*.ts`. Their tests (`packages/*/test`, `apps/api/test`) are in no tsconfig, and neither are `assets/**/*.ts` and `vitest.config.ts`. `npm run typecheck` never reads them.
- Checked once, they hold **3 errors**: `packages/geometry/test/geometry.test.ts:39` (missing `rooms`), `packages/geometry/test/rows.test.ts:5` (a literal that no longer fits its type) and `assets/download-list.ts:185` (`size` does not exist on the type). This is the estate's "green because nothing ran" fact again.

**The `pretest` gap.** With every `dist/` deleted, `npx vitest run apps/api` failed 2 files, because `@solstice/schema` resolves to `dist/`. `npm test` alone fails on a fresh clone.

**ESLint** (typed config, one run over the repo, `project` listing every tsconfig and the probe config). Full-repo lint took 27 s with `project` and 32 s with `projectService`; one file (`apps/api/src/app.ts`) took 3.9 s under `projectService`. Biome takes 0.2 s. That speed is lost.

| Rule | Findings | Where |
|---|---|---|
| `no-floating-promises`, `no-misused-promises`, `await-thenable`, `switch-exhaustiveness-check` (`considerDefaultExhaustiveForUnions`) | 0 each | |
| `no-unnecessary-type-assertion` | 40 | 4 in source (`apps/web/src/engine/PathTracer.ts:310`, `apps/web/src/state/store.ts:411`, `apps/web/src/ui/plan/PlanSurface.tsx:181`, `scenes/src/greenhollow.ts:951`), 36 in tests |
| `consistent-type-imports` | 2 | `apps/web/src/engine/SandboxEngine.ts:25`, `apps/web/src/lib/physics.ts:32`: both are `typeof import("...")` type annotations for lazy chunks, not imports |
| `no-non-null-assertion` | **641** | 97 in source (18 files; `packages/geometry/src/context/masses.ts` 29, `apps/web/src/lib/drawing/faces.ts` 23, `packages/schema/src/geometry.ts` 11, `apps/web/src/engine/SandboxEngine.ts` 6), 544 in tests |
| `no-console` | 23 | 21 in CLIs (`scenes/build.ts` 11, `assets/download-list.ts` 4, `assets/bake/serve.ts` 3, `apps/api/src/server.ts:7-9` 3), 2 library `console.warn`s: `packages/geometry/src/index.ts:262`, `apps/web/src/engine/PathTracer.ts:219` |
| `n/no-process-env` | 8 | `apps/api/src/config.ts:24-30` (5), `apps/cli/src/solstice.ts:15`, `apps/web/vite.config.ts:90, 102` |
| `import-x/no-default-export` | 5 | `apps/web/vite.config.ts:87`, `vitest.config.ts:22`, and `scenes/src/elmsgate.ts:497`, `scenes/src/greenhollow.ts:1098`, `scenes/src/villa-carpathia.ts:231` |
| `no-restricted-syntax` on enums, `no-warning-comments`, `no-explicit-any`, `ban-ts-comment` | 0 | |
| `react-hooks` recommended (7.1.1, with the compiler rules) | 18 | `refs` 13, `set-state-in-effect` 4, `immutability` 1: see below |
| `@vitest/eslint-plugin` recommended | 10 | `no-conditional-expect` 8 (`packages/schema/test/lint.test.ts:501, 502, 561, 562, 563, 574, 582`, `packages/solar/test/solar.test.ts:195`), `valid-title` 1 (`apps/api/test/builder-names.test.ts:23`), `no-standalone-expect` 1 (`assets/test/download-script.test.ts:33`) |
| `vitest/valid-expect` | 12-16 at the default, **0** with `maxArgs: 2` | the findings are the message form `expect(x, "why")`, as at `apps/web/test/contrast.test.ts:53` |

`@vitest/eslint-plugin` 1.6.28 declares an optional peer of `typescript >=6.0.0`, so npm refused the install on TypeScript 5.9.3 (`ERESOLVE`) and needed `--legacy-peer-deps`. Step 1 bumps TypeScript to 6.0.3, which the house uses.

**The `react-hooks` findings are one pattern.** Five plan-tool hooks mirror state into a ref during render so a window key listener bound once reads the latest value: `apps/web/src/ui/plan/useWallTool.tsx:53, 55, 57, 151, 201`, `useOpeningTool.tsx:83, 85, 132, 134`, `useAreaTools.tsx:77, 78, 252`, `useSelectTool.tsx:64`. The four `set-state-in-effect` sites reset state when `doc.id`, `level.id` or `active` change (`useAreaTools.tsx:83, 257`, `useOpeningTool.tsx:89`, `useWallTool.tsx:75`). Rewriting them is a behaviour change in the drawing tools.

### What Biome enforces that the house config would not

| Biome check | Today | After this brief |
|---|---|---|
| `organizeImports` (an assist, on by default; `biome check` passes) | enforced | **Lost by default.** `eslint-plugin-simple-import-sort` flags **105 files** (its order is not Biome's), so carrying it means reordering imports in 105 files. See decision 9. |
| a11y recommended | enforced, 5 `noAutofocus` suppressed | **Carried** with `eslint-plugin-jsx-a11y` recommended on `apps/web`: 7 findings, 5 `no-autofocus` and 2 `no-noninteractive-element-interactions` (`apps/web/src/ui/SceneDialogs.tsx:22`, `apps/web/src/ui/plan/useAreaTools.tsx:154`). Brief 06 removes all seven. |
| `useButtonType` | enforced (24 `<button` sites, all typed) | **Carried** as a `no-restricted-syntax` selector: a `button` JSX element with no `type`. 0 findings. |
| `noDangerouslySetInnerHtml` | 1 suppressed, `apps/web/src/ui/plan/PlanSheet.tsx:52` | **Carried** as a `no-restricted-syntax` selector on the attribute. 1 finding. |
| `noArrayIndexKey` | 1 suppressed, `apps/web/src/ui/plan/LevelDrawing.tsx:100` | Lost. One site, documented inline. |
| `useIndexOf` | 1 suppressed, `apps/web/src/ui/SceneTree.tsx:111` | Lost. |
| `useImportType`, `noParameterProperties` | enforced | Covered by `verbatimModuleSyntax` and `erasableSyntaxOnly`, already on. |
| `noExplicitAny`, `useExhaustiveDependencies` | enforced | Covered by typescript-eslint recommended and `react-hooks`. |
| `noNonNullAssertion` | **off** | The house makes it an error: 641 findings. See decision 4. |

Gained: the six typed rules (four find nothing today, which is a result), the React compiler rules, the test rules, `no-process-env`, `no-console`, default-export and TODO rules. Lost: lint in 0.2 s, and import order.

## Owner decisions

**Decided on 2026-11-10 (the owner confirmed the controller's technical calls):**

1. **Where the configs come from** (Q6). `house-style` is **vendored**: a copy in the repo with a version header, refreshed by a `house-style:sync` script that finds the checkout by name. Not a git or tarball dependency. Step 4 adds the copy and the script.
2. **Width** (Q8, Q51): **120**, the estate's one width. The reformat at 120 is a one-off cost: 783 changed lines in 80 files, whitespace only. (Biome's own 110 would change none of the TypeScript, but the estate width wins.)
3. **Markdown stays out of Prettier** (Q45). `.prettierignore` lists `*.md`.
4. **`!`** (Q47): an error in source, a warning in tests. That is 97 source sites in 18 files. Step 4 fixes them in their own commits, one file per commit, each behaviour-neutral (a narrowing, or a small checked-access helper), with the byte-identical scenes check after each. The 544 test sites are warnings.
5. **`noUncheckedIndexedAccess`** (Q50) is already on here, so nothing is deferred. The flags stay as they are (Q11).
6. **`switch-exhaustiveness-check`** with `considerDefaultExhaustiveForUnions: true` (Q48); the typed rules as in Q12; `console` allowed in scripts and CLIs, and a default export where a framework needs one (Q13).
7. **`.claude/rules/`** is not ignored: `.gitignore` has no `.claude` line (`grep -n claude .gitignore` finds nothing, 2026-11-10). A root `CLAUDE.md` with the commands (Q46).
8. **The checkers read this repo's roots** from `scripts/conventions.json`: server `apps/api/src`, web `apps/web/src`, contract `packages/schema`.
9. **Import order.** Default: lost, and recorded in [wiki/decisions.md](../../wiki/decisions.md). The alternative is `eslint-plugin-simple-import-sort` plus a 105-file reorder commit in `.git-blame-ignore-revs`. *New question for the grilling.*
10. **`react-hooks` compiler rules** (the 18 above). Default: `warn` on `apps/web/src/ui/plan/use*Tool.tsx`, `error` elsewhere, with a comment in the config naming the pattern. Not rewritten here: the harness must not change the drawing tools. *New question.*
11. **`no-console`.** Default: allowed in `scenes/build.ts`, `apps/cli/`, `assets/**` and `apps/api/src/server.ts`; an error elsewhere. The two library `console.warn` calls get an inline disable with a reason. *New question: or `allow: ["warn", "error"]`.*
12. **Default exports.** Default: allowed in `*.config.*` and in `scenes/src/*.ts`. A scene builder's default export is a load-time contract: `scenes/build.ts:44-47` reads `mod.default` and fails without it.
13. **`consistent-type-imports`** with `disallowTypeAnnotations: false`, so the two lazy-chunk `typeof import()` annotations stay.
14. **Typed lint** (Q12). Default: `projectService`, unless `project` measures faster on the final tsconfig layout (27 s against 32 s on 2026-11-10).
15. **`check:fast`** (Q10): typecheck (`tsc --build`, incremental) plus ESLint on the changed files, about 5 s plus 4 s, target 15 s. The Claude Code layer lives in the plugin (Q7).
16. **A root `CLAUDE.md`:** move the project invariants out of [corpus/CLAUDE.md](../../CLAUDE.md), because they apply outside the corpus.

## Files you OWN

- `tsconfig.base.json` (only `types`, if step 2 puts it there), `packages/geometry/tsconfig.json`, and a new `tsconfig.tests.json` at the root.
- New: `eslint.config.js`, the Prettier config, `.prettierignore`, `.git-blame-ignore-revs`.
- Removed: `biome.json`, and `@biomejs/biome` from `package.json`.
- New: the vendored `house-style` copy with its version header, and a `house-style:sync` script.
- The root `package.json` (scripts, devDependencies, `typescript`) and `package-lock.json`.
- The reformat: whitespace-only changes to every file Prettier covers.
- The 12 `biome-ignore` comments, and the fixes the typed rules ask for in the three type errors' files: `packages/geometry/test/geometry.test.ts`, `packages/geometry/test/rows.test.ts`, `assets/download-list.ts`.
- New: `.claude/rules/web.md`, `.claude/rules/server.md`, `CLAUDE.md`, and `scripts/conventions.json` if an exception is needed.
- Corpus: [wiki/decisions.md](../../wiki/decisions.md), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md), [corpus/CLAUDE.md](../../CLAUDE.md) (the invariants section moves out).

## Files you must NOT touch

- Runtime behaviour. Apart from the fixes named above, every change is formatting or configuration.
- `scenes/*.scene.json`, `assets-src/` and `assets/verified.json`.
- The structure of `apps/api/src` (brief 07) and the UI markup and CSS (brief 06).
- The skills library and the `house-style` repo. A rule that looks wrong for this repo is reported back, not patched locally.

## What to do

One commit per step. After each: `npm run typecheck`, `npm test` and the lint of that step stay green, and from step 2 on `npm run scenes` leaves `scenes/` unchanged (`git diff --exit-code -- scenes`).

1. **TypeScript 6.0.3.** Bump `typescript` (pinned), add `"types": ["node"]` to `packages/geometry/tsconfig.json`, and rerun `npm run typecheck`, `typecheck:web`, `typecheck:scenes` and `typecheck:tools`. Record the counts before and after. Add `pretest` as `tsc --build`.
2. **Close the typecheck gaps.** Add `tsconfig.tests.json`: it extends the base with `noEmit`, `types: ["node"]`, `allowImportingTsExtensions` and `rewriteRelativeImportExtensions`, and includes `packages/*/test/**/*.ts`, `apps/api/test/**/*.ts`, `assets/**/*.ts` and `vitest.config.ts`. Add `"typecheck:tests": "tsc -p tsconfig.tests.json"` to `check`. Fix the three errors without changing behaviour.
3. **Prettier, and the reformat.**
   1. Add `prettier` (pinned) and its config, with `printWidth` 120 (decision 2), `trailingComma: "all"`, the rest default.
   2. Add `.prettierignore`: `*.md`, `scenes/*.scene.json`, `assets-src/`, `package-lock.json`, `**/dist/`, `apps/api/.data/`, `coverage/`.
   3. Add `format` and `format:check`. Commit that alone.
   4. Run `npm run format` and commit only that, as `style: format with Prettier`. Run it when no other brief has uncommitted work. At 120, 80 files change (783 lines); check `packages/scene-tools` tests still pass on the reformatted fixture.
   5. Add that commit's full hash to `.git-blame-ignore-revs`, in its own commit, and hand the owner `git config blame.ignoreRevsFile .git-blame-ignore-revs`.
4. **ESLint replaces Biome.** Build `eslint.config.js` (extending the vendored `house-style` copy, decision 1) with every row of the tables above. Then, in the same commit, delete `biome.json`, remove `@biomejs/biome`, and point `lint` at `eslint .`. Convert the 12 `biome-ignore` comments, each keeping its reason:
   - `apps/web/src/ui/plan/useAreaTools.tsx:81, 256`, `useOpeningTool.tsx:87`, `useWallTool.tsx:73` (`useExhaustiveDependencies`, "reset on identity change only"): to `eslint-disable-next-line react-hooks/exhaustive-deps` if that rule reports them, else delete;
   - `useAreaTools.tsx:177`, `useOpeningTool.tsx:197`, `SceneDialogs.tsx:91, 147, 198` (`noAutofocus`): to `eslint-disable-next-line jsx-a11y/no-autofocus`;
   - `SceneTree.tsx:111` (`useIndexOf`) and `LevelDrawing.tsx:100` (`noArrayIndexKey`): delete the comment, keep the prose reason;
   - `PlanSheet.tsx:52` (`noDangerouslySetInnerHtml`): to a disable of the restricted-syntax rule.

   Add the two `jsx-a11y` findings' disables (`SceneDialogs.tsx:22`, `useAreaTools.tsx:154`) with reasons. Brief 06 deletes all seven. Fix the 4 source `no-unnecessary-type-assertion` findings, the three `vitest` singles and the 8 `no-conditional-expect` sites, or list each left with its reason in the outcome note. Rules at `warn` per decision 10 and, for tests, decision 4. Then fix the 97 source `!` sites per decision 4, one file per commit, running `npm run scenes && git diff --exit-code -- scenes` after each.
5. **The gate.** `check` keeps its shape, with Biome swapped out:
   - `lint` (ESLint), `format:check`, `typecheck`, `typecheck:web`, `typecheck:scenes`, `typecheck:tools`, `typecheck:tests`, `test`, `scenes`, `build:web`, `lint:corpus`;
   - plus `check:conventions` (knip, and the two convention checkers from the skills library, `--warn-only` until briefs 06 and 07 land).

   `check:fast` runs `tsc --build`, then ESLint on files changed against `HEAD` plus untracked ones (`*.ts`, `*.tsx`, `*.js`, `*.mjs`). No shell-only syntax: the owner works under WSL. Time `check:fast` warm with one changed file and `check` in full, and record both.
6. **`.claude/rules/`**, each under about 40 lines.
   - `web.md` (`paths: ["apps/web/src/**"]`): React renders chrome only, the scene graph is imperative; Base UI only through wrappers in `apps/web/src/ui/`; no `^` or `~`; read [wiki/architecture.md](../../wiki/architecture.md).
   - `server.md` (`paths: ["apps/api/src/**", "packages/**"]`): the scene files are the truth and the index is derived; validation lives in `@solstice/schema`; `.js` extensions in relative imports; `config.ts` is the only env reader (brief 07 adds the structure lines).
7. **`CLAUDE.md`** at the root, under about 60 lines: one line on what Solstice is; "read [corpus/index.md](../../index.md) first"; the commands (`npm run dev`, `npm run api`, `npm run check`, `npm run check:fast`, `npx vitest run <file>`, `npm run scenes`, `npm run solstice -- lint <file>`); the places that mislead (`pretest` builds the packages; `assets-src/` is gitignored; the GPU needs X11 under WSL2, see [wiki/running-on-a-gpu.md](../../wiki/running-on-a-gpu.md)); and the project invariants moved from [corpus/CLAUDE.md](../../CLAUDE.md), which keeps its layout and workflow sections.
8. **Corpus.** Add a [wiki/decisions.md](../../wiki/decisions.md) entry "One toolchain: Prettier and ESLint replace Biome", with the width, what is lost (the 0.2 s lint, import order, two Biome rules) and gained, and update [wiki/status.md](../../wiki/status.md) and [log.md](../../log.md). The status line "a lint and format gate (Biome)" is replaced. Run `bash corpus/lint.sh` until it is clean.

## Acceptance

- [ ] `npm run check` passes. Its run time and `check:fast`'s (warm, one changed file) are in the outcome note.
- [ ] `grep -rn "biome" package.json package-lock.json` finds nothing, `ls biome.json` fails, and `grep -rn "biome-ignore" apps packages scenes assets` finds nothing.
- [ ] `npx prettier --check .` passes at width 120. The reformat is one commit, `git diff -w --stat <hash>^ <hash>` shows only the files Prettier covers, and the hash is in `.git-blame-ignore-revs`.
- [ ] `npm run typecheck:tests` exits 0, and `npx tsc --version` prints 6.0.3.
- [ ] **Runtime unchanged:** `npm run scenes && git diff --exit-code -- scenes` prints nothing, and `npx vitest run packages/drawing/test/plan-unchanged.test.ts` passes.
- [ ] `npx vitest run` passes on a tree with every `dist/` deleted (the `pretest` check).
- [ ] `npx eslint . --rule '{"@typescript-eslint/no-non-null-assertion":"error"}'` reports 0 errors in `apps/*/src`, `packages/*/src` and `scenes/src`.
- [ ] A deliberate `enum`, `console.log` in `packages/schema/src/index.ts`, `// TODO`, an unawaited promise and a `<button>` with no `type` each fail `npm run lint`. Revert them after.
- [ ] `.claude/rules/web.md` and `server.md` exist with `paths:` frontmatter, and the root `CLAUDE.md` is under about 60 lines and lists `npm run check`.
- [ ] `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 06 deletes the seven a11y disables and turns `check-base-ui` from `--warn-only` to enforcing. Brief 07 does the same for `check-structure` and adds dependency-cruiser. `n/no-process-env` is an error from step 4 on `apps/api/src` outside `config.ts` and tests: the server has no stray reader today, and `apps/cli/src/solstice.ts:15` and `apps/web/vite.config.ts` are exempt as a CLI and build-time config.
- Brief 06's theme switch changes `apps/web/src/styles.css`, which this brief only reformats.
