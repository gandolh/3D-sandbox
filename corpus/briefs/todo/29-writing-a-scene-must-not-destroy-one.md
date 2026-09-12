# Task 29 — Writing a scene can destroy the scene it replaces

## Context

From the 2026-09-12 audit, round 2. Two defects in the same operation, both
undermining the same promise.

**1 — The write is not atomic.** `apps/api/src/store/files.ts:92` is a plain
`writeFile(path, serialized, "utf8")`. That opens with `O_TRUNC`: the existing
scene is zeroed *before* the new bytes land. A crash, a kill, a full disk or a
power cut between those two moments leaves `greenhollow.scene.json` empty or
half-written. There is no temp-and-rename, no `.bak`, no fsync.

What makes it worse: on the next reindex a ruined file lands in `failed[]`
(`apps/api/src/store/index-db.ts:123`) and is **dropped from the index** — the
scene quietly disappears from the list rather than surfacing an error. And
because SQLite is explicitly a derived index, there is nothing to recover from.

The comment above `writeSceneFile` argues carefully that validating before
writing is what makes "scene files are truth" safe. Validation is the
*correctness* half. The **durability** half was never implemented.

**2 — `PUT` has no precondition.** `apps/api/src/app.ts:75` overwrites
unconditionally. The web client loads a document once at mount (`App.tsx:20`) and
holds it in memory for the whole session. So:

1. Open Greenhollow in the editor.
2. Edit `scenes/greenhollow.scene.json` by hand, or run `npm run scenes`.
3. Press **Save**.

The external changes are gone, and the response says `ok: true`. The project's
own documented norm is that scene files are edited outside the app *as a matter
of routine*, which makes this the expected workflow, not an edge case.

`writeSceneFile` does not `stat` first either, so a `PUT` to an id with no file
silently **creates** one — a typo'd id manufactures a new scene instead of 404ing.

The index already carries `mtime`. The information needed to detect all of this
is present and unused.

## Files you OWN

- `apps/api/src/store/files.ts`
- `apps/api/src/app.ts` — the `PUT` route
- `apps/api/test/`

## Files you must NOT touch

- `apps/web` — the client's save flow can stay as it is for this brief. If the
  API starts returning a conflict, handling it well in the UI is a **separate**
  brief; returning the right status code comes first.
- The `POST` existence check — that is brief 22's neighbour and already recorded
  separately.

## What to do

1. **Write atomically**: serialize to a temp file in the same directory, fsync,
   then `rename` over the target. Rename within a filesystem is atomic, so a
   reader sees either the old file or the new one and never a truncated one.
2. **Make `PUT` conditional.** Carry the file's `mtime` (or a hash) to the client
   on read and require it back on write; mismatch returns **409** with the
   current state rather than overwriting. Decide explicitly whether `PUT` to a
   nonexistent id creates or 404s, and write the reason down — silently creating
   is the current behaviour and it is almost certainly wrong.
3. **Test both**: a write interrupted before rename leaves the original intact;
   a `PUT` with a stale precondition is refused and changes nothing on disk.

## Acceptance

- No code path can leave a scene file truncated.
- A stale `PUT` is refused with 409 and the file is unchanged.
- `npm run check` exits 0.
