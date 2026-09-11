# Task 16 — Denoise

## Context

[Brief 12](../done/12-render-convergence.md) measured convergence and answered
the question it was deferred behind: **a denoiser is worth having.** The residual
at 300–700 samples is fine-grained noise on flat, indirectly-lit surfaces —
grass, plaster, the shaded side of a roof — and convergence is 1/√N, so brute
force will never be an efficient way to remove it.

The useful surprise: **`three-gpu-pathtracer` already ships one.**
`src/materials/fullscreen/DenoiseMaterial.js` is exported from the package index
and is a fullscreen pass with three uniforms — `sigma` (5.0), `threshold` (0.03),
`kSigma` (1.0). It is an edge-aware blur, not a trained denoiser, so it will not
match OIDN; it is also already a dependency, which makes it the right first
thing to try rather than pinning `oidn-web` and carrying a WASM model.

## Files you OWN

- `apps/web/src/engine/PathTracer.ts`
- `apps/web/src/ui/RenderOverlay.tsx` — a toggle, if one earns its place
- `corpus/wiki/running-on-a-gpu.md`

## Files you must NOT touch

- `packages/*`. Denoising is a render-path concern.
- The convergence numbers already recorded. New measurements go beside them, not
  over them.

## What to do

1. **Wire `DenoiseMaterial` as a post pass** over the accumulation target.
2. **Measure it the way brief 12 measured convergence** — RMS against a
   high-sample reference, from one progressive render. The question is not "does
   it look smoother" but *how many samples does it save at equal quality*. If the
   answer is "not many", that is a real result and the pass should not ship.
3. **Watch the edges.** An edge-aware blur is judged on what it destroys: leaf
   silhouettes against sky, the grain of clay plaster, the gravel. A denoiser
   that smooths noise and the gravel equally has not helped.
4. **Only then consider `oidn-web`.** It is a genuinely better denoiser and a
   WASM model to carry; the bundled pass has to be shown insufficient first.

## Acceptance

- An RMS-vs-samples table with the pass on and off, in the wiki beside the
  existing one.
- A stated sample saving at equal quality, or a stated finding that there is none.
- A side-by-side crop of foliage and gravel, so the cost is visible and not just
  the benefit.

---

## Outcome (2026-09-11)

Done, and the answer is **no** — which is the outcome the brief explicitly
allowed for.

`DenoiseMaterial` is wired in behind `denoise: true` on a render request, via the
tracer's `renderToCanvasCallback`, so the filter lands on the *presented* image
and `toBlob` therefore saves what the screen shows. Measured against a
1,159-sample reference at 800 × 450:

| | RMS vs reference |
|---|---|
| 150 samples, off | 13.62 |
| 150 samples, on | **13.75** |
| 400 samples, off | 11.75 |
| 400 samples, on | **12.16** |

It moves the image *away* from converged, and by more at higher sample counts —
a filter destroying detail faster than it removes noise. This scene is almost
entirely high-frequency material: grass, gravel, clay plaster, leaf silhouettes.
An edge-aware blur has very little here it can safely touch.

Ships off by default. Whether tuned uniforms or a trained denoiser (`oidn-web`)
would do better is untested and not urgent — both cost GPU time, and the sample
budgets from brief 12 already make renders tractable.

Worth keeping: the convergence study *predicted* a denoiser would help, from
sound reasoning about 1/√N. The same kind of reasoning produced the 2,000-sample
default. Measuring is what settled both.
