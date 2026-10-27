import { area, SceneDocument, type Wall } from "@solstice/schema";
import { describe, expect, it } from "vitest";
import villaJson from "../../../scenes/villa-carpathia.scene.json";
import { faceAt, floorOutline, planarFaces, roomOutline } from "../src/lib/drawing/faces.js";
import {
  nextOpeningId,
  offsetAt,
  offsetFromTyped,
  openingProblems,
  wallUnder,
} from "../src/lib/drawing/openings.js";
import type { Pt } from "../src/lib/drawing/snap.js";

const wall = (id: string, start: Pt, end: Pt, thickness = 0.24): Wall => ({
  id,
  start: [start[0], start[1]],
  end: [end[0], end[1]],
  thickness,
  material: "m",
  openings: [],
});

/** Brief 77's acceptance box: 8 × 6 m, drawn anticlockwise on screen from (0, 0). */
const box = (): Wall[] => [
  wall("A", [0, 0], [8, 0]),
  wall("B", [8, 0], [8, -6]),
  wall("C", [8, -6], [0, -6]),
  wall("D", [0, -6], [0, 0]),
];

/** The same polygon, whichever corner it starts from and whichever way round. */
const sameRing = (a: Pt[], b: Pt[]): boolean => {
  if (a.length !== b.length) return false;
  const key = (p: Pt) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const want = new Set(b.map(key));
  return a.every((p) => want.has(key(p)));
};

describe("the face finder", () => {
  it("finds a rectangle's one closed area, and its inside 0.12 m in from each centreline", () => {
    const faces = planarFaces(box());
    expect(faces.filter((f) => f.area > 0)).toHaveLength(1);
    expect(faces.filter((f) => f.area < 0)).toHaveLength(1);
    const room = roomOutline(box(), [3, -2])!;
    expect(
      sameRing(room, [
        [0.12, -0.12],
        [7.88, -0.12],
        [7.88, -5.88],
        [0.12, -5.88],
      ]),
    ).toBe(true);
    expect(area(room)).toBeCloseTo(7.76 * 5.76, 9);
  });

  it("finds nothing outside the walls", () => {
    expect(faceAt(box(), [10, -2])).toBeNull();
    expect(roomOutline(box(), [-1, 1])).toBeNull();
    expect(floorOutline(box(), [10, 10])).toBeNull();
  });

  it("follows an L shape round its inside corner", () => {
    // 6 × 6 with the north-east 3 × 3 cut out.
    const L = [
      wall("a", [0, 0], [6, 0]),
      wall("b", [6, 0], [6, -3]),
      wall("c", [6, -3], [3, -3]),
      wall("d", [3, -3], [3, -6]),
      wall("e", [3, -6], [0, -6]),
      wall("f", [0, -6], [0, 0]),
    ];
    const room = roomOutline(L, [1, -1])!;
    expect(room).toHaveLength(6);
    expect(
      sameRing(room, [
        [0.12, -0.12],
        [5.88, -0.12],
        [5.88, -2.88],
        [2.88, -2.88],
        [2.88, -5.88],
        [0.12, -5.88],
      ]),
    ).toBe(true);
    expect(area(room)).toBeCloseTo(5.76 * 2.76 + 2.76 * 3, 9);
  });

  it("splits a room by a partition that meets the walls mid-length", () => {
    // A 120 mm partition at x = 3, its ends on A and C but not at their ends:
    // a T at each end, which only splitting the walls can see.
    const walls = [...box(), wall("P", [3, 0], [3, -6], 0.12)];
    expect(planarFaces(walls).filter((f) => f.area > 0)).toHaveLength(2);
    const west = roomOutline(walls, [1, -3])!;
    const east = roomOutline(walls, [6, -3])!;
    expect(
      sameRing(west, [
        [0.12, -0.12],
        [2.94, -0.12],
        [2.94, -5.88],
        [0.12, -5.88],
      ]),
    ).toBe(true);
    expect(
      sameRing(east, [
        [3.06, -0.12],
        [7.88, -0.12],
        [7.88, -5.88],
        [3.06, -5.88],
      ]),
    ).toBe(true);
  });

  it("ignores a wall with a free end inside a room", () => {
    const walls = [...box(), wall("stub", [8, -3], [6, -3], 0.12)];
    const room = roomOutline(walls, [2, -2])!;
    expect(area(room)).toBeCloseTo(7.76 * 5.76, 9);
  });

  it("lays a floor under the outer outline, 0.12 m out from each centreline", () => {
    const slab = floorOutline([...box(), wall("P", [3, 0], [3, -6], 0.12)], [1, -3])!;
    expect(
      sameRing(slab, [
        [-0.12, 0.12],
        [8.12, 0.12],
        [8.12, -6.12],
        [-0.12, -6.12],
      ]),
    ).toBe(true);
  });
});

describe("placing an opening", () => {
  const villa = SceneDocument.parse(villaJson);
  const A = wall("A", [0, 0], [8, 0]);

  it("finds the wall under the pointer within the snap tolerance", () => {
    expect(wallUnder([A], [3, 0.1], 40)?.wall.id).toBe("A");
    // 0.12 m half thickness + 10 px at 40 px/m = 0.37 m.
    expect(wallUnder([A], [3, 0.36], 40)).not.toBeNull();
    expect(wallUnder([A], [3, 0.4], 40)).toBeNull();
  });

  it("snaps to the wall's centre, or to 0.05 m steps", () => {
    const hit = wallUnder([A], [4.1, 0], 40)!;
    expect(offsetAt(hit, 0.9, 40)).toEqual({ offset: 3.55, centred: true });
    const off = wallUnder([A], [1.33, 0], 40)!;
    expect(offsetAt(off, 0.9, 40)).toEqual({ offset: 0.9, centred: false });
  });

  it("measures a typed distance from the nearer end", () => {
    expect(offsetFromTyped(wallUnder([A], [1, 0], 40)!, 0.9, 1)).toBe(1);
    // Nearer the far end: 1.5 m of wall left after the window.
    expect(offsetFromTyped(wallUnder([A], [7, 0], 40)!, 1.2, 1.5)).toBe(5.3);
  });

  it("numbers openings after the document's own", () => {
    // Villa has d-01 and w-11 to w-22.
    expect(nextOpeningId(villa, "door")).toBe("d-2");
    expect(nextOpeningId(villa, "window")).toBe("w-23");
  });

  it("asks the linter's own rules whether it fits", () => {
    const level = villa.subject.levels[0]!;
    const host = level.walls.find((w) => w.openings.some((o) => o.kind === "door"))!;
    const door = host.openings.find((o) => o.kind === "door")!;
    const over = {
      id: "w-99",
      kind: "window" as const,
      offset: door.offset,
      width: 1.2,
      height: 1.2,
      sill: 0.9,
    };
    expect(openingProblems(villa, level.id, host.id, over).join()).toMatch(/overlaps/);
    const tooTall = { ...over, offset: 0.3, sill: 2, height: 2 };
    expect(openingProblems(villa, level.id, host.id, tooTall).join()).toMatch(/high/);
    const offEnd = { ...over, offset: 999 };
    expect(openingProblems(villa, level.id, host.id, offEnd).join()).toMatch(/long/);
  });

  it("says nothing about an opening that fits, nor about other openings' problems", () => {
    // A level with one 8 m wall holding a window that is already broken (too
    // tall): a door elsewhere on the wall fits, and the old problem is not its.
    const doc = structuredClone(villa);
    const broken = { id: "w-bad", kind: "window" as const, offset: 6, width: 1, height: 9, sill: 0.9 };
    doc.subject.levels.push({
      id: "attic",
      name: "Attic",
      elevation: 6,
      height: 2.4,
      walls: [{ ...A, openings: [broken] }],
      slabs: [],
      rooms: [],
    });
    const door = { id: "d-9", kind: "door" as const, offset: 1, width: 0.9, height: 2.1, sill: 0 };
    expect(openingProblems(doc, "attic", "A", door)).toEqual([]);
  });
});
