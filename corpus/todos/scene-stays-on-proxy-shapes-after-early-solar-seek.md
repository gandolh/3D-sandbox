# Unconfirmed: the scene stays on proxy shapes after an early solar seek

Captured 2026-10-09 during the README refresh. **Seen once; not reproduced.** Captured as a todo and
not a brief because there is no confirmed cause or fix to spec yet. Promote it to `briefs/todo/` once it
reproduces.

## What was seen

Under headless Chromium with SwiftShader, a solar seek (the transport `seek` event, which commits a new
`solar.time` to the document) was sent before the status line showed "12 model(s) loaded". The scene
then stayed on proxy shapes (12,354 triangles) for good, and never swapped to the loaded models. A page
reload fixed it. The expected behaviour is that the models arrive and the scene regenerates, whatever
the order of those two events.

## Step one: reproduce

1. Open the app headlessly (SwiftShader) with the asset download slowed so the load window is wide
   (for example throttle the `/assets-src` requests), or simply poll.
2. Before "12 model(s) loaded" appears, dispatch `window.dispatchEvent(new CustomEvent("solstice:transport",
   { detail: { action: "seek", at: <seconds> } }))`, which is what the timeline sends.
3. Wait for the status line to read "12 model(s) loaded". Read the triangle count from the stats
   (12,354 means proxies; the loaded scene is higher).
4. Repeat 20 times with varied timing, and again on a real GPU. If it never reproduces, say so and leave
   this todo with that record. If SwiftShader is the only place it shows, note that: loads are slow
   there, so the window is wide, and the bug may be real but only visible there.

## Leads (hypotheses, not findings)

- [`Viewport.tsx:245-253`](../../apps/web/src/ui/Viewport.tsx#L245-L253): `seek` calls `commit()`, which runs
  `editDocument`, which changes the document and re-fires the effect at
  [`Viewport.tsx:293-295`](../../apps/web/src/ui/Viewport.tsx#L293-L295) (`engine.setDocument`).
- [`Viewport.tsx:264-274`](../../apps/web/src/ui/Viewport.tsx#L264-L274): the load promise calls
  `engine.setAssets(...)`, and then only sets the status if `loaded.sizes.size > 0`.
- [`SandboxEngine.ts:179-217`](../../apps/web/src/engine/SandboxEngine.ts#L179-L217): `setAssets` stores the
  library and regenerates from `lastDocument`. `setDocument` builds with a shared `geometryCache`; if
  that cache keys on the document and not on the library, a regenerate with assets could serve the
  proxy geometry cached just before. Check this first, and check whether a seek during load puts a
  cached proxy build in the way.
- The abort at `:266` (`assetLoad.signal.aborted`) means a remount mid-load drops the library for good
  (React StrictMode double-mount in dev would do it). Check whether the one seen was in dev.

## Out of scope

- Fixing it: this note is for confirming it. Do not change the cache or load order on a guess.
- The SwiftShader speed itself (see [running-on-a-gpu.md](../wiki/running-on-a-gpu.md)).

## Acceptance (once it reproduces and is briefed)

- A seek sent at any point during the load ends with the loaded models in the scene, no reload.
- A test pins the order: load-then-seek and seek-then-load give the same triangle count.
