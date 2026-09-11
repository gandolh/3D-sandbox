import { describe, expect, it } from "vitest";
import type { Run } from "@solstice/schema";
import { buildRun, runLength } from "../src/subject/runs.js";

const run = (over: Partial<Run> = {}): Run => ({
  id: "r",
  kind: "pergola",
  path: [
    [0, 0],
    [0, 12],
  ],
  width: 3.6,
  height: 2.6,
  spacing: 3,
  material: "steel",
  ...over,
});

const boxOf = (geometries: { getAttribute(n: string): { array: ArrayLike<number> } }[]) => {
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  for (const g of geometries) {
    const p = g.getAttribute("position").array;
    for (let i = 0; i < p.length; i += 3) {
      minX = Math.min(minX, p[i]!);
      maxX = Math.max(maxX, p[i]!);
      minY = Math.min(minY, p[i + 1]!);
      maxY = Math.max(maxY, p[i + 1]!);
    }
  }
  return { minX, maxX, minY, maxY };
};

describe("runLength", () => {
  it("sums the segments of a polyline", () => {
    expect(runLength(run({ path: [[0, 0], [0, 3], [4, 3]] }))).toBeCloseTo(7, 6);
  });

  it("ignores a repeated point", () => {
    expect(runLength(run({ path: [[0, 0], [0, 0], [0, 5]] }))).toBeCloseTo(5, 6);
  });
});

describe("buildRun", () => {
  it("builds a hedge as one solid per segment, with no climber", () => {
    const { structure, climber } = buildRun(run({ kind: "hedge", path: [[0, 0], [0, 10]] }));
    expect(structure).toHaveLength(1);
    expect(climber).toHaveLength(0);
  });

  it("stands a hedge on the ground at its declared height", () => {
    const { structure } = buildRun(run({ kind: "hedge", height: 1.6 }));
    const box = boxOf(structure);
    expect(box.minY).toBeCloseTo(0, 6);
    expect(box.maxY).toBeCloseTo(1.6, 6);
  });

  it("puts posts down both sides of a pergola", () => {
    // 12 m at 3 m spacing is 4 bays, so 5 stations, two posts each.
    const { structure } = buildRun(run());
    const box = boxOf(structure);
    expect(box.maxX - box.minX).toBeGreaterThan(3.6);
    expect(box.maxY).toBeCloseTo(2.6, 1);
  });

  it("only grows a climber on a pergola that declares one", () => {
    expect(buildRun(run()).climber).toHaveLength(0);
    expect(buildRun(run({ climber: "vine" })).climber.length).toBeGreaterThan(0);
    expect(buildRun(run({ kind: "fence", climber: "vine" })).climber).toHaveLength(0);
  });

  it("sits the climber on top of the beams, not inside them", () => {
    const { structure, climber } = buildRun(run({ climber: "vine" }));
    expect(boxOf(climber).minY).toBeGreaterThanOrEqual(boxOf(structure).maxY - 1e-6);
  });

  it("forces the last bay onto the path's end", () => {
    // 10 m at 3 m spacing: naive stepping leaves a 1 m stub. Rounding to 3 bays
    // of 3.33 m keeps every bay the same.
    const { structure } = buildRun(run({ path: [[0, 0], [0, 10]] }));
    const zs = structure.flatMap((g) => {
      const p = g.getAttribute("position").array;
      const out: number[] = [];
      for (let i = 2; i < p.length; i += 3) out.push(p[i]!);
      return out;
    });
    expect(Math.max(...zs)).toBeCloseTo(10, 1);
    expect(Math.min(...zs)).toBeCloseTo(0, 1);
  });
});
