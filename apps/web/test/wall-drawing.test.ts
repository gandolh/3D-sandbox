import { SceneDocument } from "@solstice/schema";
import { describe, expect, it } from "vitest";
import greenhollowJson from "../../../scenes/greenhollow.scene.json";
import villaJson from "../../../scenes/villa-carpathia.scene.json";
import { directionOf, type Pt, snapPoint } from "../src/lib/drawing/snap.js";
import {
  type Chain,
  defaultWallMaterial,
  makeWall,
  moveCorner,
  nextWallId,
  parseDecimal,
  placePoint,
  pointAlong,
  pointAtBearing,
  recordWall,
  trimChain,
} from "../src/lib/drawing/walls.js";

const wall = (id: string, start: Pt, end: Pt) =>
  makeWall(id, start, end, { thickness: 0.24, height: null, material: "m" });

/** Run a sequence of points through the chain, collecting the walls it writes. */
function draw(points: Pt[]): { walls: { start: Pt; end: Pt }[]; chain: Chain | null } {
  let chain: Chain | null = null;
  const walls: { start: Pt; end: Pt }[] = [];
  for (const p of points) {
    const r = placePoint(chain, p);
    if (r.kind === "started") chain = r.chain;
    if (r.kind === "wall") {
      walls.push({ start: r.start, end: r.end });
      chain = r.chain === null ? null : recordWall(r.chain, `W-${walls.length}`);
    }
  }
  return { walls, chain };
}

describe("a chain of walls shares its corners exactly", () => {
  it("draws the acceptance box: 8, 6, 8 typed, then a click on the first point", () => {
    // Brief 77's acceptance, without a browser. East is bearing 90, north 0,
    // west 270. Every corner must be the same numbers, not nearly.
    const start: Pt = [0, 0];
    const a = pointAtBearing(start, 90, 8);
    const b = pointAtBearing(a, 0, 6);
    const c = pointAtBearing(b, 270, 8);
    expect(a).toEqual([8, 0]);
    expect(b).toEqual([8, -6]);
    expect(c).toEqual([0, -6]);

    const { walls, chain } = draw([start, a, b, c, [0, 0]]);
    expect(walls).toHaveLength(4);
    expect(chain).toBeNull();
    for (let i = 0; i < 4; i++) {
      const next = walls[(i + 1) % 4]!;
      // `toEqual` on exact values, deliberately: a corner is a shared point.
      expect(next.start).toEqual(walls[i]!.end);
    }
    expect(walls[3]!.end).toEqual(walls[0]!.start);
  });

  it("is exact from an awkward start too, with float noise cleaned", () => {
    const start: Pt = [0.1, 0.2];
    const a = pointAtBearing(start, 90, 0.2);
    expect(a).toEqual([0.3, 0.2]);
    const b = pointAtBearing(a, 180, 4.2);
    expect(b[0]).toBe(0.3);
    const { walls } = draw([start, a, b]);
    expect(walls[1]!.start).toEqual(walls[0]!.end);
  });

  it("has exact compass directions", () => {
    expect(directionOf(0)).toEqual([0, -1]);
    expect(directionOf(90)).toEqual([1, 0]);
    expect(directionOf(180)).toEqual([0, 1]);
    expect(directionOf(270)).toEqual([-1, 0]);
  });

  it("ignores a click on the point it is already at", () => {
    let r = placePoint(null, [1, 1]);
    expect(r.kind).toBe("started");
    const chain = (r as { chain: Chain }).chain;
    r = placePoint(chain, [1, 1]);
    expect(r).toEqual({ kind: "ignored", reason: "same point" });
  });

  it("will not close a loop of one wall onto itself", () => {
    const { walls, chain } = draw([
      [0, 0],
      [4, 0],
      [0, 0],
    ]);
    expect(walls).toHaveLength(1);
    expect(chain).not.toBeNull();
  });

  it("drops points whose walls an undo removed", () => {
    const { chain } = draw([
      [0, 0],
      [4, 0],
      [4, -3],
    ]);
    const trimmed = trimChain(chain!, (id) => id !== "W-2");
    expect(trimmed!.points.at(-1)).toEqual([4, 0]);
    expect(trimmed!.wallIds).toEqual(["W-1"]);
    expect(trimChain(chain!, () => false)!.points).toEqual([[0, 0]]);
  });

  it("goes along a snapped direction exactly", () => {
    expect(pointAlong([2, 3], [0, -1], 6)).toEqual([2, -3]);
  });
});

describe("typed numbers", () => {
  it("takes a comma or a dot as the decimal mark", () => {
    expect(parseDecimal("4,2")).toBe(4.2);
    expect(parseDecimal("4.2")).toBe(4.2);
    expect(parseDecimal(" 8 ")).toBe(8);
    expect(parseDecimal(",5")).toBe(0.5);
    expect(parseDecimal("4.")).toBe(4);
  });

  it("refuses anything that is not a plain number", () => {
    for (const t of ["", "4,2,1", "4.2.1", "abc", "4m", "1e3", "-"]) expect(parseDecimal(t), t).toBeNull();
  });
});

describe("ids and defaults", () => {
  const greenhollow = SceneDocument.parse(greenhollowJson);

  it("continues the document's highest W-NN", () => {
    // Greenhollow's house walls are W-01 to W-04.
    expect(nextWallId(greenhollow)).toBe("W-05");
  });

  it("counts every id in the document, not just walls", () => {
    const doc = SceneDocument.parse(villaJson);
    doc.subject.placements[0]!.id = "W-07";
    expect(nextWallId(doc)).toBe("W-08");
  });

  it("starts at W-01 on a document with none", () => {
    const doc = SceneDocument.parse(villaJson);
    for (const level of doc.subject.levels) level.walls = [];
    expect(nextWallId(doc)).toBe("W-01");
  });

  it("defaults to the level's most used material, or the first on an empty level", () => {
    const level = greenhollow.subject.levels[0]!;
    const counts = new Map<string, number>();
    for (const w of level.walls) counts.set(w.material, (counts.get(w.material) ?? 0) + 1);
    const most = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
    expect(defaultWallMaterial(greenhollow, level)).toBe(most);
    const empty = { ...level, walls: [] };
    expect(defaultWallMaterial(greenhollow, empty)).toBe(Object.keys(greenhollow.materials)[0]);
    expect(defaultWallMaterial({ ...greenhollow, materials: {} }, empty)).toBeNull();
  });

  it("leaves height out when the wall takes the level's", () => {
    expect(
      "height" in makeWall("W-01", [0, 0], [1, 0], { thickness: 0.24, height: null, material: "m" }),
    ).toBe(false);
    expect(makeWall("W-01", [0, 0], [1, 0], { thickness: 0.24, height: 2.4, material: "m" }).height).toBe(
      2.4,
    );
  });
});

describe("a corner grip", () => {
  it("moves every wall end at the corner, and nothing else", () => {
    const walls = [wall("A", [0, 0], [4, 0]), wall("B", [4, 0], [4, -3]), wall("C", [4, -3], [0, -3])];
    const moved = moveCorner(walls, [4, 0], [5, 0.5]);
    expect(moved).toEqual(["A", "B"]);
    expect(walls[0]!.end).toEqual([5, 0.5]);
    expect(walls[1]!.start).toEqual([5, 0.5]);
    expect(walls[1]!.end).toEqual([4, -3]);
    expect(walls[2]!.start).toEqual([4, -3]);
  });
});

describe("snapping", () => {
  const box = [wall("A", [0, 0], [8, 0]), wall("B", [8, 0], [8, -6])];
  const opts = { gridStep: 1 };

  it("prefers a wall end over its middle and the grid", () => {
    // 40 px/m: 10 px is 0.25 m. The end at (8, 0) and the grid point there
    // coincide; the end must win, and come back as the stored numbers.
    const s = snapPoint([7.9, 0.05], box, 40, opts);
    expect(s.kind).toBe("end");
    expect(s.point).toEqual([8, 0]);
  });

  it("prefers a middle over a point on the wall", () => {
    const s = snapPoint([4.1, 0.1], box, 40, opts);
    expect(s.kind).toBe("middle");
    expect(s.point).toEqual([4, 0]);
    expect(s.wallId).toBe("A");
  });

  it("prefers a point on a wall over a grid intersection", () => {
    // (3, 0) is both on wall A and a grid point; at (2.95, 0.1) the nearest
    // point on the wall is (2.95, 0), nearer than the grid's (3, 0).
    const s = snapPoint([2.95, 0.1], box, 40, opts);
    expect(s.kind).toBe("on-wall");
    expect(s.point[0]).toBeCloseTo(2.95, 12);
    expect(s.point[1]).toBe(0);
  });

  it("falls back to the grid, then to a free point rounded to the centimetre", () => {
    expect(snapPoint([2.1, -2.95], box, 40, opts)).toMatchObject({ kind: "grid", point: [2, -3] });
    expect(snapPoint([2.437, -2.512], box, 40, opts)).toMatchObject({ kind: "free", point: [2.44, -2.51] });
  });

  it("measures its tolerance in screen pixels, so zooming changes what catches", () => {
    // 0.2 m from the end: 8 px at 40 px/m catches, 20 px at 100 px/m does not.
    expect(snapPoint([7.8, 0], box, 40, opts).kind).toBe("end");
    expect(snapPoint([7.8, 0], box, 100, opts).kind).not.toBe("end");
  });

  it("does not snap to walls it is told to ignore", () => {
    const s = snapPoint([7.9, 0.05], box, 40, { ...opts, ignore: new Set(["A", "B"]) });
    expect(s.kind).toBe("grid");
  });

  it("snaps a direction near a multiple of 15° onto it, exactly", () => {
    // From (0, 0) to (5.3, −0.1): bearing 91.1°, within 3° of east.
    const s = snapPoint([5.37, -0.1], [], 40, { ...opts, from: [0, 0] });
    expect(s.kind).toBe("angle");
    expect(s.bearing).toBe(90);
    expect(s.direction).toEqual([1, 0]);
    expect(s.point).toEqual([5.37, 0]);
    const d = snapPoint([3.1, -5.4], [], 40, { ...opts, from: [0, 0] });
    expect(d.bearing).toBe(30);
  });

  it("locks to horizontal or vertical with Shift", () => {
    const h = snapPoint([5.37, -1.2], [], 40, { ...opts, from: [0.5, 0.25], shift: true });
    expect(h.point[1]).toBe(0.25);
    expect(h.ortho).toBe(true);
    expect(h.direction).toEqual([1, 0]);
    const v = snapPoint([1.1, -6.37], [], 40, { ...opts, from: [0.5, 0.25], shift: true });
    expect(v.point[0]).toBe(0.5);
    expect(v.bearing).toBe(0);
  });

  it("still snaps along the ortho line", () => {
    const s = snapPoint([7.9, 0.6], box, 40, { ...opts, from: [0, 0], shift: true });
    expect(s).toMatchObject({ kind: "end", point: [8, 0], ortho: true });
  });

  it("gives the direction from the wall in progress for any snap", () => {
    const s = snapPoint([8.05, -5.9], box, 40, { ...opts, from: [8, 0] });
    expect(s.kind).toBe("end");
    expect(s.point).toEqual([8, -6]);
    expect(s.direction).toEqual([0, -1]);
  });
});
