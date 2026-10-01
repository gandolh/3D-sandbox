# Task 69 — Every ARM texture is loaded three times

## Context

From the 2026-09-20 audit. The manifest knows one file fills three roles; the
loader does not.

`assets/manifest.ts:24-38` says so explicitly:

> Poly Haven packs ambient occlusion, roughness and metalness into one `arm`
> texture — R, G and B respectively — which is exactly how three.js reads
> `aoMap`, `roughnessMap` and `metalnessMap`, **so one file fills three roles.**

and the patterns confirm it — `roughnessMap`, `metalnessMap` and `aoMap` all test
`/_arm_/`, so all three map to the same filename.

`apps/web/src/engine/AssetLoader.ts:128` then loads per **role**, with no
per-path cache:

```ts
Object.entries(entry.maps).map(async ([role, path]) => {
  const texture = await textures.loadAsync(`/assets-src/${path}`);
```

`THREE.Cache.enabled` is never set anywhere in this repo — verified by grep
across `apps/`, `packages/` and `assets/` — and it defaults to `false`. So the
identical file is **fetched, JPEG-decoded and uploaded to the GPU three separate
times**, producing three independent `THREE.Texture` objects that are never
shared.

**Measured against the real tree during the audit**: `readManifest()` over the
actual `assets-src/` shows `roughnessMap === metalnessMap === aoMap` for
`polyhaven/clay_plaster`, `leafy_grass`, `roof_tiles_14`, `coast_sand_rocks_02`
and `plaster_brick_pattern`. `clay_plaster_arm_2k.jpg` is 1,449,174 bytes on
disk, decoding to roughly 16 MB raw at 2048×2048×4 — paid three times over, per
material, at every scene load.

End-to-end decode wall-clock was **not** measured (it needs a browser decode path
this machine does not have), so the brief should report the real number.

## Files you OWN

- `apps/web/src/engine/AssetLoader.ts`
- `apps/web/test/asset-loader.test.ts`

## Files you must NOT touch

- `assets/manifest.ts` — mapping one ARM file to three roles is correct and is
  how three.js wants it. The manifest is right; the consumer ignores it.
- The colour-space handling. Only `map` is sRGB and the rest are data — that
  comment is correct and load-bearing, and **it is the reason a naive shared
  texture is not automatically safe**: see below.
- Per-scene asset disposal (brief 39) — whatever you share must still be disposed
  exactly once.

## What to do

1. **De-duplicate by path within a material load.** The three ARM roles resolve
   to one file, so fetch and decode it once.
2. **Mind the colour space, which is the trap.** `texture.colorSpace` is set
   per-role on the returned object. All three ARM roles are `NoColorSpace`, so
   one shared texture is safe *today* — but confirm that holds for every
   role-pair that can collide, and make it impossible for a future map pattern to
   share a texture across a role boundary that needs different settings. The
   `wrapS`/`wrapT`/repeat settings need the same consideration.
3. **Get disposal right.** Three references to one texture must not become three
   `dispose()` calls on it. Whatever sharing scheme you pick, a scene switch must
   still free everything exactly once — brief 39 and brief 40 are the precedent
   for why this matters.
4. Decide whether the right fix is local de-duplication or `THREE.Cache.enabled`,
   and say why. Cache is one line but is global, process-wide and never evicts,
   which interacts badly with per-scene disposal — local is probably right, but
   make it a decision rather than an accident.
5. **Measure and report**: fetches issued, textures created, and load wall-clock
   for a scene using Poly Haven materials, before and after. The repo's own
   history says measuring changed the conclusion twice; do not skip it.

## Acceptance

- Loading a scene with a Poly Haven material issues **one** request for the ARM
  file and creates one texture for it, with `roughnessMap`, `metalnessMap` and
  `aoMap` all referring to it.
- Switching scenes still disposes every texture exactly once — no double-dispose,
  no leak.
- A test asserts the de-duplication (count the loader's calls) and fails if it is
  removed — verify by mutation.
- The before/after measurement is recorded in the outcome.
- `npm run check` exits 0.

## Outcome — 2026-10-01

`textureGroups(maps)` groups a material's roles by **path + colour space**.
Each group is loaded once and filled into all its roles. Colour space is in
the key so that a file mapped to both `map` and a data role gets two textures
rather than sharing one decode. Wrapping is identical for every role, so it is
not in the key. On abort a group's texture is disposed once.

**Local, not `THREE.Cache`:** the cache is global and never evicts, and it
dedupes bytes, not `Texture`s, so the uploads would still triple. Disposal: the
library deliberately outlives documents (brief 39), and `material.dispose()`
never frees maps, so the abort path is the only texture `dispose()`. It is
tested to be called exactly once per texture.

**Measured** in Chrome, cold session per run, calling `loadAssets()` directly
through the dev server against the real `assets-src/`:

| | before | after |
|---|---|---|
| material role references | 36 | 36 |
| `Texture` objects created | **36** | **26** |
| network requests for `_arm_` files | 5 | 5 |
| `loadAssets()` wall-clock | 6.8 s, 7.0 s | 7.4 s, 7.0 s |

**The audit's "fetched three times" was wrong at the network layer.** Chrome
coalesces concurrent loads of one URL, so each ARM file was always one
request. What tripled was the `Texture`s: five materials share now (the
measurement names them), 10 fewer objects, and 10 fewer GPU uploads of a
2048² RGBA image (~16 MB each, ~21 MB with mipmaps, so roughly 200 MB of GPU
memory). Wall-clock is unchanged within noise, as expected: three.js uploads
lazily at first render, and model loading dominates `loadAssets`.

Tests: one ARM load fills three roles with the same `NoColorSpace` object; no
sharing across a colour-space boundary; dispose exactly once on abort.
**Mutations:** keying by role fails the dedup test; keying by path alone fails
the colour-space test.
