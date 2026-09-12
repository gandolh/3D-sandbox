# Task 41 — Nothing stops you pulling the scene out from under a running render

## Context

From the 2026-09-12 audit, round 4. Two ways a render in progress can be
corrupted by ordinary UI actions, both of which report success afterwards.

**1 — A scene switch during a render frees the geometry it is tracing.**
The scene `<select>` (`Toolbar.tsx:33`) and the Context checkbox
(`Toolbar.tsx:54`) stay live for the whole render — there is no disabled state,
and the `isRendering` getter at `SandboxEngine.ts:451` is **dead code**; grep
finds no caller.

A render can last an hour. Switch scenes mid-queue and `loadDocument` bumps
`revision`, so `Viewport.tsx:259` calls `setDocument`, whose first statement
(`SandboxEngine.ts:136`) is `this.generated?.dispose()` — freeing every geometry
and material in `owned`/`materials`. The running session's `renderScene` holds
`this.generated.root.clone()`: meshes pointing at exactly those freed resources.

Accumulation continues from the already-uploaded BVH, so **the queue reports
success and writes files** — but every image from that point is of the scene the
user navigated away from, while the UI says otherwise. And `lastDocument` has
been swapped, so any later shot with a `solar` override resolves against the
**new site's** latitude, longitude and timezone while tracing the old geometry.

**2 — `startRender` is not re-entrant, and the loser tears down the winner.**
It opens with `cancelRender()`, which nulls `this.render` but does **not await**
the outgoing session — that one is parked in `await session.start(...)` or in the
120 ms poll and reaches its `finally` later. `Viewport.tsx:112` performs no
"already rendering" check.

Click Render twice, or Render then "Render all": session 2 sizes the renderer to
its shot. Session 1's build then resolves, its poll sees it has been superseded
and returns — and its `finally` runs `session.dispose()`, which does
`renderer.setSize(previousSize…)`, **shrinking the canvas mid-accumulation**, plus
`orbit.enabled = true` and `reattachSelection()`, popping the transform gizmo and
selection box back on screen during a render they must not appear in. The tracer
then reallocates at the wrong size and resets the sample count. The saved PNG is
the wrong resolution, or minutes of work restart from zero, with no error shown.

## Files you OWN

- `apps/web/src/engine/SandboxEngine.ts`
- `apps/web/src/ui/Viewport.tsx`
- `apps/web/src/ui/Toolbar.tsx`

## Files you must NOT touch

- `apps/web/src/engine/PathTracer.ts`'s teardown — brief 40 owns disposal. This
  brief owns *who is allowed to start and stop a session*, not what a session
  frees.

## What to do

1. **Make a session's teardown belong to the session that owns the renderer.** A
   superseded session must not restore size, orbit or gizmo state that a live one
   now depends on. The simplest correct rule: only the session still held in
   `this.render` may touch shared renderer state in its `finally`.
2. **Await the outgoing session, or refuse the new one.** Decide which, and say
   why in a comment. Refusing is honest and simple; queuing is friendlier. Do not
   leave both running.
3. **Use `isRendering` or delete it.** Disable the scene picker, the Context
   toggle and Save while a render runs — or block the switch with a clear
   message. A control that silently corrupts an hour of work should not be live.
4. **Test the supersede path**: starting a second render while the first is
   building must leave the renderer at the second shot's size, with the gizmo
   hidden, and must not reset the second's sample count.

## Acceptance

- A scene cannot be switched out from under a running render.
- Two renders started in quick succession leave the renderer in the winner's
  state.
- `isRendering` has a caller or is gone.
- `npm run check` exits 0.
