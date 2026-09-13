# Task 52 — One pergola costs more to build than the entire house

## Context

From the 2026-09-13 audit, measured rather than inferred.

Generating Greenhollow's subject tier takes **98 ms**. Broken down:

| part | cost |
|---|---|
| all 23 walls, including CSG for 25 openings | 25 ms |
| all slabs | 0.4 ms |
| all roofs | 0.1 ms |
| **`pergola-vine` alone** | **39 ms** |

One entity is **40 % of the whole scene build**, and more than every wall in
every building combined. Removing just its `climber` takes it from 39 ms to
**0.6 ms**, so the cost is entirely the canopy.

`canopy()` (`packages/geometry/src/subject/runs.ts:196`) runs
`length × width × LEAF_DENSITY` = 17.4 × 3.6 × 34 ≈ **2 130 leaf clusters**,
and for each one:

```ts
const a = new THREE.PlaneGeometry(size, size);
a.rotateX(tilt); a.rotateY(spin);
const b = new THREE.PlaneGeometry(size, size);
b.rotateX(tilt); b.rotateY(spin + Math.PI / 2);
const leaf = mergeSimple([a, b]);
a.dispose(); b.dispose();
leaf.translate(...);
out.push(leaf);
```

That is **4 260 `PlaneGeometry` allocations**, 2 130 `mergeSimple` calls (each
of which calls `toNonIndexed()` twice and pushes every vertex into a plain JS
array), 8 520 matrix transforms, and 4 260 disposals — before a final
`mergeSimple` over all 2 130 results and 2 130 more disposals.

**A prototype of the fix was measured**: one shared crossed-quad geometry plus
an `InstancedMesh` carrying 2 130 matrices comes to **0.5 ms against 49 ms** —
a **98× reduction** — for the **same 8 520 triangles and the same single draw
call**. It is strictly better, not a trade.

This matters because `generateScene` runs on **every document revision** (see
brief 51), so the canopy is rebuilt every time anyone edits anything.

## Files you OWN

- `packages/geometry/src/subject/runs.ts`
- `packages/geometry/src/index.ts` — how the climber is attached
- `packages/geometry/test/runs.test.ts`

## Files you must NOT touch

- `LEAF_DENSITY`, `LEAF`, or the crossed-quad shape. How the canopy *looks* is
  settled — two quads crossed so foliage reads from underneath, the reason
  written at `runs.ts:200`. This brief changes how it is **built**, not what it
  draws.
- The two-sided material. A leaf is a plane and a plane has a back
  (`index.ts:212`); that stays.

## What to do

1. **Build one crossed-quad geometry, then instance it.** This is the pattern
   `buildScatterMesh` already uses for the forest, so the path tracer and the
   render-scene teardown already handle `InstancedMesh` — see brief 41's
   instance-buffer disposal.
2. **Per-cluster variation goes in the matrix**, not in the geometry: tilt,
   spin, scale and position compose into one `Matrix4`. Reuse a single
   `Matrix4`/`Quaternion`/`Vector3` across the loop rather than allocating per
   instance.
3. **Keep the output byte-identical in the ways that matter.** The same seed
   must still produce the same canopy: draw the same random numbers in the same
   order, or the vine changes shape and that is a regression in every render.
4. **Measure and record** the before and after in the outcome note, the way
   brief 25 did for the bundle.

## Acceptance

- `pergola-vine` builds in under 5 ms; the real figure is recorded.
- Triangle count and draw calls are unchanged.
- The canopy is visually unchanged at the same seed.
- `npm run check` exits 0.
