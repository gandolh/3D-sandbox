import * as THREE from "three";
// `pointInPolygon` moved to `@solstice/schema` so the linter could reach it;
// re-exported here because every caller in this package already imports from
// this module, and two import sites for one predicate is how the copy came
// back last time.
import { pointInPolygon, type Plan } from "@solstice/schema";

import { ensureStandardAttributes } from "./attributes.js";

export { pointInPolygon };

/**
 * A `THREE.Shape` in the XY plane from a plan-space polygon.
 *
 * Plan space is XZ (Y is up), and `ExtrudeGeometry` extrudes along +Z, so shapes
 * are authored in XY and the caller rotates -90° about X to lay them flat. Doing
 * the rotation at the call site rather than here keeps the mapping visible where
 * it matters.
 */
export function shapeFromPolygon(polygon: readonly Plan[]): THREE.Shape {
  const shape = new THREE.Shape();
  const first = polygon[0];
  if (first === undefined) throw new Error("shapeFromPolygon: empty polygon");
  shape.moveTo(first[0], first[1]);
  for (let i = 1; i < polygon.length; i++) {
    const p = polygon[i]!;
    shape.lineTo(p[0], p[1]);
  }
  shape.closePath();
  return shape;
}

/**
 * Extrude a plan polygon upward by `height`, with its base at y = `base`.
 * The result is in world space, Y-up.
 */
export function extrudePolygon(
  polygon: readonly Plan[],
  base: number,
  height: number,
): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shapeFromPolygon(polygon), {
    depth: height,
    bevelEnabled: false,
  });
  // XY-extruded-along-Z becomes XZ-extruded-along-Y.
  //
  // The sign matters twice over: rotateX(+90°) maps (x, y, z) → (x, -z, y), which
  // keeps the polygon's plan-Z intact. Rotating the other way maps it to -z and
  // silently mirrors every footprint about the X axis.
  geometry.rotateX(Math.PI / 2);
  // The solid now occupies y ∈ [-height, 0]; lift it onto its base.
  geometry.translate(0, base + height, 0);
  return ensureStandardAttributes(geometry);
}
