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

/**
 * Ray-casting point-in-polygon. Boundary cases are not meaningful for scatter.
 *
 * Here rather than in `geometry` because the linter needs it too: a rule that
 * wants to know whether an exclusion actually sits inside its field cannot
 * import the package that draws the field.
 */
export function pointInPolygon(point: Plan, polygon: Polygon): boolean {
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


/**
 * Area of `outer` with `holes` removed — holes clipped to `outer`, and to each
 * other, so nothing is subtracted twice or subtracted where it never was.
 *
 * `area(outer) - Σ area(hole)` is the obvious version and it is wrong twice
 * over: a hole half outside its field subtracts the half that was never there,
 * and two overlapping holes subtract their overlap twice. A 100 × 100 m field
 * with one 50 × 50 m exclusion straddling its edge loses 2 500 m² where it
 * should lose 1 250, which is 14 % of the planting.
 *
 * **Exact, not sampled.** Cut the plane into horizontal slabs at every vertex
 * and every edge-edge crossing. Inside one slab no edge begins, ends, or swaps
 * sides with another, so each crossing's x moves linearly in z and so does the
 * total covered length — and the integral of a linear function over an interval
 * is its value at the midpoint times the width. One evaluation per slab is
 * therefore the whole answer, not an approximation of it.
 *
 * Handles any simple polygon and any number of overlapping holes. The cost is
 * quadratic in edge count, which for a field and a handful of exclusions is a
 * few thousand operations.
 */
export function polygonNetArea(outer: Polygon, holes: readonly Polygon[]): number {
  if (outer.length < 3) return 0;
  const all = [outer, ...holes.filter((h) => h.length >= 3)];

  const zs = new Set<number>();
  for (const poly of all) for (const [, z] of poly) zs.add(z);

  // Where two edges cross, the crossings they contribute swap order, and the
  // covered length stops being linear. Slab there too.
  const edges = all.flatMap(edgesOf);
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const z = crossingZ(edges[i]!, edges[j]!);
      if (z !== null) zs.add(z);
    }
  }

  const sorted = [...zs].sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    const z0 = sorted[i - 1]!;
    const z1 = sorted[i]!;
    const height = z1 - z0;
    if (height <= 0) continue;
    const covered = coveredAt(outer, holes, (z0 + z1) / 2);
    total += covered * height;
  }
  return total;
}

type Edge = readonly [Plan, Plan];

const edgesOf = (poly: Polygon): Edge[] =>
  poly.map((p, i) => [p, poly[(i + 1) % poly.length]!] as Edge);

/** The z where two segments properly cross, or null. */
function crossingZ(a: Edge, b: Edge): number | null {
  const [[ax1, az1], [ax2, az2]] = a;
  const [[bx1, bz1], [bx2, bz2]] = b;
  const dax = ax2 - ax1;
  const daz = az2 - az1;
  const dbx = bx2 - bx1;
  const dbz = bz2 - bz1;
  const denom = dax * dbz - daz * dbx;
  if (denom === 0) return null;
  const t = ((bx1 - ax1) * dbz - (bz1 - az1) * dbx) / denom;
  const u = ((bx1 - ax1) * daz - (bz1 - az1) * dax) / denom;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return az1 + t * daz;
}

/** Length of `outer` minus `holes` along the horizontal line at `z`. */
function coveredAt(outer: Polygon, holes: readonly Polygon[], z: number): number {
  let spans = spansAt(outer, z);
  for (const hole of holes) {
    const cut = spansAt(hole, z);
    if (cut.length > 0) spans = subtractSpans(spans, cut);
    if (spans.length === 0) return 0;
  }
  return spans.reduce((sum, [lo, hi]) => sum + (hi - lo), 0);
}

type Span = readonly [number, number];

/** Even-odd crossings of a simple polygon with the line at `z`, as x spans. */
function spansAt(poly: Polygon, z: number): Span[] {
  const xs: number[] = [];
  for (const [[x1, z1], [x2, z2]] of edgesOf(poly)) {
    // Half-open in z, so a vertex exactly on the line counts once, not twice.
    if (z1 > z === z2 > z) continue;
    xs.push(x1 + ((z - z1) / (z2 - z1)) * (x2 - x1));
  }
  xs.sort((a, b) => a - b);
  const out: Span[] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i]!, xs[i + 1]!]);
  return out;
}

function subtractSpans(from: readonly Span[], cut: readonly Span[]): Span[] {
  let spans = [...from];
  for (const [clo, chi] of cut) {
    const next: Span[] = [];
    for (const [lo, hi] of spans) {
      if (chi <= lo || clo >= hi) {
        next.push([lo, hi]);
        continue;
      }
      if (clo > lo) next.push([lo, clo]);
      if (chi < hi) next.push([chi, hi]);
    }
    spans = next;
  }
  return spans;
}
