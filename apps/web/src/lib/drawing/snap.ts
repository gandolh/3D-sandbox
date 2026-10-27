import type { Wall } from "@solstice/schema";

/** A plan point, `[x, z]` metres. */
export type Pt = readonly [number, number];

/**
 * Why the pointer landed where it did. Shown by the cursor as a marker and a
 * word, so a snap is never a surprise.
 */
export type SnapKind = "end" | "middle" | "on-wall" | "grid" | "angle" | "free";

export const SNAP_LABEL: Record<SnapKind, string> = {
  end: "End",
  middle: "Middle",
  "on-wall": "On wall",
  grid: "Grid",
  angle: "Angle",
  free: "",
};

export interface Snap {
  point: [number, number];
  kind: SnapKind;
  /** The wall snapped to, for end, middle and on-wall. */
  wallId?: string;
  /** Shift held: the point was held to the horizontal or vertical through `from`. */
  ortho: boolean;
  /**
   * Unit direction from `from` to `point`, when there is a `from` and the two
   * differ. Exact for the four compass points, so a length typed along a
   * snapped direction lands on exact coordinates.
   */
  direction?: [number, number];
  /** The compass bearing of `direction`, degrees clockwise from north (−Z). */
  bearing?: number;
}

export interface SnapOptions {
  /** The point the wall in progress starts from, if one is in progress. */
  from?: Pt | null;
  /** Shift: lock to horizontal or vertical through `from`, as ortho does in CAD. */
  shift?: boolean;
  /** Metres between grid intersections — the grid as drawn, `gridTier(scale).minor`. */
  gridStep: number;
  /** Screen pixels. The same at every zoom, so snapping feels the same at every zoom. */
  tolerancePx?: number;
  /** Walls not to snap to — the ones being dragged, which would otherwise snap to themselves. */
  ignore?: ReadonlySet<string>;
}

export const SNAP_TOLERANCE_PX = 10;
/** Angles snap to multiples of this, in degrees. */
export const ANGLE_STEP = 15;
/** How near, in degrees, a direction must be to a multiple of `ANGLE_STEP` to snap to it. */
export const ANGLE_APERTURE = 3;

/**
 * The unit direction of a compass bearing, exact at the four compass points.
 *
 * `Math.cos(Math.PI / 2)` is 6e-17, not 0, so a wall typed "6" due north from
 * (8, 0) would end at (8.000000000000000367, −6) and stop sharing a corner
 * with the next wall drawn from (8, −6). Rounding the components to 1e-12
 * makes every cardinal direction exactly (0, ±1) or (±1, 0).
 */
export function directionOf(bearing: number): [number, number] {
  const rad = (bearing * Math.PI) / 180;
  const tidy = (v: number): number => {
    const r = Math.round(v * 1e12) / 1e12;
    return Object.is(r, -0) ? 0 : r;
  };
  // Bearing 0 runs to −Z (north), 90 to +X (east): see `wallBearing`.
  return [tidy(Math.sin(rad)), tidy(-Math.cos(rad))];
}

/** The compass bearing from `a` to `b`, degrees clockwise from north, in [0, 360). */
export function bearingOf(a: Pt, b: Pt): number {
  return ((Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI + 360) % 360;
}

/** Round to the centimetre: where a free click lands. */
export const toCentimetre = (v: number): number => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
};

/** Strip float noise (0.1 + 0.2) without moving a point anyone could measure. */
export const clean = (v: number): number => {
  const r = Math.round(v * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
};

const dist = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** The nearest point on a wall's centreline to `p`, clamped to the wall. */
export function nearestOnWall(wall: Pick<Wall, "start" | "end">, p: Pt): [number, number] {
  const [ax, az] = wall.start;
  const [bx, bz] = wall.end;
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return [ax, az];
  const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / len2));
  return [ax + dx * t, az + dz * t];
}

const withDirection = (snap: Omit<Snap, "direction" | "bearing">, from: Pt | null | undefined): Snap => {
  if (from === null || from === undefined || dist(from, snap.point) < 1e-9) return snap;
  const d = dist(from, snap.point);
  return {
    ...snap,
    direction: [(snap.point[0] - from[0]) / d, (snap.point[1] - from[1]) / d],
    bearing: bearingOf(from, snap.point),
  };
};

/**
 * Where the pointer lands, and why.
 *
 * Highest first: a wall's **end**, its **middle**, the nearest point **on** its
 * centreline, a **grid** intersection, then — with a wall in progress — a
 * direction within a few degrees of a multiple of 15°. Anything else is a
 * **free** point, rounded to the centimetre. The tolerance is in screen
 * pixels, converted through the zoom, so a snap catches at the same distance
 * on screen whether the view shows a room or a whole site.
 *
 * An end snap returns the stored coordinates **as they are**, never rounded or
 * recomputed. That is what makes two walls share a corner exactly — which is
 * what a structure is — rather than meet at two points that merely look close.
 *
 * With Shift and a wall in progress, the point is held to the horizontal or
 * the vertical through `from`, whichever the pointer is nearer, and the other
 * snaps apply only along that line.
 */
export function snapPoint(pointer: Pt, walls: readonly Wall[], scale: number, options: SnapOptions): Snap {
  const tol = (options.tolerancePx ?? SNAP_TOLERANCE_PX) / scale;
  const candidates = options.ignore === undefined ? walls : walls.filter((w) => !options.ignore!.has(w.id));
  const from = options.from ?? null;
  const grid = options.gridStep;

  if (options.shift === true && from !== null) return ortho(pointer, candidates, from, tol, grid);

  // 1. Ends, nearest first.
  let best: { d: number; snap: Omit<Snap, "direction" | "bearing"> } | null = null;
  const offer = (d: number, snap: Omit<Snap, "direction" | "bearing">): void => {
    if (d <= tol && (best === null || d < best.d)) best = { d, snap };
  };
  for (const wall of candidates) {
    for (const end of [wall.start, wall.end]) {
      offer(dist(pointer, end), { point: [end[0], end[1]], kind: "end", wallId: wall.id, ortho: false });
    }
  }
  if (best !== null) return withDirection((best as { snap: Snap }).snap, from);

  // 2. Midpoints.
  for (const wall of candidates) {
    const mid: [number, number] = [(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2];
    offer(dist(pointer, mid), { point: mid, kind: "middle", wallId: wall.id, ortho: false });
  }
  if (best !== null) return withDirection((best as { snap: Snap }).snap, from);

  // 3. On a centreline.
  for (const wall of candidates) {
    const on = nearestOnWall(wall, pointer);
    offer(dist(pointer, on), { point: on, kind: "on-wall", wallId: wall.id, ortho: false });
  }
  if (best !== null) return withDirection((best as { snap: Snap }).snap, from);

  // 4. A grid intersection.
  const gx = Math.round(pointer[0] / grid) * grid;
  const gz = Math.round(pointer[1] / grid) * grid;
  const g: [number, number] = [clean(gx), clean(gz)];
  if (dist(pointer, g) <= tol) return withDirection({ point: g, kind: "grid", ortho: false }, from);

  // 5. A direction near a multiple of 15°, from the wall in progress.
  if (from !== null && dist(from, pointer) > 1e-9) {
    const raw = bearingOf(from, pointer);
    const snapped = Math.round(raw / ANGLE_STEP) * ANGLE_STEP;
    let delta = Math.abs(raw - snapped);
    if (delta > 180) delta = 360 - delta;
    if (delta <= ANGLE_APERTURE) {
      const bearing = snapped % 360;
      const direction = directionOf(bearing);
      const along = toCentimetre(
        (pointer[0] - from[0]) * direction[0] + (pointer[1] - from[1]) * direction[1],
      );
      if (along > 0) {
        return {
          point: [clean(from[0] + direction[0] * along), clean(from[1] + direction[1] * along)],
          kind: "angle",
          ortho: false,
          direction,
          bearing,
        };
      }
    }
  }

  return withDirection(
    { point: [toCentimetre(pointer[0]), toCentimetre(pointer[1])], kind: "free", ortho: false },
    from,
  );
}

/** Shift held: the point slides along the horizontal or vertical through `from`. */
function ortho(pointer: Pt, walls: readonly Wall[], from: Pt, tol: number, grid: number): Snap {
  const horizontal = Math.abs(pointer[0] - from[0]) >= Math.abs(pointer[1] - from[1]);
  // The coordinate that moves, and the one held at `from`'s, exactly.
  const axis = horizontal ? 0 : 1;
  const held = horizontal ? 1 : 0;
  const onLine = (free: number): [number, number] => (horizontal ? [free, from[1]] : [from[0], free]);
  const q = onLine(pointer[axis]);

  const finish = (free: number, kind: SnapKind, wallId?: string): Snap => {
    const point = onLine(free);
    const sign = Math.sign(free - from[axis]);
    const direction: [number, number] = horizontal ? [sign, 0] : [0, sign];
    const snap: Snap = { point, kind, ortho: true, ...(wallId === undefined ? {} : { wallId }) };
    if (sign === 0) return snap;
    return { ...snap, direction, bearing: horizontal ? (sign > 0 ? 90 : 270) : sign > 0 ? 180 : 0 };
  };

  // An end or a middle near the line: take its coordinate along the line.
  let best: { d: number; free: number; kind: SnapKind; wallId: string } | null = null;
  const offer = (pt: Pt, kind: SnapKind, wallId: string): void => {
    const d = dist(q, onLine(pt[axis]));
    const off = Math.abs(pt[held] - from[held]);
    if (d <= tol && off <= tol && (best === null || d < best.d)) best = { d, free: pt[axis], kind, wallId };
  };
  for (const wall of walls) {
    offer(wall.start, "end", wall.id);
    offer(wall.end, "end", wall.id);
  }
  if (best === null) {
    for (const wall of walls) {
      offer([(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2], "middle", wall.id);
    }
  }
  if (best !== null) {
    const b = best as { free: number; kind: SnapKind; wallId: string };
    return finish(b.free, b.kind, b.wallId);
  }

  const g = clean(Math.round(q[axis] / grid) * grid);
  if (Math.abs(g - q[axis]) <= tol) return finish(g, "grid");
  return finish(toCentimetre(q[axis]), "free");
}
