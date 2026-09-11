---
summary: What a render actually costs — end-to-end timings, the sample-convergence curve behind the 600-sample default, and the measured finding that the bundled denoiser makes things worse.
updated: 2026-09-11
---

# Render performance

Everything here was measured on this machine, through a GPU-backed browser — see
[running-on-a-gpu.md](running-on-a-gpu.md), because measuring on SwiftShader by
accident is the easiest mistake available.

## The first render that ever finished

Until 2026-09-11 every render in this project's life had been cancelled, so
`toBlob` and the download after it had never executed. The first one to run to
completion produced **a fully black PNG** — 44 KB of RGB(0,0,0) at 1920 × 1080,
after fourteen minutes, while the screen had shown the correct image throughout.

The renderer is constructed without `preserveDrawingBuffer`, so the drawing
buffer is cleared before the next compositing step. A `toBlob` issued a frame
later — which is what `startRender` did, after the accumulation loop had already
yielded — reads an empty buffer.

The fix is to snapshot **in the same tick as the final sample**, from inside the
loop. `preserveDrawingBuffer: true` would also work and would tax every 60 fps
viewport frame, forever, for a read that happens once per render.

The lesson is not about WebGL. It is that a fourteen-minute operation whose
output nobody had ever opened was wrong in the most basic possible way, and four
briefs of work had been verified against *screenshots of the viewport* rather
than against the artefact.

### Measured, end to end

| | |
|---|---|
| 600 samples at 1920 × 1080 | **~870 s** (14.5 min), 0.69 samples/s |
| 400 samples at 960 × 540 | 4.87 samples/s |

**Window occlusion does not throttle it.** Measured: 97.9 samples at 20.1 s in
the foreground, then 332 at 68.2 s after 48 s completely covered by another
maximised window — 4.87 samples/s across both. A genuinely backgrounded *tab* is
still untested; the in-tick capture means such a stall would delay a render
rather than corrupt it.
