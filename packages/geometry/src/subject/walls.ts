import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { degToRad, type Level, type Opening, type Wall } from "@solstice/schema";
import { ensureStandardAttributes } from "../attributes.js";

/**
 * A wall is a box centred on the line from `start` to `end`, `thickness` wide and
 * `height` tall, sitting on the level's floor.
 *
 * Openings are subtracted rather than modelled, which is why the linter cares so
 * much that they fit: CSG against a void that pokes out of the solid produces
 * geometry that looks almost right, and "almost right" is the expensive kind of
 * wrong to notice later.
 */
export function wallSolid(wall: Wall, level: Level): THREE.BufferGeometry {
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  const length = Math.hypot(x2 - x1, z2 - z1);
  const height = wall.height ?? level.height;

  const geometry = new THREE.BoxGeometry(length, height, wall.thickness);
  // Box is centred on the origin; move it so its base sits on the floor.
  geometry.translate(0, height / 2, 0);
  // Rotate into the wall's direction, then move to its midpoint.
  geometry.rotateY(Math.atan2(-(z2 - z1), x2 - x1));
  geometry.translate((x1 + x2) / 2, level.elevation, (z1 + z2) / 2);
  return geometry;
}

/** The void an opening cuts, in the same world frame as the wall solid. */
export function openingVoid(opening: Opening, wall: Wall, level: Level): THREE.BufferGeometry {
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  const length = Math.hypot(x2 - x1, z2 - z1);
  const angle = Math.atan2(-(z2 - z1), x2 - x1);

  // Overshoot the wall's thickness so the subtraction leaves no skin behind.
  const depth = wall.thickness * 3;
  const geometry = new THREE.BoxGeometry(opening.width, opening.height, depth);

  // Local frame: x runs along the wall from its midpoint, y up from the floor.
  const alongCentre = opening.offset + opening.width / 2 - length / 2;
  geometry.translate(alongCentre, opening.sill + opening.height / 2, 0);
  geometry.rotateY(angle);
  geometry.translate((x1 + x2) / 2, level.elevation, (z1 + z2) / 2);
  return geometry;
}

/**
 * A wall with its openings cut out. Returns the plain solid when there are none,
 * because the CSG evaluator is far from free and most walls are blank.
 */
export function buildWall(wall: Wall, level: Level, evaluator: Evaluator): THREE.BufferGeometry {
  const solid = wallSolid(wall, level);
  if (wall.openings.length === 0) return ensureStandardAttributes(solid);

  let current = new Brush(solid);
  current.updateMatrixWorld();

  for (const opening of wall.openings) {
    const cutter = new Brush(openingVoid(opening, wall, level));
    cutter.updateMatrixWorld();
    const result = evaluator.evaluate(current, cutter, SUBTRACTION);
    result.updateMatrixWorld();
    current = result;
  }

  return ensureStandardAttributes(current.geometry);
}

/** Direction the wall runs, in scene degrees clockwise from +Z (north). */
export const wallBearing = (wall: Wall): number => {
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  return (THREE.MathUtils.radToDeg(Math.atan2(x2 - x1, z2 - z1)) + 360) % 360;
};

export { degToRad };
