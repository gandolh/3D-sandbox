# Task 04: Base UI 1.9.0

**Depends on:**

- In 3D-sandbox: nothing. This brief runs first, so a visual or behavioural change in the later briefs is never blamed on the bump.
- In the owner's skills library: nothing is needed to build it. It is this repo's row of the brief *Every repo on Base UI 1.9.0*, and replaces it for this repo.

**Runs before:** 05, 06 and 07.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

On 2026-11-09 the owner decided that every web app they own runs `@base-ui/react` at the latest stable release, **1.9.0**, pinned exactly. On 2026-11-10 npm's `latest` tag was 1.9.0 and there was no other tag (`npm view @base-ui/react dist-tags --json`). Solstice is on 1.8.0.

### The pin today (read 2026-11-10)

Command: `grep -rn "base-ui" --include=package.json . | grep -v node_modules`.

| File | Spec |
|---|---|
| `package.json` (root) | none |
| `apps/web/package.json:12` | `"@base-ui/react": "1.8.0"`, already exact |
| every other `package.json` | none |

The lockfile resolves one copy: `package-lock.json:106-108`, `node_modules/@base-ui/react` at 1.8.0, with `@base-ui/utils` 0.4.0 (`package-lock.json:144`). So the whole bump is one workspace. The rule "pin exactly" already holds. `.npmrc` sets `save-exact=true`.

### The two breaking changes do not touch this repo

1.9.0 renamed `OTPFieldPreview` to `OTPField` (`@base-ui/react/otp-field`) and `sanitizeValue()` to `normalizeValue()`. Command: `grep -rnE "OTPFieldPreview|otp-field|sanitizeValue" --include=*.ts --include=*.tsx --include=*.md --include=*.json . | grep -v node_modules | grep -v package-lock` printed nothing on 2026-11-10.

### What the repo uses

One primitive, in one file: `apps/web/src/ui/Scroll.tsx:1` imports `ScrollArea` from `@base-ui/react/scroll-area` (`Root`, `Viewport`, `Scrollbar`, `Thumb`, and the `data-hovering` and `data-scrolling` attributes). Command: `grep -rn "@base-ui" --include=*.ts --include=*.tsx apps packages scenes`. No test imports Base UI.

### Measured on a scratch copy, 2026-11-10

On a scratch copy of the repo with the existing `node_modules`, then `npm install @base-ui/react@1.9.0 --save-exact -w @solstice/web --ignore-scripts` (npm 11.19.1, Node 24.22.1):

- `apps/web/package.json` became `"@base-ui/react": "1.9.0"`. No other `package.json` changed.
- **The lockfile stays hoisted.** `node_modules/@base-ui/react` is still the key, now at 1.9.0, and `@base-ui/utils` moved from 0.4.0 to 0.5.0. The diff was 26 lines: the two versions, their `resolved` and `integrity` lines, and range changes (`@babel/runtime` to `^7.29.7 || ^8.0.0`, `reselect` to `^5.3.0`, `use-sync-external-store` to `^1.7.0`). No new package and no other version moved.
- `tsc --noEmit -p apps/web/tsconfig.json`: 0 errors, 5.8 s.
- `vitest run apps/web`: 22 files and 261 tests passed. The baseline on 1.8.0 was not measured, so step 1 records it.
- Peer dependencies (`npm view @base-ui/react@1.9.0 peerDependencies --json`): `react` and `react-dom` `^17 || ^18 || ^19` (this repo is on 19.3.0); `date-fns`, `@date-fns/tz` and `@types/react` are peers too. The repo uses none of the date parts.

**Not measured here, so the steps measure it:**

- The baseline test count on 1.8.0.
- `npm run build:web`, and the scrollbar in a browser.
- The 1.8.0 to 1.9.0 changelog. Read it for anything that touches `ScrollArea`.

## Owner decisions (defaults this brief builds)

1. **Pin 1.9.0 exactly.** Default: yes, through `npm install ... --save-exact`. No range.
2. **Nothing else moves.** Default: no general `npm update` and no other dependency. The lockfile diff is Base UI's own tree and nothing else.
3. **A visual change the bump causes** is logged in the outcome note and left. Brief 06 owns the markup and the wrappers.

## Files you OWN

- `apps/web/package.json` (the one line) and `package-lock.json`.
- A source file only if a breaking or behavioural change forces it. Expect none.
- [log.md](../../log.md): the existing entry that names 1.8.0 stays as history; add the new entry below it.
- [wiki/status.md](../../wiki/status.md): one dated line.

## Files you must NOT touch

- Any other dependency, `tsconfig*.json`, `biome.json` and every file under `apps/web/src/` except as the first bullet allows.
- The three scene files and `assets-src/`.

## What to do

One commit for the whole bump, after step 1 is recorded.

1. **Baseline on 1.8.0.** Run `npm run typecheck:web` and `npx vitest run apps/web`. Record the counts. Read the 1.9.0 changelog for `ScrollArea`.
2. **Bump.** `npm install @base-ui/react@1.9.0 --save-exact -w @solstice/web`. Check `git diff --stat`: only `apps/web/package.json` and `package-lock.json` changed, and the lockfile diff is the list above.
3. **Check.** `npm run typecheck:web`, `npx vitest run apps/web`, `npm run build:web`. Open the built app and scroll the Inspector and the scene tree: the thumb shows on hover and while scrolling, as before.
4. **Corpus.** Add a [log.md](../../log.md) entry and a [wiki/status.md](../../wiki/status.md) line. Run `bash corpus/lint.sh` until it is clean.

## Acceptance

- [ ] `grep -n '"@base-ui/react"' apps/web/package.json` prints `"1.9.0"` with no `^` or `~`.
- [ ] `node -e 'const l=require("./package-lock.json").packages; console.log(l["node_modules/@base-ui/react"].version)'` prints `1.9.0`, and `grep -c 'node_modules/@base-ui/react"' package-lock.json` prints `1`.
- [ ] `git diff --stat HEAD~1` lists only `apps/web/package.json`, `package-lock.json`, `corpus/log.md` and `corpus/wiki/status.md`.
- [ ] `npm run typecheck:web` and `npm run build:web` exit 0, and `npx vitest run apps/web` passes with the same test count as the 1.8.0 baseline.
- [ ] `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 06 builds on 1.9.0, so its wrappers are written against the 1.9.0 types.
- The bump is a one-line dependency change in a game repo. It needs no deploy: the static client is published by the estate's deploy repo, by the owner.
