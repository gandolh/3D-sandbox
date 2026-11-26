# Task 08: The colour mode is kept under Solstice's own key

**Depends on:** nothing.
**Runs before:** the next `node cli.ts solstice deploy`.
**Builder:** Sonnet.
**Before you start:** run `brief-board guide` (the repo's `CLAUDE.md` says so).

Filed 2026-11-25. The owner reported that the colour-mode picker acts per account rather than per app: picking Dark in
one app turns the other apps dark too.

## Context

Solstice is served under a path of the shared domain, so it shares one localStorage with every app served there. It
keeps the Light / Dark / System choice under the bare key `theme`, and so do six others: brief-board, Mercatus, Gazette, Lantern, ro-housing, Wicket. Whichever app
writes the key last sets the mode for all seven. Ward stores no display settings, so the account plays no part. The
bare key came from the base-ui skill's theme reference, which my-personal-skills brief 52 changes to `<app>.theme`.
Almanac (`almanac.theme`) and Shelfmark (`shelfmark.theme`) already work this way.

Where the key is today:

- `apps/web/index.html`: the boot script, line 11
- `apps/web/src/state/store.ts`: `THEME_KEY`, line 19
- `apps/web/test/theme.test.tsx`: the theme tests

## Decisions

All settled. None of them is open.

- **The key is `solstice.theme`**: the app's path name plus `.theme`, the form brief 52 puts in the reference.
- **The old value carries over once.** When `solstice.theme` holds nothing valid and the bare `theme` holds `light`, `dark` or
  `system`, the app uses that value and writes it to `solstice.theme`. It never writes or deletes the bare key, since apps
  not yet renamed still read it. The boot script and the store both do this, so the first paint and the store agree.
- **The old key's name says legacy** (`LEGACY_THEME_KEY` in the store), so the house-style 1.4.0 check for a bare
  `"theme"` key lets the one-time read through.
- Nothing else changes: the same three choices, light on a first visit, the same switch.

## Files you OWN

- `apps/web/index.html`, `apps/web/src/state/store.ts`, `apps/web/test/theme.test.tsx`
- `corpus/wiki/status.md`, `corpus/log.md`, and the wiki page that describes the theme switch, if one names the key

## Files you must NOT touch

- Any other source file, the vendored house-style copy, other repos.

## Steps

1. Change the key in the boot script and the store to `solstice.theme`, with the one-time carry-over in both.
2. Tests for the store: a stored `solstice.theme` wins over the bare `theme`; with only a bare `dark` stored, the app starts
   dark and `solstice.theme` becomes `dark`; the bare key is never written; an unknown value in either reads as light.
3. Every e2e fixture or spec that seeds the mode writes `solstice.theme`.

## Acceptance

- [ ] `npm run check` exits 0.
- [ ] The e2e specs you changed pass, run the way the repo's `CLAUDE.md` runs them.
- [ ] On the dev server: choose Dark, then set the bare `theme` to `light` in the console (as another app would)
      and reload. The page stays dark.
- [ ] `bash corpus/lint.sh` passes.

## Owner steps

- `node cli.ts solstice deploy` from vps-deploy (the web build only; no server restart). On the first load after it, Solstice takes the mode last picked in any
  app, once; from then on it keeps its own.

## Owner decisions

- Settled 2026-11-25 (owner): "color-mode picker should be per app, not per ward account." The key, the carry-over
  and the legacy name are the controller's calls, the same in all seven apps.
