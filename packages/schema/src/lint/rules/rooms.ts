import { area, bounds, boundsContain, pointInPolygon, polygonNetArea } from "../../geometry.js";
import { wallAngle, wallLength } from "../../derive/walls.js";
import type { Level, Room, Wall } from "../../document.js";
import type { RawFinding, Rule } from "../types.js";

/**
 * Minimum floor area by use, in m².
 *
 * These are the sizes below which a room stops being the thing it is named
 * after rather than merely being small — a 4 m² "bedroom" is a box room however
 * the document labels it. Deliberately generous: this rule exists to catch a
 * plan that has drifted while being edited, not to impose a housing standard on
 * a scene, and a warning that fires on a legitimately cosy room teaches people
 * to ignore the linter.
 */
const MIN_AREA: Record<Room["use"], number> = {
  living: 12,
  bed: 6.5,
  kitchen: 5,
  bath: 2.5,
  hall: 1.5,
  store: 0.5,
  utility: 1,
};

/** A habitable room needs daylight; the rest do not. */
const NEEDS_DAYLIGHT: readonly Room["use"][] = ["living", "bed", "kitchen"];

/**
 * Rooms have to describe a plan that could be built.
 *
 * Everything here is a check the *geometry* cannot make and the *schema* cannot
 * express: the schema knows a room is a polygon, and the generator does not
 * read rooms at all. What is left over is whether the plan is architecturally
 * coherent — whether the rooms are inside the building, whether they overlap
 * each other, and whether a space called a bedroom could be one.
 */
export const roomsAreHabitable: Rule = {
  name: "rooms-are-habitable",
  run(doc) {
    const out: RawFinding[] = [];

    doc.subject.levels.forEach((level, li) => {
      if (level.rooms.length === 0) return;
      const envelope = bounds(level.walls.flatMap((w) => [w.start, w.end]));

      level.rooms.forEach((room, ri) => {
        const path = `subject.levels[${li}].rooms[${ri}]`;
        const floor = area(room.polygon);

        if (floor < 1e-3) {
          out.push({
            rule: "rooms-are-habitable",
            severity: "error",
            path,
            message: `room "${room.name}" has no area`,
          });
          return;
        }

        // Inside the building, with a tolerance of one thick wall: a room's
        // outline runs to the *inner* face, so it can never legitimately reach
        // the envelope's bounds, but it can legitimately come within a wall of
        // them.
        if (level.walls.length > 0 && !boundsContain(envelope, bounds(room.polygon), 1e-6)) {
          out.push({
            rule: "rooms-are-habitable",
            severity: "error",
            path,
            message: `room "${room.name}" extends outside the walls of level "${level.id}" — a room is a claim about space the walls enclose`,
          });
        }

        const floor2dp = floor.toFixed(1);
        if (floor < MIN_AREA[room.use]) {
          out.push({
            rule: "rooms-are-habitable",
            severity: "warning",
            path,
            message: `${room.use} "${room.name}" is ${floor2dp} m², below the ${MIN_AREA[room.use]} m² a ${room.use} needs to be one`,
          });
        }

        if (NEEDS_DAYLIGHT.includes(room.use) && !hasWindow(room, level)) {
          out.push({
            rule: "rooms-are-habitable",
            severity: "warning",
            path,
            message: `${room.use} "${room.name}" has no window — every habitable room needs daylight, and nothing else in the document notices a room that is sealed`,
          });
        }
      });

      // Overlap is checked pairwise, on the net area of the intersection rather
      // than on bounding boxes: two L-shaped rooms interlocking round a corner
      // have overlapping bounds and share no floor.
      for (let a = 0; a < level.rooms.length; a++) {
        for (let b = a + 1; b < level.rooms.length; b++) {
          const first = level.rooms[a]!;
          const second = level.rooms[b]!;
          const shared = area(first.polygon) - polygonNetArea(first.polygon, [second.polygon]);
          if (shared <= 1e-3) continue;
          out.push({
            rule: "rooms-are-habitable",
            severity: "error",
            path: `subject.levels[${li}].rooms[${b}]`,
            message: `rooms "${first.name}" and "${second.name}" overlap by ${shared.toFixed(1)} m² — one floor cannot be in two rooms`,
          });
        }
      }
    });

    return out;
  },
};

/**
 * Does any wall's window open into this room?
 *
 * A window is positioned along its wall by offset, so its centre in plan is the
 * wall's midpoint stepped along the wall's own direction — the same
 * `wallAngle` the mesh and the collider use. Stepping half a wall thickness to
 * *both* sides and asking whether either lands inside the room is what makes
 * this work without knowing which side of the wall the room is on.
 */
function hasWindow(room: Room, level: Level): boolean {
  return level.walls.some((wall) =>
    wall.openings.some((opening) => {
      if (opening.kind !== "window") return false;
      return sidesOf(wall, opening.offset + opening.width / 2).some((p) =>
        pointInPolygon(p, room.polygon),
      );
    }),
  );
}

/**
 * The two points just inside each face of a wall, at `along` metres along it.
 *
 * `REACH` past the face rather than a hair past it: a room outline is drawn to
 * the inner face *by convention*, not by rule, and a scene that leaves a few
 * centimetres of slack would otherwise report every one of its windows as
 * belonging to no room. 300 mm is comfortably more than any such gap and
 * comfortably less than the depth of the shallowest room worth the name, so it
 * cannot reach through a wall into the room beyond.
 */
const REACH = 0.3;

function sidesOf(wall: Wall, along: number): [number, number][] {
  const length = wallLength(wall);
  const angle = wallAngle(wall);
  const [x1, z1] = wall.start;
  const [x2, z2] = wall.end;
  const t = length === 0 ? 0 : along / length;
  const x = x1 + (x2 - x1) * t;
  const z = z1 + (z2 - z1) * t;
  // The wall's own normal in plan. `wallAngle` rotates +X onto the wall, so the
  // perpendicular is a quarter turn from it.
  const step = wall.thickness / 2 + REACH;
  const nx = Math.sin(angle) * step;
  const nz = Math.cos(angle) * step;
  return [
    [x + nx, z + nz],
    [x - nx, z - nz],
  ];
}
