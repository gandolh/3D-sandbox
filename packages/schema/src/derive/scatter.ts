import { bounds, polygonNetArea } from "../geometry.js";
import type { M } from "../units.js";
import type { ScatterField } from "../document.js";

export interface ScatterEstimate {
  /** Field area less its exclusions — clipped to the field, unioned — in m². */
  net: number;
  /** How many instances the field will place. */
  instances: number;
}

/**
 * The integer lattice a row planting stands on.
 *
 * Returned as counts rather than as a step to accumulate. `for (let z = start;
 * z <= max; z += step)` is the obvious way to write this and it has two
 * failure modes the integer form does not: the last row falls in or out
 * depending on float64 rounding, and at large coordinates `z + step === z`, so
 * the loop never advances and never ends.
 *
 * It is shared because the generator walks this lattice and the estimate has to
 * quote the same number of cells. They did not: the estimate divided the net
 * area by the cell area, which is a different quantity — it ignores how the
 * lattice actually lands on the bounds, and the two disagreed outright.
 */
export interface ScatterLattice {
  /** Centre of the first cell. */
  originX: M;
  originZ: M;
  /** Cell pitch. */
  stepX: M;
  stepZ: M;
  /** Cells along each axis — always integers, computed up front. */
  countX: number;
  countZ: number;
}

export function scatterLattice(field: ScatterField): ScatterLattice {
  const [along, across] = field.rowSpacing;
  const b = bounds(field.area);
  const originX = b.minX + along / 2;
  const originZ = b.minZ + across / 2;
  return {
    originX,
    originZ,
    stepX: along,
    stepZ: across,
    countX: cellCount(originX, b.maxX, along),
    countZ: cellCount(originZ, b.maxZ, across),
  };
}

/** How many steps of `step` from `origin` stay at or below `limit`. */
const cellCount = (origin: M, limit: M, step: M): number =>
  origin > limit ? 0 : Math.floor((limit - origin) / step) + 1;

/**
 * How many instances a scatter field yields.
 *
 * Shared by the lint rule that guards the triangle budget, by the API's scene
 * summary, and — since this brief — by the generator itself, which used to
 * restate the same arithmetic. Two places that must agree, because one tells
 * the user the render will work and the other tells them how big the scene is;
 * three, now that the thing being described also asks.
 */
export function estimateScatterInstances(field: ScatterField): ScatterEstimate {
  const gross = polygonNetArea(field.area, []);
  // Clipped, not subtracted whole. See `polygonNetArea`: an exclusion hanging
  // over the field's edge used to remove the half that was never inside it, and
  // two overlapping exclusions removed their overlap twice.
  const net = polygonNetArea(field.area, field.exclude);

  // A row planting's count comes from its spacing, not its density — the whole
  // point of rows is that a person chose how far apart to put the trees. Using
  // `density` here would have the linter and the API both quoting a number the
  // generator never produces.
  //
  // The lattice covers the field's *bounds*; the generator then drops the cells
  // that fall outside the polygon or inside an exclusion. `net / gross` is the
  // share that survives — exact for a rectangle, and the right approximation
  // for anything else.
  if (field.arrangement === "rows") {
    const lattice = scatterLattice(field);
    const cells = lattice.countX * lattice.countZ;
    return { net, instances: gross === 0 ? 0 : Math.round(cells * (net / gross)) };
  }

  return { net, instances: Math.round((net / 100) * field.density) };
}

/**
 * The RNG seed a field actually plants with: the author's `seed`, with the
 * field's **id** mixed in.
 *
 * `seed` defaults to 0 and nothing else fed the generator, so two fields over
 * the same polygon that both omitted it placed every instance at exactly the
 * same coordinates — an `oaks` bed and a `birches` bed over one plot became a
 * single co-incident, z-fighting thicket with twice the geometry and nothing
 * warning about it. That is a natural way to author two plantings, which is why
 * it had to stop being a trap rather than become a lint rule.
 *
 * `seed` stays meaningful as the author's dial: same id and same seed reproduce
 * exactly, which is the whole reason a render can be re-made from its document.
 *
 * `packages/geometry/src/subject/runs.ts` has done this since it was written,
 * precisely so two pergolas could not collide. The scatter tier is the one that
 * skipped it; this is that hash, shared rather than copied.
 */
export function scatterSeed(field: Pick<ScatterField, "id" | "seed">): number {
  let hash = field.seed >>> 0;
  // `Math.imul`, not `*`: the product of a 32-bit seed and 31 leaves the range
  // where float64 is exact, and `>>> 0` on an inexact product is not a hash.
  for (const ch of field.id) hash = (Math.imul(hash, 31) + ch.charCodeAt(0)) >>> 0;
  return hash;
}
