import * as THREE from "three";
import { scatterInstances, type ScatterField, type ScatterInstance } from "@solstice/schema";
import { ensureStandardAttributes } from "../attributes.js";

// The placement half of this module moved to `@solstice/schema/derive`: it is
// pure arithmetic over the document, and the linter has to reproduce it exactly
// to count a row planting. What stays here is the half that needs `three`.
export { scatterInstances };
export type { ScatterInstance };

/**
 * Placeholder vegetation: a cone on a cylinder, at the planting's own height.
 *
 * Deliberately crude. The asset manifest does not exist yet, and a proxy that
 * looked plausible would be mistaken for the real thing in a screenshot — which
 * is exactly how a placeholder survives to production.
 *
 * It does have to be the right *size*, though. A single fixed proxy made a bed
 * of roses into six-metre cones towering over the house, which is not a
 * placeholder being honest about being a placeholder — it is a scene that
 * cannot be composed.
 */
export function proxyTreeGeometry(height = 6): THREE.BufferGeometry {
  // A third trunk, two thirds crown, and a crown as wide as it is roughly half
  // tall — the proportions read as "shrub" or "tree" purely from the height.
  const trunkHeight = height / 3;
  const crownHeight = height - trunkHeight;
  const radius = crownHeight * 0.36;

  const trunk = new THREE.CylinderGeometry(height * 0.03, height * 0.04, trunkHeight, 6);
  trunk.translate(0, trunkHeight / 2, 0);
  const canopy = new THREE.ConeGeometry(radius, crownHeight, 7);
  canopy.translate(0, trunkHeight + crownHeight / 2, 0);

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
  /** Placed instances, when the caller has already computed or filtered them. */
  only?: readonly ScatterInstance[],
): { mesh: THREE.InstancedMesh; instances: readonly ScatterInstance[] } {
  const instances = only ?? scatterInstances(field);
  const geometry = proxyTreeGeometry(field.height);
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
