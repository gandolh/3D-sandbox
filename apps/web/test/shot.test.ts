import type { Shot } from "@solstice/schema";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { FILM_WIDTH_MM, shotCamera, shotFov } from "../src/engine/shot.js";

const shot = (over: Partial<Shot["camera"]> = {}, render = {}): Shot => ({
  id: "s",
  name: "S",
  camera: { position: [0, 2, 10], target: [0, 2, 0], focalLength: 35, ...over },
  render: { width: 1920, height: 1080, samples: 100, ...render },
});

describe("shotFov", () => {
  it("matches the textbook 3:2 figure for a 50 mm lens", () => {
    // 36 × 24 mm at 50 mm is the canonical "normal" lens: 39.6° across the
    // diagonal's short side. This is the one value worth pinning to an
    // external fact rather than to our own arithmetic.
    expect(shotFov(50, 36 / 24)).toBeCloseTo(26.99, 1);
  });

  it("derives film height from the aspect, not a fixed 24 mm", () => {
    // A 16:9 frame is shorter than a 3:2 frame at the same film width, so it
    // must see *less* vertically at the same focal length.
    const wide = shotFov(35, 16 / 9);
    const still = shotFov(35, 3 / 2);
    expect(wide).toBeLessThan(still);
    expect(wide).toBeCloseTo(32.2, 0);
  });

  it("is monotonic: longer lenses see less", () => {
    const a = shotFov(35, 16 / 9);
    const b = shotFov(85, 16 / 9);
    expect(b).toBeLessThan(a);
  });

  it("uses full-frame width", () => {
    expect(FILM_WIDTH_MM).toBe(36);
  });
});

describe("shotCamera", () => {
  it("takes its aspect from the declared output size, not the window", () => {
    const camera = shotCamera(shot({}, { width: 2560, height: 1440 }));
    expect(camera.aspect).toBeCloseTo(2560 / 1440, 6);
    expect(camera.fov).toBeCloseTo(shotFov(35, 2560 / 1440), 6);
  });

  it("sits at the declared position and looks at the target", () => {
    const camera = shotCamera(shot({ position: [-14.5, 6.2, -12.8], target: [0, 2.4, 0] }));
    expect(camera.position.toArray()).toEqual([-14.5, 6.2, -12.8]);

    // Where a camera looks is only observable through its orientation: its
    // local -Z must point from the eye toward the target.
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const toTarget = new THREE.Vector3(0, 2.4, 0).sub(camera.position).normalize();
    expect(forward.dot(toTarget)).toBeCloseTo(1, 5);
  });
});
