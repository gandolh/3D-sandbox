# Task 06: Base UI by the conventions, and a theme switch

**Depends on:**

- In 3D-sandbox: brief 04, for 1.9.0, and brief 05, for the gate, ESLint (`jsx-a11y`, the `no-restricted-syntax` selectors) and `.claude/rules/web.md`.
- In the owner's skills library:
  - brief 02, *A base-ui skill, styled with Tailwind*: rules 1-13, the references and `check-base-ui.mjs`;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: the checker runs `--warn-only` until this brief is done.
- The owner's grilling of 2026-11-10:
  - Q58: a dialog that holds a form sets `disablePointerDismissal` (**decided**);
  - Q18: Light, Dark and System, persisted on the device (**decided**; Solstice's first-visit default stays dark, see decision 4);
  - Q19: before and after screenshots at 1280 and 390 px need only be "close enough" (**decided**; it applies here to the dialog and widget swaps);
  - Q40, the phone drawer, does not apply: Solstice is a desktop editor with no phone navigation panel.

**Runs before:** nothing in this set. Brief 07 is independent.

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The owner's call of 2026-11-09 is Base UI everywhere at 1.9.0, styled with Tailwind v4, with the conventions enforced. Two parts of that need no work here:

- **There is no Tailwind migration brief.** `apps/web` is already on Tailwind v4 (`apps/web/vite.config.ts:4, 104`, `apps/web/src/styles.css:1`). The one stylesheet, `apps/web/src/styles.css` (103 lines), holds `@theme` tokens (line 11), the light palette (line 48) and a small base. `git ls-files '*.css'` lists that one file: no CSS Modules, no leftover plain CSS. One thing to fix: its base rules at lines 68, 74, 86, 91 and 96 are **unlayered**, so they beat Tailwind's utilities. They move into `@layer base` (step 1).
- **There is no redesign brief.** The owner's Q39 scope leaves the games out, because their UI is the game. Solstice's chrome stays as the Darkroom direction fixes it ([wiki/decisions.md](../../wiki/decisions.md), "Visual direction: Darkroom").

What is left is the audit below, and the theme switch.

### The audit against rules 1-13 (2026-11-10)

Only one file imports Base UI today: `apps/web/src/ui/Scroll.tsx:1`.

| Rule | Violations | Where |
|---|---|---|
| 1. Exact pin | 0 after brief 04 | `apps/web/package.json:12` |
| 2. Subpath imports | 0 | `@base-ui/react/scroll-area` |
| 3. Base UI only under a `ui/` folder | 0 | `apps/web/src/ui/` is a `ui/` folder, but it holds every component, not only wrappers. The skill spells the wrapper folder `components/ui/`. Decided (Q59): wrappers go in `apps/web/src/components/ui/`, named by primitive; `Scroll.tsx` moves there. |
| 4. Tailwind on the parts, no class selector aimed at a part | 0 | `Scroll.tsx:15-23` uses `data-[hovering]:` and `data-[scrolling]:` |
| 5. One stylesheet, no inline `style` except computed geometry | 0 stylesheet issues; 10 inline `style` props | `apps/web/src/ui/plan/useWallTool.tsx:404`, `useOpeningTool.tsx:192`, `useAreaTools.tsx:157` (cursor-following popovers), `Timeline.tsx:135, 140`, `RenderOverlay.tsx:95`, `SceneTree.tsx:51, 78`, `plan/PlanSurface.tsx:256` are computed geometry. `Inspector.tsx:254` sets a swatch colour from the document, which needs a recorded exception. |
| 6. Semantic tokens only | 0 | `grep -rnE "bg-\[#|text-\[#|border-\[#|\[rgb|\[hsl" apps/web/src` finds nothing |
| 7. Motion through state attributes | 0 | no animated popup exists yet |
| 8. Floating parts portalled | 0 | no Base UI popup exists yet; the hand-built `Modal` is not portalled (rule 13) |
| 9. Triggers use `render` | 0 | no triggers yet |
| 10. Select with differing labels passes `items` | n/a now | applies once the six native selects move (rule 13) |
| 11. No native `confirm`, `alert`, `prompt` | 0 | `grep -rnE "window\.(confirm|alert|prompt)" apps/web/src` finds nothing |
| 12. Dialogs | **3 dialogs, all hand-built** | `apps/web/src/ui/SceneDialogs.tsx:19-41` (`Modal`) serves `BuilderWarning` (line 67), `NewHouse` (132) and `StaleSave` (186). It has its own Escape handler (27-31), `role="dialog"` and `aria-modal`, and `autoFocus` on a control (`SceneDialogs.tsx:91, 147, 198`). It sets no initial-focus order, and a click outside does not close it. `NewHouse` holds a text field, so it needs `disablePointerDismissal` (Q58). |
| 13. Prefer Base UI over hand-built widgets | **13 sites, 5 kinds** | see below |

**Rule 13's sites**, with what the repo's decisions keep native left out:

1. **Dialogs:** the `Modal` above. Becomes a `Dialog` wrapper with the Escape guard, `initialFocus` (first `[data-autofocus]`, else first field, else the footer's first button), a `Title`, and `disablePointerDismissal` on the form. The existing comment (`SceneDialogs.tsx:15-17`) says `<dialog>.showModal()` was avoided because the test DOM lacks it; Base UI's `Dialog` renders a `div` with `role="dialog"`, so `apps/web/test/scene-source.test.tsx:272` (`getByRole("dialog")`) still finds it. Confirm under happy-dom in step 3.
2. **Native selects, six:** `apps/web/src/ui/Toolbar.tsx:70` (scene), `Toolbar.tsx:203` (shot), `apps/web/src/ui/PlanView.tsx:59` (level), `apps/web/src/ui/plan/ToolBar.tsx:150, 222` (material), `apps/web/src/ui/plan/useAreaTools.tsx:189`. No decision in [wiki/decisions.md](../../wiki/decisions.md) keeps them native, and this is a desktop editor. They become a `Select` wrapper that takes `items` (rule 10): the scene select shows `"<id>.scene.json"` for an id, which is exactly the raw-value trap. Two tests use `userEvent.selectOptions`, which only works on a native `<select>`: `apps/web/test/plan-view.test.tsx:56` and `apps/web/test/wall-tool.test.tsx:208`. They change to open the popup and click the option.
3. **Checkboxes, two:** `Toolbar.tsx:116` (Context) and `Toolbar.tsx:127` (Colliders). Become `Checkbox`.
4. **Range inputs, two:** `apps/web/src/ui/Timeline.tsx:116` ("Animation time") and `Timeline.tsx:145` ("Solar time"). Become `Slider`. Risk: a drag fires one `setSolar` per input event (`apps/web/test/store.test.ts:183`), and the undo keys treat a range as "not a text field" (`apps/web/src/ui/useUndoKeys.ts:4-18`; `apps/web/test/undo.test.tsx:104-113`). Base UI's slider keeps a hidden `input[type=range]`; the test must still pass unchanged.
5. **The plan tools row:** `apps/web/src/ui/plan/ToolBar.tsx:52` is a hand-built `role="toolbar"` of `aria-pressed` buttons. Becomes the 1.9.0 `Toolbar` with `Toggle`s (one Tab stop, arrow keys).

**Considered and left native:**

- The `Field` number inputs (`apps/web/src/ui/primitives.tsx`): their commit-on-blur and Escape-abandons behaviour is documented at length (lines 5-27) and a `NumberField` would change it. Native text and number inputs stay native, as rule 13 allows.
- The `title=` attributes (18 sites, `grep -rn "title=" apps/web/src | wc -l`). Many give the reason a disabled button is disabled, and a disabled element gets no hover events, so a `Tooltip` would not fire there. They stay. *Question below.*
- The Escape keys in the plan tools (`useWallTool.tsx:175, 376`, `useOpeningTool.tsx:140, 215`, `useAreaTools.tsx:56`). They are window listeners. The `Dialog`'s Escape guard must keep a dialog's Escape from also cancelling a half-drawn wall: check `event.defaultPrevented` in each, or confirm the dialog stops propagation.

### The theme today (read 2026-11-10)

- `apps/web/index.html:2` ships `data-theme="dark"`.
- `apps/web/src/state/store.ts:37` types `theme: "dark" | "light"`, `:196` starts it at `"dark"`, and `:304-306` sets `document.documentElement.dataset.theme`. Nothing is persisted (`grep -rn "localStorage" apps/web/src` finds nothing).
- `apps/web/src/ui/Toolbar.tsx:137-140` is one button that flips between the two.
- `apps/web/src/styles.css` holds the dark palette in `@theme` and the light one under `:root[data-theme="light"]` (line 48). **That already is the method the owner's Q18 answer asks for** (a `data-theme` attribute, not `prefers-color-scheme`). No `dark:` utility exists, so `@custom-variant dark` is only needed if one is ever written.
- `apps/web/test/contrast.test.ts:15-28` reads `styles.css`, splits it at `:root[data-theme="light"]`, and checks WCAG AA for both palettes. It must keep passing.

## Owner decisions

**Decided on 2026-11-10 (the owner's answers):**

1. **A theme switch with Light, Dark and System, kept on the device** (Q18). Tailwind keys off `data-theme`.
2. **A form dialog does not close on an outside tap** (Q58): `disablePointerDismissal` on `NewHouse`. It closes with Cancel, the X or Esc.
3. **Screenshots at 1280 and 390 px need only be close enough** (Q19). Drift of a few pixels is neither fixed nor listed.
4. **The first-visit theme stays Dark** (owner, 2026-11-10). Q18 asks for light by default; the owner kept Solstice's Darkroom decision (2026-09-11) instead: a path-traced render cannot be judged for exposure against a light surround. Solstice still gets the Light / Dark / System switch. The default is one constant, `DEFAULT_THEME`, set to dark.

**Decided by the owner's confirmation of the technical calls (2026-11-10):** the wrappers' location (decision 5 below), Q16 (native text, date and time inputs stay native), Q57 (an always-one-chosen filter uses `RadioGroup`; a picker that saves on each choice uses a guarded `ToggleGroup`; the plan toolbar chooses a tool, so it uses the `Toolbar`), and Q62 (tests select by role, a named type scale in `@theme`, no `phone` variant).

**Defaults this brief builds:**

5. **Wrappers live in `apps/web/src/components/ui/`** (Q59, decided 2026-11-10). `Scroll.tsx` moves there in step 1. The rest of `apps/web/src/ui/` is app components and stays.
6. **The six selects, two checkboxes, two sliders and the plan toolbar move** (rule 13), as listed above. *New question: or keep any of them native.*
7. **`title=` attributes stay** native.
8. **`Field` stays native.**
9. **The data-colour swatch** (`Inspector.tsx:254`) gets a recorded exception in the checker's exceptions file, like Almanac's calendar colours.

## Files you OWN

- `apps/web/src/components/ui/` (new wrappers, and `Scroll.tsx` moved from `apps/web/src/ui/`: `Dialog.tsx`, `Select.tsx`, `Checkbox.tsx`, `Slider.tsx`, `ToggleToolbar.tsx` (named to avoid the existing `Toolbar.tsx` component) and `ThemeSwitch.tsx`), and the call sites in `SceneDialogs.tsx`, `Toolbar.tsx`, `PlanView.tsx`, `Timeline.tsx`, `plan/ToolBar.tsx`, `plan/useAreaTools.tsx`.
- `apps/web/src/lib/cn.ts` (new: clsx + tailwind-merge, with `extendTailwindMerge` for the custom token names) and the two dependencies it adds.
- `apps/web/src/styles.css` (base rules into `@layer base`; the theme blocks), `apps/web/index.html` (the pre-paint theme script), `apps/web/src/state/store.ts` (the theme choice).
- The tests named above, and new ones for each wrapper and the switch.
- `scripts/conventions.json`, if the swatch exception needs it.
- `.claude/rules/web.md` (add the Tailwind and Base UI lines), [wiki/decisions.md](../../wiki/decisions.md), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md).

## Files you must NOT touch

- The engine, the drawing code, `packages/` and `apps/api/`. This brief changes controls and their wrappers, not what they do.
- The colour values in `styles.css`. The theme blocks move or gain an attribute; no token changes value.
- `apps/web/src/ui/primitives.tsx`'s `Field`.

## What to do

One commit per step. After each: `npm run check` green, and `npm run build:web` builds.

1. **Base layer and `cn`.** Move the unlayered rules at `styles.css:68-100` into `@layer base`. Move `Scroll.tsx` to `apps/web/src/components/ui/`. Add `cn()` and its two dependencies, pinned. Check the app looks the same at 1280 and 390 px (Q19: close enough).
2. **Wrappers, one commit each**, in this order, each with a test, each styled with Tailwind on the parts using the existing tokens (`bg-panel`, `border-line`, `text-ink`, `bg-accent`) and `data-[...]` state variants:
   1. `Dialog` (Escape guard, `initialFocus` order, `Title`, `disablePointerDismissal` as a prop, an `aria-label` on the close control). Move the three dialogs onto it and delete `Modal`. Delete the five `no-autofocus` disables and the one `no-noninteractive-element-interactions` at `SceneDialogs.tsx:22`.
   2. `Select`, taking `items`. Move the six selects; update the two tests that use `selectOptions`.
   3. `Checkbox` (two sites), then `Slider` (two sites; the undo test must pass unchanged), then `ToggleToolbar` (`plan/ToolBar.tsx:52`). Delete the `no-autofocus` disables at `useAreaTools.tsx:177` and `useOpeningTool.tsx:197` and the interaction disable at `useAreaTools.tsx:154` by moving those two popovers onto `Dialog` or `Popover` wrappers with `initialFocus`.
3. **The theme switch.**
   1. Store a `themeChoice` of `"light" | "dark" | "system"` in `store.ts` beside the resolved `theme`. `system` resolves through `matchMedia("(prefers-color-scheme: dark)")` and follows its `change` event.
   2. Persist the choice in `localStorage` under one key, with `try/catch` on every read and write; the app works with storage blocked.
   3. Set `data-theme` before first paint with a small inline script in `index.html`, so a stored choice does not flash. With no stored choice it uses `DEFAULT_THEME` (decision 4).
   4. Replace the one-button toggle at `Toolbar.tsx:137-140` with `ThemeSwitch`, built on the `Select` wrapper, labelled Light, Dark, System.
   5. Tests: a stored `light` is applied; an unstored first visit applies `DEFAULT_THEME`; `system` follows a mocked `matchMedia`; storage that throws does not break the app; `apps/web/test/contrast.test.ts` still passes.
4. **Corpus and checker.** Add the Tailwind and Base UI lines to `.claude/rules/web.md`. Drop `--warn-only` from `check-base-ui` in `check:conventions`. Record the new wrappers and the swatch exception in [wiki/decisions.md](../../wiki/decisions.md) ("Base UI under the app's controls") and update [wiki/status.md](../../wiki/status.md) and [log.md](../../log.md). Run `bash corpus/lint.sh`.

## Acceptance

- [ ] `npm run check:conventions` exits 0 with `--warn-only` removed from the base-ui checker, and `grep -rn "@base-ui" apps/web/src --include=*.tsx --include=*.ts -l` lists only files under `apps/web/src/components/ui/`.
- [ ] `grep -rnE "<select|type=\"checkbox\"|type=\"range\"|role=\"dialog\"|role=\"toolbar\"" apps/web/src` finds only the wrappers.
- [ ] `grep -rn "biome-ignore\|eslint-disable.*jsx-a11y" apps/web/src` finds nothing.
- [ ] `npx vitest run apps/web` passes, including `contrast.test.ts`, `undo.test.tsx`, `plan-view.test.tsx`, `wall-tool.test.tsx` and `scene-source.test.tsx`. New tests cover each wrapper and the theme switch.
- [ ] The three dialogs: Escape closes each, and with the wall tool mid-chain Escape in a dialog does not cancel the chain (a test). `NewHouse` ignores an outside click; the other two follow the default.
- [ ] The theme switch tests in step 3.5 pass, and `grep -n "data-theme" apps/web/index.html apps/web/src/state/store.ts` shows the attribute is the only mechanism (`grep -rn "prefers-color-scheme" apps/web/src` finds only the `matchMedia` call).
- [ ] No horizontal page scroll at 1280 px, and the dialogs fit at 390 px (checked by hand with a screenshot kept out of git).
- [ ] `npm run check` and `bash corpus/lint.sh` end clean.

## Interplay

- Brief 05 added the `jsx-a11y` disables this brief deletes. If brief 05 has not run, the lint rows here do not apply.
- The theme switch must keep working in both palettes after any later visual change. This repo has no redesign brief, so nothing in this set changes the palette.
- The checker's `--warn-only` flag was set in brief 05 and is dropped here.

## Owner questions this brief raises

- Do the six selects, two sliders, two checkboxes and the plan toolbar move to Base UI, or does any stay native because this is a desktop editor?
- Do the `title=` hints become `Tooltip`s where the control is enabled?

- 2026-11-11, from brief 05: `eslint-plugin-jsx-a11y` does not support ESLint 10 (its peer range stops at 9), so it is not installed. The `autoFocus` uses carry `eslint-disable-next-line no-restricted-syntax` (a selector in `eslint.config.js`), not a `jsx-a11y` disable, and the two `no-noninteractive-element-interactions` sites (`SceneDialogs.tsx`, `useAreaTools.tsx`) are not flagged at all. The grep above should look for `no-restricted-syntax` disables too. Also open for this brief: the `better-tailwindcss` rules are off (`tailwind` option unset); with them on, 3 deprecated classes are flagged (`backdrop-blur` in `RenderOverlay.tsx`, `rounded` twice in `Scroll.tsx`). `check-base-ui` runs `--warn-only` with 4 findings (rule 3 once, rule 6 three times); drop the flag here.
- 2026-11-11, the controller's answers to brief 05's questions:
  - Rename the 3 deprecated classes to Tailwind v4's names, which keep today's look: `rounded` becomes `rounded-sm` and `backdrop-blur` becomes `backdrop-blur-sm`, because v4 shifted those scales. Then turn the Tailwind rules on (`tailwind` in `houseStyle()`).
  - The `autoFocus` selector stands until `eslint-plugin-jsx-a11y` supports ESLint 10. The house config adds the plugin then, and this repo picks it up at the next sync.

