import { wallCorners } from "@solstice/drawing";
import { bounds, type Wall } from "@solstice/schema";

/**
 * The plan view's camera: world metres to screen pixels and back.
 *
 * Pure arithmetic, so the one thing a drawing surface must get exactly right —
 * which world point is under the pointer — is tested without a browser.
 *
 * The axes follow the compass decision: +X is east and runs right, −Z is north
 * and runs **up** the screen. Screen y grows downward, so z maps to y with no
 * sign change, exactly as the sheet does (`project` in `@solstice/drawing`).
 * Negating it would draw every building mirrored, which looks plausible from
 * every angle until someone builds from it.
 */
export interface ViewTransform {
  /** Pixels per metre. */
  scale: number;
  /** Screen position of the world origin, px from the surface's top-left. */
  originX: number;
  originY: number;
}

export type ScreenPt = readonly [number, number];
export type WorldPt = readonly [number, number];

/** How far in and out the wheel goes: a 400 m site to a 2 mm detail on a laptop screen. */
export const MIN_SCALE = 2;
export const MAX_SCALE = 4000;

const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

export const toScreen = (view: ViewTransform, [x, z]: WorldPt): [number, number] => [
  view.originX + x * view.scale,
  view.originY + z * view.scale,
];

export const toWorld = (view: ViewTransform, [sx, sy]: ScreenPt): [number, number] => [
  (sx - view.originX) / view.scale,
  (sy - view.originY) / view.scale,
];

/**
 * Zoom by `factor` about a screen point, which stays over the same world point.
 *
 * That invariant is what makes wheel zoom feel like CAD rather than like a map
 * that drifts away from the cursor: solve for the origin that puts the world
 * point back where it was.
 */
export function zoomAt(view: ViewTransform, at: ScreenPt, factor: number): ViewTransform {
  const world = toWorld(view, at);
  const scale = clampScale(view.scale * factor);
  return { scale, originX: at[0] - world[0] * scale, originY: at[1] - world[1] * scale };
}

export const pan = (view: ViewTransform, dx: number, dy: number): ViewTransform => ({
  ...view,
  originX: view.originX + dx,
  originY: view.originY + dy,
});

/** World-space bounds of what a fit should show. */
export interface Extent {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** What Fit shows on a level with nothing on it: 20 × 20 m around the origin. */
export const EMPTY_EXTENT: Extent = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };

/**
 * The transform that shows `extent` centred in a `width` × `height` surface,
 * with `padding` pixels kept clear on every side.
 *
 * A degenerate extent (one point, or one straight wall) gets a metre of room on
 * the flat axis, or the scale would be infinite.
 */
export function fitExtent(extent: Extent, width: number, height: number, padding = 32): ViewTransform {
  const spanX = Math.max(extent.maxX - extent.minX, 1);
  const spanZ = Math.max(extent.maxZ - extent.minZ, 1);
  const usableW = Math.max(width - padding * 2, 1);
  const usableH = Math.max(height - padding * 2, 1);
  const scale = clampScale(Math.min(usableW / spanX, usableH / spanZ));
  const cx = (extent.minX + extent.maxX) / 2;
  const cz = (extent.minZ + extent.maxZ) / 2;
  return { scale, originX: width / 2 - cx * scale, originY: height / 2 - cz * scale };
}

/** The world rectangle a surface of this size currently shows. */
export function visibleExtent(view: ViewTransform, width: number, height: number): Extent {
  const [minX, minZ] = toWorld(view, [0, 0]);
  const [maxX, maxZ] = toWorld(view, [width, height]);
  return { minX, maxX, minZ, maxZ };
}

/** Wheel delta to zoom factor: one notch (100 px) is about 16 %. */
export const wheelFactor = (deltaY: number): number => Math.exp(-deltaY * 0.0015);

/**
 * Grid spacings, so the grid never turns grey.
 *
 * 1 m minor and 5 m major lines, as the brief asks, and when the minor lines
 * crowd together both step up by five: 5 m and 25 m, then 25 m and 125 m. Each
 * tier's minor lines fade in over a band rather than popping on, which is the
 * difference between a grid that breathes with the zoom and one that flickers.
 */
export interface GridTier {
  /** Metres between minor lines, and between major lines. */
  minor: number;
  major: number;
  /** 0–1: how strongly to draw the minor lines at this zoom. */
  minorAlpha: number;
}

/** Below this the minor lines are hidden; at twice it they are fully drawn. */
export const GRID_MIN_PX = 8;

export function gridTier(scale: number): GridTier {
  let minor = 1;
  while (minor * scale < GRID_MIN_PX && minor < 1e6) minor *= 5;
  const px = minor * scale;
  const minorAlpha = Math.min(1, Math.max(0, (px - GRID_MIN_PX) / GRID_MIN_PX));
  return { minor, major: minor * 5, minorAlpha };
}

/** Grid line positions in one axis, from `min` to `max`, every `step`. */
export function gridLines(min: number, max: number, step: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(min / step);
  const last = Math.floor(max / step);
  // A bound, not a hope: at the clamp limits a screen is a few hundred lines.
  if (last - first > 2000) return out;
  for (let i = first; i <= last; i++) out.push(i * step);
  return out;
}

/** A coordinate as the footer shows it: metres to the centimetre, never "-0.00". */
export function formatMetres(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(2);
}

/**
 * What Fit frames on a level: the plan rectangles of its walls, or the empty
 * 20 × 20 m square when it has none.
 *
 * Every wall on the level, boundary walls included, because the plan view shows
 * all of them (the sheet is the one that frames the house alone).
 */
export function levelExtent(walls: readonly Wall[]): Extent {
  if (walls.length === 0) return EMPTY_EXTENT;
  return bounds(walls.flatMap((w) => wallCorners(w)));
}
