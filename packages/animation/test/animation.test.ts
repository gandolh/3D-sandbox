import { describe, expect, it } from "vitest";
import { Track, Animation } from "@solstice/schema";
import {
  clockToMinutes,
  ease,
  evaluate,
  evaluateTrack,
  minutesToClock,
  mod,
} from "../src/index.js";

const track = (keys: { at: number; value: number; easing?: string }[]) =>
  Track.parse({ id: "t", target: "solar.minutes", keyframes: keys });

describe("evaluateTrack", () => {
  const sun = track([
    { at: 0, value: 360, easing: "linear" },
    { at: 10, value: 1200, easing: "linear" },
  ]);

  it("interpolates between keyframes", () => {
    expect(evaluateTrack(sun, 5)).toBeCloseTo(780, 6);
  });

  it("holds flat outside the track rather than extrapolating", () => {
    // A sun that keeps rising past the end of the study because the gradient
    // said so is worse than one that stops.
    expect(evaluateTrack(sun, -50)).toBe(360);
    expect(evaluateTrack(sun, 999)).toBe(1200);
  });

  it("hits its keyframes exactly", () => {
    expect(evaluateTrack(sun, 0)).toBe(360);
    expect(evaluateTrack(sun, 10)).toBe(1200);
  });

  it("sorts keyframes rather than trusting the document", () => {
    const jumbled = track([
      { at: 10, value: 1200, easing: "linear" },
      { at: 0, value: 360, easing: "linear" },
    ]);
    expect(evaluateTrack(jumbled, 5)).toBeCloseTo(780, 6);
  });

  it("treats two keyframes at one instant as a step, not a divide by zero", () => {
    const step = track([
      { at: 0, value: 100 },
      { at: 5, value: 200 },
      { at: 5, value: 900 },
      { at: 9, value: 900 },
    ]);
    expect(Number.isFinite(evaluateTrack(step, 5))).toBe(true);
    expect(evaluateTrack(step, 7)).toBe(900);
  });

  it("takes its easing from the keyframe being approached", () => {
    const mixed = track([
      { at: 0, value: 0, easing: "linear" },
      { at: 10, value: 100, easing: "linear" },
      { at: 20, value: 200, easing: "in" },
    ]);
    // Linear segment: exactly halfway.
    expect(evaluateTrack(mixed, 5)).toBeCloseTo(50, 6);
    // Eased-in segment: behind halfway at the midpoint.
    expect(evaluateTrack(mixed, 15)).toBeLessThan(150);
  });
});

describe("ease", () => {
  it("is pinned at both ends for every kind", () => {
    for (const kind of ["linear", "in", "out", "inOut"] as const) {
      expect(ease(kind, 0)).toBeCloseTo(0, 6);
      expect(ease(kind, 1)).toBeCloseTo(1, 6);
    }
  });

  it("clamps out-of-range input", () => {
    expect(ease("inOut", -3)).toBe(0);
    expect(ease("inOut", 4)).toBe(1);
  });
});

describe("evaluate", () => {
  const doc = (loop: boolean) =>
    Animation.parse({
      duration: 10,
      loop,
      tracks: [
        { id: "sun", target: "solar.minutes", keyframes: [
          { at: 0, value: 360, easing: "linear" },
          { at: 10, value: 1200, easing: "linear" },
        ] },
      ],
    });

  it("returns a value per target", () => {
    expect(evaluate(doc(false), 5)["solar.minutes"]).toBeCloseTo(780, 6);
  });

  it("wraps the clock when looping", () => {
    expect(evaluate(doc(true), 15)["solar.minutes"]).toBeCloseTo(780, 6);
  });

  it("holds at the end when not looping", () => {
    expect(evaluate(doc(false), 15)["solar.minutes"]).toBe(1200);
  });
});

describe("clock conversion", () => {
  it("round-trips", () => {
    expect(minutesToClock(clockToMinutes("17:20"))).toBe("17:20");
    expect(clockToMinutes(minutesToClock(1040))).toBe(1040);
  });

  it("clamps to one day rather than rolling into 24:00", () => {
    expect(minutesToClock(1_000_000)).toBe("23:59");
    expect(minutesToClock(-5)).toBe("00:00");
  });

  it("mod is never negative", () => {
    expect(mod(-1, 10)).toBe(9);
  });
});
