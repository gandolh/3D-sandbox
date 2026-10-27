import type { Level, SceneDocument, Wall } from "@solstice/schema";
import { clean, directionOf, type Pt } from "./snap.js";

/**
 * The Wall tool's pure half: the chain of points being drawn, the walls it
 * makes, their ids and defaults, and editing corners that already exist.
 *
 * Kept out of React so the one property everything else depends on — that two
 * walls drawn in a chain share a corner **exactly** — is a test with `toEqual`
 * rather than a hope checked with `toBeCloseTo`.
 */

/** Two points closer than this are the same point: the tolerance a structure is grouped by. */
export const SAME_POINT = 1e-6;

export const samePoint = (a: Pt, b: Pt): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) < SAME_POINT;

/** The points placed so far. Each consecutive pair is a wall already written. */
export interface Chain {
  points: readonly (readonly [number, number])[];
  /** Ids of the walls written, one fewer than `points`. */
  wallIds: readonly string[];
}

export type Placement =
  /** The chain's first point. Nothing is written yet. */
  | { kind: "started"; chain: Chain }
  /** A click on the point the chain is already at: no zero-length wall. */
  | { kind: "ignored"; reason: "same point" | "a loop needs three walls" }
  /** A wall from the chain's last point to this one; `chain` is null when it closed the loop. */
  | { kind: "wall"; start: [number, number]; end: [number, number]; chain: Chain | null; closes: boolean };

/**
 * Place one point.
 *
 * The new wall starts at the chain's last point **copied verbatim**, so its
 * `start` and the previous wall's `end` are the same numbers. A point on the
 * chain's first point closes the loop — ending at that first point's own
 * numbers — and ends the chain.
 */
export function placePoint(chain: Chain | null, point: Pt): Placement {
  if (chain === null || chain.points.length === 0) {
    return { kind: "started", chain: { points: [[point[0], point[1]]], wallIds: [] } };
  }
  const last = chain.points[chain.points.length - 1]!;
  if (samePoint(point, last)) return { kind: "ignored", reason: "same point" };

  const first = chain.points[0]!;
  const start: [number, number] = [last[0], last[1]];
  if (samePoint(point, first)) {
    // Back to the start after one wall would lay a second wall on the first.
    if (chain.points.length < 3) return { kind: "ignored", reason: "a loop needs three walls" };
    return { kind: "wall", start, end: [first[0], first[1]], chain: null, closes: true };
  }
  return {
    kind: "wall",
    start,
    end: [point[0], point[1]],
    chain: { points: [...chain.points, [point[0], point[1]]], wallIds: chain.wallIds },
    closes: false,
  };
}

/** The chain after its last wall was written under `id`. */
export const recordWall = (chain: Chain, id: string): Chain => ({
  ...chain,
  wallIds: [...chain.wallIds, id],
});

/**
 * Drop chain points whose walls are gone — after a Ctrl+Z mid-chain — so the
 * next wall starts where the last surviving one ends.
 */
export function trimChain(chain: Chain, exists: (id: string) => boolean): Chain | null {
  let { points, wallIds } = chain;
  while (wallIds.length > 0 && !exists(wallIds[wallIds.length - 1]!)) {
    wallIds = wallIds.slice(0, -1);
    points = points.slice(0, -1);
  }
  return points.length === 0 ? null : { points, wallIds };
}

/**
 * The point `length` metres from `from` along a compass bearing.
 *
 * `directionOf` is exact at the four compass points, and the sum is cleaned of
 * float noise, so "8 east, 6 north, 8 west" from (0, 0) lands on (8, 0),
 * (8, −6) and (0, −6) exactly.
 */
export function pointAlong(from: Pt, direction: readonly [number, number], length: number): [number, number] {
  return [clean(from[0] + direction[0] * length), clean(from[1] + direction[1] * length)];
}

export const pointAtBearing = (from: Pt, bearing: number, length: number): [number, number] =>
  pointAlong(from, directionOf(bearing), length);

/**
 * A number as a person types it: "4,2" and "4.2" are both 4.2.
 *
 * A comma is a decimal mark across most of Europe, Romania included, and a
 * field that silently reads "4,2" as 4 or as nothing is worse than none.
 * Anything that is not a plain decimal is null, not a guess.
 */
export function parseDecimal(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/** Every id in the document: `unique-ids` is document-wide, so allocation must be too. */
export function documentIds(doc: SceneDocument): Set<string> {
  const ids = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node === null || typeof node !== "object") return;
    const id = (node as { id?: unknown }).id;
    if (typeof id === "string") ids.add(id);
    for (const value of Object.values(node)) walk(value);
  };
  walk(doc.subject);
  walk(doc.context);
  walk(doc.shots);
  return ids;
}

/**
 * The next free `<prefix>NN` id, continuing the highest one in the document.
 *
 * Readable ids are a project rule (`W-03`, not a UUID), and the scenes already
 * number their walls this way, so a drawn wall carries on from the builder's
 * highest number rather than restarting at 1 and colliding.
 */
export function nextId(doc: SceneDocument, prefix: string, pad = 2): string {
  const ids = documentIds(doc);
  const pattern = new RegExp(`^${prefix.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&")}(\\d+)$`);
  let highest = 0;
  for (const id of ids) {
    const match = pattern.exec(id);
    if (match !== null) highest = Math.max(highest, Number(match[1]));
  }
  let n = highest + 1;
  while (ids.has(`${prefix}${String(n).padStart(pad, "0")}`)) n++;
  return `${prefix}${String(n).padStart(pad, "0")}`;
}

export const nextWallId = (doc: SceneDocument): string => nextId(doc, "W-");

/**
 * The material a new wall gets: the one most used by the level's walls, or the
 * document's first on an empty level. Null when the document has none, and
 * then the Wall tool is off, because a wall must name a material.
 */
export function defaultWallMaterial(doc: SceneDocument, level: Level | undefined): string | null {
  const counts = new Map<string, number>();
  for (const wall of level?.walls ?? []) counts.set(wall.material, (counts.get(wall.material) ?? 0) + 1);
  let best: string | null = null;
  let most = 0;
  for (const [material, count] of counts) {
    if (count > most && doc.materials[material] !== undefined) {
      best = material;
      most = count;
    }
  }
  return best ?? Object.keys(doc.materials)[0] ?? null;
}

export interface WallOptions {
  thickness: number;
  /** Null means "the level's height": the field is left out of the wall. */
  height: number | null;
  material: string;
}

/** A new wall, with no `height` key at all when it takes the level's. */
export function makeWall(id: string, start: Pt, end: Pt, options: WallOptions): Wall {
  return {
    id,
    start: [start[0], start[1]],
    end: [end[0], end[1]],
    thickness: options.thickness,
    material: options.material,
    openings: [],
    ...(options.height === null ? {} : { height: options.height }),
  };
}

/** The walls with an end at `point`: the ones a corner grip moves together. */
export const wallsAt = (walls: readonly Wall[], point: Pt): Wall[] =>
  walls.filter((w) => samePoint(w.start, point) || samePoint(w.end, point));

/**
 * Move every wall end at `from` to `to`, so a corner stays joined.
 *
 * Openings are placed by offset from a wall's `start`, so moving a `start`
 * slides them along with it, and moving an `end` can leave one past the end of
 * a shortened wall. The linter says so in the Inspector, which is the feedback
 * a drawn wall gets; nothing here second-guesses it.
 */
export function moveCorner(walls: Wall[], from: Pt, to: Pt): string[] {
  const moved: string[] = [];
  for (const wall of walls) {
    let hit = false;
    if (samePoint(wall.start, from)) {
      wall.start = [to[0], to[1]];
      hit = true;
    }
    if (samePoint(wall.end, from)) {
      wall.end = [to[0], to[1]];
      hit = true;
    }
    if (hit) moved.push(wall.id);
  }
  return moved;
}
