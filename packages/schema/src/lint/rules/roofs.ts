import { area, bounds, boundsContain } from "../../geometry.js";
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

      const wallPoints = host.walls.flatMap((w) => [w.start, w.end]);
      const wallBounds = bounds(wallPoints);
      const roofBounds = bounds(roof.footprint);

      if (!boundsContain(roofBounds, wallBounds, roof.overhang)) {
        out.push({
          rule: "roof-covers-walls",
          severity: "error",
          path,
          message: `roof "${roof.id}" does not cover the walls of level "${host.id}" — footprint spans x ${roofBounds.minX.toFixed(2)}…${roofBounds.maxX.toFixed(2)}, z ${roofBounds.minZ.toFixed(2)}…${roofBounds.maxZ.toFixed(2)} but the walls span x ${wallBounds.minX.toFixed(2)}…${wallBounds.maxX.toFixed(2)}, z ${wallBounds.minZ.toFixed(2)}…${wallBounds.maxZ.toFixed(2)}`,
        });
      }
    });

    return out;
  },
};
