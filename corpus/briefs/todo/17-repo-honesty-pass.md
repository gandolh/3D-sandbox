# Task 17 — Repo honesty pass

## Context

Small things that are individually trivial and collectively make the repo lie to
whoever opens it next. Found by auditing the project against what it claims,
2026-09-11.

- **`xatlas-web@0.1.0` is a dependency of `apps/web` and is imported nowhere.**
  It was pinned for UV unwrapping that `boxProjectUv` ended up doing instead.
- **`corpus/wiki/overview.md` says `apps/web` and `apps/api` are "not yet
  built".** Both have been built since briefs 04 and 05. It is the first page a
  fresh agent is told to read, and its table is wrong.
- **There is no `README`.** Nothing at the repo root says what this is or how to
  run it. `npm run dev`, `npm run api`, `npm run check`, `npm run assets` and the
  WSL GPU flags all live only in the corpus.
- **`apps/web` has one test file for eighteen source files.** The engine, the
  store and the asset loader have none. This is defensible — the deliberate
  design is that logic lives in headless packages — but `shot.ts` proves the web
  app *can* hold testable logic, and `store.ts` and `AssetLoader.ts` both have
  some.
- **`Timeline.tsx` describes a feature that does not exist** (see
  [brief 14](../done/14-animation-time.md)). If 14 lands first this fixes itself; if
  not, the comment goes.

## Files you OWN

- `apps/web/package.json`
- `README.md` (new)
- `corpus/wiki/overview.md`
- `apps/web/test/` — new tests
- `apps/web/src/ui/Timeline.tsx` — the comment only

## Files you must NOT touch

- Anything in `packages/`. This brief removes untruths; it does not change
  behaviour.

## What to do

1. **Remove `xatlas-web`** and confirm the build is unaffected. If it turns out
   to be load-bearing, that is a finding — say so rather than leaving it.
2. **Fix `overview.md`**, including the "not yet built" table, and check the rest
   of the page against what exists now.
3. **Write a README** for a person cloning this cold: what it is, `npm install`,
   `npm run dev`, `npm run check`, `bash assets-src/download.sh`, and a pointer to
   the corpus for everything else. Short. It is a front door, not a manual.
4. **Test what is testable in `apps/web`** — the store's reducers and
   `AssetLoader`'s index handling, which has four separate failure paths that all
   silently fall back to proxies and none of which are exercised.
5. **Make `Timeline.tsx` honest.**

## Acceptance

- `npm run check` green with `xatlas-web` gone.
- `overview.md` describes the project as it is.
- A README that gets someone from clone to a rendered scene.
- Tests covering the asset loader's fallback paths.
