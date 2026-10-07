import { readFileSync } from "node:fs";
import { loadScene, type Site, type SolarTime, wallBearing } from "@solstice/schema";
import { describe, expect, it } from "vitest";
import {
  dayBounds,
  directionFrom,
  hexToRgb,
  localToUtc,
  resolveSolar,
  type SunVector,
  skyRadianceMap,
  sunLighting,
  sunPosition,
  utcToLocalClock,
  zoneOffsetMs,
} from "../src/index.js";

const bucharest: Site = {
  latitude: 44.4268,
  longitude: 26.1025,
  timezone: "Europe/Bucharest",
  northOffset: 0,
  terrain: { kind: "flat", size: [140, 140], material: "grass" },
};

const at = (date: string, time: string): SolarTime => ({ date, time });

describe("timezone resolution", () => {
  it("reads Bucharest summer time as UTC+3", () => {
    expect(localToUtc("2026-06-21", "17:42", "Europe/Bucharest").toISOString()).toBe(
      "2026-06-21T14:42:00.000Z",
    );
  });

  it("reads Bucharest winter time as UTC+2", () => {
    expect(localToUtc("2026-01-15", "12:00", "Europe/Bucharest").toISOString()).toBe(
      "2026-01-15T10:00:00.000Z",
    );
  });

  it("resolves correctly on both sides of a DST boundary", () => {
    // Europe/Bucharest springs forward on 2026-03-29.
    const before = localToUtc("2026-03-28", "12:00", "Europe/Bucharest");
    const after = localToUtc("2026-03-30", "12:00", "Europe/Bucharest");
    expect(before.toISOString()).toBe("2026-03-28T10:00:00.000Z");
    expect(after.toISOString()).toBe("2026-03-30T09:00:00.000Z");
    expect(zoneOffsetMs(before, "Europe/Bucharest")).toBe(2 * 3600_000);
    expect(zoneOffsetMs(after, "Europe/Bucharest")).toBe(3 * 3600_000);
  });

  it("round-trips back to the same wall clock", () => {
    const instant = localToUtc("2026-06-21", "17:42", "Europe/Bucharest");
    expect(utcToLocalClock(instant, "Europe/Bucharest")).toBe("17:42");
  });

  it("rejects a malformed date", () => {
    expect(() => localToUtc("not-a-date", "12:00", "UTC")).toThrow();
  });
});

describe("the reference sun position", () => {
  // The canonical moment, shared by the design artifact, the reference scene and
  // this test. suncalc is the authority: these figures include atmospheric
  // refraction, which a hand calculation omits (it lands ~0.6° out).
  const position = sunPosition(bucharest, at("2026-06-21", "17:42"));

  it("is at altitude 32.9°", () => {
    expect(position.altitude).toBeCloseTo(32.949, 2);
  });

  it("is at azimuth 271.7°, just north of due west", () => {
    expect(position.azimuth).toBeCloseTo(271.654, 2);
  });

  it("is daylight", () => {
    expect(position.isDaylight).toBe(true);
  });

  it("points west, so shadows fall east", () => {
    expect(position.direction.x).toBeLessThan(-0.8);
    expect(position.direction.y).toBeGreaterThan(0);
    expect(position.direction.z).toBeLessThan(0); // a touch north of west, and north is −Z
  });
});

describe("direction vectors", () => {
  it("puts the sun overhead at altitude 90", () => {
    const d = directionFrom(90, 180);
    expect(d.y).toBeCloseTo(1);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(0);
  });

  // The compass, pinned. North is −Z and east is +X, which with +Y up is the
  // right-handed pair. +Z north with +X east was a mirror image, and every
  // scene built on it was its own reflection.
  it.each([
    [0, 0, -1],
    [90, 1, 0],
    [180, 0, 1],
    [270, -1, 0],
  ])("puts azimuth %i at (%i, 0, %i)", (azimuth, x, z) => {
    const d = directionFrom(0, azimuth);
    expect(d.x).toBeCloseTo(x, 12);
    expect(d.y).toBeCloseTo(0, 12);
    expect(d.z).toBeCloseTo(z, 12);
  });

  it("throws a southern noon sun's shadows north, toward −Z", () => {
    const noon = directionFrom(60, 180);
    // A shadow falls away from the sun.
    const shadow = { x: -noon.x, z: -noon.z };
    expect(shadow.z).toBeLessThan(0);
    expect(shadow.x).toBeCloseTo(0, 12);
  });

  it("always returns a unit vector", () => {
    for (const [alt, az] of [
      [12, 40],
      [65, 210],
      [-8, 300],
    ] as const) {
      const d = directionFrom(alt, az);
      expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 6);
    }
  });
});

/**
 * The compass as a person sees it: from above, east to the right, north up.
 *
 * The screen's up is derived, not assumed. A camera looking straight down has
 * +X to its right and +Y coming back toward it; in a right-handed frame its up
 * is `back × right`. If the scene's compass were a mirror image, north would
 * come out *down* this screen and the sun would turn the wrong way.
 */
describe("seen from above", () => {
  type V = readonly [number, number, number];
  const cross = (a: V, b: V): V => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const right: V = [1, 0, 0];
  const back: V = [0, 1, 0];
  const up = cross(back, right);
  const onScreen = (d: SunVector): [number, number] => [
    d.x * right[0] + d.y * right[1] + d.z * right[2],
    d.x * up[0] + d.y * up[1] + d.z * up[2],
  ];

  it("has north up the screen and east to the right", () => {
    const [nx, ny] = onScreen(directionFrom(0, 0));
    expect(nx).toBeCloseTo(0, 12);
    expect(ny).toBeCloseTo(1, 12);
    const [ex, ey] = onScreen(directionFrom(0, 90));
    expect(ex).toBeCloseTo(1, 12);
    expect(ey).toBeCloseTo(0, 12);
  });

  it("watches the sun sweep clockwise over a day", () => {
    const points: [number, number][] = [];
    for (let minutes = 4 * 60; minutes <= 22 * 60; minutes += 30) {
      const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
      const position = sunPosition(bucharest, at("2026-06-21", time));
      if (position.isDaylight) points.push(onScreen(position.direction));
    }
    expect(points.length).toBeGreaterThan(25);
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1]!;
      const [bx, by] = points[i]!;
      // Negative z-component of the 2-D cross product: a clockwise turn.
      expect(ax * by - ay * bx).toBeLessThan(0);
    }
  });
});

/**
 * One compass, two functions. `wallBearing` (in `@solstice/schema`) names the
 * way a wall runs; `directionFrom` turns a bearing back into a vector. They
 * used to share `atan2(x, z)` by agreement alone. Here, a wall's bearing fed
 * back through `directionFrom` has to point along the wall.
 */
describe("wallBearing and directionFrom", () => {
  const walls: [number, number, number, number, number | null][] = [
    [0, 0, 0, -4, 0], // runs north
    [0, 0, 3, 0, 90], // east
    [0, 0, 0, 2, 180], // south
    [0, 0, -5, 0, 270], // west
    [1, -2, 5, 3, null], // neither axis-aligned nor 45°
    [2, 7, -1.5, 4.2, null],
  ];

  it.each(walls)("agree on a wall from (%d, %d) to (%d, %d)", (x1, z1, x2, z2, expected) => {
    const bearing = wallBearing({ start: [x1, z1], end: [x2, z2] });
    if (expected !== null) expect(bearing).toBeCloseTo(expected, 9);
    const d = directionFrom(0, bearing);
    const length = Math.hypot(x2 - x1, z2 - z1);
    expect(d.x).toBeCloseTo((x2 - x1) / length, 9);
    expect(d.z).toBeCloseTo((z2 - z1) / length, 9);
  });
});

describe("northOffset", () => {
  it("rotates scene azimuth without touching the true-north figure", () => {
    const rotated = sunPosition({ ...bucharest, northOffset: 30 }, at("2026-06-21", "17:42"));
    const plain = sunPosition(bucharest, at("2026-06-21", "17:42"));
    expect(rotated.azimuth).toBeCloseTo(plain.azimuth, 6);
    expect(rotated.sceneAzimuth).toBeCloseTo(plain.azimuth - 30, 6);
  });

  it("wraps past zero", () => {
    const rotated = sunPosition({ ...bucharest, northOffset: 300 }, at("2026-06-21", "17:42"));
    expect(rotated.sceneAzimuth).toBeGreaterThanOrEqual(0);
    expect(rotated.sceneAzimuth).toBeLessThan(360);
  });
});

describe("day bounds", () => {
  it("gives a long solstice day in Bucharest", () => {
    const bounds = dayBounds(bucharest, at("2026-06-21", "12:00"));
    expect(bounds.sunrise).not.toBeNull();
    expect(bounds.sunset).not.toBeNull();
    const hours = (bounds.sunset!.getTime() - bounds.sunrise!.getTime()) / 3600_000;
    expect(hours).toBeGreaterThan(15);
    expect(hours).toBeLessThan(16);
    expect(bounds.alwaysUp).toBe(false);
  });

  it("labels times in the site's own zone", () => {
    const bounds = dayBounds(bucharest, at("2026-06-21", "12:00"));
    expect(bounds.labels.sunrise).toMatch(/^0[45]:\d\d$/);
    expect(bounds.labels.sunset).toMatch(/^2[01]:\d\d$/);
  });

  it("survives polar day rather than crashing on a null sunrise", () => {
    const svalbard: Site = {
      ...bucharest,
      latitude: 78.22,
      longitude: 15.65,
      timezone: "Arctic/Longyearbyen",
    };
    const bounds = dayBounds(svalbard, at("2026-06-21", "12:00"));
    expect(bounds.alwaysUp).toBe(true);
    expect(bounds.sunrise).toBeNull();
    expect(bounds.labels.sunrise).toBe("—");
  });
});

describe("lighting model", () => {
  it("turns the sun off below the horizon but keeps some ambient", () => {
    const night = sunLighting(sunPosition(bucharest, at("2026-06-21", "01:00")));
    expect(night.intensity).toBe(0);
    expect(night.ambientIntensity).toBeGreaterThan(0);
  });

  it("is warmer near the horizon than at noon", () => {
    const low = sunLighting(sunPosition(bucharest, at("2026-06-21", "05:30")));
    const high = sunLighting(sunPosition(bucharest, at("2026-06-21", "13:15")));
    const blueOf = (hex: string) => Number.parseInt(hex.slice(5, 7), 16);
    expect(blueOf(low.color)).toBeLessThan(blueOf(high.color));
    expect(high.intensity).toBeGreaterThan(low.intensity);
  });

  it("clears the sky as the sun rises", () => {
    const low = sunLighting(sunPosition(bucharest, at("2026-06-21", "05:30")));
    const high = sunLighting(sunPosition(bucharest, at("2026-06-21", "13:15")));
    expect(high.sky.turbidity).toBeLessThan(low.sky.turbidity);
  });
});

describe("resolveSolar against the reference scene", () => {
  const doc = loadScene(
    JSON.parse(
      readFileSync(new URL("../../../scenes/villa-carpathia.scene.json", import.meta.url), "utf8"),
    ) as unknown,
  ).document;

  it("resolves the document's working moment", () => {
    const { position } = resolveSolar(doc);
    expect(position.altitude).toBeCloseTo(32.949, 2);
    expect(position.azimuth).toBeCloseTo(271.654, 2);
  });

  it("honours a shot's solar override", () => {
    const morning = doc.shots.find((s) => s.id === "garden-elevation")!.solar!;
    const { position } = resolveSolar(doc, morning);
    expect(position.altitude).toBeLessThan(30);
    expect(position.azimuth).toBeLessThan(120); // morning sun, east of south
  });
});

describe("sky radiance map", () => {
  const noon = sunPosition(bucharest, at("2026-06-21", "13:15"));
  const night = sunPosition(bucharest, at("2026-06-21", "01:00"));
  const white = { r: 1, g: 1, b: 1 };

  const luminance = (map: ReturnType<typeof skyRadianceMap>, x: number, y: number): number => {
    const i = (y * map.width + x) * 4;
    return 0.2126 * map.data[i]! + 0.7152 * map.data[i + 1]! + 0.0722 * map.data[i + 2]!;
  };

  it("has the requested dimensions and RGBA stride", () => {
    const map = skyRadianceMap({ sunDirection: noon.direction, sunColor: white, turbidity: 3 });
    expect(map.width).toBe(256);
    expect(map.height).toBe(128);
    expect(map.data.length).toBe(256 * 128 * 4);
  });

  it("produces only finite, non-negative radiance", () => {
    const map = skyRadianceMap({ sunDirection: noon.direction, sunColor: white, turbidity: 3 });
    let bad = 0;
    for (const v of map.data) if (!Number.isFinite(v) || v < 0) bad++;
    expect(bad).toBe(0);
  });

  it("is brighter above the horizon than below it", () => {
    const map = skyRadianceMap({ sunDirection: noon.direction, sunColor: white, turbidity: 3 });
    const above = luminance(map, 10, Math.floor(map.height * 0.85));
    const below = luminance(map, 10, Math.floor(map.height * 0.15));
    expect(above).toBeGreaterThan(below);
  });

  it("puts its brightest point in the sun's direction", () => {
    const map = skyRadianceMap({ sunDirection: noon.direction, sunColor: white, turbidity: 2 });
    let best = -1;
    let bx = 0;
    let by = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const l = luminance(map, x, y);
        if (l > best) {
          best = l;
          bx = x;
          by = y;
        }
      }
    }
    // Invert three's equirect mapping and compare with the sun vector.
    const elevation = ((by + 0.5) / map.height - 0.5) * Math.PI;
    const phi = ((bx + 0.5) / map.width - 0.5) * 2 * Math.PI;
    const dir = {
      x: Math.cos(phi) * Math.cos(elevation),
      y: Math.sin(elevation),
      z: Math.sin(phi) * Math.cos(elevation),
    };
    const dot = dir.x * noon.direction.x + dir.y * noon.direction.y + dir.z * noon.direction.z;
    expect(dot).toBeGreaterThan(0.97);
    expect(best).toBeGreaterThan(5);
  });

  it("is dark at night", () => {
    const map = skyRadianceMap({ sunDirection: night.direction, sunColor: white, turbidity: 3 });
    let peak = 0;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) peak = Math.max(peak, luminance(map, x, y));
    }
    expect(peak).toBeLessThan(0.5);
  });

  it("pales the horizon as turbidity rises", () => {
    const clear = skyRadianceMap({ sunDirection: noon.direction, sunColor: white, turbidity: 2 });
    const hazy = skyRadianceMap({ sunDirection: noon.direction, sunColor: white, turbidity: 9 });
    const row = Math.floor(clear.height * 0.52);
    expect(luminance(hazy, 200, row)).toBeGreaterThan(luminance(clear, 200, row));
  });

  it("honours a requested size", () => {
    const map = skyRadianceMap({
      sunDirection: noon.direction,
      sunColor: white,
      turbidity: 3,
      width: 64,
      height: 32,
    });
    expect(map.data.length).toBe(64 * 32 * 4);
  });
});

describe("hexToRgb", () => {
  it("splits a hex triplet into 0–1 components", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 1, g: 1, b: 1 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("e8a33d").r).toBeCloseTo(232 / 255, 5);
  });
});
