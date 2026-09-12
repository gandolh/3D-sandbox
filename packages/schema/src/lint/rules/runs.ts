import { POST_HALF_WIDTH } from "../../derive/constants.js";
import type { RawFinding, Rule } from "../types.js";

/**
 * A run has to describe a path someone could walk along.
 *
 * The schema already insists on two points; it cannot tell that both are the
 * same point, or that a "pergola" is 30 cm wide and so has both rows of posts in
 * the same place. Those produce geometry that renders without complaint and
 * looks like nothing.
 */
export const runIsWellFormed: Rule = {
  name: "run-is-well-formed",
  run(doc) {
    const out: RawFinding[] = [];

    doc.subject.runs.forEach((run, i) => {
      const path = `subject.runs[${i}]`;
      let length = 0;
      for (let j = 1; j < run.path.length; j++) {
        const a = run.path[j - 1]!;
        const b = run.path[j]!;
        const step = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (step < 1e-3) {
          out.push({
            rule: "run-is-well-formed",
            severity: "error",
            path: `${path}.path[${j}]`,
            message: `${run.kind} "${run.id}" repeats the same point at index ${j} — a zero-length segment generates nothing`,
          });
        }
        length += step;
      }

      // Not `fence`: a fence stands on one line of posts, so its `width` is the
      // thickness of the thing and a small number is correct. This rule is
      // about the *span* between two rows, which only a pergola and a colonnade
      // have. It used to fire on every railing, and the honest reading of that
      // warning was that the geometry was wrong rather than the number.
      if (run.kind !== "hedge" && run.kind !== "fence" && run.width < 2 * POST_HALF_WIDTH) {
        out.push({
          rule: "run-is-well-formed",
          severity: "warning",
          path,
          message: `${run.kind} "${run.id}" is ${run.width.toFixed(2)} m wide, which is narrower than its own posts — both rows land in the same place`,
        });
      }

      if (run.kind !== "hedge" && run.spacing > length && length > 0) {
        out.push({
          rule: "run-is-well-formed",
          severity: "warning",
          path,
          message: `${run.kind} "${run.id}" has a post spacing of ${run.spacing} m over a ${length.toFixed(1)} m path — it will have posts only at its ends`,
        });
      }

      if (run.kind === "pergola" && run.height < 2) {
        out.push({
          rule: "run-is-well-formed",
          severity: "warning",
          path,
          message: `pergola "${run.id}" is ${run.height.toFixed(2)} m tall — you cannot walk under it`,
        });
      }

      if (run.climber !== undefined && run.kind !== "pergola") {
        out.push({
          rule: "run-is-well-formed",
          severity: "warning",
          path,
          message: `${run.kind} "${run.id}" has a climber, but only a pergola carries one — it will not be generated`,
        });
      }
    });

    return out;
  },
};
