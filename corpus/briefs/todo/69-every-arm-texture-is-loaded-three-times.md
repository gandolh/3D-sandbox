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
