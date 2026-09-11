---
summary: Genuinely unresolved questions — deleted the moment they are answered.
updated: 2026-09-11
---

# Open questions

- **Schema migrations.** There is still no migration mechanism and no second
  version to migrate from. What *counts* as a bump is now settled — see
  [decisions.md](decisions.md) — so this stays deferred deliberately rather than
  by accident, until a change actually removes or redefines a field.
- **`pine_tree_01` and `fir_tree_01` are unbaked.** Villa's forest falls through
  to `tree_small_02`'s atlas and renders as one species. The bake harness works
  and the procedure is in [assets.md](assets.md); it is 1.4 GB of download and
  two GPU bakes, deferred for machine time rather than for any unknown.
- **Whether a *tuned* or trained denoiser would help.** The bundled edge-aware
  blur measurably does not — see
  [render-performance.md](render-performance.md) — but its uniforms were left at
  their defaults and `oidn-web` was never tried.

_Vine density was brief 18; the denoiser question was brief 16, which answered
"no" for the pass that ships._

_Hip roofs and stairs were parked on 2026-09-11. The schema admits `hip` and the
generator throws on it; stairs need a second storey. Nothing is blocked on
either, and a page of things nothing is blocked on stops being read. They come
back when a scene wants one._
