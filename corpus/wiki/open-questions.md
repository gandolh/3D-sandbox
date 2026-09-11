---
summary: Genuinely unresolved questions — deleted the moment they are answered.
updated: 2026-09-11
---

# Open questions

- **Schema migrations.** There is still no migration mechanism and no second
  version to migrate from. What *counts* as a bump is now settled — see
  [decisions.md](decisions.md) — so this stays deferred deliberately rather than
  by accident, until a change actually removes or redefines a field.
- **A denoiser.** The convergence study answered the question it was deferred
  behind: **yes**. Residual noise at 300–700 samples is fine-grained and sits on
  flat, indirectly-lit surfaces, and convergence is 1/√N — so brute force will
  never be an efficient way to remove it. Unbuilt; needs a brief.
- **Vine leaf density.** At 26 clusters/m² the canopy reads well from a distance
  and as scattered individual leaves from directly underneath at close range.
  Either the density rises or the clusters want to be multi-leaf sprites.

_Hip roofs and stairs were parked on 2026-09-11. The schema admits `hip` and the
generator throws on it; stairs need a second storey. Nothing is blocked on
either, and a page of things nothing is blocked on stops being read. They come
back when a scene wants one._
