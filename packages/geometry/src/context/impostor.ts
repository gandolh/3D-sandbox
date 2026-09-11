import * as THREE from "three";
import type { ScatterInstance } from "./scatter.js";

/** A baked angle atlas: one row of `angles` square views around the subject. */
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

  const baked = impostor.size[1];
  const aspect = baked === 0 ? 1 : Math.max(impostor.size[0], impostor.size[2]) / baked;

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
      const u0 = uIndex / impostor.angles;
      const u1 = (uIndex + 1) / impostor.angles;

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
        [u0, 0],
        [u1, 0],
        [u1, 1],
        [u0, 1],
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
