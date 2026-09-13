import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SceneDocument } from "@solstice/schema";
import { Inspector } from "../src/ui/Inspector.jsx";
import { SceneTree } from "../src/ui/SceneTree.jsx";
import { loadDocument, setLoadError } from "../src/state/store.js";
import { DEFAULT_SCENE_ID, sceneById } from "../src/scenes.js";

const load = () => loadDocument(SceneDocument.parse(sceneById(DEFAULT_SCENE_ID)!.json));

describe("the scene tree is a tree", () => {
  it("exposes tree semantics rather than a pile of buttons", () => {
    // Brief 36 measured 53 tab stops and fourteen `<button disabled>` headings
    // that announced themselves as broken controls. The fix was real tree
    // semantics; this is the assertion it never had.
    load();
    render(<SceneTree />);
    const tree = screen.getByRole("tree");
    const items = within(tree).getAllByRole("treeitem");
    expect(items.length).toBeGreaterThan(5);
    for (const item of items) expect(item.getAttribute("aria-level")).toBeTruthy();
  });

  it("offers exactly one tab stop into the tree", async () => {
    // Roving `tabIndex`: one thing reachable by Tab, everything else reached
    // from inside with the arrows. With nothing selected there is no item to
    // rove to, so the *container* is the stop — otherwise the tree would be
    // unreachable by keyboard at all.
    load();
    render(<SceneTree />);
    const tree = screen.getByRole("tree");
    const items = within(tree).getAllByRole("treeitem");
    const stops = [tree, ...items].filter((el) => el.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(tree);
  });

  it("walks the tree with the arrow keys, and Home returns to the top", async () => {
    load();
    render(<SceneTree />);
    const tree = screen.getByRole("tree");
    const items = within(tree).getAllByRole("treeitem");

    tree.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[0]);

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(items[1]);

    await userEvent.keyboard("{End}");
    expect(document.activeElement).toBe(items[items.length - 1]);

    await userEvent.keyboard("{Home}");
    expect(document.activeElement).toBe(items[0]);
  });
});

describe("the inspector tells you which empty it is", () => {
  it("invites a selection when a document is loaded and nothing is chosen", () => {
    load();
    render(<Inspector />);
    expect(screen.getByText(/select something/i)).toBeTruthy();
  });

  it("says what went wrong when the scene never loaded", () => {
    // These are different states, and the panel used to render the same
    // sentence for both — inviting the user to select something in a scene
    // that does not exist.
    setLoadError("Greenhollow failed to parse: expected number");
    render(<Inspector />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("failed to parse");
    expect(screen.queryByText(/select something/i)).toBeNull();
  });
});

/*
  The footer's own live region is **not** tested here, and the reason is worth
  writing down rather than leaving as a gap.

  It lives in `App`, and mounting `App` mounts `Viewport`, which constructs a
  `WebGLRenderer` — there is no GL in happy-dom, so the render throws before any
  assertion runs. Testing the engine through React is the boundary this setup
  deliberately does not cross.

  What is covered instead: the store logic behind both channels, in
  `store.test.ts`, and the Inspector's own `role="alert"` above. Reaching the
  footer would mean extracting a `StatusBar` component out of `App` — a small
  and probably worthwhile change, but a change to a component rather than a
  test of one, so it is recorded as a follow-up instead of smuggled in here.
*/
