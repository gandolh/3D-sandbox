# Task 15 — Finish a render

## Context

**No render has ever completed.** Every one in this project's life has been
cancelled — brief 08's verification, the impostor check, the convergence study,
the first GPU run. So `PathTraceSession.toBlob()` and the download that follows
it have **never executed**, and they are the last step of the thing the project
exists for.

That path is not obviously safe. Two things about it are untested by
construction:

- A 600-sample shot at 1920 × 1080 is about **thirteen minutes**. Browsers
  throttle `requestAnimationFrame` in a backgrounded tab, and the loop that
  advances the render is a rAF loop — so a render may simply stall the moment
  someone switches tab, with the UI still claiming to be working.
- `toBlob` on a 1920 × 1080 canvas allocates a large PNG. Nothing has ever
  checked that it returns, or that what it returns opens.

This brief is small and it is the difference between "the renderer works" and
"the renderer produces a file".

## Files you OWN

- `apps/web/src/engine/PathTracer.ts`, `SandboxEngine.ts`
- `apps/web/src/ui/RenderOverlay.tsx`
- `corpus/wiki/running-on-a-gpu.md`

## Files you must NOT touch

- `packages/*` — nothing here reaches the generator or the schema.

## What to do

1. **Run one to completion** and open the PNG. `greenhollow`'s `approach` at 600
   samples. This is the acceptance, not a step towards it.
2. **Survive a backgrounded tab.** Check whether rAF throttling stalls the render;
   if it does, drive the accumulation from something that does not throttle. Do
   not "fix" this speculatively — measure it first, because the fix is only worth
   its complexity if the problem is real.
3. **Report completion honestly.** The overlay says "Complete" the moment the
   sample target is hit; the blob and the download come after. If encoding a
   large PNG takes noticeable time, say so rather than appearing to hang.
4. **Record the real wall-clock** for a finished 600-sample shot at 1920 × 1080
   in the wiki, next to the convergence table. Every number there so far comes
   from a render that was killed.

## Acceptance

- A finished 600-sample PNG of `approach` on disk, opened and looked at.
- A stated answer on tab throttling, with the measurement behind it.
- The wiki carries the first end-to-end render time this project has ever had.
