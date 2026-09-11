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
- **Denoising, and whether 2,000 samples is the right default.** Now measurable
  rather than unknown — see [running-on-a-gpu.md](running-on-a-gpu.md) — but still
  unjudged: nobody has compared a 500-sample render against a 3,000-sample one and
  said where it stops improving.
- **Placements do not collide with each other.** The physics world derives only
  static geometry, so two chairs dropped at the same spot occupy the same space.
- **A pergola's climber is an opaque slab.** The vine over the metalwork is a box,
  so it reads as a black soffit in the approach render instead of dappling light
  through. Needs either an alpha-cut foliage material or real instanced leaves —
  and the path tracer has to sample whichever it is.
- **Placements and plantings are still proxy boxes and cones.** The fountain in
  the pond is a box on a plinth. Gated on the asset manifest, not on code.
