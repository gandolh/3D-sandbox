---
summary: Locked calls about the web app's controls (2026-11-11) — Base UI under components/ui, which wrapper does what, what stays native or on a title, the plan popovers, and the Light, Dark and System switch with Solstice's dark first visit. Read before adding a control or touching the theme.
updated: 2026-11-11
---

# Web decisions

The counterpart to [decisions.md](decisions.md) for `apps/web`'s chrome. The look (Darkroom) is in decisions.md;
the engine is in [architecture.md](architecture.md). The rules are the estate's `base-ui` skill, which
`check-base-ui` enforces in `check:conventions` (strict since brief 06).

## Base UI under the app's controls

Base UI 1.9.0 is imported only in `apps/web/src/components/ui/`, one wrapper per primitive, styled with Tailwind
and the `@theme` tokens in `styles.css`. `cn()` (`src/lib/cn.ts`) is clsx and tailwind-merge told the z-index names.
The base rules sit in `@layer base`, so a utility beats them.

- **`Dialog`** is the three scene dialogs. An Escape guard (an Esc a control inside used is not the dialog's),
  initial focus on `[data-autofocus]`, else the first control, else the footer's first button, a Title and a
  labelled close control. New house sets `disablePointerDismissal`, because it holds a form. Base UI stops the Esc
  that closes a dialog at the document, so the plan tools' window listeners never see it and a half-drawn wall stays.
- **`Select`** takes `items`, so the scene picker reads `<id>.scene.json`, never the id. It replaces all six
  native selects (scene, shot, level, wall and floor material, room use). Tests open the popup and click the option.
- **`Checkbox`** (Context, Colliders) and **`Slider`** (animation time; solar time as an invisible scrub strip over
  the sun band, which shows only a focus outline). A slider's hidden input is a range, which `editsText` does not
  count, so Ctrl+Z still undoes from it.
- **`ToggleToolbar`** is the plan tools: one Tab stop, arrow keys along it, the chosen tool pressed and kept when
  pressed again. A disabled tool is `aria-disabled`, not `disabled`, so it stays in the ring and keeps its title.
- **`PointPopover`** is the room popover and the opening tool's typed distance. Portalled, non-modal, placed from an
  invisible anchor at the click (the one inline `style`, computed geometry). Only Esc closes it: the plan's own click
  handler decides every other dismissal, as before. The wall tool's typed field is still a plain panel.
- **`RadioGroup`** and **`ThemeSwitch`** are the theme switch.
- **`Scroll`** moved here from `ui/`.

**Left native, on purpose.** `Field`'s number inputs (commit on blur, Esc abandons; a `NumberField` would change
that), the options bars' text inputs, and the `title=` hints (many say why a disabled button is disabled, and a
disabled element gets no hover events, so a `Tooltip` would not fire).

**The swatch.** `Inspector.tsx`'s wall swatch takes its colour from the document's material, which no token can
name, so it is an inline style, recorded as a rule 5 exception in `scripts/conventions.json`.

## The theme

Light, Dark and System, kept in `localStorage` under `theme`. `data-theme` on `<html>` is the only mechanism:
`styles.css` keys the light palette off it and the dark one is `@theme`, with no `prefers-color-scheme` anywhere in
the stylesheet. `themeChoice` is what was picked; `theme` is the palette in force. `System` asks `matchMedia` and
follows its `change` event until another choice is made. A boot script in `index.html` sets the attribute before
the first paint, and every storage read and write is in a `try`, so the app works with storage blocked.

**A first visit is dark.** The estate's rule is light first (Q18); the owner kept the Darkroom decision (2026-11-10):
a path-traced render cannot be judged for exposure against a light surround. The default is one constant,
`DEFAULT_THEME`, which the boot script repeats and a test keeps in step. The switch is a `RadioGroup` and not a
`Select`, because a device-only picker is a filter-like choice (rule 16): three options worth showing at once, and
an arrow key may try each, since nothing is saved to a server.
