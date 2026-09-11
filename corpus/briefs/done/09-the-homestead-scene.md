# Task 09 — The homestead scene

## Context

The reference scene so far — `villa-carpathia` — is a box with a gable roof in a
field of proxy cones. It was built to exercise the generator, not to look like
anywhere. The brief now is a real property, described by the user:

> A house with a porch, set back from the front of the field. A grapevine on a
> metal structure from the front of the house to the street. The porch on the
> left side of the house, the grapevine in front. An alley with roses along its
> sides. A garage. In the back, a garden, a greenhouse, and an orchard way back.
> A hedge on the left and right sides of the field, and a concrete wall with a
> metal gate at the front. A pond or fountain.

Mapping that onto the document turns up **three things the schema cannot say and
one rule that actively breaks**. That is the value of this brief: the scene is
the forcing function.

### What already works

House, garage and greenhouse are walls + openings + roofs. The boundary wall is a
`Wall` whose gate is an `Opening` — an aperture in a wall is exactly what a gate
is. The alley and the street are `RoadNetwork`s. The pond is a `Slab` with a water
material. The fountain is a `Placement`. Roses and orchard trees are
`ScatterField`s.

### The gaps

1. **Nothing expresses a hedge or a pergola.** Both are *a profile extruded along
   a path*: a hedge is solid, a pergola is posts carrying beams. A `Wall` is the
   wrong home — a hedge is not a building element, and walls live inside levels
   and are checked against roofs.
2. **Scatter is always random.** An orchard is planted in rows; randomly
   scattered fruit trees read as scrub, not an orchard.
3. **`roof-covers-walls` assumes one building per level.** It takes the bounds of
   *every* wall on the level and demands the roof cover all of them. The moment a
   property has a house *and* a garage *and* a greenhouse *and* a boundary wall,
   every roof fails. This is a genuine modelling assumption breaking under the
   first realistic scene.

## Files you OWN

- `packages/schema/src/document.ts` — `Run`, `ScatterField.arrangement`
- `packages/schema/src/lint/rules/{roofs,runs}.ts`, `lint/index.ts`
- `packages/schema/src/geometry.ts` — point-in-polygon
- `packages/geometry/src/subject/runs.ts` (new), `context/scatter.ts`, `index.ts`
- `scenes/src/greenhollow.ts` (new), `scenes/build.ts`
- `apps/web/src/App.tsx` (load the new scene), `ui/SceneTree.tsx` (show runs)
- tests alongside each
- `corpus/wiki/{glossary,decisions,status}.md`

## Files you must NOT touch

- `packages/physics`, `packages/solar`, `apps/api` — none of this reaches them.
- `apps/web/src/engine/*` — brief 08 just settled the render path.

## What to do

1. **`Run`** in the subject tier: `{ id, kind: "hedge" | "fence" | "pergola",
   path (polyline, ≥2 points), width, height, spacing (post pitch), material,
   climber? (MaterialId for a vine over a pergola) }`. Geometry: a hedge extrudes
   a solid along the path; a fence and a pergola place posts every `spacing`
   along it, a pergola adding beams and, with a `climber`, a canopy.
2. **`ScatterField.arrangement`**: `"random"` (default, unchanged) or `"rows"`
   with a `spacing: [along, across]`. Rows must stay deterministic under the seed
   — jitter the position, not the lattice.
3. **Fix `roof-covers-walls`.** A roof is checked against the walls it actually
   sits over — wall midpoint inside the footprint, grown by the overhang — not
   against every wall on the level. A roof that covers nothing is still a warning.
4. **Author `greenhollow`** to the layout below, and make it the scene the app
   loads. Keep `villa-carpathia` building — it is the regression fixture.
5. **Shots** worth having: an approach from the gate (the pergola leading the eye
   to the house), and a three-quarter from the garden side.

### Layout (metres, +Z north, street to the south, field front at z = 0)

| Feature | Extent |
|---|---|
| Street | along z = −5, width 6 |
| Concrete boundary wall + metal gate | z = 0, x −16…16, gate 4 m at centre |
| Hedges (left, right) | x = ±16, z 0…62 |
| Alley | x = 0, z 0 → 22 |
| Grapevine pergola | over the alley, z 2 → 21 |
| House | x −5.5…5.5, z 22…32, ridge east–west |
| Porch (left/west) | x −9.5…−5.5, z 23…31 |
| Garage (right/east) | x 7…14, z 20…27 |
| Roses | flanking the alley |
| Garden | z 34…44 |
| Greenhouse | x −10…−5, z 36…42 |
| Pond + fountain | x 4…10, z 35…41 |
| Orchard (rows) | x −14…14, z 46…60 |

Left and right are the visitor's, entering from the street and facing the house
(+Z): left is −X.

## Acceptance

- `npm run check` green, with tests for runs, row scatter, and the roof rule's
  multi-building behaviour.
- `greenhollow` lints clean — no errors, no warnings.
- **Verified in the browser on the GPU**: the scene reads as the description —
  porch on the left, pergola leading from gate to front door, garage on the
  right, greenhouse and orchard behind — and a shot path-traces.

---

## Outcome (2026-09-11)

Done. `greenhollow` is the scene the app loads; it lints with zero findings and
path-traces on the GPU. Every feature in the description is present: porch left,
vine pergola from gate to front door, garage right off the alley, roses flanking
it, hedges down both flanks, concrete wall with the gate cut out of it as an
`Opening`, kitchen garden, greenhouse, pond with a fountain, orchard in rows.

The three predicted gaps were real, and the scene turned up three more that only
appeared once it was on screen:

- **Every scatter proxy was a fixed 6.6 m cone**, so a bed of roses towered over
  the house. Scatter fields now declare a `height` — a real property of a
  planting, not a rendering hint.
- **Scatter had no material**, borrowing the terrain's. Roses, an orchard and a
  vegetable bed are not the lawn they stand on.
- **Untextured materials all resolved to one neutral grey**, so the whole plot
  came out a single flat tan. `baseColor` is now the documented stand-in for
  textured sources too.

And one thing the *linter* caught that a human would have shipped: the porch roof
overlapping the house by 0.2 m was enough for the old association test to demand
it cover the whole house. That is what forced the majority-overlap rule.

Deferred: the vine canopy is an opaque slab, so it reads as a black soffit rather
than dappling light through. Recorded in open-questions.
