import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { prepareAsset, type AssetGeometry, type AssetSource, type ImpostorAsset } from "@solstice/geometry";

/**
 * Loads the glTF the manifest knows about, once, into an `AssetSource`.
 *
 * The index comes from the dev server rather than a committed file, because the
 * downloads themselves are gitignored — 17 assets are 135 MB — and an index of
 * files that are not there would be wrong on every fresh clone.
 *
 * Every failure resolves to "no asset", never to a throw. A production build has
 * no `/assets-src` at all, and the correct behaviour there is the proxy, not a
 * blank viewport.
 */
export async function loadAssets(signal?: AbortSignal): Promise<AssetSource> {
  const entries = new Map<string, AssetGeometry>();
  const impostors = new Map<string, ImpostorAsset>();

  let index: {
    models?: { id: string; path: string }[];
    impostors?: { id: string; atlas: string; meta: string }[];
  };
  try {
    const response = await fetch("/assets-src/index.json", signal === undefined ? {} : { signal });
    if (!response.ok) return source(entries, impostors);
    index = (await response.json()) as typeof index;
  } catch {
    return source(entries, impostors);
  }

  const loader = new GLTFLoader();
  await Promise.all(
    (index.models ?? []).map(async (model) => {
      try {
        const gltf = await loader.loadAsync(`/assets-src/${model.path}`);
        const prepared = prepareAsset(gltf.scene);
        // A glTF that parses but carries no mesh is not an asset; letting it in
        // would replace a visible proxy with nothing at all.
        if (prepared.triangles > 0) entries.set(model.id, prepared);
      } catch {
        // Left out, so the generator falls back to its proxy.
      }
    }),
  );

  const textures = new THREE.TextureLoader();
  await Promise.all(
    (index.impostors ?? []).map(async (entry) => {
      try {
        const meta = (await (await fetch(`/assets-src/${entry.meta}`)).json()) as {
          angles: number;
          size: [number, number, number];
        };
        const texture = await textures.loadAsync(`/assets-src/${entry.atlas}`);
        texture.colorSpace = THREE.SRGBColorSpace;
        // The atlas is a strip of discrete views; filtering across a slice
        // boundary would bleed one angle into the next, and mipmaps would do it
        // worse at distance, which is exactly where impostors are used.
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        impostors.set(entry.id, { texture, angles: meta.angles, size: meta.size });
      } catch {
        // Left out, so scatter falls back to the proxy cone.
      }
    }),
  );

  return source(entries, impostors);
}

function source(
  entries: ReadonlyMap<string, AssetGeometry>,
  impostors: ReadonlyMap<string, ImpostorAsset>,
): AssetSource {
  return {
    get: (id) => entries.get(id),
    impostor: (id) => impostors.get(id),
  };
}

/** Sizes for the physics world, in the shape `deriveColliders` wants. */
export function sizesFrom(assets: AssetSource, ids: readonly string[]) {
  const table = new Map<string, readonly [number, number, number]>();
  for (const id of ids) {
    const asset = assets.get(id);
    if (asset !== undefined) table.set(id, asset.size);
  }
  return { get: (id: string) => table.get(id) };
}
