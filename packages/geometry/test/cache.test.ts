import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SceneDocument } from "@solstice/schema";
import type * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GeometryCache, generateScene } from "../src/index.js";

const scene = (): SceneDocument =>
  SceneDocument.parse(
    JSON.parse(readFileSync(fileURLToPath(new URL("../../../scenes/greenhollow.scene.json", import.meta.url)), "utf8")),
  );

/** Every mesh in the subject tier, by name, with its vertex positions. */
const fingerprint = (doc: SceneDocument, cache?: GeometryCache): string[] => {
  const generated = generateScene(doc, cache === undefined ? {} : { cache });
  const out: string[] = [];
  generated.subject.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const position = mesh.geometry?.getAttribute?.("position");
    if (position === undefined) return;
    // Rounded, because a clone is a byte copy and a rebuild is float maths —
    // but not so coarse that a moved wall would slip through.
    let sum = "";
    for (let i = 0; i < position.count; i += 97) {
      sum += `${position.getX(i).toFixed(5)},${position.getY(i).toFixed(5)},${position.getZ(i).toFixed(5)};`;
    }
    out.push(`${mesh.name}|${position.count}|${sum}`);
  });
  return out.sort();
};

describe("the cached generator draws what the uncached one draws", () => {
  it("is indistinguishable from a scene built from scratch", () => {
    // The whole safety argument. A cache that can serve a stale mesh is worse
    // than the cost it saves, so this is the assertion the design exists for.
    const cache = new GeometryCache();
    const cold = fingerprint(scene());
    const warmed = fingerprint(scene(), cache); // populates
    const served = fingerprint(scene(), cache); // served entirely from cache
    expect(warmed).toEqual(cold);
    expect(served).toEqual(cold);
    cache.dispose();
  });

  it("notices a wall that moved, and keeps the ones that did not", () => {
    const cache = new GeometryCache();
    fingerprint(scene(), cache);
    const before = { hits: cache.hits, misses: cache.misses };

    const edited = scene();
    const wall = edited.subject.levels[0]!.walls[0]!;
    wall.start = [wall.start[0] + 0.25, wall.start[1]];

    const moved = fingerprint(edited, cache);
    // W-01 moved, and its start left W-04's end, which is square now: two new
    // keys. W-01 runs along x, so its far corner with W-02 is unchanged.
    expect(cache.misses - before.misses).toBe(2);
    expect(cache.hits).toBeGreaterThan(before.hits);
    // And the drawn result matches a from-scratch build of the edited document.
    expect(moved).toEqual(fingerprint(edited));
    cache.dispose();
  });

  it("rebuilds the walls that meet a moved corner", () => {
    const cache = new GeometryCache();
    fingerprint(scene(), cache);
    const before = cache.misses;

    // Drag the corner W-01 and W-04 share. Both walls change, and so does
    // W-03, whose corner with W-04 now meets W-04 at a new angle. W-02 keeps
    // its key: its corner with W-01 is where it was, along the same line.
    const edited = scene();
    const walls = edited.subject.levels[0]!.walls;
    const w01 = walls.find((w) => w.id === "W-01")!;
    const w04 = walls.find((w) => w.id === "W-04")!;
    w01.start = [w01.start[0] + 0.25, w01.start[1]];
    w04.end = [w04.end[0] + 0.25, w04.end[1]];

    const moved = fingerprint(edited, cache);
    expect(cache.misses - before).toBe(3);
    expect(moved).toEqual(fingerprint(edited));
    cache.dispose();
  });

  it("keys on the whole wall, so a new field cannot slip past it", () => {
    // The physics cache's lesson: a hand-written list of inputs goes stale. This key is
    // `JSON.stringify` of the entire wall, so changing *any* property — here
    // one that the first version of a hand-rolled key would never have listed —
    // is a miss.
    const cache = new GeometryCache();
    fingerprint(scene(), cache);
    const misses = cache.misses;

    const edited = scene();
    const wall = edited.subject.levels[0]!.walls[0]!;
    wall.openings[0]!.sill += 0.05;
    fingerprint(edited, cache);
    expect(cache.misses).toBe(misses + 1);
    cache.dispose();
  });

  it("hands out clones, so disposing one scene cannot blank the next", () => {
    // The generated scene disposes the geometry it owns. If that were the
    // cached object, the next generation would serve an emptied buffer.
    const cache = new GeometryCache();
    const first = generateScene(scene(), { cache });
    first.dispose();
    const second = generateScene(scene(), { cache });
    let walls = 0;
    second.subject.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.name.startsWith("wall:")) return;
      walls++;
      expect(mesh.geometry.getAttribute("position").count, mesh.name).toBeGreaterThan(0);
    });
    expect(walls).toBeGreaterThan(10);
    second.dispose();
    cache.dispose();
  });

  it("stays bounded, and frees what it evicts", () => {
    // A long editing session visits a new key on every nudge; unbounded, the
    // tab would hold every intermediate state's geometry.
    const cache = new GeometryCache(8);
    for (let i = 0; i < 40; i++) {
      const edited = scene();
      const wall = edited.subject.levels[0]!.walls[0]!;
      wall.start = [wall.start[0] + i * 0.01, wall.start[1]];
      generateScene(edited, { cache }).dispose();
    }
    expect(cache.size).toBeLessThanOrEqual(8);
    cache.dispose();
    expect(cache.size).toBe(0);
  });
});
