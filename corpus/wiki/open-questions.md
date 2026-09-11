---
summary: Genuinely unresolved questions — deleted the moment they are answered.
updated: 2026-09-11
---

# Open questions

- **Schema migrations.** `schemaVersion` is stamped from day one, but there is no
  migration mechanism and no second version to migrate from. Decide the shape when
  the first breaking change actually lands, not before.
- **Roof geometry beyond gable.** The schema admits `gable`, `hip` and `flat`, but
  only the parametric fields are settled — how a hip roof lofts over a non-rectangular
  footprint is unsolved and will surface in the generator slice.
- **Stairs.** Not modelled. A single-storey house does not need them; a second
  storey will.
- **Test strategy beyond the schema.** Vitest covers the linter well because it is
  pure. How the geometry generator gets tested — golden triangle counts, bounding
  boxes, or snapshot meshes — is undecided.
