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
