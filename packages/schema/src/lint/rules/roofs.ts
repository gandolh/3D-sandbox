import { area, bounds, boundsContain, intervalsOverlap } from "../../geometry.js";
import type { Level, Wall } from "../../document.js";
import type { RawFinding, Rule } from "../types.js";

/**
 * A roof must actually cover the walls beneath it. The level it belongs to is
 * inferred from `baseElevation` matching a level's top — roofs do not name a
 * level, because a roof can span several and an explicit link would be one more
 * reference to keep consistent.
 */
export const roofCoversWalls: Rule = {
  name: "roof-covers-walls",
  run(doc) {
    const out: RawFinding[] = [];
    const levels = doc.subject.levels;

    doc.subject.roofs.forEach((roof, ri) => {
      const path = `subject.roofs[${ri}]`;

      if (area(roof.footprint) < 1e-3) {
        out.push({
          rule: "roof-covers-walls",
          severity: "error",
          path,
          message: `roof "${roof.id}" has a zero-area footprint`,
        });
        return;
      }
      if (roof.kind === "flat" && roof.pitch > 1e-6) {
        out.push({
          rule: "roof-covers-walls",
          severity: "warning",
          path,
          message: `roof "${roof.id}" is flat but has a pitch of ${roof.pitch}° — the pitch is ignored`,
        });
      }

      // The level whose top sits closest to this roof's eave.
      let host: (typeof levels)[number] | undefined;
      let best = Infinity;
      for (const level of levels) {
        const delta = Math.abs(level.elevation + level.height - roof.baseElevation);
        if (delta < best) {
          best = delta;
          host = level;
        }
      }
      if (host === undefined || best > 0.5) {
        out.push({
          rule: "roof-covers-walls",
          severity: "warning",
          path,
          message: `roof "${roof.id}" sits at ${roof.baseElevation.toFixed(2)} m, which matches no level's top — cannot verify it covers anything`,
        });
        return;
      }
      if (host.walls.length === 0) return;

      // Which *structure* is this the roof of? Taking every wall on the level —
      // which this rule used to do — assumes one building per level, so a
      // property with a house, a garage, a greenhouse and a boundary wall fails
      // every roof the moment it has more than one structure on it.
      const roofBox = bounds(roof.footprint);
      const covered = structureUnder(host, roofBox);

      if (covered.length === 0) {
        // A roof over no walls is a canopy — a porch, a car port, a loggia —
        // and a canopy is over a floor. If the level has a slab under it, that
        // is what it shelters and there is nothing to report. If it is over
        // neither walls nor floor, it is over nothing.
        const overSlab = host.slabs.some((slab) => {
          const box = bounds(slab.polygon);
          return (
            intervalsOverlap(roofBox.minX, roofBox.maxX, box.minX, box.maxX, -roof.overhang) &&
            intervalsOverlap(roofBox.minZ, roofBox.maxZ, box.minZ, box.maxZ, -roof.overhang)
          );
        });
        if (overSlab) return;

        out.push({
          rule: "roof-covers-walls",
          severity: "warning",
          path,
          message: `roof "${roof.id}" sits over neither walls nor a slab of level "${host.id}" — it shelters nothing`,
        });
        return;
      }

      const wallBounds = bounds(covered.flatMap((w) => [w.start, w.end]));
      const roofBounds = roofBox;

      // **Negative** tolerance, and the sign is the whole check.
      //
      // `boundsContain(outer, inner, t)` tests `inner.minX >= outer.minX - t`,
      // so passing `+overhang` *loosened* containment — it permitted a roof
      // **smaller** than its walls by exactly the amount it is declared to
      // oversail them by. The rule read as "the roof covers the walls, give or
      // take the eave" and meant "the roof may fall short by an eave".
      //
      // `overhang` is settled (decisions-scene.md, 2026-09-12) as *the least
      // the declared footprint oversails the walls beneath it, on any one
      // side*. So the footprint must reach at least that far past them, which
      // is the negative tolerance.
      if (!boundsContain(roofBounds, wallBounds, EAVE_EPSILON - roof.overhang)) {
        out.push({
          rule: "roof-covers-walls",
          severity: "error",
          path,
          message: `roof "${roof.id}" does not cover the walls of level "${host.id}" by its declared ${roof.overhang} m overhang — ${covered.length} wall(s) beneath it — footprint spans x ${roofBounds.minX.toFixed(2)}…${roofBounds.maxX.toFixed(2)}, z ${roofBounds.minZ.toFixed(2)}…${roofBounds.maxZ.toFixed(2)} but those walls span x ${wallBounds.minX.toFixed(2)}…${wallBounds.maxX.toFixed(2)}, z ${wallBounds.minZ.toFixed(2)}…${wallBounds.maxZ.toFixed(2)}`,
        });
      }
    });

    return out;
  },
};

/**
 * The walls of the one structure a roof sits over.
 *
 * A "structure" is a connected run of walls — walls that share an endpoint. That
 * is what makes a house distinguishable from the garage twenty metres away
 * without either of them having to say so in the document, and it is why a roof
 * does not name the walls it covers: the geometry already says.
 *
 * The structure chosen is the one covering most of the roof's own footprint —
 * bounds overlap rather than wall containment, because a roof that is too small
 * for its building still sits squarely on it and must still be an error.
 */
/**
 * Slack on the eave comparison, in metres.
 *
 * A footprint is authored as `rect(7 - 0.4, …, 7 + 0.4)` and comes out as
 * `14.399999999999999`, so a roof declaring exactly the eave it draws misses an
 * exact `>=` by 2 × 10⁻¹⁵ m. Both of Greenhollow's outbuildings did, the moment
 * this comparison started pointing the right way.
 *
 * A millimetre, because that is the smallest distance the document's own units
 * comment says anyone means — thicknesses are quoted in mm — and because an
 * eave short by less than that is not a drawing anyone would redo.
 */
const EAVE_EPSILON = 1e-3;

/** How much of a roof must sit over a structure before it is that structure's. */
const MAJORITY = 0.5;

function structureUnder(level: Level, roofBox: ReturnType<typeof bounds>): Wall[] {
  const same = (a: readonly [number, number], b: readonly [number, number]): boolean =>
    Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;

  const groups: Wall[][] = [];
  for (const wall of level.walls) {
    const touching = groups.filter((g) =>
      g.some(
        (w) =>
          same(w.start, wall.start) ||
          same(w.start, wall.end) ||
          same(w.end, wall.start) ||
          same(w.end, wall.end),
      ),
    );
    if (touching.length === 0) {
      groups.push([wall]);
      continue;
    }
    // A wall can bridge two groups that were not previously known to connect.
    const merged = touching.flat().concat(wall);
    for (const g of touching) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }

  const roofArea =
    Math.max(0, roofBox.maxX - roofBox.minX) * Math.max(0, roofBox.maxZ - roofBox.minZ);

  let best: Wall[] = [];
  let bestOverlap = 0;
  for (const group of groups) {
    const box = bounds(group.flatMap((w) => [w.start, w.end]));
    const overlap =
      Math.max(0, Math.min(roofBox.maxX, box.maxX) - Math.max(roofBox.minX, box.minX)) *
      Math.max(0, Math.min(roofBox.maxZ, box.maxZ) - Math.max(roofBox.minZ, box.minZ));

    // A roof belongs to the structure it *mostly* sits on. Any overlap at all
    // would be too eager: a porch roof has to tuck against the house wall to be
    // a porch, and a 0.2 m lap onto an 11 m house would otherwise make the
    // house's walls the porch roof's problem.
    if (overlap < roofArea * MAJORITY) continue;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = group;
    }
  }
  return best;
}
