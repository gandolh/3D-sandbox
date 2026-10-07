import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildRun, scatterInstances, wallSolid } from "@solstice/geometry";
import { wallColliders } from "@solstice/physics";
import {
  estimateScatterInstances,
  type Level,
  lintScene,
  POST_WIDTH,
  type Run,
  ScatterField,
  SceneDocument,
  type Wall,
  wallAngle,
  wallBearing,
  wallLength,
} from "@solstice/schema";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { setWallBearing } from "../src/lib/entities.js";

/**
 * The drift guards for brief 37.
 *
 * They live in `apps/web` for a structural reason: the dependency direction is
 * `geometry → schema` and `physics → schema` with nothing depending on
 * `geometry`, so this is the only workspace that can see both sides of the
 * agreements being asserted. Which is also, exactly, why the two copies could
 * disagree for as long as they did — no test could see both.
 */

const level: Level = {
  id: "L1",
  name: "Ground",
  elevation: 0,
  height: 2.7,
  walls: [],
  rooms: [],
  slabs: [],
};

/** Deliberately not axis-aligned, and not 45° — both hide a sign error. */
const wall: Wall = {
  id: "W-01",
  start: [1, -2],
  end: [5, 3],
  thickness: 0.24,
  material: "m",
  openings: [],
};

describe("wall orientation", () => {
  it("points the mesh's long axis from start to end", () => {
    const geometry = wallSolid(wall, level);
    const position = geometry.getAttribute("position");

    // Read the direction out of the vertices rather than out of the rotation we
    // just applied: the whole failure this guards against is a rotation that is
    // internally consistent and geometrically backwards.
    let far = { x: 0, z: 0, d: -Infinity };
    const [mx, mz] = [(1 + 5) / 2, (-2 + 3) / 2];
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) - mx;
      const z = position.getZ(i) - mz;
      const d = Math.hypot(x, z);
      if (d > far.d) far = { x, z, d };
    }

    const wanted = Math.hypot(5 - 1, 3 - -2);
    // The far corner of a box is off-axis by half the thickness, so compare
    // directions rather than the corner itself.
    const along = (far.x * (5 - 1) + far.z * (3 - -2)) / wanted;
    expect(along).toBeGreaterThan(0);
    expect(Math.abs(along)).toBeCloseTo(wanted / 2, 2);

    geometry.dispose();
  });

  it("gives the collider the same yaw the mesh is rotated by", () => {
    const colliders = wallColliders(wall, level);
    expect(colliders).toHaveLength(1);
    expect(colliders[0]!.rotationY).toBe(wallAngle(wall));
  });

  it("agrees on which way that yaw points in plan space", () => {
    const yaw = wallAngle(wall);
    const length = Math.hypot(5 - 1, 3 - -2);
    // `rotateY` turns +X toward -Z, so the plan direction is (cos, -sin).
    expect(Math.cos(yaw) * length).toBeCloseTo(5 - 1);
    expect(-Math.sin(yaw) * length).toBeCloseTo(3 - -2);
  });
});

/**
 * A run stands against the walls, so it has to turn the way they do.
 *
 * `runs.ts` used to carry its own copy of `wallAngle`'s `atan2`. It was
 * identical, which is why nothing failed. But the day a sign changes, a copy
 * keeps the old one and every pergola, fence, hedge and colonnade turns out of
 * line with the walls beside it. These read the run's direction out of its
 * vertices and hold it to `wallAngle`'s, so a run that stops following the
 * walls fails here.
 */
describe("run orientation", () => {
  const run = (kind: Run["kind"], width: number): Run => ({
    id: "r",
    kind,
    path: [wall.start, wall.end],
    width,
    height: 2.4,
    spacing: 20,
    material: "m",
  });
  const yaw = wallAngle(wall);
  /** Unit direction of the wall in plan space — `(cos θ, -sin θ)`. */
  const dir = [Math.cos(yaw), -Math.sin(yaw)] as const;
  const length = Math.hypot(5 - 1, 3 - -2);
  const centre = (g: THREE.BufferGeometry): [number, number] => {
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new THREE.Vector3());
    return [c.x, c.z];
  };

  it("lays a hedge along the line `wallAngle` gives its path", () => {
    const [hedge] = buildRun(run("hedge", 0.1)).structure;
    const position = hedge!.getAttribute("position");
    const [mx, mz] = [(1 + 5) / 2, (-2 + 3) / 2];
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) - mx;
      const z = position.getZ(i) - mz;
      // Every vertex is at most half the length along the wall's direction and
      // at most half the width across it. A hedge turned by any other angle
      // puts its ends far off that line.
      expect(Math.abs(x * dir[0] + z * dir[1])).toBeLessThanOrEqual(length / 2 + 1e-6);
      expect(Math.abs(-x * dir[1] + z * dir[0])).toBeLessThanOrEqual(0.05 + 1e-6);
    }
  });

  it("stands a colonnade's two rows square across that line", () => {
    // The offsets that put the rows either side are `sin`/`cos` of the same
    // angle, so they have to agree with `(cos θ, -sin θ)` as well.
    const { structure } = buildRun(run("colonnade", 1.2));
    const [a, b] = [centre(structure[0]!), centre(structure[1]!)];
    const across: [number, number] = [b[0] - a[0], b[1] - a[1]];
    expect(across[0] * dir[0] + across[1] * dir[1]).toBeCloseTo(0, 6);
    expect(Math.hypot(across[0], across[1])).toBeCloseTo(1.2, 6);
    // Both rows start at the path's first point, not somewhere along it.
    expect((a[0] + b[0]) / 2).toBeCloseTo(wall.start[0], 6);
    expect((a[1] + b[1]) / 2).toBeCloseTo(wall.start[1], 6);
  });
});

const field = (over: Record<string, unknown>): ScatterField =>
  ScatterField.parse({
    id: "f",
    assets: ["a/b"],
    area: [
      [0, 0],
      [0, 40],
      [40, 40],
      [40, 0],
    ],
    density: 3,
    seed: 7,
    height: 4,
    ...over,
  });

describe("scatter instance count", () => {
  it("places exactly what the estimate promised, scattered", () => {
    const f = field({});
    expect(scatterInstances(f)).toHaveLength(estimateScatterInstances(f).instances);
  });

  // Every arrangement, and every *shape* — the brief's acceptance criterion is
  // "the same number for every arrangement", and the first version of this
  // tested only a rectangle. On a rectangle the old estimate happened to be
  // exact; on an L it quoted 130 against 100 placed, 30 % over.
  const L = [
    [0, 0],
    [0, 40],
    [20, 40],
    [20, 20],
    [40, 20],
    [40, 0],
  ];
  const hole = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0],
  ];
  const straddling = [
    [30, 10],
    [30, 30],
    [60, 30],
    [60, 10],
  ];

  it.each([
    ["rows, rectangle", { arrangement: "rows", rowSpacing: [3, 4] }],
    ["rows, with an exclusion", { arrangement: "rows", rowSpacing: [3, 4], exclude: [hole] }],
    ["rows, concave field", { arrangement: "rows", rowSpacing: [3, 4], area: L }],
    ["scattered, with an exclusion", { exclude: [hole] }],
    ["scattered, straddling exclusion", { exclude: [straddling] }],
    ["scattered, concave field", { area: L }],
  ])("agrees with the estimate — %s", (_name, over) => {
    const f = field(over);
    expect(scatterInstances(f)).toHaveLength(estimateScatterInstances(f).instances);
  });

  it("quotes the concave row field at what it actually plants", () => {
    // Pinned, so "they agree" cannot be satisfied by both being wrong.
    const f = field({ arrangement: "rows", rowSpacing: [3, 4], area: L });
    expect(estimateScatterInstances(f).instances).toBe(100);
  });

  it("counts the row lattice the generator actually walks", () => {
    // 40 m of bounds at 3 m along and 4 m across: centres at 1.5, 4.5 … 38.5
    // (13 of them) and 2, 6 … 38 (10). The estimate used to divide net area by
    // cell area and quote 133.
    const f = field({ arrangement: "rows", rowSpacing: [3, 4] });
    expect(estimateScatterInstances(f).instances).toBe(13 * 10);
  });
});

/**
 * `run-is-well-formed` warns that a colonnade is "narrower than its own posts —
 * both rows land in the same place". That is a claim about the generated mesh,
 * so it is checked against the generated mesh: the rule must fire exactly when
 * the two rows of posts really do overlap.
 *
 * It did not. The constant both sides read was called `POST_HALF_WIDTH`, the
 * generator used it as the whole section, the rule doubled it — and every
 * colonnade between 80 and 160 mm wide got a warning about a collision that
 * left a visible gap.
 */
describe("post width", () => {
  const greenhollow = SceneDocument.parse(
    JSON.parse(
      readFileSync(fileURLToPath(new URL("../../../scenes/greenhollow.scene.json", import.meta.url)), "utf8"),
    ),
  );

  /** A straight colonnade along +X, so its two rows differ only in Z. */
  const colonnade = (width: number): Run => ({
    id: "col",
    kind: "colonnade",
    path: [
      [0, 0],
      [6, 0],
    ],
    width,
    height: 3,
    spacing: 3,
    material: greenhollow.subject.runs.find((r) => r.kind === "colonnade")!.material,
  });

  /** The gap between the two rows' first posts, face to face. Negative overlaps. */
  const gap = (width: number): number => {
    const { structure } = buildRun(colonnade(width));
    const [a, b] = structure.slice(0, 2).map((g) => {
      g.computeBoundingBox();
      return g.boundingBox!;
    });
    return Math.max(a!.min.z, b!.min.z) - Math.min(a!.max.z, b!.max.z);
  };

  const warns = (width: number): boolean => {
    const doc = structuredClone(greenhollow);
    doc.subject.runs = [colonnade(width)];
    return lintScene(doc).some((f) => f.rule === "run-is-well-formed" && f.message.includes("narrower"));
  };

  it("draws a post exactly the constant's width", () => {
    const [post] = buildRun(colonnade(1)).structure;
    post!.computeBoundingBox();
    expect(post!.boundingBox!.max.x - post!.boundingBox!.min.x).toBeCloseTo(POST_WIDTH, 6);
    expect(post!.boundingBox!.max.z - post!.boundingBox!.min.z).toBeCloseTo(POST_WIDTH, 6);
  });

  it.each([0.05, 0.079, 0.081, 0.12, 0.159, 0.3])("warns at %f m exactly when the rows overlap", (width) => {
    expect(warns(width)).toBe(gap(width) < 0);
  });
});

/**
 * The inspector's Bearing field writes through `setWallBearing` and reads back
 * through `wallBearing`. The two live in different workspaces, so a compass
 * change that reaches one and not the other turns a typed 90° into 270°.
 */
describe("setWallBearing", () => {
  it.each([0, 37, 90, 180, 251, 270])("is wallBearing's inverse at %i°", (bearing) => {
    const turned = structuredClone(wall);
    setWallBearing(turned, bearing);
    expect(wallBearing(turned)).toBeCloseTo(bearing, 9);
    expect(wallLength(turned)).toBeCloseTo(wallLength(wall), 9);
  });

  it("turns bearing 0 toward −Z, which is north", () => {
    const turned = structuredClone(wall);
    setWallBearing(turned, 0);
    expect(turned.end[0]).toBeCloseTo(turned.start[0], 9);
    expect(turned.end[1]).toBeLessThan(turned.start[1]);
  });
});
