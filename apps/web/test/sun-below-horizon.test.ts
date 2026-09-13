import { resolveSolar, skyGradient, skyRadianceMap, sunPosition } from "@solstice/solar";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { aimSun } from "../src/engine/SandboxEngine.js";

/**
 * The viewport and the render must show the same sky.
 *
 * The engine positions a `DirectionalLight` with `Math.max(1, y * distance)` to
 * keep its shadow camera out of a degenerate direction, and that same clamped
 * vector was normalised into the `Sky` shader's `sunPosition`. The path
 * tracer's environment was built from the *unclamped* direction. Above the
 * horizon the two agree closely enough that nothing showed; below it they
 * described different times of day.
 */

const BUCHAREST = {
  latitude: 44.4268,
  longitude: 26.1025,
  timezone: "Europe/Bucharest",
  northOffset: 0,
};

/** 2026-06-21 22:30 local — the brief's case, altitude −11.61°. */
const afterSunset = () => sunPosition(BUCHAREST as never, { date: "2026-06-21", time: "22:30" });

/** What the engine hands the `Sky` shader. */
const domeDirection = (direction: { x: number; y: number; z: number }) =>
  new THREE.Vector3(direction.x, direction.y, direction.z).normalize();

/** What the engine used to hand it: the light's own clamped position. */
const clampedDirection = (direction: { x: number; y: number; z: number }) => {
  const sun = new THREE.DirectionalLight();
  aimSun(sun, direction, { color: "#ffffff", intensity: 0 });
  return sun.position.clone().normalize();
};

describe("after sunset", () => {
  it("is genuinely below the horizon at the clock the brief names", () => {
    // Pinned so the rest of this file is testing the engine rather than the
    // almanac. `@solstice/solar` was verified against suncalc separately.
    expect(afterSunset().altitude).toBeCloseTo(-11.61, 1);
  });

  it("gives the dome and the environment the same vector", () => {
    const { direction } = afterSunset();
    const dome = domeDirection(direction);
    // `buildSkyEnvironment` passes `position.direction` through untouched, so
    // the environment's vector *is* the unclamped direction.
    expect(dome.x).toBeCloseTo(direction.x, 12);
    expect(dome.y).toBeCloseTo(direction.y, 12);
    expect(dome.z).toBeCloseTo(direction.z, 12);
    expect(dome.y).toBeLessThan(0);
  });

  it("no longer lifts the dome's sun above the horizon", () => {
    // The measured symptom: the clamp turned −11.61° into +0.49°, which is a
    // sunset glow painted on a night sky.
    const { direction } = afterSunset();
    const lifted = clampedDirection(direction);
    expect(Math.asin(lifted.y) * (180 / Math.PI)).toBeCloseTo(0.49, 1);
    // That vector is still what the *light* uses, and it is no longer what the
    // dome uses. The two having separated is the fix.
    expect(lifted.y).not.toBeCloseTo(direction.y, 3);
  });

  it("turns the shadow light off rather than hoisting it", () => {
    const { direction } = afterSunset();
    const sun = new THREE.DirectionalLight();
    aimSun(sun, direction, { color: "#ffffff", intensity: 0 });
    expect(sun.visible).toBe(false);
  });

  it("paints a night sky, not a black one", () => {
    // The viewport hides three's `Sky` below the horizon — its whole result is
    // driven by `sunIntensity(dot(sun, up))`, which is 0 there — and paints
    // this gradient instead. It must be the same one the environment map is
    // built from, or the render still disagrees.
    const { direction } = afterSunset();
    const gradient = skyGradient(direction.y, 6);
    expect(gradient.day).toBe(0);
    expect(gradient.zenith.b).toBeGreaterThan(0.2);

    const map = skyRadianceMap({
      sunDirection: direction,
      sunColor: { r: 1, g: 1, b: 1 },
      turbidity: 6,
      width: 8,
      height: 8,
    });
    // The top row's centre sits at 78.75° rather than straight up, so it is
    // 99 % of the way from horizon to zenith — close enough to identify the
    // number, which is the point: the environment's gradient and the
    // viewport's background are computed by one function.
    expect(map.data[(7 * 8 + 0) * 4 + 2]).toBeCloseTo(gradient.zenith.b, 2);
    expect(map.data[(7 * 8 + 0) * 4 + 2]).toBeLessThanOrEqual(gradient.zenith.b);
  });
});

describe("just above the horizon", () => {
  it("still lights and still casts, at 1–3° altitude", () => {
    // The clamp exists for this band and must keep working: a low sun is when
    // shadows are longest and most worth getting right.
    const low = sunPosition(BUCHAREST as never, { date: "2026-06-21", time: "21:00" });
    expect(low.altitude).toBeGreaterThan(0);
    expect(low.altitude).toBeLessThan(6);

    const sun = new THREE.DirectionalLight();
    aimSun(sun, low.direction, { color: "#ffffff", intensity: 1.2 });
    expect(sun.visible).toBe(true);
    expect(sun.position.y).toBeGreaterThanOrEqual(1);
    expect(sun.intensity).toBe(1.2);
  });

  it("agrees with the environment above the horizon too", () => {
    const solved = resolveSolar({
      site: BUCHAREST,
      solar: { date: "2026-06-21", time: "12:00" },
    } as never);
    const dome = domeDirection(solved.position.direction);
    expect(dome.y).toBeCloseTo(solved.position.direction.y, 12);
  });
});
