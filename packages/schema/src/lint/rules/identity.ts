import type { RawFinding, Rule } from "../types.js";

/**
 * Every id in a document must be unique, across every tier and entity kind.
 * Ids appear in linter messages and in the editor's selection state, so a
 * collision is not cosmetic — it makes one of the two entities unreachable.
 */
export const uniqueIds: Rule = {
  name: "unique-ids",
  run(doc) {
    const seen = new Map<string, string>();
    const out: RawFinding[] = [];

    const claim = (id: string, path: string): void => {
      const prior = seen.get(id);
      if (prior === undefined) {
        seen.set(id, path);
        return;
      }
      out.push({
        rule: "unique-ids",
        severity: "error",
        path,
        message: `id "${id}" is already used at ${prior}`,
      });
    };

    doc.subject.levels.forEach((level, li) => {
      claim(level.id, `subject.levels[${li}]`);
      level.walls.forEach((wall, wi) => {
        const wp = `subject.levels[${li}].walls[${wi}]`;
        claim(wall.id, wp);
        wall.openings.forEach((o, oi) => claim(o.id, `${wp}.openings[${oi}]`));
      });
      level.slabs.forEach((s, si) => claim(s.id, `subject.levels[${li}].slabs[${si}]`));
    });
    doc.subject.roofs.forEach((r, i) => claim(r.id, `subject.roofs[${i}]`));
    doc.subject.placements.forEach((p, i) => claim(p.id, `subject.placements[${i}]`));
    doc.context.scatter.forEach((s, i) => claim(s.id, `context.scatter[${i}]`));
    doc.context.masses.forEach((m, i) => claim(m.id, `context.masses[${i}]`));
    doc.context.roads.forEach((r, i) => claim(r.id, `context.roads[${i}]`));
    doc.shots.forEach((s, i) => claim(s.id, `shots[${i}]`));

    return out;
  },
};
