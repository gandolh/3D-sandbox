import {
  DEFAULTS,
  type Opening,
  RULES,
  resolveEntities,
  type SceneDocument,
  type Wall,
  wallLength,
} from "@solstice/schema";
import { clean, nearestOnWall, type Pt, SNAP_TOLERANCE_PX } from "./snap.js";
import { nextId } from "./walls.js";

/** Openings slide in steps of this along their wall, between the centre snap. */
export const OFFSET_STEP = 0.05;

export interface OpeningSize {
  width: number;
  height: number;
  sill: number;
}

/** The sizes the options bar starts from: an ordinary door and window. */
export const DEFAULT_SIZES: Record<Opening["kind"], OpeningSize> = {
  door: { width: 0.9, height: 2.1, sill: 0 },
  window: { width: 1.2, height: 1.2, sill: 0.9 },
};

/** The wall under the pointer, and how far along it the pointer is. */
export interface WallHit {
  wall: Wall;
  /** Distance from the wall's `start` to the pointer's foot on the centreline. */
  along: number;
  length: number;
}

/**
 * The wall whose plan rectangle the pointer is over, give or take the snap
 * tolerance, nearest first. A thin partition zoomed out is a pixel wide, so
 * the tolerance is what makes it hoverable at all.
 */
export function wallUnder(walls: readonly Wall[], pointer: Pt, scale: number): WallHit | null {
  let best: { hit: WallHit; d: number } | null = null;
  for (const wall of walls) {
    const length = wallLength(wall);
    if (length < 1e-6) continue;
    const foot = nearestOnWall(wall, pointer);
    const d = Math.hypot(pointer[0] - foot[0], pointer[1] - foot[1]);
    if (d > wall.thickness / 2 + SNAP_TOLERANCE_PX / scale) continue;
    const along = Math.hypot(foot[0] - wall.start[0], foot[1] - wall.start[1]);
    if (best === null || d < best.d) best = { hit: { wall, along, length }, d };
  }
  return best?.hit ?? null;
}

/**
 * Where an opening centred on the pointer starts: snapped to the wall's centre
 * when the pointer is near it, otherwise to a 0.05 m step.
 */
export function offsetAt(hit: WallHit, width: number, scale: number): { offset: number; centred: boolean } {
  const centre = hit.length / 2;
  if (Math.abs(hit.along - centre) <= SNAP_TOLERANCE_PX / scale) {
    return { offset: clean(centre - width / 2), centred: true };
  }
  return { offset: clean(Math.round((hit.along - width / 2) / OFFSET_STEP) * OFFSET_STEP), centred: false };
}

/**
 * Where an opening starts when its distance from the nearer wall end is typed:
 * the end nearer the pointer. From the far end, the typed distance is to the
 * opening's far edge, so it is the gap to that end either way.
 */
export function offsetFromTyped(hit: WallHit, width: number, distance: number): number {
  return hit.along <= hit.length / 2 ? clean(distance) : clean(hit.length - distance - width);
}

/** The next free `d-<n>` or `w-<n>`: the builders name openings by position, so a drawn one needs only a number. */
export const nextOpeningId = (doc: SceneDocument, kind: Opening["kind"]): string =>
  nextId(doc, kind === "door" ? "d-" : "w-", 1);

const OPENING_RULES = new Set(["opening-fits-wall", "opening-fits-height", "openings-do-not-overlap"]);

/**
 * What the linter would say against an opening placed here, as messages.
 * Empty means it fits.
 *
 * The linter's own rules, run on the document with the opening in it, not a
 * copy of their arithmetic: a ghost that turned red by different rules than
 * the Inspector's would be a second linter, and the two would drift. The
 * opening goes last on its wall, which is where `openings-do-not-overlap`
 * reports a pair; `replacing` takes an existing opening out first, for a drag.
 */
export function openingProblems(
  doc: SceneDocument,
  levelId: string,
  wallId: string,
  candidate: Opening,
  replacing?: string,
): string[] {
  const trial: SceneDocument = {
    ...doc,
    subject: {
      ...doc.subject,
      levels: doc.subject.levels.map((level) =>
        level.id !== levelId
          ? level
          : {
              ...level,
              walls: level.walls.map((wall) =>
                wall.id !== wallId
                  ? wall
                  : { ...wall, openings: [...wall.openings.filter((o) => o.id !== replacing), candidate] },
              ),
            },
      ),
    },
  };
  const options = {
    knownAssets: undefined,
    knownMaterials: undefined,
    minOpeningEdgeMargin: DEFAULTS.minOpeningEdgeMargin,
    maxScatterInstances: DEFAULTS.maxScatterInstances,
    scatterErrorMultiple: DEFAULTS.scatterErrorMultiple,
  };
  return RULES.filter((rule) => OPENING_RULES.has(rule.name))
    .flatMap((rule) => rule.run(trial, options))
    .filter((f) => f.severity === "error" && resolveEntities(trial, f.path).includes(candidate.id))
    .map((f) => f.message);
}
