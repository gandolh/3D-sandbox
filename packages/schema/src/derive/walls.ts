import type { Wall } from "../document.js";
import type { Plan } from "../geometry.js";
import type { M } from "../units.js";

/** Just the ends — so a lint rule can ask without holding a whole `Wall`. */
export type Segment = Pick<Wall, "start" | "end">;

/**
 * The Y rotation that lays a wall along its own line, in **radians**.
 *
 * `atan2(-(z2 - z1), x2 - x1)` and not `atan2(z2 - z1, x2 - x1)`: a three.js
 * `rotateY(θ)` turns the local +X axis toward **-Z**, so the plan-space Z
 * difference has to be negated for the box's long axis to end up pointing from
 * `start` to `end`. Both signs produce a wall that looks plausible from most
 * camera angles; only one of them puts the wall where the document says.
 *
 * This lived twice — in the mesh builder and in the collider builder — which is
 * two chances to negate the wrong term and no way to notice, because the mesh
 * and the collider are never drawn on top of each other. A wall whose collider
 * has rotated away from it is invisible until something walks through it.
 *
 * The inverse, for anyone placing something along the wall: the unit direction
 * is `[cos(θ), -sin(θ)]` in plan space.
 */
export function wallAngle(wall: Segment): number {
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  return Math.atan2(-(z2 - z1), x2 - x1);
}

/** Centreline length, in metres. */
export function wallLength(wall: Segment): M {
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  return Math.hypot(x2 - x1, z2 - z1);
}

/** The point every wall-local offset is measured from. */
export function wallMidpoint(wall: Segment): Plan {
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  return [(x1 + x2) / 2, (z1 + z2) / 2];
}

/**
 * The direction a wall runs, in **degrees clockwise from −Z**, which the scene
 * calls north. +X is east, so a wall running −Z/+X/+Z/−X has bearing
 * 0/90/180/270, and the compass turns clockwise seen from above, as a real one
 * does.
 *
 * A second angle for the same line, and deliberately so: `wallAngle` is a
 * three.js Y rotation in radians for putting geometry in the right place, and
 * this is a compass bearing in degrees for showing a person. Note that the two
 * are not the same convention — `atan2(dx, -dz)` here versus `atan2(-dz, dx)`
 * there — which is exactly why both belong in one file where the difference is
 * visible, rather than in three files where it is not.
 *
 * There were three copies: one in `geometry`, one in the web app's entity
 * helpers, and the inspector importing the app's. The compass itself was a
 * mirror until 2026-10-07: +Z north with +X east turned anticlockwise seen from
 * above. It is now right-handed, and `directionFrom` in `@solstice/solar`
 * shares it; a test there fails if the two drift. `setWallBearing` in the web
 * app is this function's inverse.
 */
export function wallBearing(wall: Segment): number {
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  return ((Math.atan2(x2 - x1, -(z2 - z1)) * 180) / Math.PI + 360) % 360;
}

/* ── where walls meet ─────────────────────────────────────────────── */

/**
 * One end of a wall, in the wall's own frame: `along` metres from `start`
 * toward `end`, `across` metres toward `wallAcross`.
 *
 * - `plus`, `minus`: how far along the wall its +across and −across faces
 *   reach at this end. A free end is square, so both are 0 at the start and
 *   the wall's length at the end.
 * - `tip`: the end bends through the centreline point itself. Only a junction
 *   of three or more walls does that; two walls meet on one straight line.
 */
export interface WallEnd {
  plus: M;
  minus: M;
  tip: boolean;
}

export interface WallEnds {
  start: WallEnd;
  end: WallEnd;
}

/**
 * The same tolerance the roof rule's "structure" uses for walls that share an
 * endpoint (`lint/rules/roofs.ts`). The Wall tool snaps onto an existing end
 * exactly, so anything further apart is two ends, not one.
 */
const SHARED_END = 1e-6;

/** Below this, two walls run along one line, and their ends meet square. */
const PARALLEL = 1e-9;

type Vec = readonly [number, number];

const unit = (wall: Segment): Vec => {
  const length = wallLength(wall);
  return [(wall.end[0] - wall.start[0]) / length, (wall.end[1] - wall.start[1]) / length];
};
const cross = (a: Vec, b: Vec): number => a[0] * b[1] - a[1] * b[0];
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1];
const near = (a: Plan, b: Plan): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) < SHARED_END;

/**
 * The unit vector a wall's +across side faces, in plan space.
 *
 * A quarter turn from the wall's direction, `[-dz, dx]`: the side the mesh's
 * local +Z ends up on after `rotateY(wallAngle(wall))`, so a mesh, a collider and
 * a drawing built from `wallOutline` agree about which face is which.
 */
export function wallAcross(wall: Segment): Plan {
  const [dx, dz] = unit(wall);
  return [-dz, dx];
}

/** A point given in a wall's own frame, in plan space. */
export function wallPoint(wall: Segment, along: M, across: M): Plan {
  const [dx, dz] = unit(wall);
  return [wall.start[0] + dx * along - dz * across, wall.start[1] + dz * along + dx * across];
}

/** Both ends square: a wall that meets nothing. */
export function squareEnds(wall: Segment): WallEnds {
  const length = wallLength(wall);
  return { start: { plus: 0, minus: 0, tip: false }, end: { plus: length, minus: length, tip: false } };
}

/**
 * How a wall's ends meet the walls that share them, among `walls` (its level's).
 *
 * Each end is cut along the bisector of its corner, so two walls that share an
 * end close the corner with no notch outside and no overlap inside. The cut is
 * computed as the line through the two points where the walls' faces cross,
 * which is the bisector when the walls are equally thick and still closes the
 * corner when they are not.
 *
 * At a junction of three or more walls, each face meets the nearest wall on its
 * own side, and the end bends through the centreline point, so the walls tile
 * the junction like slices. A wall running straight on from another, or a face
 * whose mitre would run past the wall's other end, stays square.
 */
export function wallEnds(wall: Wall, walls: readonly Wall[]): WallEnds {
  const length = wallLength(wall);
  const ends = squareEnds(wall);
  if (length < SHARED_END) return ends;

  const d = unit(wall);
  const half = wall.thickness / 2;

  const endAt = (point: Plan, away: Vec): WallEnd | null => {
    // Every other wall with an end here, with the direction it leaves in and
    // its angle from this wall, turning toward this wall's left of `away`.
    const others: { away: Vec; half: number; angle: number }[] = [];
    for (const other of walls) {
      if (other === wall || other.id === wall.id || wallLength(other) < SHARED_END) continue;
      const o = unit(other);
      const leaves = near(other.start, point) ? o : near(other.end, point) ? ([-o[0], -o[1]] as const) : null;
      if (leaves === null) continue;
      let angle = Math.atan2(cross(away, leaves), dot(away, leaves));
      if (angle <= 0) angle += 2 * Math.PI;
      // Lying along this wall, back the way it came: not a corner.
      if (angle < PARALLEL || angle > 2 * Math.PI - PARALLEL) continue;
      others.push({ away: leaves, half: other.thickness / 2, angle });
    }
    if (others.length === 0) return null;

    const left = others.reduce((a, b) => (b.angle < a.angle ? b : a));
    const right = others.reduce((a, b) => (b.angle > a.angle ? b : a));

    // Distance from the shared point, along `away`, at which this wall's face
    // crosses the neighbour's facing face. Both sides reduce to one formula.
    const reach = (other: (typeof others)[number], side: 1 | -1): number => {
      const c = cross(away, other.away);
      if (Math.abs(c) < PARALLEL) return 0;
      return (side * (other.half + half * dot(away, other.away))) / c;
    };
    const tLeft = reach(left, 1);
    const tRight = reach(right, -1);
    if (Math.abs(tLeft) > length || Math.abs(tRight) > length) return null;

    // The centreline point is a vertex of the end unless it lies on the line
    // between the two face points, which it always does for two walls.
    const tip = left !== right && Math.abs(tLeft + tRight) > PARALLEL;
    return { plus: tLeft, minus: tRight, tip };
  };

  // At the start the wall leaves along `d`, and its left is +across; at the end
  // it leaves along `-d`, and its left is −across.
  const start = endAt(wall.start, d);
  const end = endAt(wall.end, [-d[0], -d[1]]);
  if (start !== null) ends.start = start;
  if (end !== null) ends.end = { plus: length - end.minus, minus: length - end.plus, tip: end.tip };

  // A wall too short for both its mitres: square, rather than inside out.
  if (ends.start.plus > ends.end.plus || ends.start.minus > ends.end.minus) return squareEnds(wall);
  return ends;
}

/**
 * The plan outline of a wall, or of the stretch of it from `from` to `to`, in
 * the wall's own frame as `[along, across]` points.
 *
 * Order: the +across face from start to end, the end (and its tip), the −across
 * face back, the start's tip.
 *
 * A stretch is the whole outline clipped square at `from` and `to`, as the edge
 * of an opening is. Clipped rather than rebuilt from four points, because a
 * mitre can reach past an opening's edge: at a 15° corner of 240 mm walls the
 * inside face stops 0.9 m short of the corner point, while the linter keeps an
 * opening only 250 mm from a wall's end. Four points would draw that stretch
 * as a bow tie.
 */
export function wallOutline(wall: Wall, ends: WallEnds, from = 0, to = wallLength(wall)): [M, M][] {
  const length = wallLength(wall);
  const half = wall.thickness / 2;
  let out: [M, M][] = [
    [ends.start.plus, half],
    [ends.end.plus, half],
  ];
  if (ends.end.tip) out.push([length, 0]);
  out.push([ends.end.minus, -half], [ends.start.minus, -half]);
  if (ends.start.tip) out.push([0, 0]);

  if (from > SHARED_END) out = clipAlong(out, from, 1);
  if (to < length - SHARED_END) out = clipAlong(out, to, -1);
  return out;
}

/**
 * Keep the part of an outline on one side of the line across the wall at
 * `along = at`: beyond it for `side` 1, short of it for −1. One pass of
 * Sutherland–Hodgman, which is exact here because the line is straight and the
 * outline has no holes.
 */
function clipAlong(outline: readonly (readonly [M, M])[], at: M, side: 1 | -1): [M, M][] {
  const out: [M, M][] = [];
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    const da = side * (a[0] - at);
    const db = side * (b[0] - at);
    if (da >= 0) out.push([a[0], a[1]]);
    // Strictly either side, so a point on the line is kept once, not twice.
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) out.push([at, a[1] + ((b[1] - a[1]) * da) / (da - db)]);
  });
  return out;
}
