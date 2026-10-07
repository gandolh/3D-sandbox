import { describe, expect, it } from "vitest";
import {
  lintScene,
  MAX_COORDINATE,
  polygonNetArea,
  rect,
  ScatterField,
  SceneDocument,
  scatterLattice,
  scatterSeed,
  wallBearing,
  wallsFromFootprint,
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

/**
 * The compass a wall is described by. North is −Z and east is +X, so with +Y up
 * a bearing turns clockwise seen from above, as a real compass does. It was +Z
 * north until 2026-10-07, which made every bearing a mirror image's.
 */
describe("wall bearing", () => {
  it.each([
    [[0, 3], [0, -1], 0],
    [[0, 0], [4, 0], 90],
    [[2, -1], [2, 5], 180],
    [[0, 0], [-4, 0], 270],
  ] as const)("names a wall from %j to %j as %i°", (start, end, bearing) => {
    expect(wallBearing({ start: [start[0], start[1]], end: [end[0], end[1]] })).toBeCloseTo(bearing, 12);
  });

  it("numbers a rectangle's walls from the south side, anticlockwise seen from above", () => {
    // x 1…5, z −6…−4: the south edge is z = −4, the larger z.
    const footprint = rect(1, -6, 4, 2);
    expect(footprint).toEqual([
      [1, -4],
      [5, -4],
      [5, -6],
      [1, -6],
    ]);
    // W-01 the south wall running east, then the east wall running north.
    const walls = wallsFromFootprint(footprint, { material: "m" });
    expect(walls.map((w) => wallBearing({ start: w.start, end: w.end }))).toEqual([90, 0, 270, 180]);
  });
});

describe("post width", () => {
  // Absolute widths, not expressions of the constant: the previous version of
  // these tests bracketed `2 * POST_HALF_WIDTH` and so asserted whatever the
  // rule computed, bug included. The geometric fact — the rule fires exactly
  // when the generated rows overlap — is asserted against the real mesh in
  // `apps/web/test/shared-primitives.test.ts`, the one workspace that sees both.
  it("stays quiet for a 120 mm colonnade, whose rows stand 40 mm apart", () => {
    expect(narrowFindings(0.12)).toHaveLength(0);
  });

  it("warns for a 50 mm one, whose rows overlap", () => {
    expect(narrowFindings(0.05)).toHaveLength(1);
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

  it("starts in the south-west cell and steps north, toward −Z", () => {
    // Rows were laid from the south edge while north was +Z, and still are.
    // That is what let the scenes keep their orchards when they were mirrored.
    const lattice = scatterLattice(field([3, 4], 40));
    expect(lattice.originX).toBe(1.5);
    expect(lattice.originZ).toBe(38);
    expect(lattice.stepZ).toBe(-4);
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
