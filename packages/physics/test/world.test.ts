import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SceneDocument } from "@solstice/schema";
import { PhysicsWorld, initPhysics } from "../src/world.js";
import { deriveColliders } from "../src/colliders.js";
import { baseScene } from "./fixtures.js";

const CHAIR: [number, number, number] = [0.25, 0.4, 0.25];

let world: PhysicsWorld;

beforeAll(async () => {
  await initPhysics();
  world = await PhysicsWorld.create(baseScene());
});

afterAll(() => world.dispose());

describe("building the world", () => {
  it("creates a collider for every derived descriptor", () => {
    expect(world.colliderCount).toBe(deriveColliders(baseScene()).length);
    expect(world.colliderCount).toBeGreaterThan(4);
  });
});

describe("dropping things", () => {
  it("settles a box on the floor slab", () => {
    const result = world.dropToRest([3, 4, 2.5], { halfExtents: CHAIR });
    expect(result.settled).toBe(true);
    // The slab's top is the finished floor at y = 0, so the box centre rests at
    // its own half-height.
    expect(result.position[1]).toBeCloseTo(CHAIR[1], 1);
    expect(result.restingOn).toBe("slab-1");
  });

  it("does not drift while falling straight down", () => {
    const result = world.dropToRest([3, 4, 2.5], { halfExtents: CHAIR });
    expect(result.position[0]).toBeCloseTo(3, 1);
    expect(result.position[2]).toBeCloseTo(2.5, 1);
  });

  it("lands on top of a wall when dropped onto one", () => {
    // W-02 runs along x = 6 and is 2.7 m tall.
    const result = world.dropToRest([6, 6, 2.5], { halfExtents: CHAIR });
    expect(result.settled).toBe(true);
    expect(result.position[1]).toBeGreaterThan(2.7);
    expect(result.restingOn).toBe("W-02");
  });

  it("falls through a doorway to the floor", () => {
    // The door in W-01 spans x 2.5–3.5 at z = 0 and is 2.1 m tall.
    const result = world.dropToRest([3, 1.5, 0], { halfExtents: [0.2, 0.3, 0.1] });
    expect(result.settled).toBe(true);
    expect(result.position[1]).toBeLessThan(0.6);
    expect(result.restingOn).toBe("slab-1");
  });

  it("is stopped by the lintel above that same doorway", () => {
    // Directly above the opening there is solid wall from 2.1 m to 2.7 m.
    const result = world.dropToRest([3, 4, 0], { halfExtents: [0.2, 0.3, 0.1] });
    expect(result.position[1]).toBeGreaterThan(2.5);
    expect(result.restingOn).toBe("W-01");
  });

  it("is stopped by the solid wall beside the doorway", () => {
    const result = world.dropToRest([1, 4, 0], { halfExtents: [0.2, 0.3, 0.1] });
    expect(result.settled).toBe(true);
    expect(result.position[1]).toBeGreaterThan(2.5);
    expect(result.restingOn).toBe("W-01");
  });

  it("settles on bare terrain away from the building", () => {
    const result = world.dropToRest([-10, 3, -10], { halfExtents: CHAIR });
    expect(result.settled).toBe(true);
    expect(result.position[1]).toBeCloseTo(CHAIR[1], 1);
    expect(result.restingOn).toBe("terrain");
  });

  it("lands on a neighbouring mass rather than inside it", () => {
    const result = world.dropToRest([24, 12, 23], { halfExtents: CHAIR });
    expect(result.settled).toBe(true);
    expect(result.position[1]).toBeGreaterThan(6);
    expect(result.restingOn).toBe("n-01");
  });

  it("is deterministic", () => {
    const a = world.dropToRest([3, 4, 2.5], { halfExtents: CHAIR });
    const b = world.dropToRest([3, 4, 2.5], { halfExtents: CHAIR });
    expect(a.position[1]).toBeCloseTo(b.position[1], 6);
    expect(a.steps).toBe(b.steps);
  });

  it("reports failure rather than spinning forever", () => {
    const result = world.dropToRest([3, 400, 2.5], { halfExtents: CHAIR, maxSteps: 5 });
    expect(result.settled).toBe(false);
    expect(result.steps).toBe(5);
  });
});

describe("overlap queries", () => {
  it("reports an overlap inside a wall", () => {
    expect(world.overlaps([1, 1.2, 0], [0.2, 0.3, 0.2])).toBe(true);
  });

  it("reports no overlap in clear air inside the room", () => {
    expect(world.overlaps([3, 1.5, 2.5], [0.2, 0.3, 0.2])).toBe(false);
  });

  it("reports no overlap in the doorway itself", () => {
    expect(world.overlaps([3, 1, 0], [0.2, 0.3, 0.08])).toBe(false);
  });

  it("reports an overlap below ground", () => {
    expect(world.overlaps([-20, -1, -20], [0.5, 0.5, 0.5])).toBe(true);
  });
});

describe("the reference scene", () => {
  it("builds a world and nothing about it touches the document", async () => {
    const doc = baseScene();
    const before = JSON.stringify(doc);
    const scene = await PhysicsWorld.create(doc);
    scene.dropToRest([3, 4, 2.5], { halfExtents: CHAIR });
    expect(JSON.stringify(doc)).toBe(before);
    scene.dispose();
  });
});

describe("resting positions are snapped to the surface", () => {
  // Rapier lets a settled body sink a centimetre or two into what it rests on.
  // Correct for a solver; wrong for an authoring aid, where a chair placed on
  // the floor should be on the floor.
  it("puts a box exactly its own half-height above the slab", () => {
    const result = world.dropToRest([3, 4, 2.5], { halfExtents: CHAIR });
    expect(result.position[1]).toBeCloseTo(CHAIR[1], 4);
  });

  it("puts a box exactly on the terrain", () => {
    const result = world.dropToRest([-12, 3, -12], { halfExtents: CHAIR });
    expect(result.position[1]).toBeCloseTo(CHAIR[1], 4);
  });

  it("scales the resting height with the box", () => {
    const tall: [number, number, number] = [0.3, 1.1, 0.3];
    const result = world.dropToRest([3, 6, 2.5], { halfExtents: tall });
    expect(result.position[1]).toBeCloseTo(tall[1], 4);
  });
})

describe("placements collide with each other", () => {
  const sizes = {
    get: (id: string) => (id === "a/table" ? ([1.4, 0.75, 0.9] as const) : undefined),
  };

  const withTable = (): SceneDocument => {
    const doc = baseScene();
    return {
      ...doc,
      subject: {
        ...doc.subject,
        placements: [
          { id: "table-01", asset: "a/table", position: [2, 0, 2], rotationY: 0, scale: 1 },
        ],
      },
    };
  };

  it("rests a dropped box on a table rather than through it", async () => {
    // The whole reason this was deferred: a proxy box has no honest size, so
    // there was nothing truthful to build a collider from.
    const world = await PhysicsWorld.create(withTable(), sizes);
    const result = world.dropToRest([2, 3, 2], { halfExtents: [0.08, 0.08, 0.08] });
    expect(result.restingOn).toBe("table-01");
    expect(result.position[1]).toBeCloseTo(0.75 + 0.08, 3);
    world.dispose();
  });

  it("falls to the floor when it misses the table", async () => {
    const world = await PhysicsWorld.create(withTable(), sizes);
    const result = world.dropToRest([2, 3, 4.2], { halfExtents: [0.08, 0.08, 0.08] });
    expect(result.restingOn).not.toBe("table-01");
    expect(result.position[1]).toBeCloseTo(0.08, 2);
    world.dispose();
  });

  it("ignores placements when no sizes are supplied", async () => {
    const world = await PhysicsWorld.create(withTable());
    const result = world.dropToRest([2, 3, 2], { halfExtents: [0.08, 0.08, 0.08] });
    expect(result.restingOn).not.toBe("table-01");
    world.dispose();
  });
});

describe("ignoreEntity", () => {
  const sizes = {
    get: (id: string) => (id === "a/bench" ? ([1.6, 0.85, 0.6] as const) : undefined),
  };

  const withBench = (): SceneDocument => {
    const doc = baseScene();
    return {
      ...doc,
      subject: {
        ...doc.subject,
        placements: [
          { id: "bench-01", asset: "a/bench", position: [2, 0.5, 2], rotationY: 0, scale: 1 },
        ],
      },
    };
  };

  it("lands on its own collider without it", async () => {
    // The bug this exists for. The bench's static box spans y 0.5–1.35, and it
    // is still in the world while the bench is being dropped — so the bench
    // settles on top of itself and the viewport reports "bench-vine settled on
    // bench-vine".
    const world = await PhysicsWorld.create(withBench(), sizes);
    const result = world.dropToRest([2, 2.5, 2], { halfExtents: [0.8, 0.425, 0.3] });
    expect(result.restingOn).toBe("bench-01");
    expect(result.position[1]).toBeCloseTo(1.35 + 0.425, 2);
    world.dispose();
  });

  it("reaches the floor when told to ignore itself", async () => {
    const world = await PhysicsWorld.create(withBench(), sizes);
    const result = world.dropToRest([2, 0.5, 2], {
      halfExtents: [0.8, 0.425, 0.3],
      ignoreEntity: "bench-01",
    });
    expect(result.restingOn).not.toBe("bench-01");
    expect(result.position[1]).toBeCloseTo(0.425, 2);
    world.dispose();
  });

  it("re-enables what it muted, so a second drop is unaffected", async () => {
    const world = await PhysicsWorld.create(withBench(), sizes);
    world.dropToRest([2, 0.5, 2], { halfExtents: [0.8, 0.425, 0.3], ignoreEntity: "bench-01" });
    const after = world.dropToRest([2, 3, 2], { halfExtents: [0.08, 0.08, 0.08] });
    expect(after.restingOn).toBe("bench-01");
    world.dispose();
  });
});
