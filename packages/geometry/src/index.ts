import * as THREE from "three";
import { Evaluator } from "three-bvh-csg";
import type { SceneDocument } from "@solstice/schema";

import { buildMaterials, resolveMaterial, type MaterialTable } from "./materials.js";
import { ensureStandardAttributes } from "./attributes.js";
import { extrudePolygon } from "./polygon.js";
import { buildWall } from "./subject/walls.js";
import { UnsupportedRoofError, buildRoof } from "./subject/roofs.js";
import { buildRun } from "./subject/runs.js";
import type { AssetSource, MaterialSource } from "./assets.js";
import {
  buildScatterMesh,
  mergeSimple,
  scatterInstances,
  type ScatterInstance,
} from "./context/scatter.js";
import { buildImpostorGeometry, impostorMaterial } from "./context/impostor.js";
import { boxProjectUv } from "./uv.js";
import { buildMass, buildPaving, buildRoad } from "./context/masses.js";

export * from "./random.js";
export * from "./attributes.js";
export * from "./uv.js";
export * from "./polygon.js";
export * from "./materials.js";
export * from "./subject/walls.js";
export * from "./subject/roofs.js";
export * from "./subject/runs.js";
export * from "./assets.js";
export * from "./context/scatter.js";
export * from "./context/impostor.js";
export * from "./context/masses.js";

export interface TierStats {
  meshes: number;
  triangles: number;
}

export interface SceneStats {
  subject: TierStats;
  context: TierStats;
  /** Scatter instances across every field — the number that drives BVH cost. */
  instances: number;
  get triangles(): number;
}

export interface GeneratedScene {
  root: THREE.Group;
  subject: THREE.Group;
  context: THREE.Group;
  stats: SceneStats;
  /** Free every geometry and material this generator created. */
  dispose(): void;
}

export interface GenerateOptions {
  /** Include the `context` tier. Off makes editing large scenes responsive. */
  includeContext?: boolean;
  /** Include the ground plane. */
  includeTerrain?: boolean;
  /**
   * Loaded assets. Absent — or missing an id — means the proxy, which is why
   * this generator runs identically in a Node test with nothing downloaded.
   */
  assets?: AssetSource;
  /** Loaded PBR maps. Absent means every material is its `baseColor`. */
  materials?: MaterialSource;
}

/**
 * Stand-in for an unloaded asset: a chair-sized box on a plinth.
 *
 * Crude on purpose, like the scatter proxies. The asset manifest does not exist
 * yet, and a placeholder that looked like furniture would survive into a
 * screenshot and then into someone's expectations.
 */
function proxyPlacementGeometry(): THREE.BufferGeometry {
  const seat = new THREE.BoxGeometry(0.5, 0.12, 0.5);
  seat.translate(0, 0.44, 0);
  const back = new THREE.BoxGeometry(0.5, 0.5, 0.08);
  back.translate(0, 0.75, -0.21);
  const legs = new THREE.BoxGeometry(0.44, 0.44, 0.44);
  legs.translate(0, 0.22, 0);
  const merged = mergeSimple([seat, back, legs]);
  seat.dispose();
  back.dispose();
  legs.dispose();
  return ensureStandardAttributes(merged);
}

const triangleCount = (geometry: THREE.BufferGeometry): number => {
  const position = geometry.getAttribute("position");
  if (position === undefined) return 0;
  return (geometry.index === null ? position.count : geometry.index.count) / 3;
};

/**
 * Compile a scene document into three.js objects.
 *
 * Pure CPU work — no WebGL context is created, nothing here touches a canvas.
 * That is deliberate: it makes the generator testable headlessly, which is the
 * only reason triangle counts and scatter determinism have real tests rather
 * than a screenshot someone squinted at.
 */
export function generateScene(
  doc: SceneDocument,
  options: GenerateOptions = {},
): GeneratedScene {
  const includeContext = options.includeContext ?? true;
  const includeTerrain = options.includeTerrain ?? true;

  const materials = buildMaterials(doc, options.materials);
  const owned: THREE.BufferGeometry[] = [];
  const evaluator = new Evaluator();
  evaluator.useGroups = false;

  const root = new THREE.Group();
  root.name = `scene:${doc.id}`;
  const subject = new THREE.Group();
  subject.name = "subject";
  const context = new THREE.Group();
  context.name = "context";
  root.add(subject, context);

  const stats: SceneStats = {
    subject: { meshes: 0, triangles: 0 },
    context: { meshes: 0, triangles: 0 },
    instances: 0,
    get triangles() {
      return this.subject.triangles + this.context.triangles;
    },
  };

  const attach = (
    group: THREE.Group,
    tier: TierStats,
    geometry: THREE.BufferGeometry,
    materialId: string,
    name: string,
    /**
     * Re-project UVs in world metres. True for everything this generator builds
     * — boxes and extrusions whose 0–1 UVs would stretch a texture across a
     * whole wall — and false for a loaded glTF, which already has UVs that were
     * authored against its own maps.
     */
    options: { project?: boolean; twoSided?: boolean } = {},
  ): THREE.Mesh => {
    const shared = resolveMaterial(materials, materialId);
    // A flat surface needs both its sides, and the shared material cannot give
    // it one without giving it to every other surface that names the same
    // material. Cloned per mesh, which is a handful of them.
    const material =
      options.twoSided !== true
        ? shared
        : Object.assign(shared.clone(), { side: THREE.DoubleSide, name: shared.name });
    let placed = geometry;
    if (options.project !== false && material.map !== null) {
      placed = boxProjectUv(geometry, doc.materials[materialId]?.textureScale ?? 2);
    }
    owned.push(placed);
    const mesh = new THREE.Mesh(placed, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    tier.meshes++;
    tier.triangles += triangleCount(placed);
    return mesh;
  };

  /* ── subject ─────────────────────────────────────────────────── */

  for (const level of doc.subject.levels) {
    const levelGroup = new THREE.Group();
    levelGroup.name = `level:${level.id}`;
    subject.add(levelGroup);

    for (const wall of level.walls) {
      attach(levelGroup, stats.subject, buildWall(wall, level, evaluator), wall.material, `wall:${wall.id}`);
    }
    for (const slab of level.slabs) {
      const geometry = extrudePolygon(slab.polygon, level.elevation - slab.thickness, slab.thickness);
      attach(levelGroup, stats.subject, geometry, slab.material, `slab:${slab.id}`);
    }
  }

  // Placements were generated as nothing at all until now. Proxy boxes so the
  // scene has something to place and the physics aid has something to drop.
  for (const placement of doc.subject.placements) {
    // A real asset when one is loaded, the proxy otherwise. The fallback is
    // deliberately unmistakable: a placeholder that looked like furniture would
    // survive into a screenshot and then into someone's expectations.
    const loaded = options.assets?.get(placement.asset);
    const geometry = loaded === undefined ? proxyPlacementGeometry() : loaded.geometry.clone();

    geometry.scale(placement.scale, placement.scale, placement.scale);
    geometry.rotateY(THREE.MathUtils.degToRad(placement.rotationY));
    geometry.translate(...placement.position);
    attach(subject, stats.subject, geometry, doc.site.terrain.material, `placement:${placement.id}`, loaded === undefined ? {} : { project: false });
  }

  for (const run of doc.subject.runs) {
    const { structure, climber } = buildRun(run);
    // Merged per material rather than per part: a 60 m hedge is one solid and a
    // pergola is two — steel and vine — not two hundred little boxes, each of
    // which would be its own draw call.
    if (structure.length > 0) {
      attach(subject, stats.subject, mergeSimple(structure), run.material, `run:${run.id}`);
      for (const part of structure) part.dispose();
    }
    if (climber.length > 0 && run.climber !== undefined) {
      // Two-sided, because a leaf is a plane and a plane has a back.
      //
      // The cluster is two quads crossed precisely so foliage reads from any
      // direction — and with the default `FrontSide` every triangle facing away
      // from the viewer was culled, so from underneath the canopy the approach
      // shot showed sky through it. Same class as the inverted roads and
      // roofs, different mechanism: nothing here is wound backwards, the
      // surface simply only had one side and needed two.
      attach(subject, stats.subject, mergeSimple(climber), run.climber, `run:${run.id}:climber`, {
        twoSided: true,
      });
      for (const part of climber) part.dispose();
    }
  }

  for (const roof of doc.subject.roofs) {
    try {
      attach(subject, stats.subject, buildRoof(roof), roof.material, `roof:${roof.id}`);
    } catch (error) {
      if (!(error instanceof UnsupportedRoofError)) throw error;
      // A roof kind we cannot build yet is skipped, loudly, rather than
      // silently producing something wrong that looks plausible.
      console.warn(`[geometry] ${error.message}`);
    }
  }

  /* ── terrain ─────────────────────────────────────────────────── */

  if (includeTerrain) {
    const [sx, sz] = doc.site.terrain.size;
    const ground = new THREE.PlaneGeometry(sx, sz);
    ground.rotateX(-Math.PI / 2);
    ensureStandardAttributes(ground);
    attach(context, stats.context, ground, doc.site.terrain.material, "terrain");
  }

  /* ── context ─────────────────────────────────────────────────── */

  if (includeContext) {
    for (const field of doc.context.scatter) {
      // Impostors when the field's assets have been baked. Checked before the
      // proxy, because the alternative for a photoreal tree is not "the real
      // mesh" — it is a cone. Poly Haven's are 2–17 M triangles each and a
      // 284-instance forest of them is billions.
      //
      // Grouped per asset rather than picking one atlas for the whole field: a
      // field names several species precisely so the scatter is not uniform,
      // and collapsing them to whichever happened to be baked first throws that
      // away. A field may be partly baked — those instances get impostors and
      // the rest fall through to the proxy below.
      const baked = new Map<string, ScatterInstance[]>();
      const unbaked: ScatterInstance[] = [];
      const all = scatterInstances(field);
      for (const instance of all) {
        if (options.assets?.impostor?.(instance.asset) === undefined) unbaked.push(instance);
        else baked.set(instance.asset, [...(baked.get(instance.asset) ?? []), instance]);
      }

      for (const [assetId, group] of baked) {
        const impostor = options.assets!.impostor!(assetId)!;
        const geometry = buildImpostorGeometry(group, impostor, field.height);
        const mesh = new THREE.Mesh(geometry, impostorMaterial(impostor));
        mesh.name = `scatter:${field.id}:${assetId}`;
        owned.push(geometry);
        context.add(mesh);
        stats.context.meshes++;
        stats.context.triangles += triangleCount(geometry);
        stats.instances += group.length;
      }

      if (unbaked.length === 0) continue;
      if (baked.size > 0) {
        // Only the leftovers get proxies, so a partly-baked field is obviously
        // partly baked rather than silently all-or-nothing.
        const material = resolveMaterial(materials, field.material ?? doc.site.terrain.material);
        const { mesh } = buildScatterMesh(field, material, unbaked);
        owned.push(mesh.geometry);
        context.add(mesh);
        stats.context.meshes++;
        stats.context.triangles += triangleCount(mesh.geometry) * unbaked.length;
        stats.instances += unbaked.length;
        continue;
      }

      const material = resolveMaterial(materials, field.material ?? doc.site.terrain.material);
      const { mesh, instances } = buildScatterMesh(field, material);
      owned.push(mesh.geometry);
      context.add(mesh);
      stats.context.meshes++;
      stats.context.triangles += triangleCount(mesh.geometry) * instances.length;
      stats.instances += instances.length;
    }
    for (const mass of doc.context.masses) {
      attach(context, stats.context, buildMass(mass), mass.material, `mass:${mass.id}`);
    }
    for (const road of doc.context.roads) {
      attach(context, stats.context, buildRoad(road), road.material, `road:${road.id}`);
    }
    // After the roads, so where a courtyard meets the drive the laid surface
    // wins the depth test rather than the two flickering against each other.
    for (const paving of doc.context.paving) {
      attach(context, stats.context, buildPaving(paving), paving.material, `paving:${paving.id}`);
    }
  }

  return {
    root,
    subject,
    context,
    stats,
    dispose() {
      for (const geometry of owned) geometry.dispose();
      for (const material of materials.values()) material.dispose();
      owned.length = 0;
      materials.clear();
    },
  };
}
