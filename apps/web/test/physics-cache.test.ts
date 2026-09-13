import { PhysicsWorld } from "@solstice/physics";
import { SceneDocument } from "@solstice/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collidersFor, disposePhysics, physicsFor, sizesFromMap } from "../src/lib/physics.js";
import { DEFAULT_SCENE_ID, sceneById } from "../src/scenes.js";

/**
 * The cache must be keyed on everything a world is derived from.
 *
 * `PhysicsWorld.create` is stubbed rather than run: what is under test is which
 * inputs cause a rebuild, and standing up Rapier's WASM heap to count calls
 * would make the test slower without making it say more.
 */
const stubCreate = () => {
  let n = 0;
  return vi
    .spyOn(PhysicsWorld, "create")
    .mockImplementation(async () => ({ id: ++n, dispose: () => {} }) as unknown as PhysicsWorld);
};

afterEach(() => {
  disposePhysics();
  vi.restoreAllMocks();
});

const doc = SceneDocument.parse(sceneById(DEFAULT_SCENE_ID)!.json);
const empty = new Map<string, readonly [number, number, number]>();
const withTable = new Map<string, readonly [number, number, number]>([
  ["polyhaven/CoffeeTable_01", [1.2, 0.4, 0.6]],
]);

describe("physicsFor", () => {
  it("reuses a world when nothing changed", async () => {
    const create = stubCreate();
    const first = await physicsFor({ doc, revision: 1, sizes: empty });
    const second = await physicsFor({ doc, revision: 1, sizes: empty });
    expect(second).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("rebuilds when the document changes", async () => {
    const create = stubCreate();
    await physicsFor({ doc, revision: 1, sizes: empty });
    await physicsFor({ doc, revision: 2, sizes: empty });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("rebuilds when asset sizes arrive, at the same revision", async () => {
    // The whole brief. Open a scene, use drop-to-floor before the models land,
    // and the world cached at revision 1 has *no placement colliders at all* —
    // `deriveColliders` skips any placement whose asset has no size. The models
    // then load; `setAssetSizes` does not bump the revision, and must not. Every
    // later drop reused that world, so a bench dropped over a table fell
    // straight through it.
    const create = stubCreate();
    const before = await physicsFor({ doc, revision: 1, sizes: empty });
    const after = await physicsFor({ doc, revision: 1, sizes: withTable });
    expect(create).toHaveBeenCalledTimes(2);
    expect(after).not.toBe(before);
  });

  it("does not rebuild for an equal-but-distinct size map", async () => {
    // Identity, deliberately: the store replaces the map when sizes change and
    // otherwise hands back the same reference, so identity is both correct and
    // cheap. A deep comparison would walk every asset on every drop.
    const create = stubCreate();
    await physicsFor({ doc, revision: 1, sizes: withTable });
    await physicsFor({ doc, revision: 1, sizes: withTable });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("frees the world it replaces", async () => {
    const disposed: number[] = [];
    let n = 0;
    vi.spyOn(PhysicsWorld, "create").mockImplementation(async () => {
      const id = ++n;
      return { dispose: () => disposed.push(id) } as unknown as PhysicsWorld;
    });
    await physicsFor({ doc, revision: 1, sizes: empty });
    await physicsFor({ doc, revision: 1, sizes: withTable });
    expect(disposed).toEqual([1]);
  });
});

describe("the collider overlay's own inputs", () => {
  it("gains placement boxes only once sizes exist", async () => {
    // What the overlay effect draws. It listed `[doc, revision, showColliders]`
    // as its dependencies while reading `assetSizes`, so turning colliders on
    // before the models landed showed no placement box — indefinitely, since
    // nothing else was going to change. `assetSizes` is in the deps now.
    const withPlacement: SceneDocument = {
      ...doc,
      subject: {
        ...doc.subject,
        placements: [
          {
            id: "table-01",
            asset: "polyhaven/CoffeeTable_01",
            position: [0, 0, 0],
            rotationY: 0,
            scale: 1,
          },
        ],
      },
    };
    const cold = collidersFor(withPlacement, sizesFromMap(empty));
    const warm = collidersFor(withPlacement, sizesFromMap(withTable));
    expect(cold.filter((c) => c.source === "placement")).toHaveLength(0);
    expect(warm.filter((c) => c.source === "placement")).toHaveLength(1);
  });
});
