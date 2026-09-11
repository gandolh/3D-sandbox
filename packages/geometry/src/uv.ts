import * as THREE from "three";

/**
 * Replace a geometry's UVs with a world-space box projection, in metres.
 *
 * Every primitive here is built from `BoxGeometry`, extrusions and planes, all
 * of which carry 0–1 UVs across each face whatever its size. With a real texture
 * that means one brick stretched across a 6.4 m wall and the same brick squeezed
 * onto a 0.9 m pier — the surfaces would not match, and nothing in the document
 * would explain why.
 *
 * Projecting from world position instead ties texture scale to *metres*, so a
 * material tiles identically everywhere it appears. `tile` is how many metres
 * one repeat covers.
 *
 * The projection axis is chosen per triangle from its dominant normal, which is
 * the standard box mapping: correct on anything roughly axis-aligned, which
 * walls, slabs, roofs and hedges all are, and gracefully wrong on a sloped roof
 * rather than catastrophically wrong.
 */
export function boxProjectUv(geometry: THREE.BufferGeometry, tile: number): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  if (position === undefined || normal === undefined || tile <= 0) return geometry;

  const source = geometry.index === null ? geometry : geometry.toNonIndexed();
  const p = source.getAttribute("position");
  const n = source.getAttribute("normal");
  const uvs = new Float32Array(p.count * 2);

  for (let i = 0; i < p.count; i += 3) {
    // One axis for the whole triangle, from the face's average normal. Choosing
    // per *vertex* would split a triangle across two projections and tear the
    // texture down its middle.
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let k = 0; k < 3; k++) {
      nx += n.getX(i + k);
      ny += n.getY(i + k);
      nz += n.getZ(i + k);
    }
    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);

    for (let k = 0; k < 3; k++) {
      const x = p.getX(i + k);
      const y = p.getY(i + k);
      const z = p.getZ(i + k);
      let u: number;
      let v: number;
      if (ay >= ax && ay >= az) {
        u = x;
        v = z;
      } else if (ax >= az) {
        u = z;
        v = y;
      } else {
        u = x;
        v = y;
      }
      uvs[(i + k) * 2] = u / tile;
      uvs[(i + k) * 2 + 1] = v / tile;
    }
  }

  source.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  if (source !== geometry) {
    geometry.dispose();
    return source;
  }
  return geometry;
}
