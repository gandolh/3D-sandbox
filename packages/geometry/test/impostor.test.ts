import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { buildImpostorGeometry, type ImpostorAsset } from "../src/context/impostor.js";
import type { ScatterInstance } from "../src/context/scatter.js";

const impostor = (angles = 16): ImpostorAsset => ({
  texture: new THREE.Texture(),
  angles,
  size: [3, 5, 3],
});

const instance = (over: Partial<ScatterInstance> = {}): ScatterInstance => ({
  asset: "a/tree",
  position: [0, 0, 0],
  rotationY: 0,
  scale: 1,
  ...over,
});

const attr = (g: THREE.BufferGeometry, name: string) => g.getAttribute(name).array;

describe("buildImpostorGeometry", () => {
  it("is four triangles per instance — two crossed quads", () => {
    const g = buildImpostorGeometry([instance(), instance()], impostor(), 5);
    expect(g.getAttribute("position").count).toBe(2 * 12);
  });

  it("stands on the ground at the instance's height", () => {
    const g = buildImpostorGeometry([instance()], impostor(), 5);
    const ys = [...attr(g, "position")].filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
    expect(Math.max(...ys)).toBeCloseTo(5, 6);
  });

  it("scales with the instance", () => {
    const g = buildImpostorGeometry([instance({ scale: 2 })], impostor(), 5);
    const ys = [...attr(g, "position")].filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeCloseTo(10, 6);
  });

  it("gives the two planes different atlas slices, 90° apart", () => {
    // The whole difference between a cross-tree that reads as a tree and one
    // that reads as two copies of the same photograph.
    const g = buildImpostorGeometry([instance()], impostor(16), 5);
    const us = [...attr(g, "uv")].filter((_, i) => i % 2 === 0);
    // Six vertices per plane, so six u values each. The fixture is baked
    // 3 × 5 × 3, so its cell is 5 m square and the subject takes the middle
    // 60 % of it — the u range is inset by 20 % of a cell on each side rather
    // than running to the cell's edges. See "the quad matches the cell".
    const inset = (1 / 16) * 0.2;
    const first = us.slice(0, 6);
    const second = us.slice(6);
    expect(Math.min(...first)).toBeCloseTo(inset, 6);
    // 90° of 16 slices is slice 4, so this cell starts at 4/16.
    expect(Math.min(...second)).toBeCloseTo(4 / 16 + inset, 6);
  });

  it("picks the slice nearest the instance's own rotation", () => {
    const g = buildImpostorGeometry([instance({ rotationY: 90 })], impostor(16), 5);
    const us = [...attr(g, "uv")].filter((_, i) => i % 2 === 0);
    expect(Math.min(...us.slice(0, 6))).toBeCloseTo(4 / 16 + (1 / 16) * 0.2, 6);
  });

  it("wraps the slice index rather than running off the atlas", () => {
    const g = buildImpostorGeometry([instance({ rotationY: 350 })], impostor(16), 5);
    const us = [...attr(g, "uv")].filter((_, i) => i % 2 === 0);
    expect(Math.max(...us)).toBeLessThanOrEqual(1);
    expect(Math.min(...us)).toBeGreaterThanOrEqual(0);
  });

  it("takes its width from the baked aspect, not from the height", () => {
    // Baked 3 m wide by 5 m tall: a 10 m tree is 6 m across, not 10.
    const g = buildImpostorGeometry([instance()], impostor(), 10);
    const xs = [...attr(g, "position")].filter((_, i) => i % 3 === 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(6, 5);
  });
});

describe("the quad matches the cell the baker drew", () => {
  const sized = (size: [number, number, number]): ImpostorAsset => ({
    texture: new THREE.Texture(),
    angles: 16,
    size,
  });

  /** The drawn subject, read out of positions and UVs rather than assumed. */
  const drawn = (g: THREE.BufferGeometry) => {
    const p = [...attr(g, "position")];
    const uv = [...attr(g, "uv")];
    const xs = p.filter((_, i) => i % 3 === 0);
    const ys = p.filter((_, i) => i % 3 === 1);
    const vs = uv.filter((_, i) => i % 2 === 1);
    return {
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      base: Math.min(...ys),
      v0: Math.min(...vs),
      v1: Math.max(...vs),
    };
  };

  it("draws tree_small_02 at its true proportions", () => {
    // The one asset actually baked. Its cell is 4.5567 m square (the max of its
    // three extents) and it is 4.2925 m across, so its true w/h is
    // 4.2925 / 4.5567 = 0.94202. The old formula built the quad from that same
    // ratio and *then* let the subject fill only 0.9420 of it, drawing
    // 0.8874 — every tree in the forest 5.8 % too narrow for its height.
    const g = buildImpostorGeometry([instance()], sized([2.9167, 4.5567, 4.2925]), 9);
    const d = drawn(g);
    expect(d.width / d.height).toBeCloseTo(0.94202, 4);
    expect(d.height).toBeCloseTo(9, 6);
  });

  it("draws a wide, short asset at its true size, standing on the ground", () => {
    // The case that makes the error obvious: a shrub baked at [6, 2, 6] has a
    // 6 m square cell, so the subject occupies v ∈ [⅓, ⅔] of it. The old quad
    // was 2 m tall by 6 m wide and drew that band into it — two thirds of a
    // metre of shrub, hovering 0.67 m above the ground.
    //
    // A bounding-box assertion cannot catch this, which is why it survived:
    // the old geometry's box was also 2 m tall. The UVs are the other half of
    // the answer and are asserted with it.
    const g = buildImpostorGeometry([instance()], sized([6, 2, 6]), 2);
    const d = drawn(g);
    expect(d.height).toBeCloseTo(2, 6);
    expect(d.width).toBeCloseTo(6, 6);
    expect(d.base).toBeCloseTo(0, 6);
    expect(d.v0).toBeCloseTo(1 / 3, 6);
    expect(d.v1).toBeCloseTo(2 / 3, 6);
  });

  it("uses the whole cell when the subject fills it", () => {
    // A cube needs no letterboxing in either axis, and must not get any.
    const g = buildImpostorGeometry([instance()], sized([4, 4, 4]), 4);
    const d = drawn(g);
    expect(d.width).toBeCloseTo(4, 6);
    expect(d.height).toBeCloseTo(4, 6);
    expect(d.v0).toBeCloseTo(0, 6);
    expect(d.v1).toBeCloseTo(1, 6);
  });

  it("crops the atlas horizontally for a narrow, tall asset", () => {
    // A 1 × 10 × 1 post: cell is 10 m square, the post is a tenth of its
    // width. The quad is 1 m wide and the UVs take the middle tenth.
    // One angle, so both planes take the same cell and the u range is the
    // whole atlas rather than two slices of it.
    const one: ImpostorAsset = { texture: new THREE.Texture(), angles: 1, size: [1, 10, 1] };
    const g = buildImpostorGeometry([instance()], one, 10);
    const d = drawn(g);
    expect(d.width).toBeCloseTo(1, 6);
    expect(d.height).toBeCloseTo(10, 6);
    const us = [...attr(g, "uv")].filter((_, i) => i % 2 === 0);
    expect(Math.min(...us)).toBeCloseTo(0.45, 6);
    expect(Math.max(...us)).toBeCloseTo(0.55, 6);
  });
});
