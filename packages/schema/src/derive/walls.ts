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
 * The direction a wall runs, in **degrees clockwise from +Z**, which the scene
 * calls north.
 *
 * A second angle for the same line, and deliberately so: `wallAngle` is a
 * three.js Y rotation in radians for putting geometry in the right place, and
 * this is a compass bearing in degrees for showing a person. Note that the two
 * are not the same convention — `atan2(dx, dz)` here versus `atan2(-dz, dx)`
 * there — which is exactly why both belong in one file where the difference is
 * visible, rather than in three files where it is not.
 *
 * There were three copies: one in `geometry`, one in the web app's entity
 * helpers, and the inspector importing the app's. The `northOffset` question —
 * whether this compass turns the way a real one does — is still open; see
 * `corpus/wiki/open-questions.md`. It is now open in one place.
 */
export function wallBearing(wall: Segment): number {
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  return ((Math.atan2(x2 - x1, z2 - z1) * 180) / Math.PI + 360) % 360;
}
