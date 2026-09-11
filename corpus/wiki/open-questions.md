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
  Worth keeping in proportion: the only consumer is `villa-carpathia`, the
  regression fixture, so this is a flaw in a test file and not in anything
  anyone looks at. It gets baked if a scene ever wants conifers; otherwise the
  honest close is to delete the species claim from villa rather than leave a
  standing question about a fixture.

_Vine density was brief 18. The denoiser closed on 2026-09-11: brief 16 measured
the bundled pass as actively harmful, and the remaining thread — whether a
trained denoiser like `oidn-web` would do better — died with the convergence
curve. A trained denoiser earns multi-MB of WASM and weights by making *low*
sample counts usable, and brief 12 showed 300 samples already sit within 1.8 RMS
of 1,500. There is no low-sample regime here left for it to rescue._

_Hip roofs and stairs were parked on 2026-09-11. The schema admits `hip` and the
generator throws on it; stairs need a second storey. Nothing is blocked on
either, and a page of things nothing is blocked on stops being read. They come
back when a scene wants one._
