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
- **The asset manifest.** Everything placed is a proxy box or a proxy cone.
  Turning those into real Poly Haven glTF is the largest single upgrade available,
  and it is gated on the download-and-commit workflow, not on code.
- **Path-tracer performance on real hardware.** Never yet run on a GPU. Sample
  budgets, denoising and whether shots need a lower default are all unknown.
- **Placements do not collide with each other.** The physics world derives only
  static geometry, so two chairs dropped at the same spot occupy the same space.
