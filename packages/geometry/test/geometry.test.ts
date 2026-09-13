import { readFileSync } from "node:fs";
import {
  BuildingMass,
  bounds,
  type Level,
  loadScene,
  Roof,
  Run,
  ScatterField,
  type Wall,
} from "@solstice/schema";
import * as THREE from "three";
import { Evaluator } from "three-bvh-csg";
import { describe, expect, it } from "vitest";
import {
  buildMass,
  buildPaving,
  buildRoad,
  buildRoof,
  buildRun,
  buildWall,
  ensureStandardAttributes,
  extrudePolygon,
  generateScene,
  hasStandardAttributes,
  mergeSimple,
  mulberry32,
  pointInPolygon,
  roofRise,
  scatterInstances,
  UnsupportedRoofError,
  wallSolid,
} from "../src/index.js";
import { downwardFaces, faces, inwardFaces, normalsAgainstWinding, slopes } from "./normals.js";

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
      new THREE.Raycaster(new THREE.Vector3(x, 1.5, -1), new THREE.Vector3(0, 0, 1)).intersectObject(
        mesh,
        false,
      ).length;
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
      id: "R-01",
      kind: "gable",
      footprint,
      baseElevation: 2.7,
      pitch: 32,
      material: "roof",
    });
    const box = boxOf(buildRoof(roof));
    expect(box.min.x).toBeCloseTo(-3.6);
    expect(box.max.x).toBeCloseTo(3.6);
    expect(box.min.z).toBeCloseTo(-5.2);
    expect(box.max.z).toBeCloseTo(5.2);
  });

  it("refuses a hip roof rather than guessing", () => {
    const roof = Roof.parse({
      id: "R-01",
      kind: "hip",
      footprint,
      baseElevation: 2.7,
      pitch: 32,
      material: "roof",
    });
    expect(() => buildRoof(roof)).toThrow(UnsupportedRoofError);
  });
});

describe("deterministic scatter", () => {
  const field = (seed: number, exclude: number[][][] = []) =>
    ScatterField.parse({
      id: "forest",
      assets: ["a", "b"],
      area: [
        [-50, -50],
        [50, -50],
        [50, 50],
        [-50, 50],
      ],
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

  it("counts an exclusion that hangs over the edge only where it overlaps", () => {
    // 100 × 100 field, one 50 × 50 exclusion half outside it. Subtracting the
    // exclusion whole removes 2 500 m² where 1 250 is excluded, so the field
    // planted 300 where 350 belong — 14 % under, and shaped correctly, so
    // nothing about the render said so.
    const big = ScatterField.parse({
      id: "meadow",
      assets: ["a"],
      area: [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      density: 4,
      seed: 5,
      exclude: [
        [
          [75, 25],
          [125, 25],
          [125, 75],
          [75, 75],
        ],
      ],
    });
    expect(scatterInstances(big)).toHaveLength(350);
  });

  it("counts two overlapping exclusions once", () => {
    // Two 20 × 20 holes sharing a 10 × 10 corner: 700 m² of hole, not 800.
    const twice = ScatterField.parse({
      id: "meadow",
      assets: ["a"],
      area: [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ],
      density: 4,
      seed: 5,
      exclude: [
        [
          [0, 0],
          [20, 0],
          [20, 20],
          [0, 20],
        ],
        [
          [10, 10],
          [30, 10],
          [30, 30],
          [10, 30],
        ],
      ],
    });
    expect(scatterInstances(twice)).toHaveLength(Math.round(((10000 - 700) / 100) * 4));
  });

  it("places nothing inside an excluded region", () => {
    const clearing = [
      [-20, -20],
      [20, -20],
      [20, 20],
      [-20, 20],
    ];
    const instances = scatterInstances(field(3, [clearing]));
    const inside = instances.filter((i) => pointInPolygon([i.position[0], i.position[2]], clearing as never));
    expect(inside).toHaveLength(0);
    expect(instances.length).toBeGreaterThan(100);
  });

  it("separates two fields that share a polygon and omit the seed", () => {
    // The authoring pattern this protects: an `oaks` bed and a `birches` bed
    // over the same plot. Both default `seed` to 0, and before the field id was
    // folded in they placed every instance at identical coordinates — one
    // co-incident z-fighting thicket with twice the geometry.
    const named = (id: string) =>
      ScatterField.parse({
        id,
        assets: ["a"],
        area: [
          [0, 0],
          [40, 0],
          [40, 40],
          [0, 40],
        ],
        density: 2,
      });
    const oaks = scatterInstances(named("oaks"));
    const birches = scatterInstances(named("birches"));
    expect(oaks).toHaveLength(birches.length);
    expect(oaks.map((i) => i.position)).not.toEqual(birches.map((i) => i.position));
    // Not merely "some differ" — none of them may coincide.
    const shared = oaks.filter((o, i) => o.position[0] === birches[i]!.position[0]);
    expect(shared).toHaveLength(0);
  });

  it("still reproduces exactly for one id and one seed", () => {
    // The dial has to keep working, or a render stops being re-makeable from
    // its document — which is the reason the seed exists at all.
    expect(scatterInstances(field(12))).toEqual(scatterInstances(field(12)));
  });

  it("does not pin the first instance to the southern edge", () => {
    // mulberry32's second output is ~0.0003 for seed 0, so the first accepted
    // instance used to land within 0.03 % of `bounds.minZ` — hard against the
    // boundary — for any low seed. The RNG is warmed before first use now.
    for (const seed of [0, 1, 2, 3]) {
      const first = scatterInstances(field(seed))[0]!;
      expect(first.position[2]).toBeGreaterThan(-50 + 1);
    }
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
    // 260 since the forest stopped growing through the neighbours: the six
    // masses plus a 2 m skirt take about 24 trees out of the 284 it used to
    // place.
    expect(scene.stats.instances).toBe(260);
    scene.dispose();
  });

  it("plants no tree inside a building", () => {
    // The count above cannot see this, which is why it is separate. The forest
    // covers 120 × 120 m and used to exclude one rectangle — the house
    // clearing — so every one of the six neighbours had trees growing through
    // its walls. n-03 is 108 m², about two trees' worth at this density.
    const field = doc.context.scatter[0]!;
    const buildings = doc.context.masses.map((mass) => bounds(mass.footprint));
    const planted = scatterInstances(field);
    expect(planted.length).toBeGreaterThan(200);

    const trespassing = planted.filter(({ position: [x, , z] }) =>
      buildings.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ),
    );
    expect(trespassing).toEqual([]);
  });

  it("keeps the subject far cheaper than the context, which is the point of the split", () => {
    const scene = generateScene(doc);
    expect(scene.stats.subject.triangles).toBeGreaterThan(0);
    expect(scene.stats.context.triangles).toBeGreaterThan(scene.stats.subject.triangles);
    expect(scene.stats.triangles).toBe(scene.stats.subject.triangles + scene.stats.context.triangles);
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

// The filtering these two share now lives in `./normals.ts`, with the rest of
// the facing guard. It was written here for the gable bug and then the same
// bug turned up in roads, which is the argument for one home.
describe("gable slopes face the sky", () => {
  const footprint = [
    [-3.25, 1.4],
    [3.25, 1.4],
    [3.25, 10.6],
    [-3.25, 10.6],
  ];

  // The bug Elmsgate's black roof exposed: the ridge-along-X branch of both
  // gable builders wound its slopes backwards, so the normals pointed into the
  // building. The other branch was right, and nothing had ever asserted a
  // direction — so Greenhollow's house and garage roofs, which both declare
  // `ridgeBearing: 90`, had been inside out since they were written.
  it.each([undefined, 0, 90, 180, 270])("points up with ridgeBearing %s", (bearing) => {
    const roof = Roof.parse({
      id: "r",
      kind: "gable",
      footprint,
      baseElevation: 5.8,
      pitch: 38,
      material: "m",
      ...(bearing === undefined ? {} : { ridgeBearing: bearing }),
    });
    const found = slopes(buildRoof(roof));
    expect(found).toHaveLength(4);
    // Every slope, not the average: an average hides one inverted face.
    expect(found.every((ny) => ny > 0)).toBe(true);
  });

  it("points up on a context mass too", () => {
    for (const bearing of [undefined, 0, 90]) {
      const mass = BuildingMass.parse({
        id: "nb",
        footprint,
        height: 5.8,
        roofKind: "gable",
        pitch: 38,
        material: "m",
        ...(bearing === undefined ? {} : { ridgeBearing: bearing }),
      });
      const found = slopes(buildMass(mass));
      expect(found.length).toBeGreaterThanOrEqual(4);
      expect(found.every((ny) => ny > 0)).toBe(true);
    }
  });
});

describe("building masses sit on the ground", () => {
  it("places a pitched neighbour from 0 to height + rise", () => {
    const mass = BuildingMass.parse({
      id: "n-01",
      footprint: [
        [-46, 22],
        [-35, 22],
        [-35, 31],
        [-46, 31],
      ],
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

  it("runs the ridge along the declared bearing, not the long axis", () => {
    // Elmsgate's finding. A terrace neighbour is narrow and deep, so the
    // long-axis guess points the ridge front-to-back and shows a gable end to
    // the street — while the subject's roof, which *can* declare a bearing,
    // runs along the row. A whole terrace could never line up.
    const terraced = {
      id: "nb",
      footprint: [
        [0, 0],
        [6.5, 0],
        [6.5, 9.2],
        [0, 9.2],
      ],
      height: 5.8,
      roofKind: "gable" as const,
      pitch: 38,
      material: "brick",
    };
    const guessed = boxOf(buildMass(BuildingMass.parse(terraced)));
    const declared = boxOf(buildMass(BuildingMass.parse({ ...terraced, ridgeBearing: 90 })));

    // The apex is what tells the two apart, because the span the slopes cross
    // is the axis the ridge does *not* run along. Guessed: ridge front-to-back,
    // slopes cross the 6.5 m width. Declared 90°: ridge along the row, slopes
    // cross the 9.2 m depth — a bigger span, so a higher ridge.
    const rise = (span: number) => 5.8 + (span / 2) * Math.tan((38 * Math.PI) / 180);
    expect(guessed.max.y).toBeCloseTo(rise(6.5), 4);
    expect(declared.max.y).toBeCloseTo(rise(9.2), 4);
    expect(declared.max.y).toBeGreaterThan(guessed.max.y);
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

/**
 * The facing guard, applied to every builder that winds triangles by hand.
 *
 * Three bugs in this repo have been this one bug — the gable branch of
 * `buildRoof`, the same branch of `buildMass`, and `buildRoad` — and all three
 * survived a passing suite for the same reason: **a bounding box is identical
 * whether a surface faces the sky or the ground.** The assertions live in
 * `./normals.ts` so there is one of them rather than one per bug.
 */
describe("hand-wound surfaces face outward", () => {
  const rect: [number, number][] = [
    [-3.25, 1.4],
    [3.25, 1.4],
    [3.25, 10.6],
    [-3.25, 10.6],
  ];

  const road = (path: [number, number][]) =>
    buildRoad({ id: "r", path, width: 6, material: "asphalt" } as never);

  it("lays a road face-up, straight and round a bend", () => {
    // The shipped winding produced (0, −1, 0) on every triangle, and every road
    // in all three scenes rendered pure black against lit terrain. It read as
    // "asphalt is dark" in two briefs' screenshots.
    for (const path of [
      [
        [0, 0],
        [20, 0],
      ] as [number, number][],
      [
        [0, 0],
        [20, 0],
        [20, 20],
      ] as [number, number][],
      // Backwards, and diagonally: the winding must not depend on which way
      // the centreline happens to run.
      [
        [20, 20],
        [20, 0],
        [0, 0],
      ] as [number, number][],
      [
        [0, 0],
        [-14, 9],
      ] as [number, number][],
    ]) {
      const geometry = road(path);
      expect(faces(geometry).length).toBe((path.length - 1) * 2);
      expect(downwardFaces(geometry)).toEqual([]);
    }
  });

  it("lays paving face-up, whatever shape it is", () => {
    // Same class as the roads, and the same reason it would never be noticed:
    // a paving slab whose top faces the earth is simply invisible, and its
    // bounding box is identical either way. The scene would read as "we forgot
    // to pave the yard" rather than as a winding bug.
    const paved = (polygon: [number, number][]) =>
      buildPaving({ id: "p", polygon, material: "brick", thickness: 0.04 } as never);

    const shapes: [string, [number, number][]][] = [
      ["a rectangle", rect],
      // Wound the other way round: the builder must not depend on the author
      // having listed the corners in a particular direction.
      ["the same rectangle reversed", [...rect].reverse()],
      [
        "an L",
        [
          [0, 0],
          [0, 10],
          [5, 10],
          [5, 5],
          [10, 5],
          [10, 0],
        ],
      ],
    ];

    for (const [name, polygon] of shapes) {
      const geometry = paved(polygon);
      // Paving is a thin *solid*, not a ribbon, so it has a bottom and
      // `downwardFaces` is meant to find it. The assertion that matters is
      // about the surface you walk on: every face at the top of the box must
      // point at the sky.
      const top = faces(geometry).filter((f) => f.centroid.y > 0.04 - 1e-6);
      expect(top.length, `${name}: no top surface at all`).toBeGreaterThan(0);
      for (const face of top) {
        expect(face.normal.y, `${name}: a top face points at the earth`).toBeGreaterThan(0.9);
      }
      expect(normalsAgainstWinding(geometry), `${name}: normals fight the winding`).toEqual([]);
      geometry.dispose();
    }
  });

  it("puts the paving's walking surface above the ground, not below it", () => {
    // `thickness` positions the *surface*, because the surface is what you see
    // and what you stand on. Getting this upside down buries the courtyard.
    const geometry = buildPaving({
      id: "p",
      polygon: rect,
      material: "brick",
      thickness: 0.04,
    } as never);
    const box = new THREE.Box3().setFromBufferAttribute(
      geometry.getAttribute("position") as THREE.BufferAttribute,
    );
    expect(box.max.y).toBeCloseTo(0.04, 6);
    expect(box.min.y).toBeCloseTo(0, 6);
    geometry.dispose();
  });

  it("winds every closed solid outward", () => {
    const solids: [string, THREE.BufferGeometry][] = [
      [
        "gabled mass",
        buildMass(
          BuildingMass.parse({
            id: "m",
            footprint: rect,
            height: 5.8,
            roofKind: "gable",
            pitch: 38,
            material: "m",
          }),
        ),
      ],
      [
        "flat mass",
        buildMass(
          BuildingMass.parse({ id: "m", footprint: rect, height: 5.8, roofKind: "flat", material: "m" }),
        ),
      ],
      ["extrusion", extrudePolygon(rect, 0, 3)],
      ["wall solid", wallSolid(wall(), level())],
    ];
    for (const [name, geometry] of solids) {
      expect([name, inwardFaces(geometry)]).toEqual([name, []]);
    }
  });

  it("winds every run's posts, rails and hedge outward", () => {
    for (const kind of ["fence", "pergola", "hedge"] as const) {
      const run = Run.parse({
        id: "r",
        kind,
        path: [
          [0, 0],
          [10, 0],
        ],
        width: 1.2,
        height: 2.2,
        spacing: 2,
        material: "m",
        ...(kind === "pergola" ? { climber: "m" } : {}),
      });
      const { structure } = buildRun(run);
      expect(structure.length).toBeGreaterThan(0);
      for (const part of structure) expect([kind, inwardFaces(part)]).toEqual([kind, []]);
    }
  });

  it("keeps winding through mergeSimple", () => {
    // The merge copies vertices in order and so preserves winding by
    // construction — which is exactly the kind of claim that stops being true
    // silently. `buildMass`, the proxy tree and `prepareAsset` all rely on it.
    const box = new THREE.BoxGeometry(2, 3, 4);
    const before = faces(box).map((f) => f.normal.toArray().map((n) => Math.round(n)));
    const after = faces(mergeSimple([box])).map((f) => f.normal.toArray().map((n) => Math.round(n)));
    expect(after).toEqual(before);
    expect(inwardFaces(mergeSimple([box]))).toEqual([]);
  });

  /**
   * The fourth instance, and a different mechanism.
   *
   * A pergola's climber is crossed quads — flat planes, deliberately, so that
   * foliage reads from any direction. Nothing about them is wound backwards.
   * But three's default `FrontSide` culls a plane's back, so every leaf facing
   * away from the camera vanished, and from under the canopy — where the
   * approach shot puts the viewer — the pergola showed sky through it.
   *
   * Hence a facing bug with no inverted triangle in it: the surface only had
   * one side and needed two.
   */
  it("gives the climber's leaves both their sides", () => {
    const doc = loadScene(
      JSON.parse(readFileSync(new URL("../../../scenes/greenhollow.scene.json", import.meta.url), "utf8")),
    ).document;
    const scene = generateScene(doc);
    const climbers: THREE.Mesh[] = [];
    scene.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh === true && o.name.endsWith(":climber")) climbers.push(o as THREE.Mesh);
    });
    expect(climbers.length).toBeGreaterThan(0);
    for (const mesh of climbers) {
      expect((mesh.material as THREE.Material).side).toBe(THREE.DoubleSide);
    }
    // And nothing else got dragged two-sided with it: a solid rendered from
    // both sides costs fill rate and hides inversions from the eye.
    let oneSided = 0;
    scene.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh !== true || mesh.name.endsWith(":climber")) return;
      if ((mesh.material as THREE.Material).side === THREE.FrontSide) oneSided++;
    });
    expect(oneSided).toBeGreaterThan(0);
  });
});

/**
 * Greenhollow's house plan, and the one number that can break silently.
 *
 * The chimney is a wall carried past the ridge — there is no chimney primitive,
 * so its height is a literal that has to agree with a roof height nothing
 * computes for it. Widen the house, change the pitch, or raise the eave, and
 * the stack quietly ends up *inside* the roof: still rendered, still lit, and
 * wrong in a way no bounding box or triangle count would show.
 */
describe("the house at Greenhollow", () => {
  const doc = loadScene(
    JSON.parse(readFileSync(new URL("../../../scenes/greenhollow.scene.json", import.meta.url), "utf8")),
  ).document;
  const ground = doc.subject.levels.find((l) => l.id === "ground")!;

  it("carries the chimney clear of the ridge", () => {
    const chimney = ground.walls.find((w) => w.id === "P-chimney")!;
    const roof = doc.subject.roofs.find((r) => r.id === "roof-house")!;

    // Ridge bearing 0 means the slopes span the footprint's width, so that is
    // the span the rise is taken from.
    expect(roof.ridgeBearing).toBe(0);
    const box = bounds(roof.footprint);
    const rise = ((box.maxX - box.minX) / 2) * Math.tan((roof.pitch * Math.PI) / 180);
    const ridge = roof.baseElevation + rise;

    expect(chimney.height).toBeDefined();
    expect(chimney.height!).toBeGreaterThan(ridge);
    // And not absurdly clear of it either — a stack standing two metres proud
    // of the ridge is a factory, not a house.
    expect(chimney.height! - ridge).toBeLessThan(1.5);
  });

  it("gives every room its own door off the hall", () => {
    // The plan's whole claim is that no room is reached through another. The
    // hall's two walls carry five doors — the larder joined them when the
    // oversized 12.2 m² bathroom was split into a bathroom and a *cămară*; the
    // day line carries the living room's; the living room carries bedroom 3's.
    const doors = ground.walls
      .filter((w) => w.id.startsWith("P-"))
      .flatMap((w) => w.openings.filter((o) => o.kind === "door").map((o) => o.id));
    expect(doors.sort()).toEqual([
      "d-bath",
      "d-bed1",
      "d-bed2",
      "d-bed3",
      "d-kitchen",
      "d-larder",
      "d-living",
    ]);
  });

  it("keeps partitions thinner than the envelope", () => {
    // 0.12 against 0.30 — a single leaf against a masonry wall. Reading the
    // ratio off a plan is how you tell which walls hold the roof up.
    const external = ground.walls.filter((w) => /^W-\d/.test(w.id));
    const internal = ground.walls.filter((w) => w.id.startsWith("P-") && w.id !== "P-chimney");
    expect(external.every((w) => w.thickness === 0.3)).toBe(true);
    expect(internal.every((w) => w.thickness === 0.12)).toBe(true);
  });
});
