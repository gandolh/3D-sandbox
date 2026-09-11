import * as THREE from "three";
import { bounds, degToRad, type Roof } from "@solstice/schema";
import { extrudePolygon } from "../polygon.js";

export class UnsupportedRoofError extends Error {
  constructor(kind: string) {
    super(
      `Roof kind "${kind}" is not implemented yet. Gable and flat are supported; ` +
        `hip lofting over a non-rectangular footprint is an open question.`,
    );
    this.name = "UnsupportedRoofError";
  }
}

/**
 * Flat roofs are a slab at eave height. Gable roofs are built from the
 * footprint's bounding box: two sloped planes meeting at a ridge, plus the two
 * triangular gable ends.
 *
 * Using the bounding box rather than the polygon itself is a deliberate
 * simplification — it is exact for the rectangular footprints the schema is
 * currently exercised with, and visibly wrong for anything else, which is the
 * right way for a placeholder to fail.
 */
export function buildRoof(roof: Roof): THREE.BufferGeometry {
  if (roof.kind === "flat") {
    return extrudePolygon(roof.footprint, roof.baseElevation, 0.25);
  }
  if (roof.kind === "hip") {
    throw new UnsupportedRoofError(roof.kind);
  }

  const b = bounds(roof.footprint);
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  // Ridge runs along the longer axis, unless the document says otherwise.
  const ridgeAlongZ = roof.ridgeBearing === undefined ? depth >= width : roof.ridgeBearing % 180 === 0;

  const span = ridgeAlongZ ? width : depth;
  const rise = (span / 2) * Math.tan(degToRad(roof.pitch));
  const base = roof.baseElevation;
  const apex = base + rise;

  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  // Eight corners: four eave, two ridge (doubled for the quad strips).
  const positions: number[] = [];
  const push = (x: number, y: number, z: number) => positions.push(x, y, z);
  const quad = (
    a: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    e: [number, number, number],
  ) => {
    push(...a); push(...c); push(...d);
    push(...a); push(...d); push(...e);
  };
  const tri = (
    a: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
  ) => {
    push(...a); push(...c); push(...d);
  };

  if (ridgeAlongZ) {
    const r1: [number, number, number] = [cx, apex, b.minZ];
    const r2: [number, number, number] = [cx, apex, b.maxZ];
    quad([b.minX, base, b.minZ], [b.minX, base, b.maxZ], r2, r1);
    quad([b.maxX, base, b.maxZ], [b.maxX, base, b.minZ], r1, r2);
    tri([b.minX, base, b.minZ], r1, [b.maxX, base, b.minZ]);
    tri([b.maxX, base, b.maxZ], r2, [b.minX, base, b.maxZ]);
  } else {
    const r1: [number, number, number] = [b.minX, apex, cz];
    const r2: [number, number, number] = [b.maxX, apex, cz];
    quad([b.minX, base, b.minZ], [b.maxX, base, b.minZ], r2, r1);
    quad([b.maxX, base, b.maxZ], [b.minX, base, b.maxZ], r1, r2);
    tri([b.minX, base, b.maxZ], r1, [b.minX, base, b.minZ]);
    tri([b.maxX, base, b.minZ], r2, [b.maxX, base, b.maxZ]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Ridge height above the eave, for inspectors and annotation overlays. */
export function roofRise(roof: Roof): number {
  if (roof.kind === "flat") return 0;
  const b = bounds(roof.footprint);
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  const ridgeAlongZ = roof.ridgeBearing === undefined ? depth >= width : roof.ridgeBearing % 180 === 0;
  const span = ridgeAlongZ ? width : depth;
  return (span / 2) * Math.tan(degToRad(roof.pitch));
}
