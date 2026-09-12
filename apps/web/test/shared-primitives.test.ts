import { describe, expect, it } from "vitest";
import {
  ScatterField,
  estimateScatterInstances,
  wallAngle,
  type Level,
  type Wall,
} from "@solstice/schema";
import { scatterInstances, wallSolid } from "@solstice/geometry";
import { wallColliders } from "@solstice/physics";

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

  it("places exactly what the estimate promised, in rows", () => {
    const f = field({ arrangement: "rows", rowSpacing: [3, 4] });
    // A rectangle with no exclusions is the case where the estimate is exact
    // rather than proportional, so equality is the right assertion here.
    expect(scatterInstances(f)).toHaveLength(estimateScatterInstances(f).instances);
  });

  it("counts the row lattice the generator actually walks", () => {
    // 40 m of bounds at 3 m along and 4 m across: centres at 1.5, 4.5 … 38.5
    // (13 of them) and 2, 6 … 38 (10). The estimate used to divide net area by
    // cell area and quote 133.
    const f = field({ arrangement: "rows", rowSpacing: [3, 4] });
    expect(estimateScatterInstances(f).instances).toBe(13 * 10);
  });
});
