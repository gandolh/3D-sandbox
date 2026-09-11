import type { M } from "./units.js";

/** A point on the ground plane. Y-up means plan space is XZ. */
export type Plan = readonly [M, M];
/** A point in world space. */
export type World = readonly [M, M, M];
/** A closed polygon in plan space. The closing edge is implicit. */
export type Polygon = readonly Plan[];

export const sub = (a: Plan, b: Plan): Plan => [a[0] - b[0], a[1] - b[1]];
export const length = (a: Plan, b: Plan): M => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Signed area via the shoelace formula. Positive is counter-clockwise. */
export function signedArea(poly: Polygon): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    sum += p[0] * q[1] - q[0] * p[1];
  }
  return sum / 2;
}

export const area = (poly: Polygon): number => Math.abs(signedArea(poly));

/** Axis-aligned bounds in plan space. */
export interface Bounds {
  minX: M;
  minZ: M;
  maxX: M;
  maxZ: M;
}

export function bounds(points: readonly Plan[]): Bounds {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minZ, maxX, maxZ };
}

/** Does `outer` contain `inner`, allowing `tolerance` metres of slack? */
export function boundsContain(outer: Bounds, inner: Bounds, tolerance: M = 0): boolean {
  return (
    inner.minX >= outer.minX - tolerance &&
    inner.maxX <= outer.maxX + tolerance &&
    inner.minZ >= outer.minZ - tolerance &&
    inner.maxZ <= outer.maxZ + tolerance
  );
}

/** True when two closed 1-D intervals overlap by more than `epsilon`. */
export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  epsilon = 1e-6,
): boolean {
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > epsilon;
}

