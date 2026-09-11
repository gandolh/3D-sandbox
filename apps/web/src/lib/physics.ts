import type { SceneDocument } from "@solstice/schema";
import { PhysicsWorld, deriveColliders, type CuboidCollider } from "@solstice/physics";

let cached: { revision: number; world: PhysicsWorld } | null = null;

/**
 * One physics world per document revision.
 *
 * Rebuilding colliders on every drop would be wasteful, and keeping one across
 * edits would be wrong — move a wall and the world it describes is stale. Keying
 * the cache on the revision counter makes both impossible.
 */
export async function physicsFor(doc: SceneDocument, revision: number): Promise<PhysicsWorld> {
  if (cached !== null && cached.revision === revision) return cached.world;
  cached?.world.dispose();
  const world = await PhysicsWorld.create(doc);
  cached = { revision, world };
  return world;
}

export const collidersFor = (doc: SceneDocument): CuboidCollider[] => deriveColliders(doc);

export function disposePhysics(): void {
  cached?.world.dispose();
  cached = null;
}
