import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  prepareAsset,
  type AssetGeometry,
  type AssetSource,
  type ImpostorAsset,
  type MaterialMaps,
  type MaterialSource,
} from "@solstice/geometry";
import type { SceneDocument } from "@solstice/schema";

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
export interface LoadedAssets {
  assets: AssetSource;
  /** Built per document, because material ids are the document's, not the library's. */
  materialsFor(doc: SceneDocument): MaterialSource;
}

export async function loadAssets(signal?: AbortSignal): Promise<LoadedAssets> {
  const entries = new Map<string, AssetGeometry>();
  const impostors = new Map<string, ImpostorAsset>();

  let index: {
    models?: { id: string; path: string }[];
    impostors?: { id: string; atlas: string; meta: string }[];
    materials?: { id: string; maps: Record<string, string> }[];
  };
  try {
    const response = await fetch("/assets-src/index.json", signal === undefined ? {} : { signal });
    if (!response.ok) return bundle(entries, impostors, new Map());
    index = (await response.json()) as typeof index;
  } catch {
    return bundle(entries, impostors, new Map());
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

  const libraryMaps = new Map<string, MaterialMaps>();
  await Promise.all(
    (index.materials ?? []).map(async (entry) => {
      const maps: MaterialMaps = {};
      await Promise.all(
        Object.entries(entry.maps).map(async ([role, path]) => {
          try {
            const texture = await textures.loadAsync(`/assets-src/${path}`);
            // Only the base colour is colour. Normal, roughness, metalness and
            // occlusion are data, and running them through sRGB decode makes
            // surfaces subtly, unexplainably wrong.
            texture.colorSpace = role === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            (maps as Record<string, THREE.Texture>)[role] = texture;
          } catch {
            // One missing map is not a missing material.
          }
        }),
      );
      if (Object.keys(maps).length > 0) libraryMaps.set(entry.id, maps);
    }),
  );

  return bundle(entries, impostors, libraryMaps);
}

function bundle(
  entries: ReadonlyMap<string, AssetGeometry>,
  impostors: ReadonlyMap<string, ImpostorAsset>,
  libraryMaps: ReadonlyMap<string, MaterialMaps>,
): LoadedAssets {
  return {
    assets: {
      get: (id) => entries.get(id),
      impostor: (id) => impostors.get(id),
    },
    // The document names materials by its own ids; the library names them
    // `<source>/<slug>`. This is the only place that knows both.
    materialsFor: (doc) => {
      const byMaterialId = new Map<string, MaterialMaps>();
      for (const [id, definition] of Object.entries(doc.materials)) {
        if (definition.slug === undefined || definition.source === "procedural") continue;
        const found = libraryMaps.get(`${definition.source}/${definition.slug}`);
        if (found !== undefined) byMaterialId.set(id, found);
      }
      return { maps: (id) => byMaterialId.get(id) };
    },
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
