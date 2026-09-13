---
summary: Layer map, dependency direction, and the document-to-pixels pipeline — how a scene JSON file becomes a rendered image.
updated: 2026-09-13
---

# Architecture

## Dependency direction

```
scenes/src/*.ts   (authoring, TypeScript builders)
      │  emit
      ▼
scenes/*.scene.json      ← the only source of truth
      │  validate + lint
      ▼
packages/schema          ← depends on nothing but zod
      │
      ├──► packages/geometry   (document → three.js meshes; CPU only, no GL)
      ├──► packages/solar      (site + clock → sun, sky, lighting; suncalc)
      ├──► packages/physics    (document → colliders; rapier, headless)
      ├──► packages/drawing    (document → SVG floor plan; no three, no DOM)
      │         │
      │         └──► apps/web  (the four above → WebGL2 → path tracer)
      │
      └──► apps/api            (Fastify; validates on write, never stores invalid)

assets/                  ← manifest, download list, impostor bake harness
      └──► assets-src/   (downloads: gitignored except the baked atlases)
```

`packages/schema` is the bottom of the stack and must stay free of three.js,
React, and Fastify. Inside it, `src/derive/` is the home for any computation a
**generator and its checker both need** — a wall's angle, a field's instance
count, a scene's room areas — under two rules: no `three` import, and two
callers in different packages. See `decisions.md`; it exists because nine such
computations had drifted into duplicate copies, each living in the code that
checked the other.

`packages/drawing` is the second output path and deliberately parallel to
`geometry` rather than layered on it: a plan is a **horizontal section rendered
as vectors**, not a view of meshes, and it has to be producible on a machine
with no GPU. That constraint is what lets the whole drawing be asserted in
tests — line weights, door swings, room labels — rather than eyeballed. `packages/geometry` sits above it and depends on three.js but
**never on a WebGL context** — geometry construction and CSG are pure CPU work, so
the generator is testable headlessly in Node. That is why triangle counts, opening
cuts and scatter determinism have real tests rather than a screenshot someone
squinted at.

## The pipeline

1. **Author** — a TypeScript builder module composes a `SceneDocument`. Loops and
   helpers are available here and only here.
2. **Emit** — a build step writes canonical JSON. The runtime never sees TypeScript.
3. **Validate** — Zod parses the shape; the **linter** then checks what Zod cannot
   (see below). An invalid document is never written and never loaded.
4. **Generate** — a generator compiles the semantic document into three.js meshes.
   Walls become solids, openings are cut with `three-bvh-csg`, roofs are lofted
   from a footprint and pitch.
5. **Light** — `suncalc` turns date, time and site coordinates into a sun vector;
   a matched HDRI provides image-based lighting.
6. **Render** — the real-time WebGL2 viewport for work; `three-gpu-pathtracer` for
   the final progressive still, which downloads to the user's machine.

## Two fidelity tiers

The document splits into `subject` and `context` (see
[glossary.md](./glossary.md)). This is not cosmetic — path-tracer cost scales with
triangle count, and a photoreal tree is 50–200k triangles. `subject` is
parametric, editable, and fully detailed. `context` is declarative scatter
(`ScatterField`, `BuildingMass`, `RoadNetwork`) realised through `InstancedMesh` at
reduced LOD. Without the split, the BVH build for the path tracer is unusable and
the render button — the whole point of the project — stops working.

## Validation is a linter, not a schema

Zod catches shape. The failures that actually occur in AI-authored documents are
semantic and referential:

- an `Opening` whose `wallId` names no existing wall
- a window taller than the wall it is cut into, or overhanging its end
- two openings on one wall that overlap
- a `Roof` whose footprint does not match the walls beneath it
- a `Placement` referencing an asset absent from the manifest

These are geometric and cross-referential checks over an already-parsed document.
They live in `packages/schema/src/lint/` and run on every write.
