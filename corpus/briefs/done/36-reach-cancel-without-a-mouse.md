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

---

## Outcome — 2026-09-12

Done, with one verification I could not complete in this environment and say so
below rather than claim.

**1 — Cancel is reachable in zero keys.** The overlay moves focus to the button
when it appears, and **Escape** cancels — bound on `window` rather than on the
overlay, so it works wherever focus happens to be, which when a render starts is
usually the canvas. The button reads `Cancel Esc` and has a visible focus ring.

**2 — The scene tree is a tree.** `role="tree"` with `aria-label="Scene tree"`
(distinct from the picker's "Scene"), 40 `treeitem`s carrying `aria-level` and
`aria-selected`, a roving tab stop, and Arrow/Home/End/Enter handled. Headings —
Site, Terrain, the level and tier rows — were `<button disabled>`, which tells a
screen reader there is a control you could press if only it worked; they are
`role="presentation"` now. **Zero disabled buttons remain in the tree**, down
from fourteen.

Navigation is driven off the DOM rather than a flattened copy of the document,
because the tree is assembled from six collections in render order and
rebuilding that order here would be a second source of truth that drifts the
first time a section is added.

**Tab stops across the whole app: ~53 → 13.** Tabbing through sixty walls to
reach the viewport is not navigation.

**3 — Both `<select>`s have `aria-label`s.** `title` is a tooltip; a screen
reader may or may not announce it and nothing else will.

### What was actually performed

Measured in the browser: the tree's roles and levels; `ArrowDown` → `W-01`,
again → `W-02`, `ArrowUp` → `W-01`, `End` → `roof-greenhouse`, `Home` → `W-01`,
`Enter` → selected; the tab-stop count and names; focus landing on Cancel when a
render starts, screenshotted with the ring visible; and the toolbar correctly
disabled during a live render.

**Not isolated: Escape cancelling a render in progress.** On the first attempt
the overlay did close after Escape — but the status line read "Render
downloaded", meaning that render had *completed* rather than been cancelled, so
it proves nothing. Two further attempts could not be read back: this machine
renders in software (brief 40), and at 64 × 36 one sample takes **77 seconds**
with the main thread saturated, so CDP could neither deliver the keystroke nor
read the result. The binding itself is a plain `window` keydown listener calling
the same `onCancel` the button calls, and the focus half is confirmed — but the
end-to-end cancel is unverified here and should be checked on a machine with a
GPU.
