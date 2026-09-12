import type { SceneDocument } from "@solstice/schema";
// `@solstice/physics/colliders`, not the package root.
//
// `deriveColliders` is pure arithmetic over the document and the
// always-available colliders toggle uses it; `PhysicsWorld` is the only thing
// in the package that touches Rapier. The package's index re-exports
// `world.js`, and Rapier's module has side effects, so importing anything
// through the root pulls ~2 MB of inlined WASM into the first paint — for a
// feature (drop to floor) most visitors never reach. The second entry point is
// what lets a bundler tell the two halves apart.
import { deriveColliders, type CuboidCollider, type PlacementSizes } from "@solstice/physics/colliders";
// Type-only, so it is erased rather than emitted as an import.
import type { PhysicsWorld } from "@solstice/physics";

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
let engine: typeof import("@solstice/physics") | null = null;

/**
 * Has the physics engine chunk already been fetched?
 *
 * So the caller can say "Loading the physics engine…" on the first drop and
 * "Dropping table-01…" on every one after, rather than showing the same
 * message for two very different waits.
 */
export const physicsReady = (): boolean => engine !== null;

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
  // Deferred to here — the first drop — rather than to module scope. The chunk
  // is still statically built and served from the same directory, so this does
  // not touch the static-deploy decision; it changes *when* it loads, not
  // where it comes from.
  engine ??= await import("@solstice/physics");
  const world = await engine.PhysicsWorld.create(inputs.doc, sizesFromMap(inputs.sizes));
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
