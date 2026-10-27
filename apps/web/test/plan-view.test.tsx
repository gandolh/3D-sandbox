import { SceneDocument } from "@solstice/schema";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { formatMetres, toScreen, toWorld, type ViewTransform } from "../src/lib/plan-view.js";
import { SCENES, sceneById } from "../src/scenes.js";
import {
  getState,
  loadDocument,
  select,
  setPlanLevelId,
  setPlanSheet,
  setPlanView,
} from "../src/state/store.js";
import { PlanView } from "../src/ui/PlanView.jsx";

const parse = (id: string): SceneDocument => SceneDocument.parse(sceneById(id)!.json);
const surface = (): SVGSVGElement => screen.getByTestId("plan-surface") as unknown as SVGSVGElement;
const entity = (id: string): Element => {
  const el = surface().querySelector(`[data-entity="${id}"]`);
  if (el === null) throw new Error(`nothing drawn for ${id}`);
  return el;
};

// happy-dom does no layout, so every box is at (0, 0): a client coordinate is
// a surface coordinate. A fixed view makes "where is this wall end on screen"
// exact arithmetic.
const VIEW: ViewTransform = { scale: 50, originX: 400, originY: 300 };

beforeEach(() => setPlanSheet(false));

describe("the plan view opens every scene on every level", () => {
  for (const scene of SCENES) {
    const doc = SceneDocument.parse(scene.json);
    for (const level of doc.subject.levels) {
      it(`${scene.id} · ${level.id}`, () => {
        loadDocument(doc);
        setPlanLevelId(level.id);
        render(<PlanView />);
        expect(screen.queryByRole("alert")).toBeNull();
        // Every wall, opening and room on the level is a selectable mark.
        for (const wall of level.walls) {
          expect(entity(wall.id)).toBeTruthy();
          for (const opening of wall.openings) expect(entity(opening.id)).toBeTruthy();
        }
        for (const room of level.rooms) expect(entity(room.id)).toBeTruthy();
      });
    }
  }

  it("offers a level picker when the scene has more than one level", async () => {
    loadDocument(parse("elmsgate"));
    render(<PlanView />);
    const picker = screen.getByRole("combobox", { name: "Level" });
    const upper = parse("elmsgate").subject.levels[1]!;
    await userEvent.selectOptions(picker, upper.id);
    expect(getState().planLevelId).toBe(upper.id);
    expect(entity(upper.walls[0]!.id)).toBeTruthy();
  });

  it("has no picker on a one-level scene", () => {
    loadDocument(parse("villa-carpathia"));
    render(<PlanView />);
    expect(screen.queryByRole("combobox", { name: "Level" })).toBeNull();
  });

  it("shows an empty level as a grid, with no error", () => {
    // `planSvg` throws on a level with no walls, which is why the plan view
    // is not built on it. A new house starts exactly like this.
    const doc = parse("villa-carpathia");
    doc.subject.levels.push({
      id: "attic",
      name: "Attic",
      elevation: 6,
      height: 2.4,
      walls: [],
      slabs: [],
      rooms: [],
    });
    loadDocument(SceneDocument.parse(doc));
    setPlanLevelId("attic");
    render(<PlanView />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(surface().querySelector("[data-grid]")).not.toBeNull();
    expect(surface().querySelector("[data-entity]")).toBeNull();
  });
});

describe("the pointer readout", () => {
  it("shows a wall end's own coordinates, to the centimetre", () => {
    const doc = parse("greenhollow");
    loadDocument(doc);
    render(<PlanView />);
    act(() => setPlanView(VIEW));
    const wall = doc.subject.levels[0]!.walls[0]!;
    for (const end of [wall.start, wall.end]) {
      const [x, y] = toScreen(VIEW, end);
      fireEvent.pointerMove(surface(), { clientX: x, clientY: y, pointerId: 1 });
      const readout = screen.getByTestId("plan-pointer").textContent ?? "";
      expect(readout).toContain(`x ${formatMetres(end[0])} m`);
      expect(readout).toContain(`z ${formatMetres(end[1])} m`);
    }
    fireEvent.pointerLeave(surface());
    expect(screen.getByTestId("plan-pointer").textContent).toMatch(/off the plan/);
  });

  it("is not a live region, so moving the pointer announces nothing", () => {
    loadDocument(parse("greenhollow"));
    render(<PlanView />);
    expect(screen.getByTestId("plan-pointer").getAttribute("aria-live")).toBe("off");
  });
});

describe("the wheel", () => {
  it("zooms about the pointer, keeping the world point under it still", () => {
    loadDocument(parse("greenhollow"));
    render(<PlanView />);
    act(() => setPlanView(VIEW));
    const at: [number, number] = [612, 155];
    const before = toWorld(VIEW, at);
    // happy-dom's WheelEvent drops `clientX`/`clientY` from its init, so they
    // are set on the event itself, as a browser would have them.
    const wheel = new WheelEvent("wheel", { deltaY: -240, bubbles: true, cancelable: true });
    Object.defineProperties(wheel, { clientX: { value: at[0] }, clientY: { value: at[1] } });
    act(() => {
      surface().dispatchEvent(wheel);
    });
    expect(wheel.defaultPrevented).toBe(true);
    const zoomed = getState().planView!;
    expect(zoomed.scale).toBeGreaterThan(VIEW.scale);
    const after = toWorld(zoomed, at);
    expect(after[0]).toBeCloseTo(before[0], 9);
    expect(after[1]).toBeCloseTo(before[1], 9);
  });
});

describe("selection", () => {
  it("selects a wall clicked in the plan", () => {
    const doc = parse("greenhollow");
    loadDocument(doc);
    render(<PlanView />);
    const wall = doc.subject.levels[0]!.walls[1]!;
    const mark = entity(wall.id).querySelector("path")!;
    fireEvent.pointerDown(mark, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(mark, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    expect(getState().selection).toBe(wall.id);
  });

  it("selects an opening over its wall, and a room under the walls", () => {
    const doc = parse("greenhollow");
    loadDocument(doc);
    render(<PlanView />);
    const level = doc.subject.levels[0]!;
    const opening = level.walls.find((w) => w.openings.length > 0)!.openings[0]!;
    const room = level.rooms[0]!;
    for (const id of [opening.id, room.id]) {
      const mark = entity(id).tagName === "path" ? entity(id) : entity(id).querySelector("path")!;
      fireEvent.pointerDown(mark, { button: 0, pointerId: 1 });
      fireEvent.pointerUp(mark, { button: 0, pointerId: 1 });
      expect(getState().selection).toBe(id);
    }
  });

  it("clears the selection on a click on bare ground, but not after a pan", () => {
    const doc = parse("greenhollow");
    loadDocument(doc);
    render(<PlanView />);
    select(doc.subject.levels[0]!.walls[0]!.id);
    // A middle-button drag pans and must not deselect.
    fireEvent.pointerDown(surface(), { button: 1, pointerId: 2, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(surface(), { pointerId: 2, clientX: 160, clientY: 130 });
    fireEvent.pointerUp(surface(), { button: 1, pointerId: 2, clientX: 160, clientY: 130 });
    expect(getState().selection).not.toBeNull();
    fireEvent.pointerDown(surface(), { button: 0, pointerId: 3, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(surface(), { button: 0, pointerId: 3, clientX: 5, clientY: 5 });
    expect(getState().selection).toBeNull();
  });

  it("pans with a middle-button drag", () => {
    loadDocument(parse("greenhollow"));
    render(<PlanView />);
    act(() => setPlanView(VIEW));
    fireEvent.pointerDown(surface(), { button: 1, pointerId: 4, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(surface(), { pointerId: 4, clientX: 130, clientY: 80 });
    fireEvent.pointerUp(surface(), { button: 1, pointerId: 4, clientX: 130, clientY: 80 });
    expect(getState().planView).toEqual({ ...VIEW, originX: VIEW.originX + 30, originY: VIEW.originY - 20 });
  });

  it("highlights a selection made elsewhere", () => {
    const doc = parse("greenhollow");
    loadDocument(doc);
    render(<PlanView />);
    const wall = doc.subject.levels[0]!.walls[2]!;
    expect(entity(wall.id).getAttribute("data-selected")).toBeNull();
    // What the scene tree's click does.
    act(() => select(wall.id));
    expect(entity(wall.id).getAttribute("data-selected")).toBe("true");
  });
});

/**
 * Brief 73: the sheet overran its pane and painted over the timeline. It now
 * sits behind the Sheet toggle, and keeps the fix.
 *
 * happy-dom does no layout, so this cannot measure the overrun. It pins the
 * cause instead: `Scroll`'s root is `min-h-0 flex-1`, and those only bound its
 * height when the parent is a flex column that can itself shrink.
 */
describe("the sheet", () => {
  for (const scene of SCENES) {
    it(`sits in a shrinkable flex column (${scene.id})`, async () => {
      loadDocument(SceneDocument.parse(scene.json));
      render(<PlanView />);
      await userEvent.click(screen.getByRole("button", { name: "Sheet" }));
      const pane = screen.getByTestId("plan-sheet");
      expect(pane.querySelector("svg")).not.toBeNull();
      for (const name of ["flex", "flex-col", "min-h-0", "flex-1"]) {
        expect(pane.classList.contains(name)).toBe(true);
      }
      const root = pane.firstElementChild as HTMLElement;
      expect(root.classList.contains("min-h-0")).toBe(true);
      expect(root.classList.contains("flex-1")).toBe(true);
    });
  }

  it("draws the level the plan view is on", async () => {
    loadDocument(parse("elmsgate"));
    const upper = parse("elmsgate").subject.levels[1]!;
    setPlanLevelId(upper.id);
    render(<PlanView />);
    await userEvent.click(screen.getByRole("button", { name: "Sheet" }));
    expect(screen.getByTestId("plan-sheet").innerHTML).toContain(upper.name);
  });

  it("says why an empty level has no sheet, instead of throwing", async () => {
    const doc = parse("villa-carpathia");
    doc.subject.levels.push({
      id: "attic",
      name: "Attic",
      elevation: 6,
      height: 2.4,
      walls: [],
      slabs: [],
      rooms: [],
    });
    loadDocument(SceneDocument.parse(doc));
    setPlanLevelId("attic");
    render(<PlanView />);
    await userEvent.click(screen.getByRole("button", { name: "Sheet" }));
    expect(screen.getByRole("alert").textContent).toMatch(/no walls/);
  });
});
