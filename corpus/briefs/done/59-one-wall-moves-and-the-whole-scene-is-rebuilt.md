# Task 59 — Move one wall, rebuild everything

## Context

From the 2026-09-13 audit. This is the structural one, and it should be read
**after** briefs 51 and 52, which remove most of the pain without touching the
design.

Every document change bumps `revision` (`apps/web/src/state/store.ts:209`), and
`Viewport`'s effect is keyed on it:

```ts
useEffect(() => {
  if (doc !== null) engineRef.current?.setDocument(doc, { includeContext: showContext });
}, [doc, revision, showContext]);
```

`setDocument` disposes the generated scene and calls `generateScene` over the
**entire document** — every wall's CSG, every run's canopy, every roof, slab,
mass, road, paving polygon and scatter field — regardless of what changed.

**Measured, per edit:**

| scene | full regenerate |
|---|---|
| greenhollow | **98 ms** |
| elmsgate | 7 ms |
| villa-carpathia | 5 ms |

Greenhollow is the default scene and the one that will keep growing. Nudging a
wall by 10 mm re-cuts 25 openings with `three-bvh-csg` (25 ms) and rebuilds
2 130 leaf clusters (39 ms) that no edit touched.

This is **by design** and the design is defensible: geometry is derived, never
stored, and regenerating everything is what makes it impossible for the scene
graph to disagree with the document. That invariant is worth a great deal and
must survive whatever this brief does.

But "derived" does not have to mean "recomputed". Nothing currently
distinguishes *deriving* geometry from *rebuilding* it, and the cost now scales
with the size of the scene rather than the size of the edit.

## Files you OWN

- `packages/geometry/src/index.ts` — the generator's entry point
- `apps/web/src/engine/SandboxEngine.ts` — `setDocument`
- `packages/geometry/test/`

## Files you must NOT touch

- The parametric-semantic decision. Geometry stays derived output; no mesh is
  ever stored in a document.
- The invariant that the scene graph always matches the current document. A
  cache that can serve a stale mesh is strictly worse than the current cost —
  this project has already paid for one cache keyed on too little (brief 24).

## What to do

1. **Decide the unit of reuse and write it down in `decisions.md`.** The
   obvious candidate is per-entity: a wall's geometry is a pure function of that
   wall plus its level's height and elevation, and a run's is a pure function of
   the run. Whether the key is structural equality, a per-entity revision, or
   object identity from `structuredClone` is the real decision — and identity is
   the trap, because `editDocument` clones the whole document, so **every**
   entity gets a new identity on every edit.
2. **Make the key impossible to get wrong by adding an input later.** Brief 24
   solved the same problem for the physics world by comparing every field of an
   inputs object generically; the same shape applies, and the same failure mode
   (a hand-written conjunction going stale) is what to avoid.
3. **Dispose exactly what is replaced.** A cache that leaks `BufferGeometry` is
   a worse bug than the cost it saves; brief 40's teardown work is the
   precedent.
4. **Test the invariant, not the cache.** After any sequence of edits, the
   generated scene must equal a scene generated from scratch — same meshes, same
   names, same triangle count. That test is the whole safety argument.
5. **Report the measurement.** Same three scenes, before and after, for a
   one-wall edit.

## Acceptance

- A single-entity edit to Greenhollow regenerates in well under the current
  98 ms; the figure is recorded.
- A from-scratch generation and an incrementally-updated one are indistinguishable.
- No geometry is leaked across a sequence of edits.
- `npm run check` exits 0.

---

## Outcome — 2026-09-13

**The premise had changed by the time this was reached, and that changed the
work.** The brief quoted 98 ms for Greenhollow. Briefs 51 and 52 brought that
to **32 ms** without touching the design — 51 stopped the rebuild happening per
keystroke at all, and 52 removed the canopy's 39 ms. So I re-measured before
building anything.

**Re-measuring is what decided the scope.** The remaining cost turned out to be
concentrated rather than spread:

| | ms | share |
|---|---|---|
| wall CSG (11 of 23 walls carry openings) | **23.0** | **82 %** |
| all runs | 1.5 | 5 % |
| all roofs | 0.3 | 1 % |
| whole build with context | 28.2 | |

So this caches **walls only**. Caching runs and roofs would have added a class
of bug for a rounding error.

**Prototyped before committing to a design**, which is what settled the key:

| | ms |
|---|---|
| rebuild all 23 walls | 20.03 |
| clone 23 prebuilt geometries | 0.27 |
| `JSON.stringify` 23 walls (the key) | **0.02** |
| one wall moved: 22 clones + 1 CSG | **3.75** |

**In the real generator: 30.0 ms → 5.8 ms**, with 137 hits and 24 misses.

**The key is the whole `Wall`, not a field list**, and that is the brief's
"impossible to get wrong by adding an input later" requirement met the way
brief 24 met it. Identity was rejected outright — `editDocument`
structured-clones, so every entity has a new identity after every edit and an
identity key would never hit once.

**Callers get a clone.** That is not a detail: the generated scene disposes
what it owns, and handing out the cached object would let one generation's
teardown blank the next one's walls. There is a test that does exactly that —
generate, dispose, generate again, assert every wall still has vertices.

**Five tests, and the first one is the whole safety argument**: a cached scene
is fingerprinted mesh-by-mesh against one built from scratch and must be
identical. Plus: one moved wall is exactly one new key; changing an opening's
`sill` — a field no hand-rolled key would have listed — is a miss; clones
survive disposal; and the cache stays bounded and frees what it evicts.

**One honest correction to my own measurement.** Timing an edit through CDP
first gave 585–744 ms, which I nearly recorded. It was the automation channel,
not the app: measured properly with `PerformanceObserver`, the synchronous
commit is **5 ms** and the edit's longest task is **61 ms**. So the cache
removes ~24 ms from an ~85 ms path and the remainder is GPU upload and React —
worth knowing, and a different problem from this one.

Decision recorded in `decisions.md`. `npm run check` clean, **459 tests**.
