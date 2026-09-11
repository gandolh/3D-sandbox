# Task 19 — Render the whole shot list

## Context

A `Shot` has been the reproducible unit since brief 08: its own camera, clock,
output size and sample budget. `greenhollow` declares four of them. But the
Render button renders **one** — whichever the picker is on — and at ~14.5 minutes
a shot you cannot sit through four of them by hand, so in practice the other
three never get rendered at all.

This is the cheap half of the "render what you can play" question raised on
2026-09-11. The expensive half — sampling an animation track at N frames — stays
unbuilt: at 0.69 samples/s for a 1920 × 1080 / 600-sample shot, a few seconds of
motion is hours of GPU, which is not the machine this runs on. A queue over the
declared shots is the same unattended-render plumbing at a size that fits.

**The estimate is part of the feature, not decoration.** Four shots at 600
samples is about 58 minutes. A button that silently commits the machine to an
hour is a worse button than one that says so first.

## Files you OWN

- `apps/web/src/engine/queue.ts` — new. Pure: shots → ordered requests, plus the
  cost estimate. No three.js, no DOM, so it is testable headlessly.
- `apps/web/src/engine/queue.test.ts` — new.
- `apps/web/src/engine/PathTracer.ts` — `RenderProgress` gains queue position.
- `apps/web/src/engine/SandboxEngine.ts` — thread queue position into progress.
- `apps/web/src/ui/Toolbar.tsx` — the "Render all" action and its estimate.
- `apps/web/src/ui/Viewport.tsx` — run the queue in sequence.
- `apps/web/src/ui/RenderOverlay.tsx` — show "shot 2 of 4".

## Files you must NOT touch

- `packages/schema` — no document change. A queue is an application affordance
  over shots that already exist; it is not a new thing a scene declares.
- `scenes/` — `greenhollow`'s four shots are the fixture for this, unchanged.

## What to do

1. **`renderQueue(shots)`** → `RenderRequest[]` in document order. Document order
   is deliberate: it is the order a human wrote them, which is the only ordering
   that carries intent.
2. **`estimateQueue(requests)`** → total samples and estimated seconds, scaling
   the measured 0.69 samples/s at 1920 × 1080 by pixel count. Quote it as a
   measured-from figure, not a guarantee — the number came from one machine.
3. **Sequence, download each as it lands.** A queue interrupted at shot 3 must
   leave shots 1 and 2 on disk. Do not accumulate blobs and write at the end.
4. **Cancel stops the queue**, not just the current shot. `startRender`
   resolving `null` means cancelled; break the loop on it.
5. **Progress reports position** — `queue: { index, total }` on `RenderProgress`,
   optional so a single render is unchanged.

## Acceptance

- `renderQueue` and `estimateQueue` are covered headlessly, including the
  empty-shot-list case and the aspect-scaling of the estimate.
- `npm run check` exits 0.
- One end-to-end: a two-shot queue at a low sample budget downloads two PNGs and
  the overlay counts through them. **Not** a 600-sample run — the point of the
  estimate is that the full one costs an hour.

---

## Outcome — 2026-09-11

Done. `renderQueue` / `estimateQueue` are pure and covered (8 tests, 239 total);
the toolbar carries "Render all · ~58 min" and the overlay counts "Shot 2 / 4".

**Running it changed the design.** The brief said each image downloads as it
lands, and the first end-to-end — a two-shot queue — reported "Rendered 2 of 2"
with **one PNG on disk**. Chromium gates automatic downloads after the first
from a page, non-deterministically: across single page loads the second
sometimes never arrived and once arrived ninety seconds late, the third onwards
never at all, and in every case with no error, no exception and no console
message. The overlay counted to the end regardless.

So the queue now asks for a directory once, on the button's own click
(`showDirectoryPicker` needs the user gesture), and writes each PNG into it —
a write that fails throws, which is the point. `<a download>` stays as the
fallback for a single render and for browsers without File System Access, which
is exactly the one-file case that works. Re-verified: a three-shot queue wrote
three files, 148–169 KB, all with real PNG signatures.

The `<a download>` path had shipped since brief 06 and was never wrong, because
a single render only ever takes one download. Queueing is what exposed it.
