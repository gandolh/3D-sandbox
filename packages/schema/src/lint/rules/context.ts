import { area } from "../../geometry.js";
import type { LintFinding, Rule } from "../types.js";

/** Zero-area polygons generate nothing and usually mean transposed coordinates. */
export const polygonsHaveArea: Rule = {
  name: "polygons-have-area",
  run(doc) {
    const out: LintFinding[] = [];
    const check = (poly: readonly (readonly [number, number])[], path: string, owner: string) => {
      if (area(poly) < 1e-3) {
        out.push({
          rule: "polygons-have-area",
          severity: "error",
          path,
          message: `${owner} has a zero-area polygon — check for duplicated or collinear points`,
        });
      }
    };

    doc.subject.levels.forEach((l, li) =>
      l.slabs.forEach((s, si) =>
        check(s.polygon, `subject.levels[${li}].slabs[${si}]`, `slab "${s.id}"`),
      ),
    );
    doc.context.masses.forEach((m, i) =>
      check(m.footprint, `context.masses[${i}]`, `mass "${m.id}"`),
    );
    doc.context.scatter.forEach((s, i) =>
      check(s.area, `context.scatter[${i}]`, `scatter field "${s.id}"`),
    );

    return out;
  },
};

/**
 * Guards the decision that made the two-tier split necessary: path-tracer BVH
 * build cost scales with triangles, and a scatter field is the one place in the
 * document where a single number can produce unbounded geometry. A photoreal
 * tree is 50–200k triangles, so a few thousand instances is already tens of
 * millions and the render button stops working.
 */
export const scatterDensityIsSane: Rule = {
  name: "scatter-density-is-sane",
  run(doc, opts) {
    return doc.context.scatter.flatMap((field, i): LintFinding[] => {
      const a = area(field.area);
      if (a < 1e-3) return []; // polygons-have-area owns this
      const excluded = field.exclude.reduce((sum, poly) => sum + area(poly), 0);
      const net = Math.max(0, a - excluded);
      const instances = Math.round((net / 100) * field.density);

      if (instances <= opts.maxScatterInstances) return [];
      return [
        {
          rule: "scatter-density-is-sane",
          severity: "warning",
          path: `context.scatter[${i}]`,
          message: `scatter field "${field.id}" yields about ${instances.toLocaleString("en-GB")} instances over ${Math.round(net).toLocaleString("en-GB")} m² — above the ${opts.maxScatterInstances.toLocaleString("en-GB")} budget, which will make the path tracer's BVH build unusable`,
        },
      ];
    });
  },
};

/** A camera whose target equals its position has no view direction. */
export const shotCameraIsValid: Rule = {
  name: "shot-camera-is-valid",
  run(doc) {
    return doc.shots.flatMap((shot, i): LintFinding[] => {
      const [px, py, pz] = shot.camera.position;
      const [tx, ty, tz] = shot.camera.target;
      const d = Math.hypot(tx - px, ty - py, tz - pz);
      if (d >= 1e-3) return [];
      return [
        {
          rule: "shot-camera-is-valid",
          severity: "error",
          path: `shots[${i}].camera`,
          message: `shot "${shot.id}" has its camera target at the camera position — there is no view direction`,
        },
      ];
    });
  },
};
