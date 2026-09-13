import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { boxProjectUv } from "../src/uv.js";

const uvsOf = (g: THREE.BufferGeometry) => [...g.getAttribute("uv").array];

describe("boxProjectUv", () => {
  it("ties texture repeats to metres, not to face size", () => {
    // The bug it exists for: a BoxGeometry carries 0–1 UVs across every face,
    // so a 6 m wall and a 1 m pier would show the same number of bricks.
    const wide = boxProjectUv(new THREE.BoxGeometry(6, 3, 0.3), 1);
    const narrow = boxProjectUv(new THREE.BoxGeometry(1, 3, 0.3), 1);
    const span = (g: THREE.BufferGeometry) => {
      const u = uvsOf(g).filter((_, i) => i % 2 === 0);
      return Math.max(...u) - Math.min(...u);
    };
    // Six metres of wall is six repeats at a 1 m tile; one metre is one.
    expect(span(wide)).toBeCloseTo(6, 5);
    expect(span(narrow)).toBeCloseTo(1, 5);
  });

  it("scales inversely with the tile size", () => {
    const fine = boxProjectUv(new THREE.BoxGeometry(4, 4, 4), 1);
    const coarse = boxProjectUv(new THREE.BoxGeometry(4, 4, 4), 2);
    const span = (g: THREE.BufferGeometry) => {
      const u = uvsOf(g).filter((_, i) => i % 2 === 0);
      return Math.max(...u) - Math.min(...u);
    };
    expect(span(fine) / span(coarse)).toBeCloseTo(2, 5);
  });

  it("keeps each triangle on one projection axis", () => {
    // Choosing per vertex would split a triangle across two projections and
    // tear the texture down its middle.
    const g = boxProjectUv(new THREE.BoxGeometry(2, 2, 2), 1);
    const uv = uvsOf(g);
    for (let i = 0; i < uv.length; i += 6) {
      const us = [uv[i], uv[i + 2], uv[i + 4]] as number[];
      const vs = [uv[i + 1], uv[i + 3], uv[i + 5]] as number[];
      // A degenerate triangle in UV space is the symptom of a mixed axis.
      const area = Math.abs((us[1]! - us[0]!) * (vs[2]! - vs[0]!) - (us[2]! - us[0]!) * (vs[1]! - vs[0]!));
      expect(area).toBeGreaterThan(0);
    }
  });

  it("leaves geometry alone when the tile size is nonsense", () => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const before = uvsOf(box);
    expect(uvsOf(boxProjectUv(box, 0))).toEqual(before);
  });
});
