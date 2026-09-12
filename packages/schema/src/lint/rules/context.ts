import { area } from "../../geometry.js";
import { estimateScatterInstances } from "../../derive/scatter.js";
import type { RawFinding, Rule } from "../types.js";

/** Zero-area polygons generate nothing and usually mean transposed coordinates. */
export const polygonsHaveArea: Rule = {
  name: "polygons-have-area",
  run(doc) {
    const out: RawFinding[] = [];
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
 *
 * **Two thresholds, and the second one refuses the document.** A warning is the
 * right answer for a field that is merely expensive — an author who wants
 * 6 000 trees and is prepared to wait is making a legitimate choice, and a
 * linter that forbids it is wrong. But a warning is the wrong answer for
 * `density: 1e9`, which used to parse, lint, and be persisted by
 * `PUT /api/scenes/:id` as a legitimate authored scene, because `loadScene`
 * only refuses on errors. Past a hard multiple of the budget the number has
 * stopped describing an intention, and the linter's stated job — that an
 * invalid document is never written — has to include it.
 */
export const scatterDensityIsSane: Rule = {
  name: "scatter-density-is-sane",
  run(doc, opts) {
    return doc.context.scatter.flatMap((field, i): RawFinding[] => {
      const { net, instances } = estimateScatterInstances(field);
      if (net < 1e-3) return []; // polygons-have-area owns this

      if (instances <= opts.maxScatterInstances) return [];

      const ceiling = opts.maxScatterInstances * opts.scatterErrorMultiple;
      const over = instances > ceiling;
      const count = instances.toLocaleString("en-GB");
      const area = Math.round(net).toLocaleString("en-GB");
      return [
        {
          rule: "scatter-density-is-sane",
          severity: over ? "error" : "warning",
          path: `context.scatter[${i}]`,
          message: over
            ? `scatter field "${field.id}" yields about ${count} instances over ${area} m² — past the ${ceiling.toLocaleString("en-GB")} hard ceiling, ${opts.scatterErrorMultiple}× the budget. This is not a scene that renders slowly; it is a number no machine can draw`
            : `scatter field "${field.id}" yields about ${count} instances over ${area} m² — above the ${opts.maxScatterInstances.toLocaleString("en-GB")} budget, which will make the path tracer's BVH build unusable`,
        },
      ];
    });
  },
};

/** A camera whose target equals its position has no view direction. */
export const shotCameraIsValid: Rule = {
  name: "shot-camera-is-valid",
  run(doc) {
    return doc.shots.flatMap((shot, i): RawFinding[] => {
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
