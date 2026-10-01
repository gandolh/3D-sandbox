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

## Outcome — 2026-10-01

**It was three defects, not one.** Baking would not have worked at all:

1. **The server did not start.** `serve.ts` imported `./paths.js`, which Node's
   type stripping does not remap to `.ts`. This is the same defect brief 60
   fixed for the API, and `assets/` is under no tsconfig, so nothing caught it.
   Now `./paths.ts`.
2. **The page's upload was refused.** `impostor.js` POSTs the `asset` query
   parameter, which is the **glTF path** (`polyhaven/pine_tree_01/…_2k.gltf`).
   Brief 31 tightened `ASSET_ID` to exactly `<source>/<slug>`, so every real
   upload got a 400. The page now sends the first two segments.
3. **The write path**, as the brief says. Read against (2), `dirname` was
   *correct* for the glTF path the page used to send, and became wrong when
   brief 31 changed what the id had to be.

The write is now `assets/bake/write.ts` (`impostorDir`, `writeImpostor`),
testable without binding a port. `ASSET_ID` and `insideRoot` still guard the
corrected path, and a bad id is a `BakeTargetError` → 400.

Tests bake into a temp root and read it back with `readManifest`: the impostor
is attached to the right asset, there is no phantom `polyhaven/impostor`, and
two same-source bakes leave both atlases. Traversal ids are still refused.
**Mutation:** restoring `dirname(asset)` fails 3 of 4.

**Verified end to end against the real server.** It starts and serves the page
(200), and answers a traversal id with 400. A POST for a throwaway
`polyhaven/zz_bake_probe` wrote `…/zz_bake_probe/impostor/atlas.png`, which
`readManifest` reported as that asset's impostor (the probe was then
removed). A full GPU bake was not rerun.

**No committed atlas is at the wrong path.** `tree_small_02`'s is at
`polyhaven/tree_small_02/impostor/`, so it was evidently placed by hand.
`open-questions.md`'s conifer entry is corrected.
