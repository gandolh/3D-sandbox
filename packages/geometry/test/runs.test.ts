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

  it("sits the climber on the beams, hanging a little through them", () => {
    // Not strictly above: a trained vine droops between the rafters, and
    // clusters tilted to catch the light necessarily dip below their centres.
    // What matters is that the mass is on top and the droop is a hand's width,
    // not that the canopy floats clear of the structure.
    const { structure, climber } = buildRun(run({ climber: "vine" }));
    const top = boxOf(structure).maxY;
    const canopy = boxOf(climber);
    expect(canopy.maxY).toBeGreaterThan(top);
    expect(top - canopy.minY).toBeLessThan(0.25);
  });

  it("crosses each cluster, so it reads from below as well as from the side", () => {
    // A single flat quad is a sliver at a grazing angle, and the approach shot
    // views the canopy from directly underneath.
    const { climber } = buildRun(run({ climber: "vine" }));
    const first = climber[0]!;
    const p = first.getAttribute("position");
    const count = first.index === null ? p.count : first.index.count;
    expect(count / 3).toBe(4);
  });

  it("builds the climber from many small clusters, not one slab", () => {
    // A slab reads as a black soffit from underneath. What makes a vine a vine
    // is that light comes through it in patches, so the gaps are the feature.
    const { climber } = buildRun(run({ climber: "vine" }));
    expect(climber.length).toBeGreaterThan(200);
    const box = boxOf(climber);
    // Each cluster is a fraction of a metre; the canopy as a whole is metres.
    expect(box.maxX - box.minX).toBeGreaterThan(3);
    expect(box.maxY - box.minY).toBeLessThan(1);
  });

  it("is deterministic in the run's id", () => {
    const a = buildRun(run({ id: "p1", climber: "vine" })).climber.length;
    const b = buildRun(run({ id: "p1", climber: "vine" })).climber.length;
    const c = buildRun(run({ id: "p2", climber: "vine" })).climber;
    expect(a).toBe(b);
    // A different pergola gets different foliage, not a copy of the first.
    expect(boxOf(c).minY).not.toBe(boxOf(buildRun(run({ id: "p1", climber: "vine" })).climber).minY);
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
