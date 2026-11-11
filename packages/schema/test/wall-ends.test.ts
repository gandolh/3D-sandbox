import { describe, expect, it } from "vitest";
import { pointInPolygon, squareEnds, type Wall, wallEnds, wallLength, wallOutline, wallPoint } from "../src/index.js";

/**
 * Where walls meet, as the mesh, the collider and the plan all read it.
 *
 * Each case checks the thing a notch or an overshoot would break: the outlines
 * of walls that share an end tile the corner, which shows up as their areas
 * adding up to the shape's and as the shared cut being one segment.
 */

const wall = (id: string, start: [number, number], end: [number, number], thickness = 0.24): Wall => ({
  id,
  start,
  end,
  thickness,
  material: "m",
  openings: [],
});

const outline = (w: Wall, walls: readonly Wall[]): [number, number][] =>
  wallOutline(w, wallEnds(w, walls)).map(([along, across]) => wallPoint(w, along, across) as [number, number]);

const area = (polygon: readonly (readonly [number, number])[]): number => {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, z1] = polygon[i]!;
    const [x2, z2] = polygon[(i + 1) % polygon.length]!;
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) / 2;
};

const close = (a: readonly number[], b: readonly number[]) => {
  expect(a[0]).toBeCloseTo(b[0]!, 9);
  expect(a[1]).toBeCloseTo(b[1]!, 9);
};

describe("wall ends", () => {
  it("leaves a wall that meets nothing square", () => {
    const w = wall("a", [0, 0], [4, 0]);
    expect(wallEnds(w, [w])).toEqual(squareEnds(w));
  });

  it("closes the outside corner of the 8 × 6 m box", () => {
    // The box the notch was measured on: the square from (−0.12, 0) to
    // (0, 0.12) was in neither W-05 nor W-08.
    const walls = [
      wall("W-05", [0, 0], [8, 0]),
      wall("W-06", [8, 0], [8, -6]),
      wall("W-07", [8, -6], [0, -6]),
      wall("W-08", [0, -6], [0, 0]),
    ];
    const outlines = walls.map((w) => outline(w, walls));
    const inNotch: [number, number] = [-0.06, 0.06];
    expect(outlines.some((o) => pointInPolygon(inNotch, o))).toBe(true);
    // Nothing outside the corner either.
    expect(outlines.some((o) => pointInPolygon([-0.13, 0.13], o))).toBe(false);
    // The four outlines are exactly the ring: no gap, no overlap.
    const total = outlines.reduce((sum, o) => sum + area(o), 0);
    expect(total).toBeCloseTo(8.24 * 6.24 - 7.76 * 5.76, 9);
  });

  for (const degrees of [45, 30, 75]) {
    it(`meets at ${degrees}° on one cut through the shared point`, () => {
      const turn = (degrees * Math.PI) / 180;
      const a = wall("a", [0, 0], [4, 0]);
      const b = wall("b", [4, 0], [4 + 3 * Math.cos(turn), -3 * Math.sin(turn)]);
      const walls = [a, b];
      const ea = wallEnds(a, walls);
      const eb = wallEnds(b, walls);
      // a's end and b's start are the same two points.
      close(wallPoint(a, ea.end.plus, 0.12), wallPoint(b, eb.start.plus, 0.12));
      close(wallPoint(a, ea.end.minus, -0.12), wallPoint(b, eb.start.minus, -0.12));
      expect(ea.end.tip || eb.start.tip).toBe(false);
      // The far ends are untouched.
      expect(ea.start).toEqual({ plus: 0, minus: 0, tip: false });
      expect(eb.end).toEqual({ plus: wallLength(b), minus: wallLength(b), tip: false });
    });
  }

  it("closes a corner between walls of different thickness", () => {
    const a = wall("a", [0, 0], [4, 0], 0.3);
    const b = wall("b", [4, 0], [4, 3], 0.12);
    const walls = [a, b];
    const total = area(outline(a, walls)) + area(outline(b, walls));
    // The L: a's strip runs 0.06 past the corner, b's starts 0.15 inside it.
    expect(total).toBeCloseTo(4.06 * 0.3 + 2.85 * 0.12, 9);
    // The outside corner is covered, and nothing beyond it.
    const outlines = [outline(a, walls), outline(b, walls)];
    expect(outlines.some((o) => pointInPolygon([4.05, -0.14], o))).toBe(true);
    expect(outlines.some((o) => pointInPolygon([4.07, -0.16], o))).toBe(false);
  });

  it("stays square where a wall runs straight on", () => {
    const a = wall("a", [0, 0], [4, 0]);
    const b = wall("b", [4, 0], [8, 0]);
    expect(wallEnds(a, [a, b])).toEqual(squareEnds(a));
    expect(wallEnds(b, [a, b])).toEqual(squareEnds(b));
  });

  it("tiles a junction of three walls with no gap", () => {
    const w = wall("w", [-4, 0], [0, 0]);
    const v = wall("v", [0, 0], [4, 0]);
    const x = wall("x", [0, 0], [0, 4]);
    const walls = [w, v, x];
    const total = walls.reduce((sum, each) => sum + area(outline(each, walls)), 0);
    // The through strip, and the branch from the strip's face.
    expect(total).toBeCloseTo(8 * 0.24 + (4 - 0.12) * 0.24, 9);
    expect(wallEnds(w, walls).end.tip).toBe(true);
    expect(wallEnds(x, walls).start.tip).toBe(true);
  });

  it("clips a stretch that stops inside a mitre, rather than tying it in a bow", () => {
    // At 30° the inside face stops 0.45 m from the corner point, past a door
    // at the linter's 250 mm. The stretches either side of the door and across
    // it add up to the whole wall: a bow tie's shoelace area would not.
    const turn = (30 * Math.PI) / 180;
    const a = wall("a", [0, 0], [4, 0]);
    const b = wall("b", [0, 0], [3 * Math.cos(turn), 3 * Math.sin(turn)]);
    const ends = wallEnds(a, [a, b]);
    expect(ends.start.plus).toBeCloseTo(0.12 / Math.tan(turn / 2), 9);
    const stretch = (from: number, to: number) =>
      wallOutline(a, ends, from, to).map(([along, across]) => wallPoint(a, along, across) as [number, number]);
    const pieces = [stretch(0, 0.25), stretch(0.25, 1.15), stretch(1.15, 4)];
    const total = pieces.reduce((sum, piece) => sum + area(piece), 0);
    expect(total).toBeCloseTo(area(outline(a, [a, b])), 9);
    // And each stays inside its stretch.
    for (const [i, [from, to]] of [
      [0, 0.25],
      [0.25, 1.15],
      [1.15, 4],
    ].entries()) {
      for (const [along] of wallOutline(a, ends, from, to)) {
        expect(along).toBeGreaterThanOrEqual(i === 0 ? -1 : from! - 1e-9);
        expect(along).toBeLessThanOrEqual(to! + 1e-9);
      }
    }
  });

  it("keeps a wall too short for its mitres square", () => {
    // Both neighbours fold back almost onto it, so each mitre is metres long.
    const a = wall("a", [0, 0], [0.1, 0]);
    const b = wall("b", [0.1, 0], [0.1 + Math.cos(Math.PI - 0.05), Math.sin(Math.PI - 0.05)]);
    const c = wall("c", [0, 0], [Math.cos(0.05), Math.sin(0.05)]);
    expect(wallEnds(a, [a, b, c])).toEqual(squareEnds(a));
  });
});
