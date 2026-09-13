/**
 * Authoring helpers.
 *
 * These exist only at authoring time — `scenes/src/*.ts` imports them, the
 * build step emits plain JSON, and neither the app nor the API ever sees them.
 * That split is what lets a scene be written with loops and helpers while the
 * runtime still consumes inert data.
 */

import type { SceneDocumentInput } from "../document.js";
import type { Plan } from "../geometry.js";

type WallInput = NonNullable<NonNullable<SceneDocumentInput["subject"]>["levels"]>[number]["walls"];
type OpeningInput = NonNullable<NonNullable<WallInput>[number]["openings"]>[number];
/**
 * One wall as the document declares it, before parsing.
 *
 * Exported because scenes build walls by hand — a boundary wall with a gate, an
 * internal partition — and were importing this name already. It was not
 * exported, and nothing noticed: `scenes/` was never type-checked, and Node's
 * type-stripping deletes a type-only import without ever asking whether it
 * resolves.
 */
export type WallSpec = NonNullable<WallInput>[number];

/**
 * A plan point as an *author* writes it.
 *
 * Deliberately mutable, unlike `Plan`, which is the readonly form the geometry
 * package passes around. The difference matters exactly here: `SceneDocument`'s
 * Zod input type is a mutable tuple, so a helper returning `readonly [M, M]`
 * produces something the schema it belongs to will not accept. Thirty-four type
 * errors across the three scenes came from that one mismatch, none of them
 * visible until `scenes/` was type-checked for the first time.
 */
export type PlanInput = [number, number];

/** An axis-aligned rectangle in plan space, given by its corner and extent. */
export function rect(x: number, z: number, width: number, depth: number): PlanInput[] {
  return [
    [x, z],
    [x + width, z],
    [x + width, z + depth],
    [x, z + depth],
  ];
}

export const windowOpening = (
  id: string,
  offset: number,
  width: number,
  height: number,
  sill: number,
): OpeningInput => ({ id, kind: "window", offset, width, height, sill });

export const doorOpening = (id: string, offset: number, width: number, height: number): OpeningInput => ({
  id,
  kind: "door",
  offset,
  width,
  height,
  sill: 0,
});

/**
 * Walls around a closed footprint, one per edge, numbered from a prefix.
 *
 * This is the helper that earns the TypeScript authoring layer: a rectangular
 * house is four walls with consistent thickness and material, and writing them
 * as four literals invites exactly the transposed-coordinate mistakes the
 * linter then has to catch.
 */
export function wallsFromFootprint(
  footprint: readonly Plan[],
  options: {
    prefix?: string;
    material: string;
    thickness?: number;
    height?: number;
  },
): WallSpec[] {
  const prefix = options.prefix ?? "W";
  return footprint.map((start, i): WallSpec => {
    const end = footprint[(i + 1) % footprint.length]!;
    const wall: WallSpec = {
      id: `${prefix}-${String(i + 1).padStart(2, "0")}`,
      start: [start[0], start[1]],
      end: [end[0], end[1]],
      material: options.material,
      ...(options.thickness === undefined ? {} : { thickness: options.thickness }),
      ...(options.height === undefined ? {} : { height: options.height }),
    };
    return wall;
  });
}

/** Attach openings to a wall by id, leaving the rest of the array untouched. */
export function withOpenings(
  walls: readonly WallSpec[],
  id: string,
  openings: readonly OpeningInput[],
): WallSpec[] {
  let matched = false;
  const out = walls.map((w) => {
    if (w.id !== id) return w;
    matched = true;
    return { ...w, openings: [...(w.openings ?? []), ...openings] };
  });
  if (!matched) {
    throw new Error(`withOpenings: no wall with id "${id}" (have: ${walls.map((w) => w.id).join(", ")})`);
  }
  return out;
}
