import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import {
  degToRad,
  wallAngle,
  wallBearing,
  wallLength,
  wallMidpoint,
  type Level,
  type Opening,
  type Wall,
} from "@solstice/schema";
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
  const length = wallLength(wall);
  const [midX, midZ] = wallMidpoint(wall);
  const height = wall.height ?? level.height;

  const geometry = new THREE.BoxGeometry(length, height, wall.thickness);
  // Box is centred on the origin; move it so its base sits on the floor.
  geometry.translate(0, height / 2, 0);
  // Rotate into the wall's direction, then move to its midpoint. The angle is
  // `wallAngle`'s and not a local `atan2`, because `packages/physics` rotates
  // the collider for this same wall and the two must not be able to drift.
  geometry.rotateY(wallAngle(wall));
  geometry.translate(midX, level.elevation, midZ);
  return geometry;
}

/** The void an opening cuts, in the same world frame as the wall solid. */
export function openingVoid(opening: Opening, wall: Wall, level: Level): THREE.BufferGeometry {
  const length = wallLength(wall);
  const [midX, midZ] = wallMidpoint(wall);
  const angle = wallAngle(wall);

  // Overshoot the wall's thickness so the subtraction leaves no skin behind.
  const depth = wall.thickness * 3;
  const geometry = new THREE.BoxGeometry(opening.width, opening.height, depth);

  // Local frame: x runs along the wall from its midpoint, y up from the floor.
  const alongCentre = opening.offset + opening.width / 2 - length / 2;
  geometry.translate(alongCentre, opening.sill + opening.height / 2, 0);
  geometry.rotateY(angle);
  geometry.translate(midX, level.elevation, midZ);
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

export { degToRad, wallAngle, wallBearing, wallLength, wallMidpoint };
