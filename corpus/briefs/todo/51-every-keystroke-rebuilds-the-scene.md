# Task 51 — A field named `onCommit` fires on every keystroke

## Context

From the 2026-09-13 audit.

`Field` is the numeric input behind **every** editable property in the
Inspector — wall length, height, thickness, bearing, each opening's offset,
width, height and sill, each placement's X/Y/Z, rotation and scale. Its prop is
called `onCommit`. It is wired to `onChange`
(`apps/web/src/ui/primitives.tsx:34`):

```tsx
onChange={(event) => {
  const next = Number.parseFloat(event.target.value);
  if (Number.isFinite(next)) onCommit?.(next);
}}
```

React's `onChange` on an `<input>` fires on **every character**. So typing
`150` runs the whole edit pipeline three times, and that pipeline is not cheap
(`apps/web/src/state/store.ts:209`):

```ts
const draft = structuredClone(state.document) as SceneDocument;
mutate(draft);
const parsed = SceneDocument.safeParse(draft);
...
set({ document: parsed.data, findings: lintScene(parsed.data), revision: state.revision + 1 });
```

structured-clone the whole document, re-parse it through Zod, re-lint it, then
bump `revision` — which `Viewport`'s effect turns into a **full scene
regeneration**.

**Measured on Greenhollow (the default scene):**

| stage | cost |
|---|---|
| `SceneDocument.parse` | 1.1 ms |
| `lintScene` | 1.6 ms |
| `generateScene` | **98 ms** |

So roughly **100 ms per character**, on the main thread, plus a new document
identity every time — which re-renders every component subscribed to
`s.document` (`Viewport`, `Toolbar`, `Inspector`, `SceneTree`).

Typing a four-digit millimetre value is about **0.4 s of blocked UI**, and the
intermediate values are real documents: typing `150` briefly commits a wall
length of `1` and then `15`, each fully linted, each possibly producing
findings that flash in the panel.

## Files you OWN

- `apps/web/src/ui/primitives.tsx`
- `apps/web/test/`

## Files you must NOT touch

- `editDocument`'s clone-and-reparse. That an edited document is
  indistinguishable from a loaded one is a deliberate invariant — see the
  comment above it. This brief changes **how often** it runs, not what it does.

## What to do

1. **Make the name true.** Commit on `blur` and on `Enter`, not on `change`.
   Keep the field's own displayed value in local state while typing so it stays
   responsive.
2. **Keep the arrow keys and the spinner working** — those are `change` events
   a user expects to take effect. Either commit them immediately or debounce
   them; say which and why in a comment.
3. **Do not commit a value the user is mid-way through typing.** `-`, `0.`, and
   an empty field are all states a number input passes through legitimately.
4. **Test the behaviour, not the implementation**: typing three characters
   produces **one** document revision; blur commits; Escape reverts to the
   document's value.

## Acceptance

- Typing a multi-character value produces exactly one revision bump.
- The field still reflects an external document change (undo, a scene switch).
- `npm run check` exits 0.
