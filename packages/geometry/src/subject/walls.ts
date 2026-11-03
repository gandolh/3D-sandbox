import {
  degToRad,
  type Level,
  type Opening,
  squareEnds,
  type Wall,
  type WallEnds,
  wallAngle,
  wallBearing,
  wallLength,
  wallMidpoint,
  wallOutline,
  wallPoint,
} from "@solstice/schema";
import * as THREE from "three";
import { Brush, type Evaluator, SUBTRACTION } from "three-bvh-csg";
import { ensureStandardAttributes } from "../attributes.js";
import { extrudePolygon } from "../polygon.js";

/**
 * A wall is its plan outline, centred on the line from `start` to `end` and
 * `thickness` wide, extruded `height` tall from the level's floor.
 *
 * The outline's ends come from `wallEnds`: square where the wall meets nothing,
 * cut along the corner's bisector where it shares an end with another wall, so
 * the two close the corner. A box with square ends left a notch half a
 * thickness square outside every corner. The collider and the plan read the same
 * outline, so the three cannot disagree about where a wall stops.
 *
 * Openings are subtracted rather than modelled, which is why the linter cares so
 * much that they fit: CSG against a void that pokes out of the solid produces
 * geometry that looks almost right, and "almost right" is the expensive kind of
 * wrong to notice later.
 */
export function wallSolid(wall: Wall, level: Level, ends: WallEnds = squareEnds(wall)): THREE.BufferGeometry {
  const height = wall.height ?? level.height;
  const outline = wallOutline(wall, ends).map(([along, across]) => wallPoint(wall, along, across));
  return extrudePolygon(outline, level.elevation, height);
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
export function buildWall(
  wall: Wall,
  level: Level,
  evaluator: Evaluator,
  ends: WallEnds = squareEnds(wall),
): THREE.BufferGeometry {
  const solid = wallSolid(wall, level, ends);
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
