import * as THREE from "three";
import type { ImpostorAsset } from "./context/impostor.js";

/**
 * One loaded asset, reduced to what the generator and the physics world need.
 *
 * Geometry in the asset's own space, with its base on y = 0 — the document
 * positions things by where they *sit*, so an asset whose origin is at its
 * centre would float or sink by half its height and every placement would need
 * a correction nobody wrote down.
 */
export interface AssetGeometry {
  geometry: THREE.BufferGeometry;
  triangles: number;
  /** Axis-aligned size in metres, `[x, y, z]`. */
  size: [number, number, number];
}

/**
 * Where loaded assets come from.
 *
 * An interface rather than a loader, because `generateScene` is pure CPU work
 * that runs in Node tests with no WebGL context and no network — which is the
 * only reason triangle counts and scatter determinism have real tests. The web
 * app supplies a glTF-backed implementation; tests supply a stub; and when
 * nothing is supplied, or an id is absent, the caller falls back to a proxy.
 */
export interface AssetSource {
  get(id: string): AssetGeometry | undefined;
  /**
   * A baked angle atlas, for assets too heavy to place as geometry.
   *
   * Separate from `get` because they are not alternatives at the same fidelity:
   * the subject tier wants the real mesh and the context tier cannot have it —
   * Poly Haven's trees are millions of triangles each. An asset may have one,
   * both, or neither.
   */
  impostor?(id: string): ImpostorAsset | undefined;
}

/** Sizes and grounds a loaded object, merging it into one geometry. */
export function prepareAsset(object: THREE.Object3D): AssetGeometry {
  object.updateWorldMatrix(true, true);

  const parts: THREE.BufferGeometry[] = [];
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh !== true || mesh.geometry === undefined) return;
    const clone = mesh.geometry.clone();
    clone.applyMatrix4(mesh.matrixWorld);
    parts.push(clone);
  });

  if (parts.length === 0) {
    return { geometry: new THREE.BufferGeometry(), triangles: 0, size: [0, 0, 0] };
  }

  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();

  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const size = new THREE.Vector3();
  box.getSize(size);

  // Centre in plan, base on the floor. A placement names where a thing stands.
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);

  const position = geometry.getAttribute("position");
  const triangles =
    position === undefined ? 0 : (geometry.index === null ? position.count : geometry.index.count) / 3;

  return { geometry, triangles, size: [size.x, size.y, size.z] };
}

/** Concatenate geometries, keeping only the attributes every one of them has. */
function mergeGeometries(parts: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const part of parts) {
    const src = part.index === null ? part : part.toNonIndexed();
    const p = src.getAttribute("position");
    const n = src.getAttribute("normal");
    const t = src.getAttribute("uv");
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n?.getX(i) ?? 0, n?.getY(i) ?? 1, n?.getZ(i) ?? 0);
      uvs.push(t?.getX(i) ?? 0, t?.getY(i) ?? 0);
    }
    if (src !== part) src.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return out;
}

/** An `AssetSource` over a plain map — what tests and caches both want. */
export function assetSourceFrom(entries: ReadonlyMap<string, AssetGeometry>): AssetSource {
  return { get: (id) => entries.get(id) };
}

/** The PBR maps a material can carry, once its texture set is downloaded. */
export interface MaterialMaps {
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  aoMap?: THREE.Texture;
}

/**
 * Where a material's textures come from, keyed by the document's material id.
 *
 * Separate from `AssetSource` because materials and models are downloaded,
 * named and versioned independently — a scene can have every texture and no
 * model, or the reverse, and both have to work.
 */
export interface MaterialSource {
  maps(materialId: string): MaterialMaps | undefined;
}
