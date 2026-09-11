import * as THREE from "three";
import { area, bounds, type ScatterField } from "@solstice/schema";
import { mulberry32, pick, randomBetween } from "../random.js";
import { pointInPolygon } from "../polygon.js";
import { ensureStandardAttributes } from "../attributes.js";

export interface ScatterInstance {
  asset: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

/**
 * Rejection-sample points inside the field's polygon, minus its exclusions.
 *
 * Deterministic in the field's seed — the same document must yield the same
 * forest everywhere, or a render is not reproducible from its scene file.
 */
export function scatterInstances(field: ScatterField): ScatterInstance[] {
  const net = Math.max(
    0,
    area(field.area) - field.exclude.reduce((sum, poly) => sum + area(poly), 0),
  );
  const target = Math.round((net / 100) * field.density);
  if (target === 0) return [];

  const b = bounds(field.area);
  const rng = mulberry32(field.seed);
  const out: ScatterInstance[] = [];

  // Bounded so a pathological polygon cannot spin forever; a field that cannot
  // hit its target simply produces fewer instances.
  const maxAttempts = target * 40 + 1000;
  let attempts = 0;

  while (out.length < target && attempts < maxAttempts) {
    attempts++;
    const x = randomBetween(rng, b.minX, b.maxX);
    const z = randomBetween(rng, b.minZ, b.maxZ);
    if (!pointInPolygon([x, z], field.area)) continue;
    if (field.exclude.some((poly) => pointInPolygon([x, z], poly))) continue;

    out.push({
      asset: pick(rng, field.assets),
      position: [x, 0, z],
      rotationY: rng() * 360,
      scale: randomBetween(rng, field.scaleRange[0], field.scaleRange[1]),
    });
  }

  return out;
}

/**
 * Placeholder vegetation: a cone on a cylinder.
 *
 * Deliberately crude. The asset manifest does not exist yet, and a proxy that
 * looked plausible would be mistaken for the real thing in a screenshot — which
 * is exactly how a placeholder survives to production.
 */
export function proxyTreeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.18, 0.24, 2.2, 6);
  trunk.translate(0, 1.1, 0);
  const canopy = new THREE.ConeGeometry(1.6, 4.4, 7);
  canopy.translate(0, 4.4, 0);

  const merged = mergeSimple([trunk, canopy]);
  trunk.dispose();
  canopy.dispose();
  return merged;
}

/** Minimal non-indexed merge — enough for proxies, no BufferGeometryUtils import. */
export function mergeSimple(geometries: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const g of geometries) {
    const src = g.index === null ? g : g.toNonIndexed();
    const p = src.getAttribute("position");
    const n = src.getAttribute("normal");
    const t = src.getAttribute("uv");
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n !== undefined) normals.push(n.getX(i), n.getY(i), n.getZ(i));
      uvs.push(t === undefined ? 0 : t.getX(i), t === undefined ? 0 : t.getY(i));
    }
    if (src !== g) src.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length === positions.length) {
    out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  }
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return ensureStandardAttributes(out);
}

/** One `InstancedMesh` per field. Instancing is the whole point of the tier. */
export function buildScatterMesh(
  field: ScatterField,
  material: THREE.Material,
): { mesh: THREE.InstancedMesh; instances: ScatterInstance[] } {
  const instances = scatterInstances(field);
  const geometry = proxyTreeGeometry();
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, instances.length));
  mesh.name = `scatter:${field.id}`;
  mesh.count = instances.length;

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const position = new THREE.Vector3();

  instances.forEach((instance, i) => {
    position.set(...instance.position);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(instance.rotationY));
    scale.setScalar(instance.scale);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;

  return { mesh, instances };
}
