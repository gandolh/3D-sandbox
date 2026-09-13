# Task 50 — Dragging furniture does nothing, and the app works hard to undo it

## Context

From the 2026-09-13 audit. **A live, user-facing bug in a feature that looks
like it works.**

The transform gizmo attaches to whatever is selected. `findMesh`
(`apps/web/src/engine/SandboxEngine.ts:338`) matches on
`object.name.endsWith(":" + id)`, and `packages/geometry/src/index.ts:200`
names placement meshes `placement:<id>` — so selecting a chair attaches the
gizmo exactly as selecting a wall does, and `reattachSelection` makes the
handles visible. The user is offered a drag.

But the handler only knows about walls (`apps/web/src/ui/Viewport.tsx:50`):

```ts
onTranslate: (id, dx, dz) =>
  editDocument((draft) => {
    for (const level of draft.subject.levels) {
      const wall = level.walls.find((w) => w.id === id);
      if (wall !== undefined) translateWall(wall, dx, dz);
    }
  }),
```

`grep` finds `translateWall` in `apps/web/src/lib/entities.ts:78` and **no
`translatePlacement` anywhere in the repo**.

So the id never matches, nothing is mutated — and `editDocument`
(`apps/web/src/state/store.ts:209`) bumps `revision` **unconditionally**, which
makes `Viewport`'s effect regenerate the entire scene from the unchanged
document. The chair snaps back to where it started the instant the mouse is
released, with no error and nothing in the status line.

**The scene rebuild that undoes the drag is measured at 98 ms for Greenhollow**
— so the app spends a tenth of a second doing precise work to discard the
user's input.

## Files you OWN

- `apps/web/src/lib/entities.ts` — a `translatePlacement`
- `apps/web/src/ui/Viewport.tsx` — the `onTranslate` handler
- `apps/web/src/state/store.ts` — only if `editDocument` should report a no-op
- `apps/web/test/`

## Files you must NOT touch

- `SandboxEngine`'s gizmo handling. Attaching to any selected mesh is correct;
  the bug is that the document side does not answer for all of them.

## What to do

1. **Give a placement the same treatment a wall gets.** `translatePlacement`
   moves `position[0]` and `position[2]`, leaving `position[1]` alone — dragging
   on the ground plane must not change height, which is what `drop to floor` is
   for.
2. **Dispatch by what the id names**, rather than searching one collection and
   silently succeeding when it misses. `findEntity` in `lib/entities.ts` already
   resolves an id to a tagged entity; use it, and handle each kind explicitly.
3. **Make an unmatched id loud.** A drag that matches nothing should set an
   alert, not bump the revision. Whatever the shape, `editDocument` must not
   look like it worked when nothing changed.
4. **Test it at the document level**: translating a placement id moves that
   placement and nothing else; translating an unknown id changes no document
   and produces a finding the user can see.

## Acceptance

- Dragging a placement in the viewport moves it, and it stays where it is put.
- A drag that resolves to nothing says so rather than silently reverting.
- `npm run check` exits 0.

---

## Outcome — 2026-09-13

**`translateEntity(doc, id, dx, dz)` dispatches on the resolved entity** rather
than searching one collection, and returns whether it moved anything.
`findEntity` already existed and already knew about placements; the drag
handler simply never asked it.

`translatePlacement` moves X and Z and **leaves Y alone** — a lateral drag that
also changed height would put the one control that knows about collisions
(`drop to floor`) in a fight with the one that does not.

**Roofs and slabs are refused, deliberately.** They are positioned by their own
footprint polygons rather than by a point, so dragging one is a different
gesture and not one the gizmo currently offers. Refusing is the point: the
whole bug was that "moved nothing" and "moved successfully" were the same
return value.

**Two guards, because the revision bump is the expensive half.** The handler
checks `findEntity` against the *current* document before calling
`editDocument` at all — so a drag that resolves to nothing never triggers the
clone, re-parse, re-lint and 98 ms scene rebuild that used to put the object
back where it already was. If the edit runs and still moves nothing, an alert
says so.

Five tests: a placement moves in XZ with Y untouched, a wall moves by both
endpoints, an unknown id returns `false`, a roof returns `false` **and its
footprint is unchanged**, and no other placement is touched.

`npm run check` clean, **435 tests**.
