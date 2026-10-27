import { lintScene, SceneDocument } from "@solstice/schema";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { toScreen, type ViewTransform } from "../src/lib/plan-view.js";
import { sceneById } from "../src/scenes.js";
import {
  getState,
  loadDocument,
  select,
  setPlanLevelId,
  setPlanSheet,
  setPlanTool,
  setPlanView,
  setWallOptions,
  undo,
} from "../src/state/store.js";
import { PlanView } from "../src/ui/PlanView.jsx";
import { ToolBar } from "../src/ui/plan/ToolBar.jsx";
import { useUndoKeys } from "../src/ui/useUndoKeys.js";

// happy-dom does no layout: every box is at (0, 0), so a client coordinate is
// a surface coordinate, and a fixed view makes world points exact pixels.
const VIEW: ViewTransform = { scale: 40, originX: 400, originY: 300 };
const surface = (): SVGSVGElement => screen.getByTestId("plan-surface") as unknown as SVGSVGElement;

type Pt = readonly [number, number];
const at = (pt: Pt) => {
  const [clientX, clientY] = toScreen(VIEW, pt);
  return { clientX, clientY };
};
const move = (pt: Pt, shiftKey = false) =>
  fireEvent.pointerMove(surface(), { ...at(pt), pointerId: 1, shiftKey });
const click = (pt: Pt, shiftKey = false) => {
  move(pt, shiftKey);
  fireEvent.pointerDown(surface(), { ...at(pt), button: 0, pointerId: 1, shiftKey });
  fireEvent.pointerUp(surface(), { ...at(pt), button: 0, pointerId: 1, shiftKey });
};

/** Villa Carpathia with an empty attic, the plan view on it. */
function emptyLevel(): void {
  const doc = SceneDocument.parse(sceneById("villa-carpathia")!.json);
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
}
const attic = () => getState().document!.subject.levels.find((l) => l.id === "attic")!;

function Harness() {
  useUndoKeys();
  return <PlanView />;
}

beforeEach(() => {
  setPlanSheet(false);
  setPlanTool("select");
  setWallOptions({ thickness: 0.24, height: null, material: null });
  emptyLevel();
});

async function pickWall(): Promise<void> {
  render(<Harness />);
  act(() => setPlanView(VIEW));
  await userEvent.click(screen.getByRole("button", { name: "Wall" }));
}

describe("drawing a box on an empty level", () => {
  it("makes four walls whose shared corners are exactly equal", async () => {
    await pickWall();
    click([0.04, -0.03]); // grid snap: (0, 0)
    move([5.37, -0.1]); // near east
    await userEvent.keyboard("8{Enter}");
    move([8.1, -4]); // near north
    await userEvent.keyboard("6{Enter}");
    move([3, -6.1]); // near west
    await userEvent.keyboard("8{Enter}");
    click([0.05, 0.05]); // the first point: closes the loop

    const walls = attic().walls;
    expect(walls.map((w) => w.id)).toEqual(["W-05", "W-06", "W-07", "W-08"]);
    expect(walls.map((w) => [w.start, w.end])).toEqual([
      [
        [0, 0],
        [8, 0],
      ],
      [
        [8, 0],
        [8, -6],
      ],
      [
        [8, -6],
        [0, -6],
      ],
      [
        [0, -6],
        [0, 0],
      ],
    ]);
    // The tool's defaults: 0.24 m, the level's height (no key), a real material.
    for (const wall of walls) {
      expect(wall.thickness).toBe(0.24);
      expect("height" in wall).toBe(false);
      expect(getState().document!.materials[wall.material]).toBeDefined();
    }
    // Nothing in the Inspector's error list is about them.
    const ids = new Set(walls.map((w) => w.id));
    expect(lintScene(getState().document!).filter((f) => f.entities.some((e) => ids.has(e)))).toEqual([]);
    expect(getState().undoStack.at(-1)?.label).toBe("Add wall W-08");
    // The loop closed, so the chain is over.
    expect(surface().querySelector("[data-chain]")).toBeNull();
  });

  it("takes back one wall per Ctrl+Z", async () => {
    await pickWall();
    click([0, 0]);
    for (const [pt, len] of [
      [[5, 0.1], "8"],
      [[8.1, -4], "6"],
      [[3, -6.1], "8"],
    ] as const) {
      move(pt);
      await userEvent.keyboard(`${len}{Enter}`);
    }
    click([0, 0]);
    expect(attic().walls).toHaveLength(4);
    for (const left of [3, 2, 1, 0]) {
      await userEvent.keyboard("{Control>}z{/Control}");
      expect(attic().walls).toHaveLength(left);
    }
  });

  it("reads 4,2 and 4.2 as the same length", async () => {
    await pickWall();
    click([0, 0]);
    move([5, 0.1]);
    await userEvent.keyboard("4,2{Enter}");
    expect(attic().walls[0]!.end).toEqual([4.2, 0]);
    move([4.3, -3]);
    await userEvent.keyboard("4.2{Enter}");
    expect(attic().walls[1]!.end).toEqual([4.2, -4.2]);
  });

  it("takes a bearing after Tab", async () => {
    await pickWall();
    click([0, 0]);
    move([3, 0.4]);
    await userEvent.keyboard("5{Tab}180{Enter}");
    expect(attic().walls[0]!.end).toEqual([0, 5]);
  });

  it("writes nothing for the wall in progress on Esc, and a second Esc returns to Select", async () => {
    await pickWall();
    click([0, 0]);
    move([3, 0]);
    expect(surface().querySelector("[data-ghost]")).not.toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(attic().walls).toHaveLength(0);
    expect(surface().querySelector("[data-ghost]")).toBeNull();
    expect(getState().planTool).toBe("wall");
    await userEvent.keyboard("{Escape}");
    expect(getState().planTool).toBe("select");
  });

  it("ignores a second click on the same point", async () => {
    await pickWall();
    click([2, 2]);
    click([2, 2]);
    expect(attic().walls).toHaveLength(0);
  });

  it("ends the chain on a double-click, a right-click or Enter", async () => {
    await pickWall();
    for (const finish of ["dbl", "right", "enter"] as const) {
      click([0, 0]);
      click([4, 0]);
      if (finish === "dbl") fireEvent.doubleClick(surface(), at([4, 0]));
      if (finish === "right") fireEvent.contextMenu(surface(), at([4, 0]));
      if (finish === "enter") await userEvent.keyboard("{Enter}");
      expect(surface().querySelector("[data-chain]"), finish).toBeNull();
    }
  });

  it("draws only horizontal or vertical walls with Shift", async () => {
    await pickWall();
    click([0, 0]);
    click([5.3, -1.7], true);
    click([6.1, -4.6], true);
    const [a, b] = attic().walls;
    expect(a!.end).toEqual([5.3, 0]);
    expect(b!.start).toEqual([5.3, 0]);
    expect(b!.end[0]).toBe(5.3);
  });

  it("uses the options bar's thickness, height and material", async () => {
    await pickWall();
    const material = Object.keys(getState().document!.materials).at(-1)!;
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Material" }), material);
    const thickness = screen.getByRole("textbox", { name: "Thickness" });
    await userEvent.clear(thickness);
    await userEvent.type(thickness, "0,3{Enter}");
    await userEvent.type(screen.getByRole("textbox", { name: "Height" }), "2.1{Enter}");
    click([0, 0]);
    click([3, 0]);
    expect(attic().walls[0]).toMatchObject({ thickness: 0.3, height: 2.1, material });
  });
});

describe("snapping, as shown", () => {
  it("marks each snap kind with its word", async () => {
    // Villa's ground floor: W-01 to W-04.
    loadDocument(SceneDocument.parse(sceneById("villa-carpathia")!.json));
    await pickWall();
    const wall = getState().document!.subject.levels[0]!.walls[0]!;
    const mid: Pt = [(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2];
    const quarter: Pt = [
      wall.start[0] + (wall.end[0] - wall.start[0]) * 0.3,
      wall.start[1] + (wall.end[1] - wall.start[1]) * 0.3,
    ];
    for (const [pt, kind, word] of [
      [[wall.start[0] + 0.05, wall.start[1] + 0.05], "end", "End"],
      [mid, "middle", "Middle"],
      [quarter, "on-wall", "On wall"],
      [[40.04, 40.03], "grid", "Grid"],
    ] as const) {
      move(pt);
      const marker = surface().querySelector("[data-snap]");
      expect(marker?.getAttribute("data-snap"), word).toBe(kind);
      expect(marker?.textContent).toBe(word);
    }
  });

  it("starts a wall exactly on an existing wall's end", async () => {
    loadDocument(SceneDocument.parse(sceneById("villa-carpathia")!.json));
    await pickWall();
    const corner = getState().document!.subject.levels[0]!.walls[0]!.start;
    click([corner[0] + 0.06, corner[1] - 0.04]);
    click([corner[0] + 0.06, corner[1] - 5]);
    expect(getState().document!.subject.levels[0]!.walls.at(-1)!.start).toEqual(corner);
  });
});

describe("editing what exists", () => {
  /** A drawn L: W-05 from (0,0) to (4,0), W-06 from (4,0) to (4,-3). */
  async function drawL(): Promise<void> {
    await pickWall();
    click([0, 0]);
    click([4, 0]);
    click([4, -3]);
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Select" }));
  }

  it("drags a shared corner, moving both walls' ends together", async () => {
    await drawL();
    act(() => select("W-05"));
    const grip = surface().querySelector('[data-grip="end"]')!;
    fireEvent.pointerDown(grip, { ...at([4, 0]), button: 0, pointerId: 1 });
    move([5.02, 0.97]);
    fireEvent.pointerUp(surface(), { ...at([5.02, 0.97]), button: 0, pointerId: 1 });
    const [a, b] = attic().walls;
    expect(a!.end).toEqual([5, 1]);
    expect(b!.start).toEqual([5, 1]);
    expect(a!.start).toEqual([0, 0]);
    expect(b!.end).toEqual([4, -3]);
    expect(getState().undoStack.at(-1)?.label).toBe("Move the corner of W-05 and W-06");
    act(() => undo());
    expect(attic().walls[0]!.end).toEqual([4, 0]);
  });

  it("deletes the selected wall", async () => {
    await drawL();
    act(() => select("W-06"));
    await userEvent.keyboard("{Delete}");
    expect(attic().walls.map((w) => w.id)).toEqual(["W-05"]);
    expect(getState().selection).toBeNull();
  });
});

describe("the tool bar", () => {
  it("turns the Wall tool off, and says why, when the scene has no materials", () => {
    const doc = SceneDocument.parse(sceneById("villa-carpathia")!.json);
    render(<ToolBar doc={{ ...doc, materials: {} }} />);
    const wall = screen.getByRole("button", { name: "Wall" }) as HTMLButtonElement;
    expect(wall.disabled).toBe(true);
    expect(wall.title).toMatch(/no materials/);
  });
});
