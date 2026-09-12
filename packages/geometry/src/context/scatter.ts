import * as THREE from "three";
import {
  bounds,
  estimateScatterInstances,
  scatterLattice,
  type ScatterField,
} from "@solstice/schema";
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
  if (field.arrangement === "rows") return rowInstances(field);

  // Asked for rather than restated. The linter quotes this number to say the
  // render will fit in the triangle budget and the API quotes it to say how big
  // the scene is; a generator that computed its own would eventually make both
  // of them wrong at once, which is the failure mode with no symptom.
  const target = estimateScatterInstances(field).instances;
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
 * Instances on a lattice — an orchard, a vineyard, a nursery bed.
 *
 * The lattice is not jittered; the *position within its cell* is. Jittering the
 * lattice itself would drift the rows out of line down a long field, and rows
 * that are nearly-but-not-quite straight read as a mistake in a way that either
 * true rows or frank randomness does not.
 *
 * `density` is ignored here: the spacing sets the count. A row planting's whole
 * character is that a person decided how far apart to put the trees.
 */
function rowInstances(field: ScatterField): ScatterInstance[] {
  const lattice = scatterLattice(field);
  const rng = mulberry32(field.seed);
  const out: ScatterInstance[] = [];

  // A quarter of the spacing, so a tree never wanders into its neighbour's place.
  const jitterX = lattice.stepX / 4;
  const jitterZ = lattice.stepZ / 4;

  // Integer counts from the shared lattice, not `x += step` until it passes the
  // edge. Accumulating loses the last row to rounding, and at large coordinates
  // `x + step === x`, so the loop stops advancing without ever stopping.
  for (let iz = 0; iz < lattice.countZ; iz++) {
    const z = lattice.originZ + iz * lattice.stepZ;
    for (let ix = 0; ix < lattice.countX; ix++) {
      const x = lattice.originX + ix * lattice.stepX;
      const px = x + randomBetween(rng, -jitterX, jitterX);
      const pz = z + randomBetween(rng, -jitterZ, jitterZ);
      const rotation = rng() * 360;
      const scale = randomBetween(rng, field.scaleRange[0], field.scaleRange[1]);
      const asset = pick(rng, field.assets);

      // Drawn before the containment test on purpose: the random sequence must
      // depend only on the lattice, so editing the field's outline moves trees
      // in and out without reshuffling the ones that stay.
      if (!pointInPolygon([px, pz], field.area)) continue;
      if (field.exclude.some((poly) => pointInPolygon([px, pz], poly))) continue;

      out.push({ asset, position: [px, 0, pz], rotationY: rotation, scale });
    }
  }
  return out;
}

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
