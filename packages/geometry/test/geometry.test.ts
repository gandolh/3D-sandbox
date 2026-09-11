import { readFileSync } from "node:fs";
import * as THREE from "three";
import { Evaluator } from "three-bvh-csg";
import { describe, expect, it } from "vitest";
import { Roof, ScatterField, loadScene, type Level, type Wall } from "@solstice/schema";
import {
  UnsupportedRoofError,
  buildRoof,
  buildWall,
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
