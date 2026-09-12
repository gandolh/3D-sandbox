import {
  wallBearing,
  wallLength,
  type Level,
  type Placement,
  type SceneDocument,
  type Wall,
} from "@solstice/schema";

/** Where a mesh name like `wall:W-03` points in the document. */
export interface WallRef {
  kind: "wall";
  wall: Wall;
  level: Level;
  levelIndex: number;
  wallIndex: number;
}

export interface PlacementRef {
  kind: "placement";
  placement: Placement;
  index: number;
}

export type EntityRef =
  | WallRef
  | PlacementRef
  | { kind: "roof"; id: string; index: number }
  | { kind: "slab"; id: string }
  | { kind: "other"; id: string };

export function findEntity(doc: SceneDocument, id: string): EntityRef | null {
  for (const [levelIndex, level] of doc.subject.levels.entries()) {
    for (const [wallIndex, wall] of level.walls.entries()) {
      if (wall.id === id) return { kind: "wall", wall, level, levelIndex, wallIndex };
    }
    for (const slab of level.slabs) {
      if (slab.id === id) return { kind: "slab", id };
    }
  }
  for (const [index, roof] of doc.subject.roofs.entries()) {
    if (roof.id === id) return { kind: "roof", id, index };
  }
  for (const [index, placement] of doc.subject.placements.entries()) {
    if (placement.id === id) return { kind: "placement", placement, index };
  }
  return null;
}

// Both come from `@solstice/schema`, which is where the geometry generator and
// the collider builder read them from too. This file had its own copies, so the
// inspector's readout and the mesh were free to describe the same wall
// differently.
export { wallBearing, wallLength };

/**
 * Move a wall's far endpoint so it runs `length` metres in its current
 * direction. Openings are positioned by offset along the wall, so they stay
 * attached — and the linter flags any that no longer fit rather than the editor
 * silently orphaning them.
 */
export function setWallLength(wall: Wall, length: number): void {
  const current = wallLength(wall);
  if (current < 1e-6) return;
  const ux = (wall.end[0] - wall.start[0]) / current;
  const uz = (wall.end[1] - wall.start[1]) / current;
  wall.end = [wall.start[0] + ux * length, wall.start[1] + uz * length];
}

/** Rotate a wall about its start point to the given compass bearing. */
export function setWallBearing(wall: Wall, bearing: number): void {
  const length = wallLength(wall);
  const rad = (bearing * Math.PI) / 180;
  wall.end = [wall.start[0] + Math.sin(rad) * length, wall.start[1] + Math.cos(rad) * length];
}

/** Translate both endpoints — what the gizmo does when dragging a wall. */
export function translateWall(wall: Wall, dx: number, dz: number): void {
  wall.start = [wall.start[0] + dx, wall.start[1] + dz];
  wall.end = [wall.end[0] + dx, wall.end[1] + dz];
}
