---
summary: Genuinely unresolved questions — deleted the moment they are answered.
updated: 2026-09-11
---

# Open questions

- **Schema migrations.** There is still no migration mechanism and no second
  version to migrate from. What *counts* as a bump is now settled — see
  [decisions.md](decisions.md) — so this stays deferred deliberately rather than
  by accident, until a change actually removes or redefines a field.
- **How context vegetation gets decimated.** Poly Haven's trees carry 90–905 MB
  of mesh each — see [assets.md](assets.md) — so the three the scenes name cannot
  be used as downloaded, and instancing does not help. Something has to reduce
  them to a scatter LOD: a build step over the glTF, a different source, or
  billboards at distance. Nothing is chosen, and it blocks the context tier
  looking like anything other than proxy cones.
- **Whether a denoiser is needed at all.** Deferred behind the convergence study
  (brief 12): the study says where samples stop buying quality, and that number
  says whether denoising is worth the change. Asking first would be guessing.

_Hip roofs and stairs were parked on 2026-09-11. The schema admits `hip` and the
generator throws on it; stairs need a second storey. Nothing is blocked on
either, and a page of things nothing is blocked on stops being read. They come
back when a scene wants one._
