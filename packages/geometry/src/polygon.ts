import * as THREE from "three";
import type { Plan } from "@solstice/schema";

/** Ray-casting point-in-polygon. Boundary cases are not meaningful for scatter. */
export function pointInPolygon(point: Plan, polygon: readonly Plan[]): boolean {
  const [x, z] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersects =
      a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0];
    if (intersects) inside = !inside;
  }
  return inside;
}

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
  return geometry;
}
