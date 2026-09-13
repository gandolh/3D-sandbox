import type { Run } from "@solstice/schema";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildRun, type Canopy, runLength } from "../src/subject/runs.js";

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

/**
 * The canopy's bounding box **in the world**, which means applying each
 * instance's matrix.
 *
 * The canopy is one shared geometry plus a transform per cluster now, so its
 * own vertices sit around the origin and say nothing about where the vine is.
 * The spatial assertions below are about where the leaves end up, so they have
 * to go through the transforms — which is also the only way they would notice
 * if the transforms stopped being applied at all.
 */
const canopyBox = (canopy: Canopy) => {
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  const position = canopy.geometry.getAttribute("position");
  for (const matrix of canopy.transforms) {
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position as THREE.BufferAttribute, i).applyMatrix4(matrix);
      box.expandByPoint(point);
    }
  }
  return { minX: box.min.x, maxX: box.max.x, minY: box.min.y, maxY: box.max.y };
};

describe("runLength", () => {
  it("sums the segments of a polyline", () => {
    expect(
      runLength(
        run({
          path: [
            [0, 0],
            [0, 3],
            [4, 3],
          ],
        }),
      ),
    ).toBeCloseTo(7, 6);
  });

  it("ignores a repeated point", () => {
    expect(
      runLength(
        run({
          path: [
            [0, 0],
            [0, 0],
            [0, 5],
          ],
        }),
      ),
    ).toBeCloseTo(5, 6);
  });
});

describe("buildRun", () => {
  it("builds a hedge as one solid per segment, with no climber", () => {
    const { structure, climber } = buildRun(
      run({
        kind: "hedge",
        path: [
          [0, 0],
          [0, 10],
        ],
      }),
    );
    expect(structure).toHaveLength(1);
    expect(climber).toBeNull();
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

  it("stands a fence on one line of posts, not two", () => {
    // The bug Elmsgate's railings found: `posts` built two rows whatever the
    // kind, so a 0.07 m railing got a duplicate row 70 mm away — twice the
    // geometry, and visibly doubled from anywhere near it.
    const fence = run({ kind: "fence", width: 0.07, height: 1.05, spacing: 1.1 });
    const { structure } = buildRun(fence);
    const box = boxOf(structure);
    // Everything sits on the path's own line, within one post section of it.
    expect(box.maxX - box.minX).toBeLessThanOrEqual(0.08 + 1e-6);
  });

  it("gives a fence a top rail and a mid rail", () => {
    const fence = run({ kind: "fence", width: 0.07, height: 1.2, spacing: 1.1 });
    const pergola = run();
    // A pergola's two beams are one per side; a fence's two are stacked, which
    // is what makes a railing read as a railing rather than a row of stakes.
    const rails = buildRun(fence).structure.filter((g) => {
      const y = g.getAttribute("position").array;
      let min = Infinity;
      for (let i = 1; i < y.length; i += 3) min = Math.min(min, y[i]!);
      return min > 0.3;
    });
    expect(rails.length).toBeGreaterThanOrEqual(2);
    expect(buildRun(pergola).structure.length).toBeGreaterThan(0);
  });

  it("keeps two rows for the runs that actually span something", () => {
    for (const kind of ["pergola", "colonnade"] as const) {
      const box = boxOf(buildRun(run({ kind, width: 3.6 })).structure);
      expect(box.maxX - box.minX).toBeGreaterThan(3.6);
    }
  });

  it("only grows a climber on a pergola that declares one", () => {
    expect(buildRun(run()).climber).toBeNull();
    expect(buildRun(run({ climber: "vine" })).climber!.transforms.length).toBeGreaterThan(0);
    expect(buildRun(run({ kind: "fence", climber: "vine" })).climber).toBeNull();
  });

  it("sits the climber on the beams, hanging a little through them", () => {
    // Not strictly above: a trained vine droops between the rafters, and
    // clusters tilted to catch the light necessarily dip below their centres.
    // What matters is that the mass is on top and the droop is a hand's width,
    // not that the canopy floats clear of the structure.
    //
    // The bound is 0.40 rather than 0.25 since the canopy became instanced.
    // The old version tilted each quad about the world X axis and *then* spun
    // the pair by angles 90° apart, which does not compose to a right angle —
    // so the two quads were never actually perpendicular and their combined
    // extent was smaller by accident. Building the pair crossed once and
    // transforming it rigidly makes the crossing real, and a genuinely
    // perpendicular pair reaches about 80 mm further down. Measured 0.333.
    const { structure, climber } = buildRun(run({ climber: "vine" }));
    const top = boxOf(structure).maxY;
    const canopy = canopyBox(climber!);
    expect(canopy.maxY).toBeGreaterThan(top);
    expect(top - canopy.minY).toBeLessThan(0.4);
  });

  it("crosses each cluster, so it reads from below as well as from the side", () => {
    // A single flat quad is a sliver at a grazing angle, and the approach shot
    // views the canopy from directly underneath.
    const { climber } = buildRun(run({ climber: "vine" }));
    const geometry = climber!.geometry;
    const p = geometry.getAttribute("position");
    const count = geometry.index === null ? p.count : geometry.index.count;
    // Two quads, four triangles — one shared geometry now, instanced per
    // cluster rather than rebuilt for each one.
    expect(count / 3).toBe(4);

    // And the two quads are genuinely perpendicular. Building the pair once and
    // transforming it rigidly is what guarantees that; the previous version
    // tilted each quad about the world X axis and *then* spun them by angles
    // 90° apart, which does not compose to a right angle.
    const normals: THREE.Vector3[] = [];
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p as THREE.BufferAttribute, i);
      b.fromBufferAttribute(p as THREE.BufferAttribute, i + 1);
      c.fromBufferAttribute(p as THREE.BufferAttribute, i + 2);
      normals.push(b.clone().sub(a).cross(c.clone().sub(a)).normalize());
    }
    const across = normals.find((n) => Math.abs(n.dot(normals[0]!)) < 0.01);
    expect(across, "the two quads are not at right angles").toBeDefined();
  });

  it("builds the climber from many small clusters, not one slab", () => {
    // A slab reads as a black soffit from underneath. What makes a vine a vine
    // is that light comes through it in patches, so the gaps are the feature.
    const { climber } = buildRun(run({ climber: "vine" }));
    expect(climber!.transforms.length).toBeGreaterThan(200);
    const box = canopyBox(climber!);
    // Each cluster is a fraction of a metre; the canopy as a whole is metres.
    expect(box.maxX - box.minX).toBeGreaterThan(3);
    expect(box.maxY - box.minY).toBeLessThan(1);
  });

  it("is deterministic in the run's id", () => {
    const first = buildRun(run({ id: "p1", climber: "vine" })).climber!;
    const again = buildRun(run({ id: "p1", climber: "vine" })).climber!;
    // Element-by-element, not just the count: the same id must place the same
    // leaves, or every render of the pergola changes between reloads.
    expect(again.transforms.map((m) => m.elements.join(","))).toEqual(
      first.transforms.map((m) => m.elements.join(",")),
    );

    // A different pergola gets different foliage, not a copy of the first.
    const other = buildRun(run({ id: "p2", climber: "vine" })).climber!;
    expect(other.transforms[0]!.elements.join(",")).not.toBe(first.transforms[0]!.elements.join(","));
  });

  it("forces the last bay onto the path's end", () => {
    // 10 m at 3 m spacing: naive stepping leaves a 1 m stub. Rounding to 3 bays
    // of 3.33 m keeps every bay the same.
    const { structure } = buildRun(
      run({
        path: [
          [0, 0],
          [0, 10],
        ],
      }),
    );
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
