import type { SceneDocument } from "./../document.js";

/** What a scene is made of, for anything that summarises one. */
export interface SceneCounts {
  walls: number;
  openings: number;
  shots: number;
}

/**
 * Counted once.
 *
 * `scenes/build.ts` prints these after generating a scene and the API's index
 * prints them for the same file; two hand-rolled reductions over the same
 * nested arrays is how one total quietly stops meaning the other.
 */
export function sceneCounts(doc: SceneDocument): SceneCounts {
  let walls = 0;
  let openings = 0;
  for (const level of doc.subject.levels) {
    walls += level.walls.length;
    for (const wall of level.walls) openings += wall.openings.length;
  }
  return { walls, openings, shots: doc.shots.length };
}
