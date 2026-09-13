import type { Shot } from "@solstice/schema";
import { describe, expect, it } from "vitest";
import {
  estimateQueue,
  formatDuration,
  MEASURED_SAMPLES_PER_SECOND,
  renderQueue,
} from "../src/engine/queue.js";

const shot = (id: string, render: Partial<Shot["render"]> = {}): Shot => ({
  id,
  name: id.toUpperCase(),
  camera: { position: [0, 2, 10], target: [0, 2, 0], focalLength: 35 },
  render: { width: 1920, height: 1080, samples: 600, ...render },
});

describe("renderQueue", () => {
  it("keeps document order", () => {
    // The storyboard's order is the author's, and sorting by cost would
    // silently reorder it.
    const queue = renderQueue([shot("c", { samples: 10 }), shot("a"), shot("b", { samples: 50 })]);
    expect(queue.map((r) => r.shot?.id)).toEqual(["c", "a", "b"]);
  });

  it("carries each shot's own render settings, not a shared default", () => {
    const queue = renderQueue([shot("a", { samples: 100 }), shot("b", { width: 960, height: 540 })]);
    expect(queue[0]?.samples).toBe(100);
    expect(queue[1]?.width).toBe(960);
    expect(queue[1]?.samples).toBe(600);
  });

  it("is empty for a scene that declares no shots", () => {
    expect(renderQueue([])).toEqual([]);
    expect(estimateQueue([])).toEqual({ shots: 0, samples: 0, seconds: 0 });
  });
});

describe("estimateQueue", () => {
  it("reproduces the measured figure at the measured size", () => {
    // 600 samples at 1920 × 1080 was timed at ~870 s.
    const { seconds } = estimateQueue(renderQueue([shot("a")]));
    expect(seconds).toBeCloseTo(600 / MEASURED_SAMPLES_PER_SECOND, 5);
    expect(seconds).toBeGreaterThan(800);
    expect(seconds).toBeLessThan(900);
  });

  it("scales with pixel count, not with sample count alone", () => {
    // Quarter the area, quarter the time — the rate is per-pixel work.
    const full = estimateQueue(renderQueue([shot("a", { samples: 100 })]));
    const quarter = estimateQueue(renderQueue([shot("a", { samples: 100, width: 960, height: 540 })]));
    expect(full.samples).toBe(quarter.samples);
    expect(quarter.seconds).toBeCloseTo(full.seconds / 4, 5);
  });

  it("sums the whole queue", () => {
    const estimate = estimateQueue(renderQueue([shot("a"), shot("b"), shot("c"), shot("d")]));
    expect(estimate.shots).toBe(4);
    expect(estimate.samples).toBe(2400);
    // The number this feature exists to put in front of someone: about an hour.
    expect(formatDuration(estimate.seconds)).toBe("58 min");
  });

  it("does not divide by zero on a degenerate size", () => {
    const estimate = estimateQueue([{ width: 0, height: 0, samples: 10 }]);
    expect(Number.isFinite(estimate.seconds)).toBe(true);
  });
});

describe("formatDuration", () => {
  it("reads in the unit that fits", () => {
    expect(formatDuration(42)).toBe("42 s");
    expect(formatDuration(600)).toBe("10 min");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(3840)).toBe("1 h 4 min");
  });
});
