import { SceneDocument } from "@solstice/schema";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SCENES } from "../src/scenes.js";
import { loadDocument } from "../src/state/store.js";
import { PlanView } from "../src/ui/PlanView.jsx";

/**
 * Brief 73: the plan sheet overran its pane and painted over the timeline.
 *
 * happy-dom does no layout, so this cannot measure the overrun. It pins the
 * cause instead: `Scroll`'s root is `min-h-0 flex-1`, and those only bound its
 * height when the parent is a flex column that can itself shrink. As a plain
 * block the root grew to the sheet's height and never scrolled. The geometry
 * was checked in a browser at 1440×900 on all three scenes.
 */
describe("the plan view bounds its scroll area", () => {
  for (const scene of SCENES) {
    it(`puts the sheet in a shrinkable flex column (${scene.id})`, () => {
      loadDocument(SceneDocument.parse(scene.json));
      const { container } = render(<PlanView />);
      const pane = container.firstElementChild as HTMLElement;
      expect(pane.querySelector("svg")).not.toBeNull();
      for (const name of ["flex", "flex-col", "min-h-0", "flex-1"]) {
        expect(pane.classList.contains(name)).toBe(true);
      }
      const root = pane.firstElementChild as HTMLElement;
      expect(root.classList.contains("min-h-0")).toBe(true);
      expect(root.classList.contains("flex-1")).toBe(true);
    });
  }
});
