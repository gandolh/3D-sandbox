import * as THREE from "three";
import type { ScatterInstance } from "./scatter.js";

/**
 * A baked angle atlas: one row of `angles` **square** views around the subject.
 *
 * Square is the load-bearing word. Each cell covers `max(sx, sy, sz)` metres in
 * both axes, centred on the bounding-box centre — so the subject is letterboxed
 * inside it and the consumer has to know that. See `buildImpostorGeometry`.
 */
export interface ImpostorAsset {
  /** The atlas, `angles * cell` wide by `cell` tall. */
  texture: THREE.Texture;
  angles: number;
  /** Subject size in metres, `[x, y, z]`, as baked. */
  size: readonly [number, number, number];
}

/**
 * Crossed quads, not camera-facing billboards.
 *
 * A billboard is view-dependent, and a path tracer cannot have that: rays arrive
 * from every direction at once, so there is no "the camera" to face. Two planes
 * crossed at right angles are view-*independent*, cost four triangles, and go
 * through the path tracer with no special handling at all — the material is an
 * ordinary alpha-tested map.
 *
 * The two planes do not show the same picture. The plane whose normal runs along
 * +X takes the atlas slice 90° round from the one facing +Z, which is what the
 * atlas was baked for, and is the difference between a cross-tree that reads as
 * a tree and one that reads as two photographs stapled together.
 */
export function buildImpostorGeometry(
  instances: readonly ScatterInstance[],
  impostor: ImpostorAsset,
  height: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const [sx, sy, sz] = impostor.size;

  // What one atlas cell actually contains. `assets/bake/impostor.js` sets
  // `half = max(sx, sy, sz) / 2` and renders an orthographic frustum of ±half
  // in **both** axes, so every cell is a square `S × S` metres centred on the
  // bounding-box centre — never a tight crop of the subject.
  //
  // The quad used to be built from `max(sx, sz) / sy`, which is the subject's
  // own aspect, and those two are the same thing only when the subject is
  // exactly as wide as it is tall. For `tree_small_02` that drew every tree in
  // the forest 5.8 % too narrow. Off that near-cubic case it falls apart: a
  // shrub baked at [6, 2, 6] gives S = 6 and an aspect of 3.0, so the quad was
  // 2 m tall by 6 m wide while the subject occupied only v ∈ [⅓, ⅔] of the
  // cell — two thirds of a metre tall, hovering above the ground, with empty
  // atlas above and below it.
  const cell = Math.max(sx, sy, sz);

  // Widest the silhouette can be from any angle in the row, so a quad never
  // clips the subject at the angles between the two extremes.
  const width = Math.max(sx, sz);

  // Rather than draw the whole square cell and let the empty parts alpha-test
  // away — which works, but puts geometry below the terrain for anything
  // wider than it is tall — the quad is the subject's own box and the UVs name
  // the sub-rectangle of the cell it occupies. Same picture, no waste, and the
  // base lands on y = 0 by construction rather than by luck.
  const uInset = cell === 0 ? 0 : (1 - width / cell) / 2;
  const v0 = cell === 0 ? 0 : 0.5 - sy / cell / 2;
  const v1 = cell === 0 ? 1 : 0.5 + sy / cell / 2;

  // `height` is the field's nominal instance height, so the subject's own
  // height is what maps to it.
  const aspect = sy === 0 ? 1 : width / sy;

  const slice = (degrees: number): number => {
    const step = 360 / impostor.angles;
    return ((Math.round(degrees / step) % impostor.angles) + impostor.angles) % impostor.angles;
  };

  for (const instance of instances) {
    const h = height * instance.scale;
    const w = h * aspect;
    const [x, , z] = instance.position;

    // The quad the trunk stands in the middle of: half a width either side, base
    // on the ground. Scatter positions are ground points, not centres.
    for (const plane of [0, 90]) {
      const uIndex = slice(instance.rotationY + plane);
      const cellU0 = uIndex / impostor.angles;
      const cellU1 = (uIndex + 1) / impostor.angles;
      const u0 = cellU0 + (cellU1 - cellU0) * uInset;
      const u1 = cellU1 - (cellU1 - cellU0) * uInset;

      const angle = THREE.MathUtils.degToRad(instance.rotationY + plane);
      const dx = Math.cos(angle);
      const dz = -Math.sin(angle);

      const corners: [number, number, number][] = [
        [x - (dx * w) / 2, 0, z - (dz * w) / 2],
        [x + (dx * w) / 2, 0, z + (dz * w) / 2],
        [x + (dx * w) / 2, h, z + (dz * w) / 2],
        [x - (dx * w) / 2, h, z - (dz * w) / 2],
      ];
      const uv: [number, number][] = [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ];

      // Normal perpendicular to the plane, so ambient light reads sensibly. It
      // is a lie either way — the geometry is flat and the subject is not — but
      // a consistent lie shades better than a random one.
      const nx = Math.sin(angle);
      const nz = Math.cos(angle);

      for (const corner of [0, 1, 2, 0, 2, 3]) {
        positions.push(...corners[corner]!);
        normals.push(nx, 0, nz);
        uvs.push(...uv[corner]!);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

/**
 * The material an impostor wants.
 *
 * `alphaTest` rather than `transparent`: blended transparency is order-dependent,
 * and a forest is thousands of overlapping quads with no correct order. The path
 * tracer samples `alphaTest` natively, so the render and the viewport agree.
 */
export function impostorMaterial(impostor: ImpostorAsset): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: impostor.texture,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
  });
}
