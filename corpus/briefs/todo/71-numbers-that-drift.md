# Task 71 — Numbers that drift

## Context

From the 2026-09-20 audit. The README already argues this brief's case, in its
own words:

> **Sizes are in `assets-src/DOWNLOADS.md`**, which `npm run assets` regenerates
> from the scenes themselves. They are not repeated here on purpose: this file
> said 135 MB in one paragraph and 88 MB five lines later, and both were wrong.
> **A number that drifts is worse than a pointer to the one that cannot.**

The policy was stated and then not applied elsewhere. Two live instances:

**1. `apps/web/src/engine/AssetLoader.ts:17`** says the downloads are

> 17 assets are 135 MB

The generated source of truth, `assets-src/DOWNLOADS.md:52`, says:

> Fetched by `download.sh`: **162.0 MB** across 17 assets.

A 20 % drift. Confirmed by running `npm run assets` and diffing, and by checking
the committed `DOWNLOADS.md` already said 162.0 MB. Nothing checks prose against
the generated file, so it went unnoticed — and 135 MB is precisely the stale
figure the README says was wrong.

**2. `.github/workflows/check.yml:4`** says `npm run check` is

> typecheck × 3, **454 tests**, the scene build, the lint and the corpus lint

The suite is **459** — verified twice locally and once in a clean clone. The
comment has not been touched since before commit `f275a46`, whose own message
says "459 tests".

Neither is dangerous on its own. Both are the same defect: **a hand-written
number duplicating a source of truth that can be generated or measured.** The
fix worth doing is not "change 135 to 162" — that drifts again next month. It is
to apply the policy the README already wrote down.

## Files you OWN

- `apps/web/src/engine/AssetLoader.ts` — the doc comment only
- `.github/workflows/check.yml` — the header comment only
- `corpus/lint.sh` — if you choose to add a check there

## Files you must NOT touch

- `assets-src/DOWNLOADS.md` and `assets/download-list.ts` — the generator is
  correct and its output is the source of truth.
- Any behaviour. This brief changes comments, and possibly adds one check. It
  changes no code path.
- The README's own asset-size paragraph — it already does the right thing.

## What to do

1. **Prefer deletion or a pointer to a correction.** `AssetLoader`'s comment does
   not need a figure at all — its point is that downloads are gitignored, and it
   can say so and point at `DOWNLOADS.md`. The CI comment does not need a test
   count. A number removed cannot drift.
2. Where a number genuinely earns its place, make something check it. Weigh
   whether `corpus/lint.sh` — which already exists and already fails the build —
   is the right home for a check that prose figures match their generated source.
   If you judge that not worth the machinery, say so explicitly in the outcome;
   this brief is satisfied by a reasoned "no" as long as the stale figures are
   gone.
3. Grep the whole repo for other hand-written counts and sizes — MB figures, test
   counts, triangle counts, timing claims — and report what you find. Note that
   timing claims like the workflow's "9 s warm" are machine-dependent and
   arguably fine; say which you left and why.

## Acceptance

- No comment in the repo states an asset size that disagrees with
  `assets-src/DOWNLOADS.md`, and none states a test count that disagrees with the
  suite.
- The sweep for other drifting numbers is recorded, including the ones
  deliberately left.
- `npm run check` exits 0.
