import * as THREE from "three";

/**
 * The facing guard, in one place.
 *
 * Three separate bugs in this repo have been the same bug: a hand-wound
 * triangle wound backwards. `computeVertexNormals` derives a normal from the
 * winding, so backwards winding means a surface lit from the wrong side — a
 * roof lit from inside the attic, a road lit from underground, both rendering
 * pure black. The suite never caught one because it asserted bounding boxes,
 * and **a bounding box is identical whether a surface faces the sky or the
 * ground**.
 *
 * So these read the *positions*, not the normal attribute. Winding is the
 * thing that was wrong; a normal attribute is downstream of it, and for
 * geometry that authors its own normals the two can disagree — which is its
 * own finding, and `normalsMatchWinding` is for that.
 */

/** One entry per triangle: its geometric normal and its centroid. */
export interface Face {
  normal: THREE.Vector3;
  centroid: THREE.Vector3;
  /** The averaged normal attribute, when the geometry carries one. */
  declared: THREE.Vector3 | null;
}

export function faces(geometry: THREE.BufferGeometry): Face[] {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined;
  const index = geometry.index;
  const count = index === null ? position.count : index.count;

  const out: Face[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();

  for (let t = 0; t < count / 3; t++) {
    const at = (k: number) => (index === null ? t * 3 + k : index.getX(t * 3 + k));
    const [i0, i1, i2] = [at(0), at(1), at(2)];
    a.fromBufferAttribute(position, i0);
    b.fromBufferAttribute(position, i1);
    c.fromBufferAttribute(position, i2);

    const normalOf = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    // A degenerate triangle has no facing to assert. Skipped rather than
    // normalised into a NaN that quietly passes every comparison.
    if (normalOf.lengthSq() < 1e-18) continue;

    out.push({
      normal: normalOf.normalize(),
      centroid: new THREE.Vector3()
        .add(a)
        .add(b)
        .add(c)
        .multiplyScalar(1 / 3),
      declared:
        normal === undefined
          ? null
          : new THREE.Vector3(
              (normal.getX(i0) + normal.getX(i1) + normal.getX(i2)) / 3,
              (normal.getY(i0) + normal.getY(i1) + normal.getY(i2)) / 3,
              (normal.getZ(i0) + normal.getZ(i1) + normal.getZ(i2)) / 3,
            ),
    });
  }
  return out;
}

/**
 * Triangles of an open horizontal surface that face the ground.
 *
 * For a ribbon laid on the terrain — a road, a path — every triangle must face
 * up. Returns the offenders, so a failure names how many and how far over.
 */
export function downwardFaces(geometry: THREE.BufferGeometry): number[] {
  return faces(geometry)
    .map((f) => f.normal.y)
    .filter((ny) => ny <= 0);
}

/**
 * Triangles of a closed convex solid that face its own middle.
 *
 * Compared against the bounding-box centre rather than a true centroid, and
 * only sound for convex shapes — which is every solid this package winds by
 * hand: extruded rectangles, gabled masses, posts and rails. An inverted face
 * points at the middle instead of away from it, and this is what says so.
 *
 * Per triangle, never averaged: a summed volume or a mean normal lets one
 * inverted face hide behind fifty correct ones, which is precisely how the
 * gable bug survived.
 */
export function inwardFaces(geometry: THREE.BufferGeometry): number[] {
  geometry.computeBoundingBox();
  const centre = new THREE.Vector3();
  geometry.boundingBox?.getCenter(centre);

  const out: number[] = [];
  for (const [i, face] of faces(geometry).entries()) {
    const outward = new THREE.Vector3().subVectors(face.centroid, centre);
    // A face through the middle has no side to be on; nothing to assert.
    if (outward.lengthSq() < 1e-12) continue;
    if (face.normal.dot(outward.normalize()) <= 0) out.push(i);
  }
  return out;
}

/**
 * Triangles whose authored normal disagrees with their winding.
 *
 * Only geometry that sets `normal` itself can fail this — impostor quads are
 * the one case. Everything else derives normals from winding via
 * `computeVertexNormals`, where agreement is definitional.
 */
export function normalsAgainstWinding(geometry: THREE.BufferGeometry): number[] {
  const out: number[] = [];
  for (const [i, face] of faces(geometry).entries()) {
    if (face.declared === null) continue;
    if (face.declared.lengthSq() < 1e-12) continue;
    if (face.normal.dot(face.declared.clone().normalize()) <= 0) out.push(i);
  }
  return out;
}

/**
 * The pitched faces of a roof, and nothing else.
 *
 * Bounded at both ends on purpose: below 0.1 are the vertical faces (gable
 * ends, and a mass's extruded walls), above 0.95 the horizontal ones (a mass's
 * floor and ceiling caps, which come along because `buildMass` merges walls and
 * roof into one geometry). Averaging without the upper bound reads a correct
 * roof as half wrong, because a downward cap cancels a slope.
 */
export function slopes(geometry: THREE.BufferGeometry): number[] {
  return faces(geometry)
    .map((f) => f.normal.y)
    .filter((ny) => Math.abs(ny) >= 0.1 && Math.abs(ny) <= 0.95);
}
