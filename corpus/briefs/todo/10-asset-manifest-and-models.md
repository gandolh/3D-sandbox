# Task 10 — The asset manifest and real models

## Context

`asset-resolves` has never run on a real scene. It only fires when `knownAssets`
is supplied, and the only callers that supply it are two tests — so **eight of
Greenhollow's thirteen asset slugs do not exist**, verified 404 against
`api.polyhaven.com`:

```
apple_tree_01  pear_tree_01  plum_tree_01  rose_bush_01
rose_bush_02   vegetable_bed_01  Fountain_01  GardenBench_01
```

They were committed one change after the corpus note in
[assets.md](../../wiki/assets.md) warning about exactly this failure mode. A rule
that is written down and never armed is not a rule.

Poly Haven has **no fruit trees, no roses, no fountain and no vegetable bed**.
The decision — see [decisions-scene.md](../../wiki/decisions-scene.md) — is honest
substitution from what exists, not per-asset licence hunting on Sketchfab.

## Files you OWN

- `assets/manifest.ts` (new) — scan `assets-src/`, emit the manifest
- `assets/download-list.ts` (new) — emit slug → URL → target path
- `scenes/build.ts` — pass `knownAssets` to `loadScene`
- `packages/geometry/src/assets.ts` (new) — glTF load + bounds cache
- `packages/geometry/src/index.ts` — placements use real models
- `packages/physics/src/{colliders,world}.ts` — placements as colliders
- `scenes/src/greenhollow.ts`, `scenes/src/villa-carpathia.ts` — real slugs
- `package.json` — wire the manifest into `check`
- `.gitignore`, `corpus/wiki/assets.md`

## Files you must NOT touch

- `apps/api` — the manifest is a build-time concern, not a served one.
- `apps/web/src/engine/*` beyond what loading models requires.

## What to do

1. **Generate the manifest by scanning `assets-src/`.** Not hand-maintained: it
   would be a second copy of what the filesystem says, and it would drift the
   first time a download moved. Same shape as the SQLite scene index — files are
   truth, the index is rebuildable.
2. **Arm it.** `scenes/build.ts` passes `knownAssets`; `npm run check` fails when
   a scene names an asset that is not there. This is the whole point of the brief.
3. **Emit a download list** as a build artefact — slug, source URL, target path,
   licence — because downloads are done by hand. Make it the thing the user works
   from, not a wiki page that goes stale.
4. **Substitute the eight missing slugs** with what exists:

   | Wanted | Use | Note |
   |---|---|---|
   | orchard fruit trees | `tree_small_02` | rows are what make it an orchard, not species |
   | roses | `shrub_01`–`shrub_04` | temperate, from `verdant_trail` |
   | vegetable beds | `planter_box_01`–`03` | closer to a kitchen garden than a bed of nothing |
   | garden bench | `painted_wooden_bench` | exists |
   | fountain | — | drop it; the pond stands alone |

   Verify **every** slug against `api.polyhaven.com/info/<slug>` before committing.
5. **Load real glTF** for placements and scatter, replacing the proxy box and
   proxy cone. Cache by asset id; the geometry package must stay headless-testable,
   so the loader is injectable and tests use a stub.
6. **Placements collide with each other.** A real model has a real bounding box,
   which is exactly what was missing before — a proxy box has no honest size. Add
   settled placements to the physics world so drop-to-rest stacks rather than
   interpenetrates.

## Acceptance

- `npm run check` **fails** if a scene names a missing asset. Prove it by
  temporarily breaking one.
- Both scenes reference only slugs that resolve 200.
- The download list is a real file a person can work from.
- Dropping one placement onto another rests it on top, with a test.
- Verified in the browser on the GPU: Greenhollow renders with real models.
