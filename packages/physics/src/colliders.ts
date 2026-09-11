import { bounds, degToRad, type SceneDocument, type Level, type Wall } from "@solstice/schema";

/** A box collider in world space, rotated only about Y. */
export interface CuboidCollider {
  id: string;
  /** Which document entity produced it. */
  source: "wall" | "slab" | "terrain" | "mass";
  /** The entity's own id, so a hit can be reported in the document's language. */
  entity: string;
  halfExtents: [number, number, number];
  position: [number, number, number];
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
export function deriveColliders(doc: SceneDocument): CuboidCollider[] {
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
        position: [
          (b.minX + b.maxX) / 2,
          level.elevation - slab.thickness / 2,
          (b.minZ + b.maxZ) / 2,
        ],
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
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  const length = Math.hypot(x2 - x1, z2 - z1);
  if (length < EPSILON) return [];

  const height = wall.height ?? level.height;
  const rotationY = Math.atan2(-(z2 - z1), x2 - x1);
  const midX = (x1 + x2) / 2;
  const midZ = (z1 + z2) / 2;
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
