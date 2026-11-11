---
paths:
  - "apps/web/src/**"
---

# The web app (`apps/web/src`)

- Read the `base-ui` skill before you add or change a component, and
  [corpus/wiki/architecture.md](../../corpus/wiki/architecture.md) before you touch the engine.
- React renders chrome only. The scene graph is imperative three.js in
  `src/engine/`, with no React Three Fiber. WebGL2 only: no `three/webgpu`, no TSL.
- Base UI (1.9.0, pinned) is imported only by the wrappers in `src/components/ui/`, one per primitive,
  from its subpath (`@base-ui/react/dialog`). Pages and tools import the wrapper, never `@base-ui/react`.
  What each wrapper does is in [corpus/wiki/decisions-web.md](../../corpus/wiki/decisions-web.md).
- Style with Tailwind on each part's `className`, merged with `cn()` from `src/lib/cn.ts`; state through
  `data-*` variants (`data-checked:`, `data-popup-open:`), never a CSS selector aimed at a part. One stylesheet,
  `src/styles.css`, its base rules in `@layer base`. No inline `style` except computed geometry or data.
- Every popup goes through its `Portal` and takes its z-index from the `--z-index-*` tokens. Motion keys on
  `data-starting-style` and `data-ending-style`, under `motion-safe:`.
- A dialog is the `Dialog` wrapper (controlled, an Escape guard, a Title, initial focus); one that holds a form sets
  `disablePointerDismissal`. A `Select` always gets `items`. A device-only picker (the theme) is a `RadioGroup`.
  No `window.confirm`, `alert` or `prompt`. Text, number, date and time inputs and `title=` hints stay native.
- Tests select by role and name.
- No `^` or `~` in any `package.json`: versions are exact, and `.npmrc` keeps
  `save-exact=true`.
- A `<button>` always has a `type`, and `dangerouslySetInnerHTML` only carries
  markup this repo builds (the plan drawing). No `autoFocus`: a dialog or popover sets `initialFocus`, and a
  control to focus first carries `data-autofocus`. Each exception carries an `eslint-disable-next-line` with its reason.
- The plan tools (`src/ui/plan/use*Tool*.tsx`) mirror state into refs during
  render on purpose, so a window key listener bound once reads the latest
  value. The React compiler rules are warnings there (see `eslint.config.js`);
  do not "fix" them without a test that drives the tools first.
- Colours are tokens from `src/styles.css`. No hex, `rgb()` or named colour in
  a class name.
- Web tests: a file that renders components is `.test.tsx` and gets happy-dom;
  everything else is `.test.ts` and runs in Node.
- `npm run check:conventions` runs `check-base-ui` over this folder, strict.
