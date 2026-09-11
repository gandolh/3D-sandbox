import { readFileSync } from "node:fs";
import * as THREE from "three";
import { Evaluator } from "three-bvh-csg";
import { describe, expect, it } from "vitest";
import { BuildingMass, Roof, ScatterField, loadScene, type Level, type Wall } from "@solstice/schema";
import {
  UnsupportedRoofError,
  buildMass,
  buildRoof,
  buildWall,
  extrudePolygon,
  ensureStandardAttributes,
  hasStandardAttributes,
  mergeSimple,
  generateScene,
  mulberry32,
  pointInPolygon,
  roofRise,
  scatterInstances,
  wallSolid,
} from "../src/index.js";

const level = (): Level => ({
  id: "L1",
  name: "Ground",
  elevation: 0,
  height: 2.7,
  walls: [],
  slabs: [],
});

const wall = (openings: Wall["openings"] = []): Wall => ({
  id: "W-01",
  start: [0, 0],
  end: [6, 0],
  thickness: 0.24,
  material: "wall",
  openings,
});

const boxOf = (geometry: THREE.BufferGeometry): THREE.Box3 => {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.clone();
};

describe("wall solids", () => {
  it("spans its endpoints, sits on the floor, and is one thickness deep", () => {
    const box = boxOf(wallSolid(wall(), level()));
    expect(box.min.x).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(6);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.y).toBeCloseTo(2.7);
    expect(box.max.z - box.min.z).toBeCloseTo(0.24);
  });

  it("honours the level's elevation", () => {
    const raised = { ...level(), elevation: 3.2 };
    const box = boxOf(wallSolid(wall(), raised));
    expect(box.min.y).toBeCloseTo(3.2);
    expect(box.max.y).toBeCloseTo(5.9);
  });

  it("rotates to follow a wall that is not axis-aligned", () => {
    const diagonal: Wall = { ...wall(), start: [0, 0], end: [4, 4] };
    const box = boxOf(wallSolid(diagonal, level()));
    expect(box.min.x).toBeLessThan(0.2);
    expect(box.max.x).toBeGreaterThan(3.8);
    expect(box.max.z - box.min.z).toBeGreaterThan(3.8);
  });
});

describe("openings are actually cut", () => {
  const withWindow = () =>
    buildWall(
      wall([{ id: "w-1", kind: "window", offset: 2, width: 1.4, height: 1.2, sill: 0.9 }]),
      level(),
      new Evaluator(),
    );

  it("leaves the wall's overall bounds unchanged", () => {
    const box = boxOf(withWindow());
    expect(box.min.x).toBeCloseTo(0, 1);
    expect(box.max.x).toBeCloseTo(6, 1);
    expect(box.max.y).toBeCloseTo(2.7, 1);
  });

  it("lets a ray pass straight through the opening", () => {
    const mesh = new THREE.Mesh(withWindow());
    mesh.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(2.7, 1.5, -1),
      new THREE.Vector3(0, 0, 1).normalize(),
    );
    expect(raycaster.intersectObject(mesh, false)).toHaveLength(0);
  });

  it("still stops a ray through the solid part of the same wall", () => {
    const mesh = new THREE.Mesh(withWindow());
    mesh.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0.5, 1.5, -1),
      new THREE.Vector3(0, 0, 1).normalize(),
    );
    expect(raycaster.intersectObject(mesh, false).length).toBeGreaterThan(0);
  });

  it("stops a ray above the opening's head", () => {
    const mesh = new THREE.Mesh(withWindow());
    mesh.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(2.7, 2.5, -1),
      new THREE.Vector3(0, 0, 1).normalize(),
    );
    expect(raycaster.intersectObject(mesh, false).length).toBeGreaterThan(0);
  });

  it("cuts two openings independently", () => {
    const mesh = new THREE.Mesh(
      buildWall(
        wall([
          { id: "w-1", kind: "window", offset: 1, width: 1, height: 1.2, sill: 0.9 },
          { id: "w-2", kind: "window", offset: 3.5, width: 1, height: 1.2, sill: 0.9 },
        ]),
        level(),
        new Evaluator(),
      ),
    );
    mesh.updateMatrixWorld(true);
    const through = (x: number) =>
      new THREE.Raycaster(new THREE.Vector3(x, 1.5, -1), new THREE.Vector3(0, 0, 1))
        .intersectObject(mesh, false).length;
    expect(through(1.5)).toBe(0);
    expect(through(4.0)).toBe(0);
    expect(through(2.5)).toBeGreaterThan(0);
  });
});

describe("roofs", () => {
  const footprint = [
    [-3.6, -5.2],
    [3.6, -5.2],
    [3.6, 5.2],
    [-3.6, 5.2],
  ] as const;

  it("puts the ridge at base + rise for a 32° gable", () => {
    const roof = Roof.parse({
      id: "R-01",
      kind: "gable",
      footprint,
      baseElevation: 2.7,
      pitch: 32,
      material: "roof",
    });
    const expectedRise = 3.6 * Math.tan((32 * Math.PI) / 180);
    expect(roofRise(roof)).toBeCloseTo(expectedRise, 5);
    const box = boxOf(buildRoof(roof));
    expect(box.max.y).toBeCloseTo(2.7 + expectedRise, 4);
    expect(box.min.y).toBeCloseTo(2.7, 4);
  });

  it("covers the whole footprint in plan", () => {
    const roof = Roof.parse({
      id: "R-01", kind: "gable", footprint, baseElevation: 2.7, pitch: 32, material: "roof",
    });
    const box = boxOf(buildRoof(roof));
    expect(box.min.x).toBeCloseTo(-3.6);
    expect(box.max.x).toBeCloseTo(3.6);
    expect(box.min.z).toBeCloseTo(-5.2);
    expect(box.max.z).toBeCloseTo(5.2);
  });

  it("refuses a hip roof rather than guessing", () => {
    const roof = Roof.parse({
      id: "R-01", kind: "hip", footprint, baseElevation: 2.7, pitch: 32, material: "roof",
    });
    expect(() => buildRoof(roof)).toThrow(UnsupportedRoofError);
  });
});

describe("deterministic scatter", () => {
  const field = (seed: number, exclude: number[][][] = []) =>
    ScatterField.parse({
      id: "forest",
      assets: ["a", "b"],
      area: [[-50, -50], [50, -50], [50, 50], [-50, 50]],
      density: 2,
      seed,
      exclude,
    });

  it("is reproducible from its seed", () => {
    expect(scatterInstances(field(7))).toEqual(scatterInstances(field(7)));
  });

  it("differs when the seed differs", () => {
    expect(scatterInstances(field(7))).not.toEqual(scatterInstances(field(8)));
  });

  it("hits the density estimate", () => {
    // 10 000 m² at 2 per 100 m² → 200
    expect(scatterInstances(field(1))).toHaveLength(200);
  });

  it("places nothing inside an excluded region", () => {
    const clearing = [[-20, -20], [20, -20], [20, 20], [-20, 20]];
    const instances = scatterInstances(field(3, [clearing]));
    const inside = instances.filter((i) =>
      pointInPolygon([i.position[0], i.position[2]], clearing as never),
    );
    expect(inside).toHaveLength(0);
    expect(instances.length).toBeGreaterThan(100);
  });

  it("varies scale within the declared range", () => {
    const scales = scatterInstances(field(5)).map((i) => i.scale);
    expect(Math.min(...scales)).toBeGreaterThanOrEqual(0.85);
    expect(Math.max(...scales)).toBeLessThanOrEqual(1.15);
    expect(new Set(scales).size).toBeGreaterThan(50);
  });
});

describe("mulberry32", () => {
  it("is stable for a seed and spread over [0,1)", () => {
    const a = Array.from({ length: 5 }, mulberry32(42));
    const b = Array.from({ length: 5 }, mulberry32(42));
    expect(a).toEqual(b);
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("generating the reference scene", () => {
  const doc = loadScene(
    JSON.parse(
      readFileSync(new URL("../../../scenes/villa-carpathia.scene.json", import.meta.url), "utf8"),
    ) as unknown,
  ).document;

  it("produces both tiers with the expected shape", () => {
    const scene = generateScene(doc);
    expect(scene.subject.children.length).toBeGreaterThan(0);
    expect(scene.context.children.length).toBeGreaterThan(0);
    expect(scene.stats.instances).toBe(284);
    scene.dispose();
  });

  it("keeps the subject far cheaper than the context, which is the point of the split", () => {
    const scene = generateScene(doc);
    expect(scene.stats.subject.triangles).toBeGreaterThan(0);
    expect(scene.stats.context.triangles).toBeGreaterThan(scene.stats.subject.triangles);
    expect(scene.stats.triangles).toBe(
      scene.stats.subject.triangles + scene.stats.context.triangles,
    );
    scene.dispose();
  });

  it("can skip the context tier for responsive editing", () => {
    const scene = generateScene(doc, { includeContext: false, includeTerrain: false });
    expect(scene.context.children).toHaveLength(0);
    expect(scene.stats.instances).toBe(0);
    expect(scene.stats.subject.triangles).toBeGreaterThan(0);
    scene.dispose();
  });

  it("names meshes after the entities they came from", () => {
    const scene = generateScene(doc);
    const names: string[] = [];
    scene.root.traverse((o) => names.push(o.name));
    expect(names).toContain("wall:W-03");
    expect(names).toContain("roof:roof-main");
    expect(names).toContain("scatter:forest");
    scene.dispose();
  });

  it("disposes without throwing", () => {
    const scene = generateScene(doc);
    expect(() => scene.dispose()).not.toThrow();
  });
});

describe("extruded polygons", () => {
  // Regression: the first implementation rotated the wrong way, mirroring every
  // footprint about X, and then lifted solids by base + height instead of base —
  // so neighbouring building masses floated a full storey above the ground.
  const L: readonly (readonly [number, number])[] = [
    [0, 0],
    [10, 0],
    [10, 4],
    [4, 4],
    [4, 9],
    [0, 9],
  ];

  it("sits exactly on its base and rises by its height", () => {
    const box = boxOf(extrudePolygon(L, 0, 6.2));
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeCloseTo(6.2, 6);
  });

  it("honours a base below ground", () => {
    const box = boxOf(extrudePolygon(L, -0.25, 0.25));
    expect(box.min.y).toBeCloseTo(-0.25, 6);
    expect(box.max.y).toBeCloseTo(0, 6);
  });

  it("does not mirror the footprint in Z", () => {
    const box = boxOf(extrudePolygon(L, 0, 1));
    expect(box.min.x).toBeCloseTo(0, 6);
    expect(box.max.x).toBeCloseTo(10, 6);
    expect(box.min.z).toBeCloseTo(0, 6);
    expect(box.max.z).toBeCloseTo(9, 6);
  });

  it("keeps an off-origin footprint where the document put it", () => {
    const offset = L.map(([x, z]) => [x + 23, z + 22] as const);
    const box = boxOf(extrudePolygon(offset, 0, 7.1));
    expect(box.min.x).toBeCloseTo(23, 6);
    expect(box.min.z).toBeCloseTo(22, 6);
    expect(box.max.z).toBeCloseTo(31, 6);
  });
});

describe("building masses sit on the ground", () => {
  it("places a pitched neighbour from 0 to height + rise", () => {
    const mass = BuildingMass.parse({
      id: "n-01",
      footprint: [[-46, 22], [-35, 22], [-35, 31], [-46, 31]],
      height: 6.2,
      roofKind: "gable",
      pitch: 30,
      material: "render",
    });
    const box = boxOf(buildMass(mass));
    expect(box.min.y).toBeCloseTo(0, 6);
    expect(box.max.y).toBeGreaterThan(6.2);
    expect(box.max.y).toBeLessThan(6.2 + 5);
    expect(box.min.x).toBeCloseTo(-46, 4);
    expect(box.min.z).toBeCloseTo(22, 4);
  });
});

describe("attribute consistency", () => {
  // three-gpu-pathtracer merges the whole scene into one buffer, so a mesh
  // missing `uv` while its neighbour has one breaks the merge far from the
  // cause. Every geometry leaving this package carries the same attributes.
  const doc = loadScene(
    JSON.parse(
      readFileSync(new URL("../../../scenes/villa-carpathia.scene.json", import.meta.url), "utf8"),
    ) as unknown,
  ).document;

  it("gives every generated mesh position, normal and uv", () => {
    const scene = generateScene(doc);
    const offenders: string[] = [];
    scene.root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry === undefined) return;
      if (!hasStandardAttributes(mesh.geometry)) offenders.push(object.name || "<unnamed>");
    });
    expect(offenders).toEqual([]);
    scene.dispose();
  });

  it("adds a zeroed uv rather than leaving it absent", () => {
    const bare = new THREE.BufferGeometry();
    bare.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    ensureStandardAttributes(bare);
    expect(hasStandardAttributes(bare)).toBe(true);
    expect(bare.getAttribute("uv").count).toBe(3);
  });

  it("carries uv through a merge", () => {
    const merged = mergeSimple([new THREE.BoxGeometry(1, 1, 1), new THREE.ConeGeometry(1, 2, 6)]);
    expect(hasStandardAttributes(merged)).toBe(true);
    expect(merged.getAttribute("uv").count).toBe(merged.getAttribute("position").count);
  });
});
