# Task 36 — The control that stops an hour of rendering is the hardest to reach

## Context

From the 2026-09-12 audit, round 2.

DOM order in `App.tsx:90` is **Toolbar → SceneTree → Viewport → Inspector**. The
render overlay's **Cancel** button lives inside the Viewport. `SceneTree.tsx:30`
renders **one `<button>` per node** — every wall, opening, slab, roof, placement,
run, scatter field and road — all individually tabbable, with no roving
`tabindex` and no `role="tree"` semantics.

So after pressing **Render all** in the toolbar — whose own tooltip warns it takes
"about 58 min" — a keyboard user must Tab through *every entity in the scene*
before reaching Cancel. Greenhollow's tree is over forty nodes; Elmsgate's is
similar. The one control you need in a hurry is behind all of them.

Two smaller keyboard gaps belong in the same pass:

- **The toolbar's two `<select>`s have no accessible name.** Scene picker
  (`Toolbar.tsx:33`) and shot picker (`Toolbar.tsx:89`) are named only by a
  `title` attribute, which is a last-resort source browsers and screen readers
  expose inconsistently. A keyboard user hears "combobox".
- **Section headers in the tree are focusable.** "Site" and "Terrain" have no
  `id`, so they render as `disabled` buttons — still in the document, still
  consuming attention, and conveying a structure that arrow keys should convey.

## Files you OWN

- `apps/web/src/App.tsx` — DOM order or focus management
- `apps/web/src/ui/SceneTree.tsx`
- `apps/web/src/ui/RenderOverlay.tsx`
- `apps/web/src/ui/Toolbar.tsx`

## Files you must NOT touch

- The 3D canvas. An accessible orbit camera is not in scope and is not expected —
  but **selection** is, because it has a DOM tree beside it.
- The React-renders-chrome-only split. Locked.

## What to do

1. **Make Cancel reachable immediately.** The cleanest fix is to move focus to it
   when a render starts, and bind **Escape** to cancel while one is running —
   that also serves mouse users, who currently have to find a small button.
   Whatever you choose, a keyboard user must reach Cancel in one or two keys.
2. **Give the scene tree real tree semantics**: `role="tree"` / `role="treeitem"`,
   one tab stop for the whole tree, arrow keys to move within it, and headers
   exposed as structure rather than as disabled buttons.
3. **Name both `<select>`s** with a real label — visually hidden if the design
   does not want visible text — rather than relying on `title`.
4. **Check the whole app with the mouse unplugged**: load, switch scene, select a
   wall, edit a field, start a render, cancel it. Say in the outcome note which of
   those you actually performed.

## Acceptance

- Cancel is reachable in at most two keystrokes from the start of a render, and
  Escape cancels.
- The scene tree is one tab stop with arrow-key navigation.
- Both toolbar selects have accessible names.
- `npm run check` exits 0.
