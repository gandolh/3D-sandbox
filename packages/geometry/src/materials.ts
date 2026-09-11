import * as THREE from "three";
import type { Material, SceneDocument } from "@solstice/schema";

/**
 * Materials are resolved to flat `MeshStandardMaterial`s using the document's
 * declared base colour and roughness. Texture maps are not loaded — the asset
 * manifest does not exist yet — so a `polyhaven` source resolves to a neutral
 * stand-in rather than its real surface.
 */
const FALLBACK_COLOUR = "#9A958C";

export type MaterialTable = Map<string, THREE.MeshStandardMaterial>;

export function buildMaterials(doc: SceneDocument): MaterialTable {
  const table: MaterialTable = new Map();
  for (const [id, definition] of Object.entries(doc.materials)) {
    table.set(id, toThreeMaterial(id, definition));
  }
  return table;
}

function toThreeMaterial(id: string, definition: Material): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(definition.baseColor ?? FALLBACK_COLOUR),
    roughness: definition.roughness ?? 0.85,
    metalness: definition.metalness ?? 0,
  });
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
