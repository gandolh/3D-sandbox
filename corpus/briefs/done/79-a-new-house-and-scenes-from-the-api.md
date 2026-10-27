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

## Outcome (2026-10-27)

Built as filed. The web side is `apps/web/src/lib/api.ts` (the client, and the one guarded read of
`__API_BASE__`, which vitest does not define), `apps/web/src/lib/scene-source.ts` (`refreshScenes`,
`openScene`, `saveOpenScene`, `createHouse`), and `apps/web/src/ui/SceneDialogs.tsx`. `App.tsx` lists the
API's scenes before opening the first, and Save goes through `saveOpenScene`. On the API, `hasBuilder` is
in `store/files.ts` and `GET /api/scenes`. `scenes/build.ts`, `scenes/src/`, `packages/schema` and the
create and replace rules are untouched.

**One path in.** First load, the picker, New house and a reload after a stale save all call `openScene`,
which takes the API's copy when the API lists the id and the bundled one otherwise, through
`SceneDocument.safeParse` either way. `setSceneId`, which drove the old load-by-effect, is gone. The listing
gives up after 1.5 s, and a non-OK answer counts as down, because Vite's proxy answers 500 when the API is
stopped.

**Two additions outside the brief's list.** PUT and POST responses now carry `x-scene-mtime`: without it the
version kept from the read went stale on the first save, and the second save was refused. The rules are as
they were. And the warning is raised from the plan view's `ToolBar.tsx` through a store `pickTool`, with the
scene list, the API state, the kept version and the dialogs in the store; the 77 and 78 tests answer
Villa's warning in `beforeEach`. The check keys on the open document's id, which the API holds equal to its
file name.

**Choices.** The id is the title lowercased, accents stripped and words hyphenated ("Căsuța" → `casuta`); one
that cannot start with a letter ("2nd Cottage") is refused in the dialog. "Save as a new house" copies the
whole open document, unsaved edits included. A new house copies all the open scene's materials, so one
made from Greenhollow starts with 17 `materials-are-used` warnings: of its 18 materials only the terrain's is
used (16 after drawing four walls).

**Checked in Chromium** (Playwright; dev server on :5181 with `apps/api` on :5174 against a temp copy of
`scenes/` that had the three builder file names in `src/`, a second dev server on :5182 built with no API):

- New house "Test Cottage" wrote `test-cottage.scene.json` with Greenhollow's site and one empty Ground floor,
  and opened it in the plan view with the Wall tool, no marks, and "· drawn" in the picker.
- Four walls drawn and saved matched the file on disk. Switching to Greenhollow and back, and reloading the
  page and picking it, both reopened it from the API with the same walls.
- Retitling the file by hand while it was open, then saving: the stale dialog, the alert in the footer, and the
  file still had the hand edit and its 0.24 m wall. Reload from disk showed the new title.
- Wall in Greenhollow showed the warning with the brief's wording and left the tool on Select. Save as a new
  house made `greenhollow-copy` (`hasBuilder: false`, all 23 walls) and opened it with the Wall tool; Wall and
  Door there warned nothing. Back in Greenhollow, Draw anyway, then Select and Wall: no second warning.
- With no API in the build, and separately with the API stopped, the three bundled scenes opened and New house
  was disabled, titled "This build has no API…" and "The API is not answering (start it with npm run api)…".

**`npm run scenes` leaves a drawn scene alone,** checked without writing into the repo: `scenes/build.ts` was
run from a copy in /tmp with `src/` linked to the real builders and `test-cottage.scene.json` beside the
outputs. It rewrote the three builders' files and left the drawn one byte-identical (sha256 match, mtime
unchanged). The acceptance names `scenes/test-cottage.scene.json`; with the API on its default directory New
house writes there, but that path was not exercised, so no scene file was ever created in the repo.

**Tests:** API (`hasBuilder` with and without a builder, a builder added after boot, a directory that is not a
builder, the version on PUT and POST, and each builder's file name against its document id) and web (17:
titles, the minimal document, the merged list, down and none, the kept version and the stale refusal through
a fake API, New house and its refusals, the warning). **665 → 691 tests.** `npm run check` passes.
