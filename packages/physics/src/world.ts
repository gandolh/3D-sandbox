import RAPIER from "@dimforge/rapier3d-compat";
import type { SceneDocument } from "@solstice/schema";
import { deriveColliders, type CuboidCollider, type PlacementSizes } from "./colliders.js";

export interface DropOptions {
  /** Half-extents of the box being placed. */
  halfExtents?: [number, number, number];
  /** Give up after this many steps rather than spinning on a rolling object. */
  maxSteps?: number;
  /** Linear speed below which the object counts as at rest, m/s. */
  restSpeed?: number;
  /**
   * A document entity whose colliders this drop should not see — normally the
   * thing being dropped.
   *
   * Placements became colliders so that things stack. That immediately means a
   * placement dropped to the floor lands on *itself*: its own static box is
   * still in the world, half a metre below where it starts. Without this, the
   * viewport reports "bench-vine settled on bench-vine" and never moves it.
   */
  ignoreEntity?: string;
}

export interface DropResult {
  position: [number, number, number];
  /** False when it was still moving when `maxSteps` ran out. */
  settled: boolean;
  steps: number;
  /** Entity id of whatever it came to rest on, when that can be determined. */
  restingOn: string | null;
}

let initialised: Promise<void> | null = null;

/** Rapier is WASM and must be initialised once per process before any use. */
export const initPhysics = async (): Promise<void> => {
  initialised ??= RAPIER.init();
  return initialised;
};

/**
 * A physics world derived from a scene document.
 *
 * Static geometry only — walls, slabs, terrain, neighbouring masses — because
 * physics here is an authoring aid, not a simulation. Nothing this world
 * computes is persisted; it exists to answer "where would this land" and "does
 * this overlap anything" while someone is placing things.
 */
export class PhysicsWorld {
  private readonly world: RAPIER.World;
  private readonly byHandle = new Map<number, CuboidCollider>();

  // Written out rather than as a parameter property: a parameter property
  // needs code generated for the assignment, which Node's type-stripping
  // cannot do — see `erasableSyntaxOnly` in `tsconfig.base.json`.
  readonly colliders: readonly CuboidCollider[];

  private constructor(colliders: readonly CuboidCollider[]) {
    this.colliders = colliders;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    for (const collider of colliders) {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(...collider.position)
          .setRotation(quaternionFromY(collider.rotationY)),
      );
      const created = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(...collider.halfExtents),
        body,
      );
      this.byHandle.set(created.handle, collider);
    }
  }

  static async create(doc: SceneDocument, sizes?: PlacementSizes): Promise<PhysicsWorld> {
    await initPhysics();
    return new PhysicsWorld(deriveColliders(doc, sizes));
  }

  /** For tests and for the viewport's collider overlay. */
  static async fromColliders(colliders: readonly CuboidCollider[]): Promise<PhysicsWorld> {
    await initPhysics();
    return new PhysicsWorld(colliders);
  }

  get colliderCount(): number {
    return this.colliders.length;
  }

  /** Rapier handles belonging to one document entity. */
  private collidersOf(entity: string | undefined): number[] {
    if (entity === undefined) return [];
    return [...this.byHandle].filter(([, c]) => c.entity === entity).map(([handle]) => handle);
  }

  /**
   * Drop a box and report where it stops.
   *
   * The object is created with rotation locked: a chair that tumbles on the way
   * down is physically honest and useless for placement, which is the whole
   * difference between an authoring aid and a simulation.
   */
  dropToRest(from: [number, number, number], options: DropOptions = {}): DropResult {
    const halfExtents = options.halfExtents ?? [0.3, 0.4, 0.3];
    const maxSteps = options.maxSteps ?? 600;
    const restSpeed = options.restSpeed ?? 0.01;

    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(...from).lockRotations(),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(...halfExtents),
      body,
    );

    // Disabled rather than removed, so the world stays reusable across drops —
    // it is cached per document revision and a second drop must see the same
    // geometry as the first.
    const muted = this.collidersOf(options.ignoreEntity);
    for (const handle of muted) this.world.getCollider(handle)?.setEnabled(false);

    let steps = 0;
    let settled = false;
    let restingBelow = 0;

    for (; steps < maxSteps; steps++) {
      this.world.step();
      const v = body.linvel();
      restingBelow = Math.hypot(v.x, v.y, v.z) < restSpeed ? restingBelow + 1 : 0;
      // Several consecutive quiet steps, not one — a box at the top of a bounce
      // is momentarily still and is not resting on anything.
      if (restingBelow >= 5) {
        settled = true;
        break;
      }
    }

    const t = body.translation();
    const position: [number, number, number] = [t.x, t.y, t.z];

    // Remove the dropped body *before* probing. A downward ray from just inside
    // the box's own bottom face otherwise hits the box itself at toi 0, and the
    // answer is always "resting on nothing".
    this.world.removeCollider(collider, false);
    this.world.removeRigidBody(body);

    // Snap to the surface. Rapier lets a resting body settle a centimetre or
    // two into what it rests on — correct for a solver, wrong for an authoring
    // aid, where "on the floor" should mean exactly on the floor.
    const surface = this.surfaceBelow(position, halfExtents);
    if (surface !== null) position[1] = surface.y + halfExtents[1];

    // Put back whatever this drop was told to ignore, before anything else
    // queries the world.
    for (const handle of muted) this.world.getCollider(handle)?.setEnabled(true);

    return { position, settled, steps, restingOn: surface?.entity ?? null };
  }

  /** Would a box at this transform interpenetrate anything already here? */
  overlaps(at: [number, number, number], halfExtents: [number, number, number]): boolean {
    const shape = new RAPIER.Cuboid(...halfExtents);
    const hit = this.world.intersectionWithShape(
      { x: at[0], y: at[1], z: at[2] },
      { x: 0, y: 0, z: 0, w: 1 },
      shape,
    );
    return hit !== null;
  }

  /**
   * What is directly beneath a resting box, in the document's own language.
   *
   * **Five rays, not one.** A single ray from the box's centre only finds what
   * is under its *middle*, and a box does not have to rest on its middle —
   * anything holding up a corner is invisible to it. That is not a corner case
   * here, it is the common one: placement colliders carry a `rotationY`, so a
   * 0.78 × 0.83 armchair turned 152° has a **1.08 m** footprint, and the
   * coffee table beside it comes to rest on a chair arm its centre ray sails
   * straight past. The drop worked and reported "settled on nothing", because
   * nothing was under the middle.
   *
   * All five share one origin height, so the smallest time-of-impact is the
   * highest surface — which is what the box is actually resting on.
   *
   * Every hit is gathered rather than just the first, because a building's floor
   * slab and the ground it sits on are coplanar by construction — both top out
   * at the level's finished floor. The nearest hit is then whichever the broad
   * phase happened to return, so a named entity is preferred over the terrain.
   * "It landed on slab-1" is the useful answer; "it landed on terrain" is merely
   * also true.
   */
  private surfaceBelow(
    position: [number, number, number],
    halfExtents: [number, number, number],
  ): { entity: string; y: number } | null {
    // Start above the box's underside so a body that sank into the surface is
    // still measured against the surface, not from inside it.
    const originY = position[1] - halfExtents[1] + 0.25;
    // Corners pulled in by a hair: a ray exactly on the edge of the box is as
    // likely to miss the thing under it as to hit it.
    const inset = 0.02;
    const dx = Math.max(0, halfExtents[0] - inset);
    const dz = Math.max(0, halfExtents[2] - inset);
    const origins: [number, number][] = [
      [position[0], position[2]],
      [position[0] - dx, position[2] - dz],
      [position[0] + dx, position[2] - dz],
      [position[0] + dx, position[2] + dz],
      [position[0] - dx, position[2] + dz],
    ];

    let best: { entity: string; toi: number; specific: boolean } | null = null;
    for (const [ox, oz] of origins) {
      const ray = new RAPIER.Ray({ x: ox, y: originY, z: oz }, { x: 0, y: -1, z: 0 });
      this.world.intersectionsWithRay(ray, 0.6, true, (hit) => {
        const collider = this.byHandle.get(hit.collider.handle);
        if (collider === undefined) return true;
        const candidate = {
          entity: collider.entity,
          toi: hit.timeOfImpact,
          specific: collider.source !== "terrain",
        };
        if (
          best === null ||
          (candidate.specific && !best.specific) ||
          (candidate.specific === best.specific && candidate.toi < best.toi)
        ) {
          best = candidate;
        }
        return true; // keep looking; coplanar surfaces are the whole problem
      });
    }

    if (best === null) return null;
    const found = best as { entity: string; toi: number };
    return { entity: found.entity, y: originY - found.toi };
  }

  dispose(): void {
    this.world.free();
    this.byHandle.clear();
  }
}

/** Quaternion for a rotation about Y, which is the only rotation colliders use. */
function quaternionFromY(angle: number): { x: number; y: number; z: number; w: number } {
  return { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) };
}
