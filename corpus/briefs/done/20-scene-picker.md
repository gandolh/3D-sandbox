# Task 20 — A scene picker

## Context

`apps/web/src/App.tsx:9` hard-imports `greenhollow.scene.json`. Two scenes exist
and one has never been openable: `villa-carpathia` is the regression fixture and
nobody has ever *looked* at it, which is part of why its forest being one
species went unnoticed as long as it did.

Brief 21 adds a third. A second scene with no way to load it is a file, not a
scene, so this comes first.

## Files you OWN

- `apps/web/src/scenes.ts` — new. The bundled catalogue.
- `apps/web/src/App.tsx` — load from the catalogue, not a fixed import.
- `apps/web/src/state/store.ts` — the current scene id.
- `apps/web/src/ui/Toolbar.tsx` — the picker, beside the shot picker.
- `apps/web/test/scenes.test.ts` — new.

## Files you must NOT touch

- `scenes/` — the documents themselves are unchanged.
- `packages/schema` — a catalogue of what an app happens to bundle is not
  something a scene document knows about.

## What to do

1. **A catalogue module** listing every built scene with its id and title,
   importing each `.scene.json`. Bundled at build time, matching the existing
   decision that the client ships the scenes it can open.
2. **Switching re-parses through the schema**, exactly as the initial load does.
   A scene loaded by a different route than the first one is a scene whose
   validation nobody checked.
3. **Switching clears selection, shot and playhead.** They are all ids into the
   document that just went away; carrying them over points them at nothing.
4. **The picker sits beside the shot picker** and is hidden when only one scene
   is bundled, like the shot picker already is.

## Acceptance

- The catalogue is covered headlessly: every entry parses, and ids are unique.
- `npm run check` exits 0.
- One end-to-end: switch scenes and confirm the tree, triangle count and shot
  list all change.

---

## Outcome — 2026-09-11

Done. `apps/web/src/scenes.ts` lists the bundled scenes; the toolbar picks
between them and `App` re-parses through `SceneDocument.safeParse` on every
switch, so the first load and a later switch take one path rather than two.
Selection, shot, playhead and playing all reset — they are ids into a document
that has gone away.

`json` is typed `unknown` on purpose. Typing a `.scene.json` as a `SceneDocument`
would assert it valid with nothing having checked, which is the assertion the
schema exists to refuse. The catalogue test cashes that in: every entry parses
and lints error-free, and its title matches the document's own.

Villa Carpathia is openable for the first time.
