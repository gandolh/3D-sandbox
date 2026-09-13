# Task 56 — There is a gate, and nothing runs it

## Context

From the 2026-09-13 audit. There is **no CI of any kind** — no `.github/`, no
other CI config anywhere in the repo.

The gate itself already exists and is good: `npm run check` runs three
typechecks, 430 tests, the scene build and the corpus lint, in **9.3 s warm**
(a cold `tsc --build` is 3.2 s). Nothing runs it except a person remembering to.

Two things this repo already treats as load-bearing are checked **only** by
that command:

1. **`asset-resolves`**, in the scene build. Its own record says eight invented
   Poly Haven slugs shipped in Greenhollow before that rule was armed. It is
   the only thing standing between a hallucinated asset id and a committed
   scene.
2. **`corpus/lint.sh`**, which checks the wiki's frontmatter, link resolution,
   page size and brief numbering — the machinery the whole corpus workflow
   rests on.

Both are exactly the kind of check that is most valuable when someone is moving
fast, which is the moment they are least likely to be run.

## Files you OWN

- `.github/workflows/` (or the equivalent for whichever host)
- `README.md` — a badge or a line, if it earns one

## Files you must NOT touch

- `npm run check` itself. CI runs the gate that exists; it does not become a
  second, different gate that can disagree with the local one.
- Deployment. That lives in the `vps-deploy` estate and is explicitly out of
  scope for this repo.

## What to do

1. **One workflow, on push and on pull request to `main`:**
   `npm ci && npm run build && npm run check`. Nothing else.
2. **Pin the Node version to what `engines` says** (`>=22.12`), and pin the
   action versions — the same reason every dependency here is pinned exactly.
3. **Cache `node_modules` on the lockfile hash**, since the whole run is ~10 s
   and install would otherwise dominate it.
4. **Do not add jobs for things that do not exist yet.** If brief 53 lands a
   linter, it is already inside `npm run check` and needs no separate job.

## Acceptance

- A pull request that breaks a test, a typecheck, a scene or the corpus lint
  goes red.
- A clean checkout goes green.
