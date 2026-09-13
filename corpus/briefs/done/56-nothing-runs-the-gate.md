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

---

## Outcome — 2026-09-13

`.github/workflows/check.yml`: one job, on push and pull request to `main`,
running `npm ci && npm run build && npm run check`. Nothing else, per the
brief — if a future brief adds a tool it goes inside `check` and needs no
second job.

**`npm run build` is there for a reason worth stating.** `check` does not build
the packages, and the workspaces import each other's `dist`. Locally that is
always already there; on a clean checkout it is not, so CI would fail on the
first typecheck with a module-not-found that looks like a code error.

Node pinned to **22.12**, matching `engines`. That is load-bearing rather than
incidental here: `scenes/build.ts` and `assets/download-list.ts` are run
directly by Node's type-stripping, so the version decides whether they parse at
all. Concurrency cancels superseded runs — there is nothing to learn from a run
against a commit that has been replaced.

**Verified by actually doing it, not by reading the YAML.** I cloned the repo
into a temp directory and ran the three commands. The first attempt **failed**:

```
sh: 1: biome: not found
```

**And that was a real defect, not a test artefact.** Biome had been installed
into `node_modules` during brief 53 but never reached `package.json` or the
lockfile — the `git checkout -- .` I used while comparing formatter widths
reverted both, and `npx biome` kept working locally off the surviving
`node_modules`. **A clean checkout had no linter at all**, and `npm run check`
would have died on its first step for anyone but me.

Fixed in its own commit, then re-verified on a second fresh clone: `npm ci`,
`npm run build`, `npm run check` — 454 tests, corpus clean, no missing binary.

That is the same lesson as brief 33's README fix, which is why the brief asked
for proof rather than plausibility: **verify by running, not by reasoning.**
The CI file is the thing that will keep catching this class, and it caught one
before it was even committed.
