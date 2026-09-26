# Task 65 — The bake writes the atlas where nothing will look for it

## Context

From the 2026-09-20 audit. The impostor bake harness is documented in
`assets.md` as working, and `open-questions.md` records the two unbaked conifers
as deferred "for machine time rather than for any unknown". **There is an
unknown.** Baking them would not have worked.

`assets/bake/serve.ts:88`:

```ts
const outDir = resolve(assetsRoot, dirname(asset), "impostor");
```

with a comment saying this is "what the manifest scan will pick up". `asset` is
an id like `polyhaven/pine_tree_01`, so `dirname(asset)` is `polyhaven` and the
atlas lands in `assets-src/polyhaven/impostor/`.

But `assets/manifest.ts:99` looks for the atlas **inside each asset's own
directory**:

```ts
const atlas = files.find((f) => f === "impostor/atlas.png");
```

i.e. `assets-src/<source>/<slug>/impostor/atlas.png`.

**Verified by execution during the audit**, running `readManifest` over that
exact layout:

- `polyhaven/pine_tree_01` comes back with `impostor = null`, so the forest
  silently falls through to proxy geometry — the failure is invisible.
- A **phantom entry** `id = polyhaven/impostor` appears in the manifest. That
  feeds `knownAssets`, which is the set `asset-resolves` trusts — the rule
  `decisions-scene.md` describes as "the only thing standing between an invented
  Poly Haven slug and a committed scene".
- Every `polyhaven/*` asset resolves to the **same** output directory, so baking
  a second asset overwrites the first one's atlas.

This is distinct from the recorded known-open that those impostors are unbaked.
This is *why* baking them would not have helped.

## Files you OWN

- `assets/bake/serve.ts` — the output path
- `assets/test/` — add coverage here
- `corpus/wiki/open-questions.md` — the conifer entry needs a correction once this
  is fixed

## Files you must NOT touch

- `assets/manifest.ts`'s scan convention. `<source>/<slug>/impostor/atlas.png` is
  the layout the committed atlases already use and that the loader expects — the
  writer is wrong, not the reader.
- `assets/bake/paths.ts` — `insideRoot()` and `ASSET_ID` are brief 31's
  containment work and are correct. Keep the containment check applying to the
  corrected path.

## What to do

1. Write the atlas to the asset's own directory: the id, not its `dirname`.
2. Fix the comment, which currently asserts the broken behaviour is correct.
3. Keep `insideAssets(outDir)` guarding the corrected path — the containment
   check must not be weakened by the move.
4. Add a test that bakes to a temp root and asserts `readManifest` then reports a
   non-null `impostor` for that asset **and** that no phantom `<source>/impostor`
   entry appears. Asserting the file exists somewhere is not enough — the whole
   defect is that it existed at the wrong path.
5. Check whether any committed atlas currently sits at the wrong path, and say so
   in the outcome.

## Acceptance

- Baking `polyhaven/pine_tree_01` produces
  `assets-src/polyhaven/pine_tree_01/impostor/atlas.png`.
- `readManifest` reports that asset with a populated `impostor`, and reports no
  `polyhaven/impostor` entry.
- Baking two assets from the same source leaves both atlases intact.
- `npm run check` exits 0.
