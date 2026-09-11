# Task 01 — Scene document schema and linter

## Context

The foundation slice. Every other subsystem — the geometry generator, the editor,
the Fastify API — reads the scene document, so its shape and its validation have
to exist before anything else can be built against them.

The requirement that shapes this work: **documents are AI-authored**. Scenes are
written in this repo by a human and Claude together, which means the failures that
actually occur are not malformed JSON but *plausible-looking nonsense* — an opening
on a wall too short to hold it, a roof that covers nothing, a material id that was
never defined. Shape validation does not see any of that.

See [decisions.md](../../wiki/decisions.md) for the locked calls this builds on.

## Files you OWN

- `package.json`, `.npmrc`, `.gitignore`, `tsconfig.base.json`, `tsconfig.json`,
  `vitest.config.ts`
- `packages/schema/**`
- `scenes/**`

## Files you must NOT touch

- `corpus/wiki/decisions.md` — settled; a change there needs an explicit revisit.

## What to do

1. npm workspaces monorepo, every version pinned exactly, `save-exact=true`.
2. `packages/schema` — Zod schema for the scene document. Strict objects
   throughout, so a typo'd key fails loudly instead of being silently stripped.
   Metres and degrees on disk; the `subject`/`context` tier split in the type.
3. The **linter** — a semantic pass over an already-parsed document, covering
   referential integrity (materials, assets, ids) and geometry (openings within
   their walls, roofs over their levels, polygons with area).
4. `loadScene` — parse, then lint, then throw on any error. Nothing in this
   project ever writes an invalid document.
5. TypeScript authoring helpers, and a build step that emits canonical JSON.
6. One complete reference scene that exercises every part of the schema.

## Acceptance

- `npm run check` passes: build, typecheck, tests, scene build, corpus lint.
- Every lint rule has a test proving it fires, and where a rule has a tempting
  false positive, a test proving it does not.
- The committed `.scene.json` is byte-identical to a fresh build from source.

---

## Outcome — 2026-09-11

Shipped as specified. 39 tests, all passing.

**Twelve rules**, in `packages/schema/src/lint/rules/`: `unique-ids`,
`wall-not-degenerate`, `opening-fits-wall`, `opening-fits-height`,
`openings-do-not-overlap`, `roof-covers-walls`, `polygons-have-area`,
`material-resolves`, `asset-resolves`, `scatter-density-is-sane`,
`shot-camera-is-valid`, `materials-are-used`.

Three decisions made during the work, none of which contradict the brief:

- **`asset-resolves` is opt-in.** It runs only when a manifest is passed. There is
  no manifest during early authoring, and a rule that always fires is a rule people
  learn to ignore.
- **`scatter-density-is-sane` exists** to guard the two-tier decision at the only
  point in the document where one number produces unbounded geometry. It estimates
  instance count from area minus exclusions and warns past 4 000.
- **Openings are checked in two dimensions, not one.** A transom directly above a
  door shares the door's span along the wall but not its height, and rejecting that
  would have been a false positive on a completely ordinary detail. There is a test
  for it.

Deferred: schema migrations (`schemaVersion` is stamped, no mechanism yet — see
[open-questions.md](../../wiki/open-questions.md)); polygon self-intersection
checks; `heightfield` terrain is in the schema but nothing validates sample counts.
