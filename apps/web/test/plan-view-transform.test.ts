import { describe, expect, it } from "vitest";
import {
  EMPTY_EXTENT,
  fitExtent,
  formatMetres,
  GRID_MIN_PX,
  gridLines,
  gridTier,
  levelExtent,
  MAX_SCALE,
  MIN_SCALE,
  pan,
  toScreen,
  toWorld,
  type ViewTransform,
  visibleExtent,
  wheelFactor,
  zoomAt,
} from "../src/lib/plan-view.js";

const view: ViewTransform = { scale: 40, originX: 300, originY: 200 };

describe("the plan view transform", () => {
  it("round-trips world to screen and back", () => {
    for (const pt of [
      [0, 0],
      [3.25, -7.5],
      [-12.04, 19.99],
    ] as const) {
      const [x, z] = toWorld(view, toScreen(view, pt));
      expect(x).toBeCloseTo(pt[0], 12);
      expect(z).toBeCloseTo(pt[1], 12);
    }
  });

  it("puts east to the right and north up the screen", () => {
    // The compass decision: +X east, −Z north. Screen y grows downward, so a
    // point further north (more negative z) must sit higher, at a smaller y.
    const origin = toScreen(view, [0, 0]);
    const east = toScreen(view, [1, 0]);
    const north = toScreen(view, [0, -5]);
    expect(east[0]).toBeGreaterThan(origin[0]);
    expect(east[1]).toBe(origin[1]);
    expect(north[1]).toBeLessThan(origin[1]);
    expect(north[0]).toBe(origin[0]);
  });

  it("keeps the point under the pointer still while zooming", () => {
    const pointer: [number, number] = [517, 133];
    const before = toWorld(view, pointer);
    for (const factor of [1.15, 0.5, 3, 0.9]) {
      const after = toWorld(zoomAt(view, pointer, factor), pointer);
      expect(after[0]).toBeCloseTo(before[0], 10);
      expect(after[1]).toBeCloseTo(before[1], 10);
    }
  });

  it("keeps the pointer still at the zoom limits too", () => {
    // Clamped zoom is where a naive implementation drifts: the factor asked for
    // is not the factor applied, and the origin must be solved for the latter.
    const pointer: [number, number] = [90, 410];
    const before = toWorld(view, pointer);
    const inFar = zoomAt(view, pointer, 1e6);
    const outFar = zoomAt(view, pointer, 1e-6);
    expect(inFar.scale).toBe(MAX_SCALE);
    expect(outFar.scale).toBe(MIN_SCALE);
    for (const v of [inFar, outFar]) {
      const after = toWorld(v, pointer);
      expect(after[0]).toBeCloseTo(before[0], 9);
      expect(after[1]).toBeCloseTo(before[1], 9);
    }
  });

  it("zooms in on a wheel up and out on a wheel down", () => {
    expect(wheelFactor(-100)).toBeGreaterThan(1);
    expect(wheelFactor(100)).toBeLessThan(1);
    expect(wheelFactor(100) * wheelFactor(-100)).toBeCloseTo(1, 12);
  });

  it("pans by screen pixels", () => {
    const moved = pan(view, 25, -10);
    expect(toScreen(moved, [2, 2])).toEqual([toScreen(view, [2, 2])[0] + 25, toScreen(view, [2, 2])[1] - 10]);
    expect(moved.scale).toBe(view.scale);
  });

  it("fits an extent centred, inside the padding", () => {
    const extent = { minX: -4, maxX: 6, minZ: -20, maxZ: -12 };
    const fitted = fitExtent(extent, 800, 600, 32);
    const [l, t] = toScreen(fitted, [extent.minX, extent.minZ]);
    const [r, b] = toScreen(fitted, [extent.maxX, extent.maxZ]);
    expect((l + r) / 2).toBeCloseTo(400, 9);
    expect((t + b) / 2).toBeCloseTo(300, 9);
    expect(l).toBeGreaterThanOrEqual(32 - 1e-9);
    expect(r).toBeLessThanOrEqual(800 - 32 + 1e-9);
    expect(t).toBeGreaterThanOrEqual(32 - 1e-9);
    expect(b).toBeLessThanOrEqual(600 - 32 + 1e-9);
    // And it is tight on the constraining axis: 8 m of depth in 536 px.
    expect(fitted.scale).toBeCloseTo(536 / 8, 9);
  });

  it("frames 20 × 20 m around the origin on an empty level", () => {
    expect(levelExtent([])).toEqual(EMPTY_EXTENT);
    const fitted = fitExtent(levelExtent([]), 800, 600);
    const shown = visibleExtent(fitted, 800, 600);
    expect(shown.minX).toBeLessThanOrEqual(-10);
    expect(shown.maxX).toBeGreaterThanOrEqual(10);
    expect(shown.minZ).toBeLessThanOrEqual(-10);
    expect(shown.maxZ).toBeGreaterThanOrEqual(10);
    expect(toScreen(fitted, [0, 0])).toEqual([400, 300]);
  });

  it("fits a level to its walls' plan rectangles, not their centrelines", () => {
    const wall = {
      id: "W-01",
      start: [0, 0] as [number, number],
      end: [8, 0] as [number, number],
      thickness: 0.3,
      material: "m",
      openings: [],
    };
    const extent = levelExtent([wall]);
    expect(extent.minX).toBeCloseTo(0, 12);
    expect(extent.maxX).toBeCloseTo(8, 12);
    expect(extent.minZ).toBeCloseTo(-0.15, 12);
    expect(extent.maxZ).toBeCloseTo(0.15, 12);
  });
});

describe("the grid", () => {
  it("draws 1 m and 5 m lines when they are far enough apart", () => {
    const tier = gridTier(40);
    expect(tier).toMatchObject({ minor: 1, major: 5, minorAlpha: 1 });
  });

  it("thins out as you zoom away, so it never turns grey", () => {
    for (const scale of [MIN_SCALE, 3, 5, 7.9, 12, 40, 400, MAX_SCALE]) {
      const tier = gridTier(scale);
      // The minor lines are never closer than the floor on screen.
      expect(tier.minor * scale).toBeGreaterThanOrEqual(GRID_MIN_PX);
      expect(tier.major).toBe(tier.minor * 5);
    }
    expect(gridTier(4).minor).toBe(5);
    expect(gridTier(0.5 + MIN_SCALE).minor).toBe(5);
  });

  it("fades minor lines in rather than popping them on", () => {
    expect(gridTier(GRID_MIN_PX).minorAlpha).toBe(0);
    expect(gridTier(GRID_MIN_PX * 1.5).minorAlpha).toBeCloseTo(0.5, 12);
    expect(gridTier(GRID_MIN_PX * 2).minorAlpha).toBe(1);
  });

  it("lists only the lines in range", () => {
    expect(gridLines(-2.5, 3.1, 1)).toEqual([-2, -1, 0, 1, 2, 3]);
    expect(gridLines(0.2, 0.8, 1)).toEqual([]);
  });
});

describe("the readout", () => {
  it("shows metres to the centimetre, and never minus zero", () => {
    expect(formatMetres(12.3456)).toBe("12.35");
    expect(formatMetres(-20.3)).toBe("-20.30");
    expect(formatMetres(-0.001)).toBe("0.00");
    expect(formatMetres(0.005)).toBe("0.01");
  });
});
