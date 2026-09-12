import type { SunVector } from "./index.js";

export interface SkyMapOptions {
  /** Unit vector toward the sun, Y-up. */
  sunDirection: SunVector;
  /** Linear RGB of the sun, 0–1 each. */
  sunColor: { r: number; g: number; b: number };
  /** Haze. Higher means a paler, more diffuse sky. */
  turbidity: number;
  width?: number;
  height?: number;
  /** Ground albedo below the horizon. */
  groundColor?: { r: number; g: number; b: number };
}

export interface SkyMap {
  width: number;
  height: number;
  /** RGBA float radiance, row 0 at v = 0. Equirectangular. */
  data: Float32Array;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface SkyGradient {
  /** Linear RGB straight up. */
  zenith: { r: number; g: number; b: number };
  /** Linear RGB at the horizon. */
  horizon: { r: number; g: number; b: number };
  /** 0 below the horizon, 1 once the sun is well up. */
  day: number;
}

/**
 * The dome's colour, without drawing it.
 *
 * Split out of `skyRadianceMap` because the **viewport** needs the same answer
 * the **path tracer's environment** is built from, and it cannot afford to
 * build a 256 × 128 float map to get it — that is 131 072 iterations per frame
 * while someone scrubs the timeline.
 *
 * Below the horizon this is the whole story: the sun disc and its glow never
 * run, so the dome is exactly this gradient and nothing else. That is the case
 * the viewport needs it for.
 */
export function skyGradient(sunY: number, turbidity: number): SkyGradient {
  const haze = clamp01((turbidity - 2) / 8);
  const day = clamp01(sunY * 2.2);
  return {
    zenith: { r: 0.06 + 0.16 * day, g: 0.11 + 0.26 * day, b: 0.24 + 0.46 * day },
    horizon: {
      r: mix(0.1, 0.62, day) + 0.18 * haze,
      g: mix(0.11, 0.68, day) + 0.16 * haze,
      b: mix(0.16, 0.82, day) + 0.12 * haze,
    },
    day,
  };
}

/**
 * A sky dome as an equirectangular radiance map.
 *
 * The path tracer gathers light from an environment texture and needs one with
 * readable pixels — a PMREM render target has none, which is the trap this
 * replaced. It is also the reason this is pure arithmetic over a `Float32Array`
 * rather than anything three.js: it can be tested without a GPU, and the web app
 * only has to wrap it in a `DataTexture`.
 *
 * Physically motivated rather than physically accurate: a horizon-to-zenith
 * gradient, a sun disc with a glow whose tightness falls off with turbidity, and
 * a dim ground hemisphere. A real Poly Haven HDRI replaces it once assets land.
 */
export function skyRadianceMap(options: SkyMapOptions): SkyMap {
  const width = options.width ?? 256;
  const height = options.height ?? 128;
  const { sunDirection: sun, sunColor, turbidity } = options;
  const ground = options.groundColor ?? { r: 0.16, g: 0.14, b: 0.11 };

  // Haze widens the glow and lifts the horizon's brightness.
  const haze = clamp01((turbidity - 2) / 8);
  const discPower = mix(900, 180, haze);
  const glowPower = mix(28, 6, haze);

  // The dome dims and warms as the sun sinks; below the horizon it is night.
  // Shared with the viewport, which paints the same gradient without building
  // the map — see `skyGradient`.
  const { day, zenith, horizon } = skyGradient(sun.y, turbidity);

  const data = new Float32Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = (y + 0.5) / height;
    // three samples equirect as v = asin(dir.y) / π + 0.5.
    const elevation = (v - 0.5) * Math.PI;
    const dy = Math.sin(elevation);
    const horizontal = Math.cos(elevation);

    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const phi = (u - 0.5) * 2 * Math.PI;
      const dx = Math.cos(phi) * horizontal;
      const dz = Math.sin(phi) * horizontal;

      const i = (y * width + x) * 4;
      let r: number;
      let g: number;
      let b: number;

      if (dy < 0) {
        // Below the horizon: dim, and darker the further down you look.
        const depth = clamp01(-dy * 2);
        const lit = 0.35 + 0.65 * day;
        r = ground.r * lit * (1 - depth * 0.6);
        g = ground.g * lit * (1 - depth * 0.6);
        b = ground.b * lit * (1 - depth * 0.6);
      } else {
        const t = Math.pow(clamp01(dy), 0.55);
        r = mix(horizon.r, zenith.r, t);
        g = mix(horizon.g, zenith.g, t);
        b = mix(horizon.b, zenith.b, t);

        const alignment = clamp01(dx * sun.x + dy * sun.y + dz * sun.z);
        if (sun.y > 0) {
          const disc = Math.pow(alignment, discPower) * 120;
          const glow = Math.pow(alignment, glowPower) * 1.4;
          r += sunColor.r * (disc + glow);
          g += sunColor.g * (disc + glow);
          b += sunColor.b * (disc + glow);
        }
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }

  return { width, height, data };
}

/** `#rrggbb` to linear-ish 0–1 components, for feeding `sunColor`. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16) / 255,
    g: Number.parseInt(value.slice(2, 4), 16) / 255,
    b: Number.parseInt(value.slice(4, 6), 16) / 255,
  };
}
