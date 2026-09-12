import * as THREE from "three";
import { bounds, degToRad, type BuildingMass, type RoadNetwork } from "@solstice/schema";
import { extrudePolygon } from "../polygon.js";
import { mergeSimple } from "./scatter.js";
import { ensureStandardAttributes } from "../attributes.js";

/**
 * A neighbouring building: an extruded footprint, with a crude prism on top when
 * it is pitched. Context geometry is never edited, so it is modelled as cheaply
 * as it can be while still reading as a house at a distance.
 */
export function buildMass(mass: BuildingMass): THREE.BufferGeometry {
  const walls = extrudePolygon(mass.footprint, 0, mass.height);
  if (mass.roofKind === "flat" || mass.pitch <= 0) return walls;

  const b = bounds(mass.footprint);
  const width = b.maxX - b.minX;
  const depth = b.maxZ - b.minZ;
  // Same rule as `subject/roofs.ts`: declared bearing wins, and the long-axis
  // guess is only a fallback. It has to be the same rule — a neighbour and the
  // house it abuts are the same roofline.
  const ridgeAlongZ =
    mass.ridgeBearing === undefined ? depth >= width : mass.ridgeBearing % 180 === 0;
  const span = ridgeAlongZ ? width : depth;
  const rise = (span / 2) * Math.tan(degToRad(mass.pitch));
  const base = mass.height;
  const apex = base + rise;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  const positions: number[] = [];
  const push = (x: number, y: number, z: number) => positions.push(x, y, z);
  const quad = (a: number[], c: number[], d: number[], e: number[]) => {
    push(a[0]!, a[1]!, a[2]!); push(c[0]!, c[1]!, c[2]!); push(d[0]!, d[1]!, d[2]!);
    push(a[0]!, a[1]!, a[2]!); push(d[0]!, d[1]!, d[2]!); push(e[0]!, e[1]!, e[2]!);
  };

  // Gable ends are filled in as well as the slopes. Without them the extruded
  // walls stop at `height` and you see straight through the triangle under the
  // ridge — cheap context geometry is fine, see-through context geometry is not.
  const tri = (a: number[], c: number[], d: number[]) => {
    push(a[0]!, a[1]!, a[2]!); push(c[0]!, c[1]!, c[2]!); push(d[0]!, d[1]!, d[2]!);
  };

  if (ridgeAlongZ) {
    quad([b.minX, base, b.minZ], [b.minX, base, b.maxZ], [cx, apex, b.maxZ], [cx, apex, b.minZ]);
    quad([b.maxX, base, b.maxZ], [b.maxX, base, b.minZ], [cx, apex, b.minZ], [cx, apex, b.maxZ]);
    tri([b.minX, base, b.minZ], [cx, apex, b.minZ], [b.maxX, base, b.minZ]);
    tri([b.maxX, base, b.maxZ], [cx, apex, b.maxZ], [b.minX, base, b.maxZ]);
  } else {
    // Same reversed winding as `subject/roofs.ts` had, and the same fix: eave →
    // ridge → ridge → eave. It never showed before because no context mass had
    // a way to ask for this branch until `ridgeBearing` was added.
    quad([b.minX, base, b.minZ], [b.minX, apex, cz], [b.maxX, apex, cz], [b.maxX, base, b.minZ]);
    quad([b.maxX, base, b.maxZ], [b.maxX, apex, cz], [b.minX, apex, cz], [b.minX, base, b.maxZ]);
    tri([b.minX, base, b.maxZ], [b.minX, apex, cz], [b.minX, base, b.minZ]);
    tri([b.maxX, base, b.minZ], [b.maxX, apex, cz], [b.maxX, base, b.maxZ]);
  }

  const roof = new THREE.BufferGeometry();
  roof.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  roof.computeVertexNormals();
  ensureStandardAttributes(roof);

  const merged = mergeSimple([walls, roof]);
  walls.dispose();
  roof.dispose();
  return merged;
}

/** A flat ribbon along the road centreline, laid just above the terrain. */
export function buildRoad(road: RoadNetwork): THREE.BufferGeometry {
  const half = road.width / 2;
  const positions: number[] = [];
  const y = 0.02; // clear of z-fighting with the ground plane

  for (let i = 0; i < road.path.length - 1; i++) {
    const a = road.path[i]!;
    const b = road.path[i + 1]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * half;
    const nz = (dx / len) * half;

    const a1 = [a[0] + nx, y, a[1] + nz];
    const a2 = [a[0] - nx, y, a[1] - nz];
    const b1 = [b[0] + nx, y, b[1] + nz];
    const b2 = [b[0] - nx, y, b[1] - nz];

    // Wound so the ribbon faces the sky. `n` is the left perpendicular of the
    // travel direction, which fixes the handedness: a1 → b2 → a2 and a1 → b1 →
    // b2 both cross to +Y for a segment running any direction. Reversed — which
    // is how this shipped — `computeVertexNormals` derives (0, −1, 0) from the
    // winding and every road in every scene renders pure black.
    positions.push(...a1, ...b2, ...a2);
    positions.push(...a1, ...b1, ...b2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return ensureStandardAttributes(geometry);
}
