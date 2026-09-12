import type { SceneDocument } from "@solstice/schema";
import {
  PhysicsWorld,
  deriveColliders,
  type CuboidCollider,
  type PlacementSizes,
} from "@solstice/physics";

/** Every input a physics world is derived from. */
export interface PhysicsInputs {
  doc: SceneDocument;
  /** Bumped by `editDocument`; means "the document changed". */
  revision: number;
  /**
   * Asset sizes, as the store holds them.
   *
   * The raw map rather than a `PlacementSizes` adapter, because the cache
   * compares inputs by **identity** and `sizesFromMap` returns a fresh object
   * every call — an adapter here would make every lookup a cache miss, which
   * is the opposite failure but just as wrong.
   */
  sizes: ReadonlyMap<string, readonly [number, number, number]>;
}

let cached: { inputs: PhysicsInputs; world: PhysicsWorld } | null = null;

/**
 * Same inputs, field by field, by identity.
 *
 * Written generically over the object's own keys rather than as
 * `a.doc === b.doc && a.revision === b.revision && …` so that **adding a fourth
 * input cannot silently skip invalidation**. That is exactly how the third one
 * was missed: the cache keyed on `revision` alone while `sizes` changed
 * independently of it.
 */
const sameInputs = (a: PhysicsInputs, b: PhysicsInputs): boolean => {
  const keys = Object.keys(a) as (keyof PhysicsInputs)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
};

/**
 * One physics world per set of inputs.
 *
 * Rebuilding colliders on every drop would be wasteful, and keeping one across
 * edits would be wrong — move a wall and the world it describes is stale.
 *
 * It used to key on `revision` alone, and its comment claimed that made both
 * failures impossible. It did not, because **`sizes` is a second input that
 * changes independently of `revision`**: `setAssetSizes` does not bump the
 * revision and must not — the revision means "the document changed", and asset
 * loading is not a document change; conflating them would regenerate the whole
 * scene when models arrive.
 *
 * The consequence was specific. Placement colliders exist only when sizes do —
 * `deriveColliders` deliberately skips any placement whose asset has no size,
 * because a collider built from a guess is worse than none. So opening a scene
 * and using drop-to-floor before the models landed cached a world at revision 1
 * with **no placement colliders at all**; the models then loaded, the revision
 * stayed 1, and every later drop reused that world. A bench dropped over a
 * table fell straight through it and the status line said it settled on
 * terrain.
 */
export async function physicsFor(inputs: PhysicsInputs): Promise<PhysicsWorld> {
  if (cached !== null && sameInputs(cached.inputs, inputs)) return cached.world;
  cached?.world.dispose();
  const world = await PhysicsWorld.create(inputs.doc, sizesFromMap(inputs.sizes));
  cached = { inputs, world };
  return world;
}

export const collidersFor = (doc: SceneDocument, sizes?: PlacementSizes): CuboidCollider[] =>
  deriveColliders(doc, sizes);

/** Adapt the store's plain map to what `deriveColliders` wants. */
export const sizesFromMap = (
  sizes: ReadonlyMap<string, readonly [number, number, number]>,
): PlacementSizes => ({ get: (id) => sizes.get(id) });

export function disposePhysics(): void {
  cached?.world.dispose();
  cached = null;
}
