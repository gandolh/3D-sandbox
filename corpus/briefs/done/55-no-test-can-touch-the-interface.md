# Task 55 — Nothing can test a component, so nothing does

## Context

From the 2026-09-13 audit.

There is **no React testing setup in any workspace** — no
`@testing-library/react`, no `jsdom` or `happy-dom`, no `environment` in
`vitest.config.ts`. Confirmed by searching every `package.json`.

The consequence is exact: **every `.tsx` file in the app has zero tests.**

```
apps/web/src/ui/Toolbar.tsx        apps/web/src/ui/SceneTree.tsx
apps/web/src/ui/Viewport.tsx       apps/web/src/ui/Timeline.tsx
apps/web/src/ui/Inspector.tsx      apps/web/src/ui/RenderOverlay.tsx
apps/web/src/ui/PlanView.tsx       apps/web/src/ui/primitives.tsx
```

That is roughly 1 200 lines of interface, including everything the last few
briefs deliberately built:

- **brief 36**'s keyboard access — Escape cancels a render, focus moves to the
  Cancel button, the scene tree's roving `tabIndex` and arrow-key handler;
- **brief 35**'s live regions — `role="status"` on the status line,
  `role="alert"` on a failure, the render overlay's milestone announcements,
  and the "no document" state that is distinct from "nothing selected";
- **brief 51**'s fix, when it lands, has no natural place to be asserted.

Brief 24's outcome had to say it outright: *"That the dependency array lists
`assetSizes` is verified by reading; there is no React renderer in this
project's test setup."* That sentence is the finding.

The suite is otherwise strong — 430 tests, real Fastify apps against real temp
directories, physics and solar pinned to independently derivable facts. The
interface is the one tier with nothing.

## Files you OWN

- `vitest.config.ts`, and a test environment
- `apps/web/package.json` — the new dev dependencies, pinned exactly
- `apps/web/test/` — the tests

## Files you must NOT touch

- The components themselves, except where a test proves a real bug. This brief
  buys the ability to test; it is not a UI rewrite.
- The imperative-three.js decision. `Viewport` owns a canvas and an engine and
  will not render meaningfully in jsdom — **do not try to test the engine
  through React.** Test the chrome.

## What to do

1. **Stand up the environment.** `happy-dom` or `jsdom` plus
   `@testing-library/react`, pinned exactly, with a per-project vitest config
   so the Node-side packages keep running in a Node environment and do not pay
   for a DOM they never use.
2. **Test the behaviour the last three briefs paid for**, because it is
   currently unguarded: Escape cancelling a render, focus landing on Cancel,
   the scene tree's arrow-key navigation, the status line's `role="status"`,
   the alert channel's `role="alert"`, and the parse-failure state rendering
   something other than the empty-selection message.
3. **Do not chase coverage.** Components that only arrange other components
   need no test. The target is the interactive and the announced.
4. **Say in the outcome what remains untestable and why** — the canvas, the
   engine, the gizmo — so the gap that is left is a known one rather than an
   assumed one.

## Acceptance

- At least the keyboard and live-region behaviour from briefs 35 and 36 is
  asserted.
- `npm run check` exits 0 and stays under 20 s.

---

## Outcome — 2026-09-13

**Two vitest projects, split by what a test needs rather than by where it
lives.** `happy-dom` for the app's chrome, Node for everything else — the
generator, the linter, the solar maths, the drawing and the API are headless by
design and giving them a DOM is paying for a browser they never touch.

**The convention is the file extension**, and it is self-describing: a test
that renders components writes JSX, so `.test.tsx` gets a DOM and `.test.ts`
gets Node. That left all 27 existing test files exactly where they were.

It also survives a real trap found while setting it up: `contrast.test.ts`
reads `styles.css` off disk, and under a DOM environment `import.meta.url` is
an `http:` URL that `fileURLToPath` refuses outright. Routing by extension puts
it in Node where it belongs; routing by directory did not.

**What is now asserted that was previously "verified by reading":**

| from | behaviour |
|---|---|
| brief 36 | focus lands on Cancel when the render overlay appears |
| brief 36 | **Escape cancels a render** — the assertion that brief explicitly could not make, because this machine path-traces at 77 s per sample and its own end-to-end attempts were drowned out |
| brief 36 | the scene tree exposes `role="tree"`/`treeitem` with `aria-level`, offers exactly one tab stop, and walks with Arrow/Home/End |
| brief 35 | the render overlay announces **milestones and never the sample counter** |
| brief 35 | a failed scene renders `role="alert"` and *not* the ordinary empty-selection message |
| brief 51 | `Field` commits once per value, on blur and Enter, never mid-typing |

**One gap left open deliberately, and named rather than assumed.** The footer's
own live region lives in `App`, and mounting `App` mounts `Viewport`, which
constructs a `WebGLRenderer` — there is no GL in happy-dom, so it throws before
any assertion runs. Testing the engine through React is the boundary this setup
does not cross. The store logic behind both channels is covered in
`store.test.ts`; reaching the footer itself would mean extracting a `StatusBar`
out of `App`, which is a change to a component rather than a test of one, so it
is recorded as a follow-up instead of smuggled in here.

**No `jest-dom`.** Plain DOM assertions (`input.value`, `input.disabled`) do
the same job with one fewer dependency and read more clearly.

Four dev dependencies, pinned exactly: `@testing-library/react` 16.3.3,
`@testing-library/dom` 10.4.1, `@testing-library/user-event` 14.6.7,
`happy-dom` 20.14.5. `npm audit` still reports 0 vulnerabilities.

**452 tests** (was 435), `npm run check` clean and still under 20 s.
