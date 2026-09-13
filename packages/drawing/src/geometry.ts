import { wallAngle, wallLength, type Opening, type Wall } from "@solstice/schema";

/** A point on the sheet, in millimetres from the top-left. */
export type Pt = readonly [number, number];

/**
 * Plan space is XZ with +Z north; a sheet is XY with +Y **down**.
 *
 * So north has to end up pointing *up* the page, which means negating Z. Miss
 * this and the drawing is a mirror of the building — the failure that looks
 * plausible from every angle until someone builds from it.
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
  // Negated, and measured from the bottom: +Z is north and north is up.
  sheet.height - sheet.margin - (z - sheet.originZ) * sheet.mmPerM,
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
  /** Unit vector along the wall, and its left perpendicular. */
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
    normal: [-dz, dx],
    halfThickness: wall.thickness / 2,
  };
}

/** Does the section plane pass through this opening? */
export const cutsThrough = (opening: Opening, cut: number): boolean =>
  opening.sill < cut && opening.sill + opening.height > cut;

export const wallSpan = (wall: Wall): number => wallLength(wall);
