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
    // Six vertices per plane, so six u values each.
    const first = us.slice(0, 6);
    const second = us.slice(6);
    expect(Math.min(...first)).toBeCloseTo(0, 6);
    // 90° of 16 slices is slice 4, so u starts at 4/16.
    expect(Math.min(...second)).toBeCloseTo(4 / 16, 6);
  });

  it("picks the slice nearest the instance's own rotation", () => {
    const g = buildImpostorGeometry([instance({ rotationY: 90 })], impostor(16), 5);
    const us = [...attr(g, "uv")].filter((_, i) => i % 2 === 0);
    expect(Math.min(...us.slice(0, 6))).toBeCloseTo(4 / 16, 6);
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
