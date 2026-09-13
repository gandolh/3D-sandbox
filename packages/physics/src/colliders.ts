import {
  bounds,
  degToRad,
  type Level,
  type SceneDocument,
  type Wall,
  wallAngle,
  wallLength,
  wallMidpoint,
} from "@solstice/schema";

/** A box collider in world space, rotated only about Y. */
export interface CuboidCollider {
  id: string;
  /** Which document entity produced it. */
  source: "wall" | "slab" | "terrain" | "mass" | "placement";
  /** The entity's own id, so a hit can be reported in the document's language. */
  entity: string;
  halfExtents: [number, number, number];
  position: [number, number, number];
  /**
   * Yaw in **radians**, always.
   *
   * Stated because it has been got wrong: the document stores a placement's
   * rotation in degrees, and copying that field straight in here is a
   * conversion the type cannot refuse. Everything downstream — `world.ts`'s
   * `quaternionFromY`, the viewport's collider overlay — reads radians, and so
   * does the mesh the collider is supposed to be shaped like.
   */
  rotationY: number;
}

const EPSILON = 1e-4;

/**
 * Colliders for a scene, as plain descriptors.
 *
 * Deliberately free of rapier: the derivation is the part with the interesting
 * geometry, and keeping it pure means it can be tested without instantiating a
 * physics engine — and the engine can then be tested against descriptors known
 * to be right.
 *
 * Roofs are omitted on purpose. Physics here is an authoring aid for placing
 * things on floors, and a pitched trimesh collider is real work for no authoring
 * benefit.
 */
/** Size of a placement whose asset is not loaded. See `deriveColliders`. */
export interface PlacementSizes {
  get(assetId: string): readonly [number, number, number] | undefined;
}

export function deriveColliders(doc: SceneDocument, sizes?: PlacementSizes): CuboidCollider[] {
  const out: CuboidCollider[] = [];

  // Terrain as a thin slab whose top surface sits at y = 0.
  const [sx, sz] = doc.site.terrain.size;
  out.push({
    id: "terrain",
    source: "terrain",
    entity: "terrain",
    halfExtents: [sx / 2, 0.5, sz / 2],
    position: [0, -0.5, 0],
    rotationY: 0,
  });

  // Placements collide with each other, so a bowl dropped over a table rests on
  // it rather than through it. This was not possible before real assets: a proxy
  // box has no honest size, and a collider built from a guess is worse than
  // none — it would settle things onto a surface that is not there.
  //
  // A placement whose asset is not loaded contributes nothing. Deliberately: an
  // invisible collider around a visible proxy is the exact failure this avoids.
  if (sizes !== undefined) {
    for (const placement of doc.subject.placements) {
      const size = sizes.get(placement.asset);
      if (size === undefined) continue;
      const [sx, sy, sz] = size;
      const scale = placement.scale;
      out.push({
        id: `placement:${placement.id}`,
        source: "placement",
        entity: placement.id,
        halfExtents: [(sx * scale) / 2, (sy * scale) / 2, (sz * scale) / 2],
        // The document positions a placement by where it stands, and
        // `prepareAsset` grounds geometry on y = 0 to match — so the collider's
        // centre is half its height above the stated position.
        position: [placement.position[0], placement.position[1] + (sy * scale) / 2, placement.position[2]],
        // The document speaks degrees; every consumer of this field reads
        // radians. `packages/geometry` converts the same field for the mesh.
        rotationY: degToRad(placement.rotationY),
      });
    }
  }

  for (const level of doc.subject.levels) {
    for (const wall of level.walls) out.push(...wallColliders(wall, level));

    for (const slab of level.slabs) {
      const b = bounds(slab.polygon);
      out.push({
        id: `slab:${slab.id}`,
        source: "slab",
        entity: slab.id,
        // Bounds rather than the polygon: a floor slab is convex in practice,
        // and an L-shaped one over-covers by a corner nobody stands in.
        halfExtents: [(b.maxX - b.minX) / 2, slab.thickness / 2, (b.maxZ - b.minZ) / 2],
        position: [(b.minX + b.maxX) / 2, level.elevation - slab.thickness / 2, (b.minZ + b.maxZ) / 2],
        rotationY: 0,
      });
    }
  }

  for (const mass of doc.context.masses) {
    const b = bounds(mass.footprint);
    out.push({
      id: `mass:${mass.id}`,
      source: "mass",
      entity: mass.id,
      halfExtents: [(b.maxX - b.minX) / 2, mass.height / 2, (b.maxZ - b.minZ) / 2],
      position: [(b.minX + b.maxX) / 2, mass.height / 2, (b.minZ + b.maxZ) / 2],
      rotationY: 0,
    });
  }

  return out;
}

/**
 * A wall, with its openings cut out.
 *
 * One box per wall would be simpler and wrong: a chair could not be carried
 * through a doorway. Splitting the wall into the solid spans between openings,
 * plus the lintel above each and the spandrel below, is the payoff for the
 * document being parametric — the openings are already positioned along the wall
 * by offset, so this is arithmetic rather than geometry.
 */
export function wallColliders(wall: Wall, level: Level): CuboidCollider[] {
  const length = wallLength(wall);
  if (length < EPSILON) return [];

  const height = wall.height ?? level.height;
  // Shared with the mesh builder rather than recomputed. The collider is meant
  // to be the shape of the wall, and nothing draws the two on top of each
  // other, so a sign that drifted apart here would show up only as something
  // walking through a wall that is plainly there.
  const rotationY = wallAngle(wall);
  const [midX, midZ] = wallMidpoint(wall);
  const halfThickness = wall.thickness / 2;

  // Local frame: u runs along the wall from its midpoint, v up from the floor.
  const place = (
    suffix: string,
    uStart: number,
    uEnd: number,
    vStart: number,
    vEnd: number,
  ): CuboidCollider | null => {
    const du = uEnd - uStart;
    const dv = vEnd - vStart;
    if (du <= EPSILON || dv <= EPSILON) return null;

    const uCentre = (uStart + uEnd) / 2 - length / 2;
    const vCentre = (vStart + vEnd) / 2;
    return {
      id: `wall:${wall.id}${suffix}`,
      source: "wall",
      entity: wall.id,
      halfExtents: [du / 2, dv / 2, halfThickness],
      position: [
        midX + Math.cos(rotationY) * uCentre,
        level.elevation + vCentre,
        midZ - Math.sin(rotationY) * uCentre,
      ],
      rotationY,
    };
  };

  const openings = [...wall.openings].sort((a, b) => a.offset - b.offset);
  const out: CuboidCollider[] = [];
  let cursor = 0;

  openings.forEach((opening, i) => {
    const near = opening.offset;
    const far = opening.offset + opening.width;

    const solid = place(`:s${i}`, cursor, near, 0, height);
    if (solid !== null) out.push(solid);

    // Spandrel under a window, lintel over anything that does not reach the top.
    const below = place(`:b${i}`, near, far, 0, opening.sill);
    if (below !== null) out.push(below);
    const above = place(`:a${i}`, near, far, opening.sill + opening.height, height);
    if (above !== null) out.push(above);

    cursor = Math.max(cursor, far);
  });

  const tail = place(openings.length === 0 ? "" : `:s${openings.length}`, cursor, length, 0, height);
  if (tail !== null) out.push(tail);

  return out;
}

export { degToRad };
