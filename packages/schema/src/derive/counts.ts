import type { Room, SceneDocument } from "./../document.js";
import { area } from "../geometry.js";

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

/** One line of a schedule of areas. */
export interface RoomArea {
  room: Room;
  /** Net internal floor, m², derived from the polygon and never stored. */
  area: number;
}

/**
 * The schedule of areas: every room, with the floor it actually has.
 *
 * Derived on demand rather than written into the document, because a stored
 * area is a second copy of a polygon and the two drift. Brief 46 worked its
 * schedule out by hand and wrote "118.6 m², and the schedule closes to 118.7"
 * into an outcome note; that number was checked by nobody and was already only
 * approximately true by the time the plan moved.
 */
export function scheduleOfAreas(doc: SceneDocument): RoomArea[] {
  return doc.subject.levels.flatMap((level) =>
    level.rooms.map((room) => ({ room, area: area(room.polygon) })),
  );
}
