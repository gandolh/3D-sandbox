import { type Opening, type Wall, wallAngle, wallLength } from "@solstice/schema";

/** A point on the sheet, in millimetres from the top-left. */
export type Pt = readonly [number, number];

/**
 * Plan space is XZ with −Z north and +X east; a sheet is XY with +Y **down**.
 *
 * So the sheet is the plan seen from above: x maps to x, and z maps to y
 * unchanged, which puts north up the page. Negate either axis and the drawing
 * is a mirror of the building — the failure that looks plausible from every
 * angle until someone builds from it.
 *
 * Z was negated here until 2026-10-07, when north was +Z. That compass was
 * itself a mirror, and this was the line that hid it on paper.
 */
export interface Sheet {
  /** Millimetres on paper per metre in the world. */
  mmPerM: number;
  /** World point that lands at the sheet's origin. */
  originX: number;
  originZ: number;
  /** Sheet margin, mm. */
  margin: number;
  height: number;
}

export const project = (sheet: Sheet, x: number, z: number): Pt => [
  sheet.margin + (x - sheet.originX) * sheet.mmPerM,
  // Measured from the top, not negated: −Z is north and north is up.
  sheet.margin + (z - sheet.originZ) * sheet.mmPerM,
];

/** The four corners of a wall's plan rectangle, in world space. */
export function wallCorners(wall: Wall): [number, number][] {
  const angle = wallAngle(wall);
  // `wallAngle` rotates +X onto the wall, so the direction is (cos, −sin) and
  // the perpendicular is a quarter turn from it. Same convention as the mesh.
  const dx = Math.cos(angle);
  const dz = -Math.sin(angle);
  const half = wall.thickness / 2;
  const nx = -dz * half;
  const nz = dx * half;
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  return [
    [x1 + nx, z1 + nz],
    [x2 + nx, z2 + nz],
    [x2 - nx, z2 - nz],
    [x1 - nx, z1 - nz],
  ];
}

/** Where an opening sits along its wall, in world space. */
export interface OpeningPlan {
  opening: Opening;
  /** Centreline endpoints of the hole, on the wall's own line. */
  near: [number, number];
  far: [number, number];
  /** Unit vector along the wall, and its left perpendicular seen from above. */
  along: [number, number];
  normal: [number, number];
  halfThickness: number;
}

export function openingPlan(wall: Wall, opening: Opening): OpeningPlan {
  const angle = wallAngle(wall);
  const dx = Math.cos(angle);
  const dz = -Math.sin(angle);
  const [x1, z1] = wall.start;
  const at = (d: number): [number, number] => [x1 + dx * d, z1 + dz * d];
  return {
    opening,
    near: at(opening.offset),
    far: at(opening.offset + opening.width),
    along: [dx, dz],
    // Left as you walk along the wall, seen from above with north up. With −Z
    // north that is `[dz, -dx]`. It was `[-dz, dx]` while +Z was north: the
    // same side on paper both times.
    normal: [dz, -dx],
    halfThickness: wall.thickness / 2,
  };
}

/** Does the section plane pass through this opening? */
export const cutsThrough = (opening: Opening, cut: number): boolean =>
  opening.sill < cut && opening.sill + opening.height > cut;

export const wallSpan = (wall: Wall): number => wallLength(wall);
