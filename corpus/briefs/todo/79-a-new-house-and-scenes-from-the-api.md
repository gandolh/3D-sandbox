# Task 79 — A new house, and scenes from the API

## Context

The owner settled brief 74 on 2026-10-21: a house started in the browser is a `*.scene.json` with
no TypeScript builder, created and saved through `apps/api`. Drawing in a scene that has a builder
is allowed, but the browser warns first, because the next `npm run scenes` erases it. See
[decisions.md](../../wiki/decisions.md#the-browser-draws-building-parts-never-free-geometry).

What the code does today, checked 2026-10-21:

- **The web app can only open three scenes.** `apps/web/src/scenes.ts` imports
  `villa-carpathia`, `greenhollow` and `elmsgate` at build time, and the toolbar's picker lists only
  those. A scene the API writes is invisible to the app.
- **Save** (`App.tsx`) sends `PUT ${__API_BASE__}/scenes/:id` without `x-scene-mtime`, so it never
  detects a file changed on disk since it was opened. With `__API_BASE__` empty (the static
  deploy) or the API down, it downloads the file instead.
- **The API** (`apps/api/src/app.ts`) has `GET /api/scenes` (the index), `GET /api/scenes/:id`
  (with an `x-scene-mtime` header), `POST /api/scenes` (create, refuses any file already on disk)
  and `PUT /api/scenes/:id` (replace an existing one, conditional on `x-scene-mtime` when sent). It
  writes into `scenes/` unless `SOLSTICE_SCENES_DIR` says otherwise.
- **`scenes/build.ts`** writes JSON only for the builders in `scenes/src/*.ts`, so a scene with no
  builder there is never overwritten. A drawn house in `scenes/` is a repo file like the others, and
  git versions it.

Depends on 75 (the plan view) for anything to draw in, and on 77 for the warning to matter. It can be
built any time after 75.

## What to do

1. **The picker reads the API.** When an API is configured and reachable, the scene picker lists
   `GET /api/scenes`. Opening one fetches it with `GET /api/scenes/:id`, parses it with
   `SceneDocument.safeParse` as the bundled ones are, and keeps its `x-scene-mtime`.
   - The bundled three stay as the fallback when there is no API, so the static deploy still opens
     them. Where an id is in both, the API's copy wins.
   - Save sends the kept `x-scene-mtime`. On a 409 `stale`, say the file changed on disk since it
     was opened and offer to reload it. Don't overwrite.
2. **New house.** A toolbar action asks for a title, derives an id from it (lowercase, hyphens), and
   `POST`s a minimal valid document: the open scene's `site`, `solar` and `materials`, one empty
   level ("Ground floor", elevation 0, height 2.7 m), no walls, no context, no shots. On a 409
   `exists`, ask for another title. Then open it in the plan view with the Wall tool chosen.
   With `__API_BASE__` empty or the API down, New house is disabled and its tooltip says why.
3. **Which scenes have a builder.** `GET /api/scenes` adds `hasBuilder: boolean` to each entry,
   true when `src/<id>.ts` exists beside the scenes directory's files. That relies on each builder's
   file name matching the document id it builds, which holds for all three today; add a test that
   keeps it true, since `build.ts` names its output by `document.id`. Work it out when listing; do
   not store it in the SQLite index, which holds only what a rescan can recompute
   ([decisions.md](../../wiki/decisions.md#scene-files-are-truth-sqlite-is-a-derived-index)). The
   bundled list marks all three as having builders.
4. **The warning.** The first time a drawing tool is picked in a scene with a builder, a dialog says
   it plainly: "Greenhollow is built from scenes/src/greenhollow.ts. What you draw here is erased
   the next time the scenes are rebuilt." It offers **Draw anyway** (once per scene per session) and
   **Save as a new house**, which `POST`s a copy under a new title and id and opens that.

## Files you OWN

- `apps/web/src/scenes.ts`, `apps/web/src/App.tsx` (load and save), `apps/web/src/ui/Toolbar.tsx`
- A small API client, e.g. `apps/web/src/lib/api.ts`
- `apps/api/src/app.ts` and `apps/api/src/store/` for `hasBuilder`
- Tests in `apps/web/test/` and `apps/api/test/`

## Files you must NOT touch

- `scenes/build.ts` and `scenes/src/`. The builders keep working exactly as they do.
- `packages/schema`. A new house is an ordinary `SceneDocument`.
- The API's create and replace rules: `POST` never overwrites, `PUT` never creates (brief 61).

## Acceptance

- With `npm run api` and `npm run dev` running, New house "Test Cottage" creates
  `scenes/test-cottage.scene.json`, opens it with an empty plan, and `npm run scenes` leaves the
  file untouched afterwards.
- After drawing walls in it and saving, the picker reopens it with the walls, from the API.
- Editing the file by hand while it is open, then saving in the app, gives the stale message, not an
  overwrite.
- Picking the Wall tool in Greenhollow shows the warning once. Save as a new house makes a copy with
  no builder, and drawing in the copy shows no warning.
- With no API, the three bundled scenes still open, and New house is disabled with a reason.
- API tests cover `hasBuilder` for a scene with and without a builder.
- `npm run check` passes.
