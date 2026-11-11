---
paths:
  - "apps/web/src/**"
---

# The web app (`apps/web/src`)

- Read the `base-ui` skill before you add or change a component, and
  [corpus/wiki/architecture.md](../../corpus/wiki/architecture.md) before you touch the engine.
- React renders chrome only. The scene graph is imperative three.js in
  `src/engine/`, with no React Three Fiber. WebGL2 only: no `three/webgpu`, no TSL.
- Base UI is imported only by wrappers in `src/ui/`. Pages and tools import the
  wrapper, never `@base-ui/react` (today `Scroll.tsx` is the one wrapper).
- No `^` or `~` in any `package.json`: versions are exact, and `.npmrc` keeps
  `save-exact=true`.
- A `<button>` always has a `type`, and `dangerouslySetInnerHTML` only carries
  markup this repo builds (the plan drawing). `autoFocus` only on a modal's
  first control. Each exception carries an `eslint-disable-next-line` with its reason.
- The plan tools (`src/ui/plan/use*Tool*.tsx`) mirror state into refs during
  render on purpose, so a window key listener bound once reads the latest
  value. The React compiler rules are warnings there (see `eslint.config.js`);
  do not "fix" them without a test that drives the tools first.
- Colours are tokens from `src/styles.css`. No hex, `rgb()` or named colour in
  a class name.
- Web tests: a file that renders components is `.test.tsx` and gets happy-dom;
  everything else is `.test.ts` and runs in Node.
- `npm run check:conventions` runs `check-base-ui` over this folder, as a
  warning until its findings are fixed.
