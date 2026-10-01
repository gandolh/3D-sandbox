# Task 61 — `POST /api/scenes` checks the index, not the disk

## Context

From the 2026-09-20 audit. **This one destroys data**, and it contradicts a
locked decision in `decisions.md`: *scene files are truth; SQLite is a derived
index.*

`apps/api/src/app.ts:104` guards the create route against clobbering like this:

```ts
if (index.get(id) !== null) {
  return reply.code(409).send({ error: "exists", ... });
}
const { document, bytes } = await writeSceneFile(config.scenesDir, id, request.body);
```

The guard asks the **derived, rebuildable SQLite cache** whether a scene exists.
The `PUT` handler twenty lines below does it correctly, and says why in a comment:

> Existence is checked here rather than inferred from a failed write, and
> against the disk rather than the index — the index is a derived cache and a
> scene dropped in by hand is a real scene before any rescan notices it.

`POST` does exactly what that comment forbids. Worse, the `PUT` doc comment
justifies removing PUT's create behaviour by leaning on this route —
"`POST /api/scenes` is how a scene is created, **it already refuses to
clobber**" — which is true only against the index.

**Verified by execution during the audit**: with the server running and an empty
scenes dir, copy `handmade.scene.json` in by hand, then `POST /api/scenes` a
different document with `id: "handmade"`. The response is **201** and the file on
disk is replaced — the title went from `PRECIOUS HAND-EDITED SCENE` to
`something else entirely`. The `PUT` route on the same file correctly finds it.

Editing scene files outside the app is described in `overview.md` and the README
as routine, so the window is not exotic — it is the normal workflow. And because
scene files are the only source of truth, the loss is unrecoverable outside git.

Note there is a second half: even once existence is detected, the write carries
no mtime precondition, while `PUT` supports `x-scene-mtime`. Creating is the one
case where there is nothing to be stale about, so that is defensible — but say so
in a comment rather than leaving it to be re-found.

## Files you OWN

- `apps/api/src/app.ts` — the `POST /api/scenes` handler
- `apps/api/test/api.test.ts`

## Files you must NOT touch

- `apps/api/src/store/files.ts` — `writeAtomically` is brief 29's work and correct.
- `apps/api/src/store/index-db.ts` — the index is fine; it is simply not the
  thing to ask.
- The decision that the index is derived and rebuildable. This brief *enforces*
  it; it does not revisit it.

## What to do

1. Make the create route's existence check read the **disk**, the same way `PUT`
   does. Reuse the same helper rather than writing a second way to ask.
2. Keep returning **409** with the same body shape — this is a bug fix, not an
   API change.
3. Update the `PUT` doc comment if it now over- or under-claims.
4. Add a test that is specifically about the index being stale: write a scene
   file directly to the scenes dir **without** going through the API (so the
   index genuinely does not know about it), then `POST` the same id and assert
   **409** and that the file on disk is byte-identical afterwards. A test that
   creates the first scene through the API would pass today and prove nothing.

## Acceptance

- `POST /api/scenes` with an id that exists only on disk returns 409 and leaves
  the file unchanged.
- The new test fails if the guard is reverted to `index.get(id)` — verify by
  mutation, do not assume.
- `npm run check` exits 0.

## Outcome — 2026-10-01

`POST /api/scenes` now asks the disk through `onDisk` (in `app.ts`), which wraps the
same `readSceneFile` the `PUT` handler uses, so there is still one way to ask. Not-found
means absent; an unsafe id still throws (400); **anything else, including a
file that exists but does not parse, counts as present**, because a broken
hand-edited file is still somebody's work and the point is not to overwrite it.
Still 409 with the same body. The create route's missing `x-scene-mtime`
precondition is now explained in a comment (nothing to be stale against). The
`PUT` doc comment's "already refuses to clobber" now says "any file on disk —
indexed or not".

Two tests write the file behind the API's back, so the index never sees it:
a valid hand-made scene (409, bytes unchanged) and an unparseable one (409,
bytes unchanged). **Mutation:** reverting the guard to `index.get(id)` fails
both.
