import type { Opening, Wall } from "@solstice/schema";
import { cutsThrough, openingPlan, wallSpan } from "./geometry.js";

/** A plan point in world metres, `[x, z]`. */
export type WorldPt = readonly [number, number];

/**
 * The marks a plan makes, in world metres, before anything is projected.
 *
 * Two surfaces draw them: the 1:100 sheet (`planSvg`), which projects them onto
 * paper in millimetres, and the plan view in the web app, which projects them
 * onto the screen in pixels at whatever zoom the user is at. Keeping the
 * geometry here and the projection in each caller is what lets the two read as
 * the same drawing without either copying the other's arithmetic. Brief 75 pulled
 * these out of `plan.ts`; a test holds the sheet byte-identical to what it drew
 * before.
 */

/**
 * The solid stretches of a wall: everything the section cuts that is not a hole.
 *
 * Each piece is a rectangle, four corners in world space.
 */
export function wallSolids(wall: Wall, cut: number): [number, number][][] {
  const length = wallSpan(wall);
  const holes = wall.openings
    .filter((o) => cutsThrough(o, cut))
    .map((o) => [o.offset, o.offset + o.width] as const)
    .sort((a, b) => a[0] - b[0]);

  const spans: [number, number][] = [];
  let cursor = 0;
  for (const [from, to] of holes) {
    if (from > cursor) spans.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (cursor < length) spans.push([cursor, length]);

  return spans.map(([from, to]) => sliceCorners(wall, from, to));
}

/** A wall's plan rectangle between two distances along it. */
function sliceCorners(wall: Wall, from: number, to: number): [number, number][] {
  const plan = openingPlan(wall, { offset: from, width: to - from } as Opening);
  const [nx, nz] = plan.normal;
  const h = plan.halfThickness;
  const [ax, az] = plan.near;
  const [bx, bz] = plan.far;
  return [
    [ax + nx * h, az + nz * h],
    [bx + nx * h, bz + nz * h],
    [bx - nx * h, bz - nz * h],
    [ax - nx * h, az - nz * h],
  ];
}

/**
 * A door or a window as a plan draws it, in world space.
 *
 * - `hidden`: the plane does not pass through it — a threshold below the cut, a
 *   clerestory above it — so it is one dashed line along the wall.
 * - `window`: both reveals, and the glazing line between them.
 * - `door`: the two jambs, and a leaf standing at 90° from the hinge at the near
 *   jamb, on the wall's left (`normal`) side, with its swing back to `shut`.
 *
 * See `openingSymbol` in `plan.ts` for why each is drawn the way it is.
 */
export type OpeningMark =
  | { kind: "hidden"; from: WorldPt; to: WorldPt }
  | {
      kind: "window";
      reveals: readonly [readonly [WorldPt, WorldPt], readonly [WorldPt, WorldPt]];
      glazing: readonly [WorldPt, WorldPt];
    }
  | {
      kind: "door";
      jambs: readonly [readonly [WorldPt, WorldPt], readonly [WorldPt, WorldPt]];
      hinge: WorldPt;
      leaf: WorldPt;
      shut: WorldPt;
    };

export function openingMark(wall: Wall, opening: Opening, cut: number): OpeningMark {
  const plan = openingPlan(wall, opening);
  const [ax, az] = plan.near;
  const [bx, bz] = plan.far;
  const [nx, nz] = plan.normal;
  const h = plan.halfThickness;

  if (!cutsThrough(opening, cut)) return { kind: "hidden", from: [ax, az], to: [bx, bz] };

  if (opening.kind === "window") {
    return {
      kind: "window",
      reveals: [
        [
          [ax + nx * h, az + nz * h],
          [bx + nx * h, bz + nz * h],
        ],
        [
          [ax - nx * h, az - nz * h],
          [bx - nx * h, bz - nz * h],
        ],
      ],
      glazing: [
        [ax, az],
        [bx, bz],
      ],
    };
  }

  const w = opening.width;
  return {
    kind: "door",
    jambs: [
      [
        [ax + nx * h, az + nz * h],
        [ax - nx * h, az - nz * h],
      ],
      [
        [bx + nx * h, bz + nz * h],
        [bx - nx * h, bz - nz * h],
      ],
    ],
    hinge: [ax, az],
    leaf: [ax + nx * w, az + nz * w],
    shut: [bx, bz],
  };
}

/**
 * Which way round a swing arc goes, given its three points in a y-down space.
 *
 * The SVG `sweep-flag`, chosen by the sign of the cross product so the arc runs
 * from the open leaf round to the shut position rather than the long way about.
 * Sheet and screen are both y-down and neither mirrors the world, so one answer
 * serves both.
 */
export function sweepFlag(
  hinge: readonly [number, number],
  from: readonly [number, number],
  to: readonly [number, number],
): 0 | 1 {
  const cross = (from[0] - hinge[0]) * (to[1] - hinge[1]) - (from[1] - hinge[1]) * (to[0] - hinge[0]);
  return cross > 0 ? 1 : 0;
}
