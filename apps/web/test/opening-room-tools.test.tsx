import { area, lintScene, SceneDocument } from "@solstice/schema";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { makeWall } from "../src/lib/drawing/walls.js";
import { toScreen, type ViewTransform } from "../src/lib/plan-view.js";
import { sceneById } from "../src/scenes.js";
import {
  allowDrawing,
  editDocument,
  getState,
  loadDocument,
  select,
  setPlanLevelId,
  setPlanSheet,
  setPlanTool,
  setPlanView,
} from "../src/state/store.js";
import { Inspector } from "../src/ui/Inspector.jsx";
import { PlanView } from "../src/ui/PlanView.jsx";
import { useUndoKeys } from "../src/ui/useUndoKeys.js";

const VIEW: ViewTransform = { scale: 40, originX: 300, originY: 400 };
const surface = (): SVGSVGElement => screen.getByTestId("plan-surface") as unknown as SVGSVGElement;
type Pt = readonly [number, number];
const at = (pt: Pt) => {
  const [clientX, clientY] = toScreen(VIEW, pt);
  return { clientX, clientY };
};
const move = (pt: Pt) => fireEvent.pointerMove(surface(), { ...at(pt), pointerId: 1 });
const click = (pt: Pt) => {
  move(pt);
  fireEvent.pointerDown(surface(), { ...at(pt), button: 0, pointerId: 1 });
  fireEvent.pointerUp(surface(), { ...at(pt), button: 0, pointerId: 1 });
};

const level = () => getState().document!.subject.levels.find((l) => l.id === "attic")!;
const wallById = (id: string) => level().walls.find((w) => w.id === id)!;

/** Villa with an attic holding brief 77's box: W-05 to W-08, (0,0) → (8,0) → (8,−6) → (0,−6). */
function boxScene(): void {
  const doc = SceneDocument.parse(sceneById("villa-carpathia")!.json);
  doc.subject.levels.push({
    id: "attic",
    name: "Attic",
    elevation: 6,
    height: 2.7,
    walls: [],
    slabs: [],
    rooms: [],
  });
  loadDocument(SceneDocument.parse(doc));
  const material = Object.keys(doc.materials)[0]!;
  const corners: Pt[] = [
    [0, 0],
    [8, 0],
    [8, -6],
    [0, -6],
  ];
  editDocument((draft) => {
    const attic = draft.subject.levels.find((l) => l.id === "attic")!;
    corners.forEach((c, i) => {
      attic.walls.push(
        makeWall(`W-0${5 + i}`, c, corners[(i + 1) % 4]!, { thickness: 0.24, height: null, material }),
      );
    });
  });
  setPlanLevelId("attic");
}

function Harness() {
  useUndoKeys();
  return (
    <>
      <PlanView />
      <Inspector />
    </>
  );
}

async function open(tool: "Door" | "Window" | "Room" | "Floor" | "Select"): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: tool }));
}

beforeEach(() => {
  setPlanSheet(false);
  setPlanTool("select");
  // Villa has a builder; brief 79's warning is answered once, as a person would.
  allowDrawing("villa-carpathia");
  boxScene();
  render(<Harness />);
  act(() => setPlanView(VIEW));
});

/** The door and two windows of brief 78's acceptance, placed by typed distances. */
async function doorAndWindows(): Promise<void> {
  await open("Door");
  move([1.3, 0.05]); // W-05, nearer its start
  await userEvent.keyboard("1{Enter}");
  await open("Window");
  move([6.4, -0.05]); // W-05, nearer its end
  await userEvent.keyboard("1,5{Enter}");
  move([8.05, -2]); // W-06, nearer its start
  await userEvent.keyboard("2{Enter}");
}

describe("doors and windows", () => {
  it("cuts a door and two windows at typed distances, with no error", async () => {
    await doorAndWindows();
    expect(wallById("W-05").openings).toEqual([
      { id: "d-2", kind: "door", offset: 1, width: 0.9, height: 2.1, sill: 0 },
      { id: "w-23", kind: "window", offset: 5.3, width: 1.2, height: 1.2, sill: 0.9 },
    ]);
    expect(wallById("W-06").openings).toEqual([
      { id: "w-24", kind: "window", offset: 2, width: 1.2, height: 1.2, sill: 0.9 },
    ]);
    const ids = new Set(["W-05", "W-06", "d-2", "w-23", "w-24"]);
    const errors = lintScene(getState().document!).filter(
      (f) => f.severity === "error" && f.entities.some((e) => ids.has(e)),
    );
    expect(errors).toEqual([]);
    // The plan draws them: a mark per opening.
    for (const id of ids) expect(surface().querySelector(`[data-entity="${id}"]`)).not.toBeNull();
    expect(getState().undoStack.at(-1)?.label).toBe("Add window w-24");
  });

  it("snaps the ghost to the wall's centre", async () => {
    await open("Door");
    move([4.1, 0]);
    expect(surface().querySelector('[data-ghost="ok"]')?.textContent).toBe("Centre");
    click([4.1, 0]);
    expect(wallById("W-05").openings[0]!.offset).toBe(3.55);
  });

  it("turns a window over a door red, and places nothing", async () => {
    await doorAndWindows();
    await open("Window");
    move([1.45, 0]);
    expect(surface().querySelector('[data-ghost="refused"]')).not.toBeNull();
    click([1.45, 0]);
    expect(wallById("W-05").openings).toHaveLength(2);
    expect(getState().status).toMatch(/Not placed: .*overlaps "d-2"/);
  });

  it("says why a door cannot be flipped", async () => {
    await open("Door");
    expect(screen.getByText("Swings to the wall's left").getAttribute("title")).toMatch(/reversing the wall/);
  });
});

describe("rooms", () => {
  it("makes a room from the inner faces, with its area on the plan", async () => {
    await open("Room");
    click([4, -3]);
    const name = screen.getByRole("textbox", { name: "Room name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Living");
    await userEvent.click(screen.getByRole("button", { name: "Add room" }));
    const room = level().rooms[0]!;
    expect(room).toMatchObject({ id: "r-1", name: "Living", use: "living" });
    const corners = new Set(room.polygon.map(([x, z]) => `${x},${z}`));
    expect(corners).toEqual(new Set(["0.12,-0.12", "7.88,-0.12", "7.88,-5.88", "0.12,-5.88"]));
    expect(area(room.polygon)).toBeCloseTo(44.6976, 9);
    expect(surface().textContent).toContain("44.7 m²");
    expect(surface().textContent).toContain("LIVING");
  });

  it("makes nothing outside the walls, and says so", async () => {
    await open("Room");
    click([12, -3]);
    expect(screen.queryByTestId("room-popover")).toBeNull();
    expect(level().rooms).toHaveLength(0);
    expect(getState().status).toBe("Not inside a closed set of walls");
  });
});

describe("floors", () => {
  it("lays a slab under the box's outer outline", async () => {
    await open("Floor");
    click([4, -3]);
    const slab = level().slabs[0]!;
    expect(slab).toMatchObject({ id: "slab-1", thickness: 0.25 });
    // The attic has no slabs, so the floor is like the ones below it, not plaster.
    const below = getState().document!.subject.levels[0]!.slabs[0]!.material;
    expect(slab.material).toBe(below);
    expect(new Set(slab.polygon.map(([x, z]) => `${x},${z}`))).toEqual(
      new Set(["-0.12,0.12", "8.12,0.12", "8.12,-6.12", "-0.12,-6.12"]),
    );
  });
});

describe("each placed part is one undo step", () => {
  it("takes back the room, the slab and the three openings one at a time", async () => {
    await doorAndWindows();
    await open("Floor");
    click([4, -3]);
    await open("Room");
    click([4, -3]);
    await userEvent.click(screen.getByRole("button", { name: "Add room" }));
    const counts = () => [
      level().walls.reduce((n, w) => n + w.openings.length, 0),
      level().slabs.length,
      level().rooms.length,
    ];
    expect(counts()).toEqual([3, 1, 1]);
    const seen = [counts()];
    for (let i = 0; i < 5; i++) {
      await userEvent.keyboard("{Control>}z{/Control}");
      seen.push(counts());
    }
    expect(seen).toEqual([
      [3, 1, 1],
      [3, 1, 0],
      [3, 0, 0],
      [2, 0, 0],
      [1, 0, 0],
      [0, 0, 0],
    ]);
  });
});

describe("editing openings, rooms and slabs", () => {
  it("drags an opening along its wall, and puts back a drag that would overlap", async () => {
    await doorAndWindows();
    await open("Select");
    const door = surface().querySelector('[data-entity="d-2"] path')!;
    fireEvent.pointerDown(door, { ...at([1.45, 0]), button: 0, pointerId: 1 });
    move([2.62, 0.1]);
    fireEvent.pointerUp(surface(), { ...at([2.62, 0.1]), button: 0, pointerId: 1 });
    // Centred on the pointer, in 0.05 m steps: 2.62 − 0.45 → 2.15.
    expect(wallById("W-05").openings[0]!.offset).toBe(2.15);
    expect(getState().undoStack.at(-1)?.label).toBe("Move d-2");

    const moved = surface().querySelector('[data-entity="d-2"] path')!;
    fireEvent.pointerDown(moved, { ...at([2.6, 0]), button: 0, pointerId: 1 });
    move([5.9, 0]); // onto w-23
    fireEvent.pointerUp(surface(), { ...at([5.9, 0]), button: 0, pointerId: 1 });
    expect(wallById("W-05").openings[0]!.offset).toBe(2.15);
    expect(getState().status).toMatch(/Not moved/);
  });

  it("shows a selected opening's offset in the Inspector, and takes a typed one", async () => {
    await doorAndWindows();
    act(() => select("w-23"));
    const offset = screen.getByRole("spinbutton", { name: /^Offset/ }) as HTMLInputElement;
    expect(offset.value).toBe("5.3");
    await userEvent.clear(offset);
    await userEvent.type(offset, "4.8{Enter}");
    expect(wallById("W-05").openings[1]!.offset).toBe(4.8);
  });

  it("deletes the selected opening, room or slab", async () => {
    await doorAndWindows();
    await open("Floor");
    click([4, -3]);
    await open("Room");
    click([4, -3]);
    await userEvent.click(screen.getByRole("button", { name: "Add room" }));
    await open("Select");
    for (const id of ["w-24", "r-1", "slab-1"]) {
      act(() => select(id));
      await userEvent.keyboard("{Delete}");
    }
    expect(wallById("W-06").openings).toHaveLength(0);
    expect(level().rooms).toHaveLength(0);
    expect(level().slabs).toHaveLength(0);
    expect(getState().selection).toBeNull();
  });
});
