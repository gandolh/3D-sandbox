import * as THREE from "three";
import type { Material, SceneDocument } from "@solstice/schema";
import type { MaterialMaps, MaterialSource } from "./assets.js";

/**
 * Materials are resolved to flat `MeshStandardMaterial`s using the document's
 * declared base colour and roughness. Texture maps are not loaded — the asset
 * manifest does not exist yet — so a `polyhaven` source resolves to a neutral
 * stand-in rather than its real surface.
 */
const FALLBACK_COLOUR = "#9A958C";

export type MaterialTable = Map<string, THREE.MeshStandardMaterial>;

export function buildMaterials(doc: SceneDocument, maps?: MaterialSource): MaterialTable {
  const table: MaterialTable = new Map();
  for (const [id, definition] of Object.entries(doc.materials)) {
    table.set(id, toThreeMaterial(id, definition, maps?.maps(id)));
  }
  return table;
}

function toThreeMaterial(
  id: string,
  definition: Material,
  loaded: MaterialMaps | undefined,
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    // Kept even with a map: `baseColor` tints it, and it is what the surface
    // falls back to on a machine with nothing downloaded.
    color: new THREE.Color(loaded?.map === undefined ? definition.baseColor ?? FALLBACK_COLOUR : "#ffffff"),
    roughness: definition.roughness ?? 0.85,
    metalness: definition.metalness ?? 0,
  });
  if (loaded !== undefined) {
    if (loaded.map !== undefined) material.map = loaded.map;
    if (loaded.normalMap !== undefined) material.normalMap = loaded.normalMap;
    if (loaded.roughnessMap !== undefined) material.roughnessMap = loaded.roughnessMap;
    if (loaded.metalnessMap !== undefined) material.metalnessMap = loaded.metalnessMap;
    if (loaded.aoMap !== undefined) material.aoMap = loaded.aoMap;
  }
  material.name = id;
  return material;
}

/** Never throws — the linter already guarantees refs resolve on a loaded document. */
export function resolveMaterial(table: MaterialTable, id: string): THREE.MeshStandardMaterial {
  const found = table.get(id);
  if (found !== undefined) return found;
  const fallback = new THREE.MeshStandardMaterial({ color: new THREE.Color(FALLBACK_COLOUR) });
  fallback.name = `missing:${id}`;
  table.set(id, fallback);
  return fallback;
}
