import { describe, expect, it } from "vitest";
import { Level, SceneDocument, Wall } from "@solstice/schema";
import { deriveColliders, wallColliders, type CuboidCollider } from "../src/colliders.js";
import { baseScene } from "./fixtures.js";

const level = Level.parse({ id: "L1", name: "Ground", elevation: 0, height: 2.7 });

const wall = (openings: unknown[] = []) =>
  Wall.parse({
    id: "W-01",
    start: [0, 0],
    end: [6, 0],
    thickness: 0.24,
    material: "m",
    openings,
  });

const spanAlong = (c: CuboidCollider): [number, number] => [
  c.position[0] - c.halfExtents[0],
  c.position[0] + c.halfExtents[0],
];

describe("wall colliders", () => {
  it("is one box when the wall is blank", () => {
    const out = wallColliders(wall(), level);
    expect(out).toHaveLength(1);
    expect(out[0]!.halfExtents).toEqual([3, 1.35, 0.12]);
    expect(out[0]!.position[0]).toBeCloseTo(3);
    expect(out[0]!.position[1]).toBeCloseTo(1.35);
  });

  it("splits around a door, leaving the doorway open", () => {
    // A door reaching 2.1 m in a 2.7 m wall leaves a lintel and two solid spans.
    const out = wallColliders(
      wall([{ id: "d-1", kind: "door", offset: 2, width: 1, height: 2.1, sill: 0 }]),
      level,
    );
    const ids = out.map((c) => c.id);
    expect(ids).toContain("wall:W-01:s0"); // before the door
    expect(ids).toContain("wall:W-01:a0"); // lintel over it
    expect(ids).toContain("wall:W-01:s1"); // after it
    expect(ids).not.toContain("wall:W-01:b0"); // no spandrel under a door

    const lintel = out.find((c) => c.id === "wall:W-01:a0")!;
    expect(lintel.position[1] - lintel.halfExtents[1]).toBeCloseTo(2.1);
    expect(lintel.position[1] + lintel.halfExtents[1]).toBeCloseTo(2.7);
  });

  it("leaves no solid box spanning the doorway at floor level", () => {
    const out = wallColliders(
      wall([{ id: "d-1", kind: "door", offset: 2, width: 1, height: 2.1, sill: 0 }]),
      level,
    );
    const atFloor = out.filter((c) => c.position[1] - c.halfExtents[1] < 0.01);
    const doorway = atFloor.some((c) => {
      const [lo, hi] = spanAlong(c);
      return lo < 2.4 && hi > 2.6; // straddles the middle of the door
    });
    expect(doorway).toBe(false);
  });

  it("gives a window both a spandrel and a lintel", () => {
    const out = wallColliders(
      wall([{ id: "w-1", kind: "window", offset: 2, width: 1.4, height: 1.2, sill: 0.9 }]),
      level,
    );
    const below = out.find((c) => c.id === "wall:W-01:b0")!;
    const above = out.find((c) => c.id === "wall:W-01:a0")!;
    expect(below.position[1] + below.halfExtents[1]).toBeCloseTo(0.9);
    expect(above.position[1] - above.halfExtents[1]).toBeCloseTo(2.1);
  });

  it("handles two openings without overlapping boxes", () => {
    const out = wallColliders(
      wall([
        { id: "w-1", kind: "window", offset: 1, width: 1.4, height: 1.2, sill: 0.9 },
        { id: "w-2", kind: "window", offset: 3.5, width: 1.4, height: 1.2, sill: 0.9 },
      ]),
      level,
    );
    const fullHeight = out.filter((c) => c.halfExtents[1] > 1.3).map(spanAlong).sort((a, b) => a[0] - b[0]);
    expect(fullHeight).toHaveLength(3);
    expect(fullHeight[0]![1]).toBeCloseTo(1);
    expect(fullHeight[1]![0]).toBeCloseTo(2.4);
    expect(fullHeight[2]![0]).toBeCloseTo(4.9);
  });

  it("carries the wall's own id on every fragment", () => {
    const out = wallColliders(
      wall([{ id: "d-1", kind: "door", offset: 2, width: 1, height: 2.1, sill: 0 }]),
      level,
    );
    expect(out.every((c) => c.entity === "W-01")).toBe(true);
  });

  it("orients a diagonal wall", () => {
    const diagonal = Wall.parse({ id: "W-9", start: [0, 0], end: [4, 4], material: "m" });
    const out = wallColliders(diagonal, level);
    expect(out[0]!.rotationY).toBeCloseTo(-Math.PI / 4);
    expect(out[0]!.position[0]).toBeCloseTo(2);
    expect(out[0]!.position[2]).toBeCloseTo(2);
  });

  it("drops a zero-length wall entirely", () => {
    expect(wallColliders(Wall.parse({ id: "W-0", start: [1, 1], end: [1, 1], material: "m" }), level)).toEqual([]);
  });
});

describe("scene colliders", () => {
  it("puts the terrain's top surface at y = 0", () => {
    const terrain = deriveColliders(baseScene()).find((c) => c.source === "terrain")!;
    expect(terrain.position[1] + terrain.halfExtents[1]).toBeCloseTo(0);
  });

  it("hangs a slab below its level's finished floor", () => {
    const slab = deriveColliders(baseScene()).find((c) => c.source === "slab")!;
    expect(slab.position[1] + slab.halfExtents[1]).toBeCloseTo(0);
  });

  it("omits roofs — placing furniture on a roof is not a use case", () => {
    expect(deriveColliders(baseScene()).some((c) => c.id.startsWith("roof"))).toBe(false);
  });

  it("includes neighbouring masses so nothing is placed inside one", () => {
    const doc = baseScene();
    expect(deriveColliders(doc).filter((c) => c.source === "mass")).toHaveLength(1);
  });
});

describe("placement colliders", () => {
  const sizes = {
    get: (id: string) => (id === "a/table" ? ([1.2, 0.75, 0.8] as const) : undefined),
  };

  const withPlacements = (scale = 1): SceneDocument => {
    const doc = baseScene();
    return {
      ...doc,
      subject: {
        ...doc.subject,
        placements: [
          { id: "table-01", asset: "a/table", position: [2, 0, 3], rotationY: 30, scale },
          { id: "ghost-01", asset: "a/not-loaded", position: [5, 0, 5], rotationY: 0, scale: 1 },
        ],
      },
    };
  };

  it("produces nothing without sizes — the behaviour before assets existed", () => {
    expect(deriveColliders(withPlacements()).filter((c) => c.source === "placement")).toHaveLength(0);
  });

  it("skips a placement whose asset is not loaded", () => {
    // An invisible collider around a visible proxy is worse than no collider:
    // things would settle onto a surface that is not there.
    const ids = deriveColliders(withPlacements(), sizes)
      .filter((c) => c.source === "placement")
      .map((c) => c.entity);
    expect(ids).toEqual(["table-01"]);
  });

  it("centres the box half its height above the stated position", () => {
    const table = deriveColliders(withPlacements(), sizes).find((c) => c.entity === "table-01");
    expect(table?.halfExtents).toEqual([0.6, 0.375, 0.4]);
    expect(table?.position).toEqual([2, 0.375, 3]);
    expect(table?.rotationY).toBe(30);
  });

  it("scales extents and the lift together", () => {
    const table = deriveColliders(withPlacements(2), sizes).find((c) => c.entity === "table-01");
    expect(table?.halfExtents).toEqual([1.2, 0.75, 0.8]);
    expect(table?.position[1]).toBe(0.75);
  });
});
