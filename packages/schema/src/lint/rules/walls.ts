import { intervalsOverlap, length } from "../../geometry.js";
import type { RawFinding, Rule } from "../types.js";

/** A wall whose endpoints coincide generates no geometry and breaks openings. */
export const wallNotDegenerate: Rule = {
  name: "wall-not-degenerate",
  run(doc) {
    const out: RawFinding[] = [];
    doc.subject.levels.forEach((level, li) => {
      level.walls.forEach((wall, wi) => {
        const len = length(wall.start, wall.end);
        const path = `subject.levels[${li}].walls[${wi}]`;
        if (len < 1e-3) {
          out.push({
            rule: "wall-not-degenerate",
            severity: "error",
            path,
            message: `wall "${wall.id}" has zero length — start and end are the same point`,
          });
        } else if (len <= wall.thickness) {
          out.push({
            rule: "wall-not-degenerate",
            severity: "warning",
            path,
            message: `wall "${wall.id}" is ${len.toFixed(3)} m long but ${wall.thickness.toFixed(3)} m thick — it is wider than it is long`,
          });
        }
      });
    });
    return out;
  },
};

/**
 * An opening must sit entirely within its host wall, leaving enough material
 * at each end to carry load. This is the single most common failure in a
 * hand- or model-authored document, because the offset is relative to the wall
 * and the wall's length is implied by its endpoints.
 */
export const openingFitsWall: Rule = {
  name: "opening-fits-wall",
  run(doc, opts) {
    const out: RawFinding[] = [];
    doc.subject.levels.forEach((level, li) => {
      level.walls.forEach((wall, wi) => {
        const len = length(wall.start, wall.end);
        if (len < 1e-3) return; // wall-not-degenerate owns this
        const margin = opts.minOpeningEdgeMargin;

        wall.openings.forEach((o, oi) => {
          const path = `subject.levels[${li}].walls[${wi}].openings[${oi}]`;
          const far = o.offset + o.width;

          if (far > len) {
            out.push({
              rule: "opening-fits-wall",
              severity: "error",
              path,
              message: `opening "${o.id}" ends at ${far.toFixed(3)} m but wall "${wall.id}" is only ${len.toFixed(3)} m long`,
            });
            return;
          }
          if (o.offset < margin) {
            out.push({
              rule: "opening-fits-wall",
              severity: "error",
              path,
              message: `opening "${o.id}" sits ${(o.offset * 1000).toFixed(0)} mm from the start of wall "${wall.id}" — below the ${(margin * 1000).toFixed(0)} mm structural minimum`,
            });
          }
          if (len - far < margin) {
            out.push({
              rule: "opening-fits-wall",
              severity: "error",
              path,
              message: `opening "${o.id}" sits ${((len - far) * 1000).toFixed(0)} mm from the end of wall "${wall.id}" — below the ${(margin * 1000).toFixed(0)} mm structural minimum`,
            });
          }
        });
      });
    });
    return out;
  },
};

/** An opening taller than its wall cuts through the plate above it. */
export const openingFitsHeight: Rule = {
  name: "opening-fits-height",
  run(doc) {
    const out: RawFinding[] = [];
    doc.subject.levels.forEach((level, li) => {
      level.walls.forEach((wall, wi) => {
        const wallHeight = wall.height ?? level.height;
        wall.openings.forEach((o, oi) => {
          const top = o.sill + o.height;
          if (top > wallHeight) {
            out.push({
              rule: "opening-fits-height",
              severity: "error",
              path: `subject.levels[${li}].walls[${wi}].openings[${oi}]`,
              message: `opening "${o.id}" reaches ${top.toFixed(3)} m but wall "${wall.id}" is only ${wallHeight.toFixed(3)} m high`,
            });
          }
          if (o.kind === "door" && o.sill > 1e-6) {
            out.push({
              rule: "opening-fits-height",
              severity: "warning",
              path: `subject.levels[${li}].walls[${wi}].openings[${oi}]`,
              message: `door "${o.id}" has a sill of ${(o.sill * 1000).toFixed(0)} mm — doors normally start at floor level`,
            });
          }
        });
      });
    });
    return out;
  },
};

/** Two openings overlapping along one wall produce a single malformed void. */
export const openingsDoNotOverlap: Rule = {
  name: "openings-do-not-overlap",
  run(doc) {
    const out: RawFinding[] = [];
    doc.subject.levels.forEach((level, li) => {
      level.walls.forEach((wall, wi) => {
        const path = `subject.levels[${li}].walls[${wi}]`;
        for (let a = 0; a < wall.openings.length; a++) {
          for (let b = a + 1; b < wall.openings.length; b++) {
            const oa = wall.openings[a]!;
            const ob = wall.openings[b]!;
            const planOverlap = intervalsOverlap(
              oa.offset,
              oa.offset + oa.width,
              ob.offset,
              ob.offset + ob.width,
            );
            if (!planOverlap) continue;
            const vertOverlap = intervalsOverlap(
              oa.sill,
              oa.sill + oa.height,
              ob.sill,
              ob.sill + ob.height,
            );
            if (!vertOverlap) continue;
            out.push({
              rule: "openings-do-not-overlap",
              severity: "error",
              path: `${path}.openings[${b}]`,
              message: `opening "${ob.id}" overlaps "${oa.id}" on wall "${wall.id}"`,
            });
          }
        }
      });
    });
    return out;
  },
};
