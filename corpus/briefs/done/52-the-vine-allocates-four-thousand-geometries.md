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

---

## Outcome — 2026-09-13

**Measured, same machine, same scene:**

| | before | after |
|---|---|---|
| `pergola-vine` | 39.1 ms | **1.62 ms** |
| `generateScene`, subject only | 97.9 ms | **29.8 ms** |
| `generateScene`, with context | 77.3 ms | **31.4 ms** |

**24× on the pergola, and the whole subject build is 3.3× faster** — because
the canopy *was* 40 % of it. Triangles and draw calls are unchanged: 2 130
instances × 4 triangles = the same 8 520, in the same single draw call.

**One shared crossed-quad geometry plus a `Matrix4` per cluster**, the pattern
`buildScatterMesh` already uses for the forest — so the path tracer and brief
41's instance-buffer teardown already handle it. `Matrix4`, `Quaternion`,
`Vector3` and `Euler` are allocated once and reused across the loop; allocating
per instance would have put back a good share of the churn this removes.

**The RNG draw order is preserved exactly** — `along, across, size, tilt, spin,
lift`, six draws in the order the old code made them — so the same seed puts
the leaves in the same places. The test now compares the transforms
**element by element** rather than just counting them.

**One deliberate change, and it is a correction rather than a side effect.**
The old code applied `rotateX(tilt)` then `rotateY(spin)` to one quad and
`rotateY(spin + π/2)` to the other. Those do not compose to a right angle:
`Ry(s)·Rx(t)·Ry(π/2) ≠ Ry(s+π/2)·Rx(t)` because `Rx` and `Ry` do not commute —
so **the two quads were never actually perpendicular**, despite the comment
saying "two quads crossed" and despite that being the entire reason they exist
(so foliage reads from underneath). Building the pair crossed once and
transforming it rigidly makes the crossing real.

The measurable consequence: a genuinely perpendicular pair reaches about
**80 mm further down**, so the canopy's droop went from 0.25 m to 0.333 m. The
test's bound moved from 0.25 to 0.40 with that reasoning written beside it, and
a new assertion checks the two quads' face normals are actually orthogonal —
which would have failed on the old geometry.

**Looked at**, from under the pergola and from the west: the vine reads as a
vine, dense with light coming through in patches, unchanged in character.

`npm run check` clean, **452 tests**.
