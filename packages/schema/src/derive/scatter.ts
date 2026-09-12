import { area, bounds } from "../geometry.js";
import type { M } from "../units.js";
import type { ScatterField } from "../document.js";

export interface ScatterEstimate {
  /** Field area less its exclusions, in m². */
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
  const gross = area(field.area);
  const excluded = field.exclude.reduce((sum, poly) => sum + area(poly), 0);
  const net = Math.max(0, gross - excluded);

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
