import { describe, expect, it } from "vitest";
import {
  lintScene,
  MAX_COORDINATE,
  POST_HALF_WIDTH,
  polygonNetArea,
  ScatterField,
  SceneDocument,
  scatterLattice,
  scatterSeed,
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

  it("terminates at the largest coordinate the schema admits", () => {
    // `1e15 + 0.001 === 1e15`, so the accumulating form this replaced never
    // moved and never ended. Two things stop that now and both are tested:
    // the schema refuses the coordinate (see "document ceiling"), and the
    // lattice reports a count rather than a step to accumulate.
    const f = ScatterField.parse({
      id: "f",
      assets: ["a/b"],
      area: [
        [MAX_COORDINATE - 10, MAX_COORDINATE - 10],
        [MAX_COORDINATE - 10, MAX_COORDINATE],
        [MAX_COORDINATE, MAX_COORDINATE],
        [MAX_COORDINATE, MAX_COORDINATE - 10],
      ],
      density: 1,
      height: 4,
      arrangement: "rows",
      rowSpacing: [0.1, 0.1],
    });
    const lattice = scatterLattice(f);
    expect(lattice.countX).toBe(100);
    expect(lattice.countZ).toBe(100);
    // The step is still resolvable at this magnitude, which is the property
    // `MAX_COORDINATE` was chosen for.
    expect(lattice.originX + lattice.stepX).toBeGreaterThan(lattice.originX);
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

describe("the document ceiling", () => {
  const field = (over: Record<string, unknown>) => ({
    id: "bed",
    assets: ["a/b"],
    area: [
      [0, 0],
      [0, 100],
      [100, 100],
      [100, 0],
    ],
    density: 1,
    ...over,
  });

  it("refuses a coordinate past ±100 km", () => {
    expect(() =>
      ScatterField.parse(
        field({
          area: [
            [1e15, 1e15],
            [1e15, 1e15 + 10],
            [1e15 + 10, 1e15 + 10],
            [1e15 + 10, 1e15],
          ],
        }),
      ),
    ).toThrow();
  });

  it("refuses a density no planting could mean", () => {
    expect(() => ScatterField.parse(field({ density: 1e9 }))).toThrow();
    // The band below the cap is still authorable — a dense ground cover is a
    // real thing, and a schema that forbids it is wrong in the other direction.
    expect(() => ScatterField.parse(field({ density: 900 }))).not.toThrow();
  });

  it("refuses rows a millimetre apart", () => {
    expect(() => ScatterField.parse(field({ arrangement: "rows", rowSpacing: [1e-6, 1e-6] }))).toThrow();
  });

  it("makes an absurd field an error, not a warning", () => {
    // The exact document from the brief: it used to parse, lint with a
    // *warning*, and be persisted by `PUT /api/scenes/:id` as a legitimate
    // authored scene, because `loadScene` only refuses on errors.
    const input = baseScene();
    input.context = {
      ...input.context,
      scatter: [field({ density: 1000 }) as never],
    };
    const findings = lintScene(SceneDocument.parse(input)).filter(
      (f) => f.rule === "scatter-density-is-sane",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("error");
  });

  it("keeps the merely-expensive field a warning", () => {
    // 10 000 m² at 60 per 100 m² is 6 000 — over the 4 000 budget, well under
    // the 40 000 ceiling. An author who wants this and will wait is making a
    // legitimate choice.
    const input = baseScene();
    input.context = {
      ...input.context,
      scatter: [field({ density: 60 }) as never],
    };
    const findings = lintScene(SceneDocument.parse(input)).filter(
      (f) => f.rule === "scatter-density-is-sane",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("warning");
  });
});
