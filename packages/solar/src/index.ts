import { getPosition, getTimes } from "suncalc";
import type { SceneDocument, Site, SolarTime } from "@solstice/schema";

export * from "./timezone.js";
import { localToUtc, utcToLocalClock } from "./timezone.js";

/** A unit vector, Y-up, pointing from the origin toward the sun. */
export interface SunVector {
  x: number;
  y: number;
  z: number;
}

export interface SunPosition {
  /** The UTC instant the document's local time resolved to. */
  instant: Date;
  /** Degrees above the horizon. Negative means the sun is down. */
  altitude: number;
  /** Compass degrees clockwise from true north. 180 is due south. */
  azimuth: number;
  /**
   * Azimuth in scene space, with `site.northOffset` applied. This is the one
   * geometry should use; `azimuth` is the real-world figure an architect checks.
   */
  sceneAzimuth: number;
  /** Direction toward the sun in scene space, Y-up. */
  direction: SunVector;
  /** True while the sun is above the horizon. */
  isDaylight: boolean;
}

export interface DayBounds {
  /** Null during polar day or polar night, where no rise or set occurs. */
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date;
  goldenHourEnd: Date | null;
  goldenHourStart: Date | null;
  /** True when the sun never sets on this date at this latitude. */
  alwaysUp: boolean;
  /** True when it never rises. */
  alwaysDown: boolean;
  /** Local `HH:MM` for each, for timeline labelling. `—` when absent. */
  labels: {
    sunrise: string;
    sunset: string;
    solarNoon: string;
  };
}

const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

/**
 * Resolve a site and a solar moment into a sun position.
 *
 * suncalc 2.x reports **degrees**, with azimuth already north-based clockwise
 * (0 = N, 90 = E, 180 = S, 270 = W) — unlike 1.x, which returned radians measured
 * from south. No conversion is needed here, and adding one would put the sun in
 * the wrong quadrant while still looking plausible.
 */
export function sunPosition(site: Site, solar: SolarTime): SunPosition {
  const instant = localToUtc(solar.date, solar.time, site.timezone);
  const raw = getPosition(instant, site.latitude, site.longitude);

  const altitude = raw.altitude;
  const azimuth = norm360(raw.azimuth);
  const sceneAzimuth = norm360(azimuth - site.northOffset);

  return {
    instant,
    altitude,
    azimuth,
    sceneAzimuth,
    direction: directionFrom(altitude, sceneAzimuth),
    isDaylight: altitude > 0,
  };
}

/**
 * Altitude and scene azimuth to a unit vector.
 *
 * Scene +Z is north and +X is east, so a sun in the west (azimuth 270°) gives a
 * negative x — and therefore shadows that fall east. That relationship is the
 * cheapest way to sanity-check a render.
 */
export function directionFrom(altitude: number, sceneAzimuth: number): SunVector {
  const alt = (altitude * Math.PI) / 180;
  const az = (sceneAzimuth * Math.PI) / 180;
  const horizontal = Math.cos(alt);
  return {
    x: horizontal * Math.sin(az),
    y: Math.sin(alt),
    z: horizontal * Math.cos(az),
  };
}

/**
 * Sunrise, sunset and golden hour for the document's date at its site.
 *
 * Every rise/set time is nullable: above the Arctic or Antarctic circle the sun
 * may not cross the horizon at all, and the timeline has to render that rather
 * than crash on it.
 */
export function dayBounds(site: Site, solar: SolarTime): DayBounds {
  const noonish = localToUtc(solar.date, "12:00", site.timezone);
  const times = getTimes(noonish, site.latitude, site.longitude);
  const clock = (d: Date | null): string =>
    d === null ? "—" : utcToLocalClock(d, site.timezone);

  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    solarNoon: times.solarNoon,
    goldenHourEnd: times.goldenHourEnd,
    goldenHourStart: times.goldenHour,
    alwaysUp: times.alwaysUp === true,
    alwaysDown: times.alwaysDown === true,
    labels: {
      sunrise: clock(times.sunrise),
      sunset: clock(times.sunset),
      solarNoon: clock(times.solarNoon),
    },
  };
}

export interface SunLighting {
  /** Linear sRGB hex for the directional light. */
  color: string;
  /** Directional light intensity; 0 when the sun is down. */
  intensity: number;
  /** Ambient/hemisphere contribution, which survives after sunset. */
  ambientIntensity: number;
  /** Rayleigh/turbidity inputs for `three/addons` Sky. */
  sky: { turbidity: number; rayleigh: number; elevation: number; azimuth: number };
}

/**
 * A defensible, deliberately simple lighting model: the sun reddens and dims as
 * it approaches the horizon, and ambient light outlives it. This is a starting
 * point for the viewport, not a photometric claim — the path tracer gets its
 * real light from an HDRI.
 */
export function sunLighting(position: SunPosition): SunLighting {
  const altitude = position.altitude;
  const t = Math.max(0, Math.min(1, altitude / 60));

  // Warm at the horizon (2 000 K-ish), neutral high in the sky.
  const warm = { r: 1.0, g: 0.55, b: 0.28 };
  const neutral = { r: 1.0, g: 0.97, b: 0.93 };
  const mix = (a: number, b: number) => a + (b - a) * t;
  const to255 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  const hex = `#${[
    to255(mix(warm.r, neutral.r)),
    to255(mix(warm.g, neutral.g)),
    to255(mix(warm.b, neutral.b)),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;

  const intensity = altitude <= 0 ? 0 : Math.min(3.2, 0.35 + 3.0 * Math.sin((altitude * Math.PI) / 180));
  const ambientIntensity = altitude <= -6 ? 0.05 : 0.15 + 0.45 * Math.max(0, t);

  return {
    color: hex,
    intensity,
    ambientIntensity,
    sky: {
      turbidity: 2 + 6 * (1 - t),
      rayleigh: 1 + 2 * (1 - t),
      elevation: altitude,
      azimuth: position.sceneAzimuth,
    },
  };
}

/** Everything the viewport needs for the document's current solar moment. */
export function resolveSolar(doc: SceneDocument, override?: SolarTime) {
  const solar = override ?? doc.solar;
  const position = sunPosition(doc.site, solar);
  return {
    solar,
    position,
    bounds: dayBounds(doc.site, solar),
    lighting: sunLighting(position),
  };
}
