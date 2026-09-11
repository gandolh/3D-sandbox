import * as THREE from "three";

/**
 * Guarantee every geometry carries the same attribute set.
 *
 * `three-gpu-pathtracer` merges the whole scene into one buffer, so a mesh
 * missing `uv` while its neighbour has one is not a cosmetic difference — the
 * merge indexes past the end of the shorter array and fails somewhere far from
 * the cause. three's own primitives all ship position, normal and uv; the
 * geometry this package builds by hand did not.
 *
 * UVs are zero-filled where they carry no meaning. Materials have no texture
 * maps yet, and a wrong-but-present UV is what the merge needs; a meaningful one
 * is a problem for whenever textures land.
 */
export function ensureStandardAttributes(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  if (position === undefined) return geometry;

  if (geometry.getAttribute("normal") === undefined) geometry.computeVertexNormals();
  if (geometry.getAttribute("uv") === undefined) {
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(position.count * 2), 2));
  }
  return geometry;
}

/** The attributes every geometry leaving this package must have. */
export const REQUIRED_ATTRIBUTES = ["position", "normal", "uv"] as const;

export const hasStandardAttributes = (geometry: THREE.BufferGeometry): boolean =>
  REQUIRED_ATTRIBUTES.every((name) => geometry.getAttribute(name) !== undefined);
