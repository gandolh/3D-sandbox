import {
  type AssetGeometry,
  type AssetSource,
  type ImpostorAsset,
  type MaterialMaps,
  type MaterialSource,
  prepareAsset,
} from "@solstice/geometry";
import type { SceneDocument } from "@solstice/schema";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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
  /**
   * Every loaded model's size, by asset id — the whole library, not one
   * document's slice of it.
   *
   * The physics derivation skips any placement whose size it does not know, so
   * a table filtered to the first document's placements silently denied
   * colliders to everything a later scene placed and the first one did not.
   * The library knows all of them; let the document do its own selecting.
   */
  sizes: ReadonlyMap<string, readonly [number, number, number]>;
}

export async function loadAssets(signal?: AbortSignal): Promise<LoadedAssets> {
  const entries = new Map<string, AssetGeometry>();
  const impostors = new Map<string, ImpostorAsset>();

  /**
   * Stop, if the caller has stopped caring.
   *
   * The signal used to reach only `index.json`, so an unmount let all 273 MB
   * finish downloading, decoded every glTF and uploaded every texture — and
   * then the guarded `.then` discarded the lot with no handle to dispose it,
   * while the remount started the same download again. Checked between stages
   * because three's loaders take no signal of their own: it cannot cancel a
   * transfer in flight, but it can stop the next one and stop the work after.
   */
  const stopped = (): boolean => signal?.aborted === true;

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
      if (stopped()) return;
      try {
        const gltf = await loader.loadAsync(`/assets-src/${model.path}`);
        if (stopped()) return;
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
      if (stopped()) return;
      try {
        const meta = (await (
          await fetch(`/assets-src/${entry.meta}`, signal === undefined ? {} : { signal })
        ).json()) as {
          angles: number;
          size: [number, number, number];
        };
        if (stopped()) return;
        const texture = await textures.loadAsync(`/assets-src/${entry.atlas}`);
        if (stopped()) {
          texture.dispose();
          return;
        }
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
      if (stopped()) return;
      const maps: MaterialMaps = {};
      await Promise.all(
        textureGroups(entry.maps).map(async ({ path, colorSpace, roles }) => {
          if (stopped()) return;
          try {
            const texture = await textures.loadAsync(`/assets-src/${path}`);
            if (stopped()) {
              // Once, however many roles it was going to fill.
              texture.dispose();
              return;
            }
            texture.colorSpace = colorSpace;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            for (const role of roles) (maps as Record<string, THREE.Texture>)[role] = texture;
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

/**
 * A material's maps, grouped so that each file becomes **one** texture.
 *
 * Poly Haven packs occlusion, roughness and metalness into one `arm` image, and
 * the manifest maps all three roles to it — which is how three.js wants it, one
 * texture read through three channels. Loaded per role it became three
 * `Texture` objects for the same file: three decodes and three GPU uploads of
 * ~16 MB each, per material. (The browser coalesced the network request, so it
 * was never three downloads — measured, brief 69.)
 *
 * The key is the path **and the colour space**, not the path alone. Only the
 * base colour is colour; normal, roughness, metalness and occlusion are data,
 * and running them through sRGB decode makes surfaces subtly, unexplainably
 * wrong. Every ARM role is data, so today they share — but should a pattern
 * ever map one file to both `map` and a data role, the two get separate
 * textures rather than one of them silently taking the other's decode. Wrapping
 * is the same for every role, so it does not need to be in the key.
 *
 * Local rather than `THREE.Cache.enabled`: the cache is global and never
 * evicts, so it would hold every image ever loaded past any disposal, and it
 * dedupes the *bytes*, not the `Texture` — the uploads would still triple.
 */
export function textureGroups(
  maps: Readonly<Record<string, string>>,
): { path: string; colorSpace: THREE.ColorSpace; roles: string[] }[] {
  const groups = new Map<string, { path: string; colorSpace: THREE.ColorSpace; roles: string[] }>();
  for (const [role, path] of Object.entries(maps)) {
    const colorSpace = role === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    const key = `${colorSpace}\u0000${path}`;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { path, colorSpace, roles: [role] });
    else group.roles.push(role);
  }
  return [...groups.values()];
}

function bundle(
  entries: ReadonlyMap<string, AssetGeometry>,
  impostors: ReadonlyMap<string, ImpostorAsset>,
  libraryMaps: ReadonlyMap<string, MaterialMaps>,
): LoadedAssets {
  const sizes = new Map<string, readonly [number, number, number]>();
  for (const [id, asset] of entries) sizes.set(id, asset.size);

  return {
    assets: {
      get: (id) => entries.get(id),
      impostor: (id) => impostors.get(id),
    },
    sizes,
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
