import { describe, expect, it } from "vitest";
import type { ScatterField } from "@solstice/schema";
import { scatterInstances } from "../src/context/scatter.js";

const field = (over: Partial<ScatterField> = {}): ScatterField => ({
  id: "orchard",
  assets: ["apple", "pear"],
  area: [
    [0, 0],
    [30, 0],
    [30, 20],
    [0, 20],
  ],
  density: 1,
  seed: 7,
  scaleRange: [0.9, 1.1],
  arrangement: "rows",
  rowSpacing: [6, 5],
  exclude: [],
  ...over,
});

describe("row-arranged scatter", () => {
  it("plants on a lattice set by spacing, not by density", () => {
    // 30 × 20 m at 6 × 5 m spacing is 5 columns × 4 rows.
    expect(scatterInstances(field())).toHaveLength(20);
    // Density is deliberately ignored — changing it must change nothing.
    expect(scatterInstances(field({ density: 50 }))).toHaveLength(20);
  });

  it("keeps rows straight: every row shares one z, within the jitter", () => {
    const rows = new Map<number, number[]>();
    for (const i of scatterInstances(field())) {
      // Rows sit at 2.5, 7.5, 12.5, 17.5; flooring by the spacing bands each
      // one cleanly, where rounding would split a row across two bands.
      const band = Math.floor(i.position[2] / 5);
      rows.set(band, [...(rows.get(band) ?? []), i.position[2]]);
    }
    expect(rows.size).toBe(4);
    for (const zs of rows.values()) {
      // Jitter is a quarter of the spacing each way, so a row's spread can
      // never reach the gap to the next row.
      expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(5 / 2);
    }
  });

  it("is deterministic in the seed", () => {
    expect(scatterInstances(field())).toEqual(scatterInstances(field()));
    expect(scatterInstances(field({ seed: 8 }))).not.toEqual(scatterInstances(field()));
  });

  it("respects exclusions", () => {
    const withHole = scatterInstances(
      field({ exclude: [[[0, 0], [30, 0], [30, 10], [0, 10]]] }),
    );
    expect(withHole.length).toBeLessThan(20);
    expect(withHole.every((i) => i.position[2] > 10)).toBe(true);
  });

  it("leaves random arrangement alone", () => {
    const random = scatterInstances(field({ arrangement: "random", density: 10 }));
    // 600 m² at 10 per 100 m².
    expect(random).toHaveLength(60);
  });
});
