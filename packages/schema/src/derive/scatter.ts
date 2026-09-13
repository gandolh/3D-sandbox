import type { ScatterField } from "../document.js";
import { bounds, pointInPolygon, polygonNetArea } from "../geometry.js";
import type { M } from "../units.js";
import { mulberry32, pick, randomBetween } from "./random.js";

export interface ScatterInstance {
  asset: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

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
  // Clipped, not subtracted whole. See `polygonNetArea`: an exclusion hanging
  // over the field's edge used to remove the half that was never inside it, and
  // two overlapping exclusions removed their overlap twice.
  const net = polygonNetArea(field.area, field.exclude);

  // A row planting's count comes from its spacing, not its density — the whole
  // point of rows is that a person chose how far apart to put the trees. Using
  // `density` here would have the linter and the API both quoting a number the
  // generator never produces.
  //
  // **Counted by walking the lattice, not by scaling it.** This was
  // `cells * (net / gross)` — exact for a rectangle and an approximation for
  // anything else, which sounds tolerable until you write an L-shaped field:
  // 130 quoted against 100 placed, 30 % over. It cannot be fixed
  // analytically, because the generator jitters each point *before* testing
  // containment, so which cells survive depends on the RNG. The only number
  // that agrees with the generator is the generator's own.
  //
  // It is affordable because a lattice is bounded: `rowSpacing` has a floor and
  // coordinates have a ceiling, and past `MAX_INSTANCES` cells the generator
  // refuses outright — so above that this returns the cell count, which is an
  // over-estimate that correctly trips the error band without walking anything
  // and without throwing inside the linter.
  if (field.arrangement === "rows") {
    const lattice = scatterLattice(field);
    const cells = lattice.countX * lattice.countZ;
    if (cells > MAX_INSTANCES) return { net, instances: cells };
    return { net, instances: rowInstances(field).length };
  }

  return { net, instances: scatterTarget(net, field.density) };
}

/** How many instances a randomly-arranged field aims for. */
const scatterTarget = (net: number, density: number): number => Math.round((net / 100) * density);

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

/**
 * The most instances one field may place, whatever the document asks for.
 *
 * Absolute, not a multiple of the target. `maxAttempts = target * 40 + 1000`
 * was the only bound here, and a bound that scales with the number it is
 * meant to limit is not a bound — `density: 1e9` over a hectare came to about
 * 4 × 10¹¹ attempts and the tab died.
 *
 * The linter refuses such a document outright now (`scatter-density-is-sane`
 * fires as an error past 10× the budget), so reaching this clamp means
 * something got past the linter: a field built in code, a rule disabled, a
 * future arrangement. That is exactly when a generator should still not be
 * able to hang the machine it runs on. 200 000 is ~50× the budget and roughly
 * a second of sampling.
 */
const MAX_INSTANCES = 200_000;
/** And an absolute ceiling on the work spent trying to reach that. */
const MAX_ATTEMPTS = 2_000_000;

export interface ScatterInstance {
  asset: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

/**
 * Rejection-sample points inside the field's polygon, minus its exclusions.
 *
 * Deterministic in the field's seed — the same document must yield the same
 * forest everywhere, or a render is not reproducible from its scene file.
 */
export function scatterInstances(field: ScatterField): ScatterInstance[] {
  if (field.arrangement === "rows") return rowInstances(field);

  // The linter quotes this number to say the render will fit in the triangle
  // budget and the API quotes it to say how big the scene is; a generator that
  // computed its own would eventually make both of them wrong at once, which is
  // the failure mode with no symptom. One expression, called from both sides —
  // and not `estimateScatterInstances`, which for rows calls back into the
  // placement below.
  const target = Math.min(
    scatterTarget(polygonNetArea(field.area, field.exclude), field.density),
    MAX_INSTANCES,
  );
  if (target === 0) return [];

  const b = bounds(field.area);
  const rng = mulberry32(scatterSeed(field));
  const out: ScatterInstance[] = [];

  // Bounded so a pathological polygon cannot spin forever; a field that cannot
  // hit its target simply produces fewer instances.
  const maxAttempts = Math.min(target * 40 + 1000, MAX_ATTEMPTS);
  let attempts = 0;

  while (out.length < target && attempts < maxAttempts) {
    attempts++;
    const x = randomBetween(rng, b.minX, b.maxX);
    const z = randomBetween(rng, b.minZ, b.maxZ);
    if (!pointInPolygon([x, z], field.area)) continue;
    if (field.exclude.some((poly) => pointInPolygon([x, z], poly))) continue;

    out.push({
      asset: pick(rng, field.assets),
      position: [x, 0, z],
      rotationY: rng() * 360,
      scale: randomBetween(rng, field.scaleRange[0], field.scaleRange[1]),
    });
  }

  return out;
}

/**
 * Instances on a lattice — an orchard, a vineyard, a nursery bed.
 *
 * The lattice is not jittered; the *position within its cell* is. Jittering the
 * lattice itself would drift the rows out of line down a long field, and rows
 * that are nearly-but-not-quite straight read as a mistake in a way that either
 * true rows or frank randomness does not.
 *
 * `density` is ignored here: the spacing sets the count. A row planting's whole
 * character is that a person decided how far apart to put the trees.
 */
function rowInstances(field: ScatterField): ScatterInstance[] {
  const lattice = scatterLattice(field);
  const rng = mulberry32(scatterSeed(field));
  const out: ScatterInstance[] = [];

  // A quarter of the spacing, so a tree never wanders into its neighbour's place.
  const jitterX = lattice.stepX / 4;
  const jitterZ = lattice.stepZ / 4;

  // Integer counts from the shared lattice, not `x += step` until it passes the
  // edge. Accumulating loses the last row to rounding, and at large coordinates
  // `x + step === x`, so the loop stops advancing without ever stopping.
  const cells = lattice.countX * lattice.countZ;
  if (cells > MAX_INSTANCES) {
    // A lattice can be enormous without any single number looking wrong:
    // spacing is bounded below and coordinates above, but their ratio is not.
    // Refusing is better than a viewport that never paints again.
    throw new RangeError(
      `scatter field "${field.id}" lays out ${cells.toLocaleString("en-GB")} lattice cells, past the ${MAX_INSTANCES.toLocaleString("en-GB")} ceiling`,
    );
  }

  for (let iz = 0; iz < lattice.countZ; iz++) {
    const z = lattice.originZ + iz * lattice.stepZ;
    for (let ix = 0; ix < lattice.countX; ix++) {
      const x = lattice.originX + ix * lattice.stepX;
      const px = x + randomBetween(rng, -jitterX, jitterX);
      const pz = z + randomBetween(rng, -jitterZ, jitterZ);
      const rotation = rng() * 360;
      const scale = randomBetween(rng, field.scaleRange[0], field.scaleRange[1]);
      const asset = pick(rng, field.assets);

      // Drawn before the containment test on purpose: the random sequence must
      // depend only on the lattice, so editing the field's outline moves trees
      // in and out without reshuffling the ones that stay.
      if (!pointInPolygon([px, pz], field.area)) continue;
      if (field.exclude.some((poly) => pointInPolygon([px, pz], poly))) continue;

      out.push({ asset, position: [px, 0, pz], rotationY: rotation, scale });
    }
  }
  return out;
}
