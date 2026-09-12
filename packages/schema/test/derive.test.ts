import { describe, expect, it } from "vitest";
import {
  POST_HALF_WIDTH,
  polygonNetArea,
  scatterSeed,
  SceneDocument,
  ScatterField,
  lintScene,
  scatterLattice,
} from "../src/index.js";
import { baseScene } from "./fixtures.js";

/**
 * The half of brief 37's drift guards that fits inside one package.
 *
 * The cross-package agreements — mesh against collider, generator against
 * estimate — are in `apps/web/test/shared-primitives.test.ts`, because that is
 * the only workspace allowed to import both sides.
 */

const narrowFindings = (width: number) => {
  const input = baseScene();
  input.subject = {
    ...input.subject,
    runs: [
      {
        id: "r-01",
        kind: "pergola",
        path: [
          [0, 0],
          [6, 0],
        ],
        width,
        height: 2.4,
        spacing: 3,
        material: "wall",
      },
    ],
  };
  return lintScene(SceneDocument.parse(input)).filter((f) =>
    f.message.includes("narrower than its own posts"),
  );
};

describe("post width", () => {
  // These two bracket the rule's threshold *in terms of the generator's own
  // constant*. Re-inline the literal `0.08` in the rule and change the post,
  // and this is what goes red — which is the whole point of the move: the
  // rule was checking a copy of the number rather than the number.
  it("warns below two posts", () => {
    expect(narrowFindings(2 * POST_HALF_WIDTH - 0.001)).toHaveLength(1);
  });

  it("stays quiet at two posts", () => {
    expect(narrowFindings(2 * POST_HALF_WIDTH + 0.001)).toHaveLength(0);
  });
});

describe("scatter lattice", () => {
  const field = (rowSpacing: [number, number], size: number): ScatterField =>
    ScatterField.parse({
      id: "f",
      assets: ["a/b"],
      area: [
        [0, 0],
        [0, size],
        [size, size],
        [size, 0],
      ],
      density: 1,
      height: 4,
      arrangement: "rows",
      rowSpacing,
    });

  it("counts cells as integers", () => {
    const lattice = scatterLattice(field([3, 4], 40));
    expect(lattice.countX).toBe(13);
    expect(lattice.countZ).toBe(10);
  });

  it("terminates at a coordinate where a float step would not advance", () => {
    // `1e15 + 0.001 === 1e15`, so the accumulating form this replaced never
    // moved and never ended. The integer form simply reports how many cells
    // fit, and the caller loops that many times.
    const f = ScatterField.parse({
      id: "f",
      assets: ["a/b"],
      area: [
        [1e15, 1e15],
        [1e15, 1e15 + 10],
        [1e15 + 10, 1e15 + 10],
        [1e15 + 10, 1e15],
      ],
      density: 1,
      height: 4,
      arrangement: "rows",
      rowSpacing: [0.001, 0.001],
    });
    const lattice = scatterLattice(f);
    expect(Number.isFinite(lattice.countX)).toBe(true);
    expect(Number.isFinite(lattice.countZ)).toBe(true);
  });
});

describe("net area with holes", () => {
  const rect = (x: number, z: number, w: number, h: number) =>
    [
      [x, z],
      [x, z + h],
      [x + w, z + h],
      [x + w, z],
    ] as const;
  const field = rect(0, 0, 100, 100);

  // Exact, not close — the method cuts the plane into slabs where the covered
  // length is linear and integrates each one in closed form, so a tolerance
  // here would be hiding something rather than allowing for something.
  it("subtracts only the part of a hole that is inside", () => {
    expect(polygonNetArea(field, [rect(75, 25, 50, 50)])).toBe(8750);
  });

  it("subtracts overlapping holes once", () => {
    expect(polygonNetArea(field, [rect(0, 0, 20, 20), rect(10, 10, 20, 20)])).toBe(9300);
  });

  it("ignores a hole entirely outside", () => {
    expect(polygonNetArea(field, [rect(200, 200, 5, 5)])).toBe(10000);
  });

  it("handles a non-convex outline", () => {
    // An L, 75 m², with a 4 × 4 hole straddling its inner corner — 12 m² of
    // which lies on the L. Sutherland–Hodgman would not survive this shape.
    const L = [
      [0, 0],
      [0, 10],
      [5, 10],
      [5, 5],
      [10, 5],
      [10, 0],
    ] as const;
    expect(polygonNetArea(L, [])).toBe(75);
    expect(polygonNetArea(L, [rect(3, 3, 4, 4)])).toBe(63);
  });
});

describe("scatter seed", () => {
  it("separates two ids that share a seed", () => {
    expect(scatterSeed({ id: "oaks", seed: 0 })).not.toBe(scatterSeed({ id: "birches", seed: 0 }));
  });

  it("keeps the author's dial", () => {
    expect(scatterSeed({ id: "oaks", seed: 0 })).not.toBe(scatterSeed({ id: "oaks", seed: 1 }));
    expect(scatterSeed({ id: "oaks", seed: 7 })).toBe(scatterSeed({ id: "oaks", seed: 7 }));
  });

  it("stays a 32-bit integer for a seed near the top of the range", () => {
    const hash = scatterSeed({ id: "a-rather-long-field-identifier", seed: 4294967295 });
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
  });
});
