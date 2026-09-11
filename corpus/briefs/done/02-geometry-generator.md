# Task 02 — Geometry generator

## Context

The scene document describes a house semantically; something has to turn it into
triangles. This is that something.

It belongs in its own package rather than in `apps/web` because **geometry
generation needs no WebGL context**. `BufferGeometry` construction and CSG are
pure CPU work, so the generator is testable headlessly in Node — triangle counts,
bounding boxes, deterministic scatter — which is the difference between a tested
subsystem and one you can only eyeball in a browser.

Depends on [decisions.md](../../wiki/decisions.md): the two-tier split, WebGL2, and
degrees-on-disk / radians-internally.

## Files you OWN

- `packages/geometry/**`
- root `package.json` (adding the workspace), `tsconfig.json` (adding the reference)

## Files you must NOT touch

- `packages/schema/**` — the document format is settled. If the generator needs a
  field the schema lacks, that is a schema change and needs its own brief.

## What to do

1. New workspace `@solstice/geometry`, pinned: `three@0.185.1`,
   `three-mesh-bvh@0.9.15`, `three-bvh-csg@0.0.18`, `@types/three@0.185.4`.
2. `generateScene(doc, options)` returning a `THREE.Group` with `subject` and
   `context` children, plus per-tier statistics and a `dispose()`.
3. Subject: wall solids from endpoints and thickness; openings subtracted with
   `three-bvh-csg`; slabs extruded from polygons; gable and flat roofs; terrain.
4. Context: deterministic seeded scatter into `InstancedMesh`, respecting
   `exclude` regions; extruded building masses; road ribbons.
5. Assets are not loaded yet — scatter and placements use **proxy geometry** so the
   viewport can be built before the asset manifest exists. Proxies must be
   obviously placeholder, never mistakable for the real thing.

## Acceptance

- `npm run check` passes with the new package included.
- Headless tests, no WebGL: wall bounds, opening actually removes volume,
  roof covers walls, scatter is reproducible from its seed, exclusions hold,
  instance count matches the density estimate, stats split subject from context.
- Generating `villa-carpathia.scene.json` produces a non-empty group whose
  subject triangle count is well under the context count.

## Open

Hip roof lofting over a non-rectangular footprint is unsolved
([open-questions.md](../../wiki/open-questions.md)). Gable and flat are in scope;
`hip` may throw a clear "not implemented" for now.

---

## Outcome — 2026-09-11

Shipped. 22 new tests (61 across the repo), all headless — no WebGL context is
created anywhere in this package.

**The two-tier decision, now measured.** Generating `villa-carpathia` gives
**321 triangles of subject against 10 896 of context** — a 34× ratio with *proxy*
trees of ~38 triangles each. Substitute real Poly Haven models at 50–200 k
triangles and those same 284 instances become 14–57 million. The split was
justified on a prediction; it is now justified on a number.

Decisions made during the work:

- **Openings are proven cut by raycast, not by triangle count.** A ray fired
  through the opening's centre must miss the mesh, and a ray through the solid
  part beside it must hit. Counting triangles would have passed on CSG output
  that was subtly wrong.
- **Gable roofs are built from the footprint's bounding box**, which is exact for
  rectangles and visibly wrong for anything else — the right way for a placeholder
  to fail. `hip` throws `UnsupportedRoofError` rather than guessing.
- **Proxy geometry is deliberately crude** (a cone on a cylinder). The asset
  manifest does not exist yet, and a plausible-looking placeholder is how a
  placeholder survives to production.
- **`Math.random` appears nowhere in the package.** Scatter uses mulberry32 seeded
  from the document, because a render that cannot be re-made from its scene file
  is not reproducible.

Known noise: `three-bvh-csg@0.0.18` calls `three-mesh-bvh@0.9.15` with the
deprecated `maxLeafSize` option, printing a warning per CSG evaluation. Harmless,
upstream, and not worth pinning around.

Deferred: hip roofs; texture maps (materials resolve to flat colours until the
manifest exists); slab/roof polygons are assumed simple and non-self-intersecting.
