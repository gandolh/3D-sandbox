import type { RawFinding, Rule } from "../types.js";

/**
 * Every material id must resolve against the document's own `materials` table.
 * The table is in-document rather than global so a scene file stays
 * self-contained and hand-readable.
 */
export const materialResolves: Rule = {
  name: "material-resolves",
  run(doc) {
    const out: RawFinding[] = [];
    const known = new Set(Object.keys(doc.materials));

    const check = (id: string | undefined, path: string, owner: string): void => {
      if (id === undefined) return;
      if (known.has(id)) return;
      out.push({
        rule: "material-resolves",
        severity: "error",
        path,
        message: `${owner} references material "${id}", which is not in the document's materials table`,
      });
    };

    check(doc.site.terrain.material, "site.terrain", "terrain");
    doc.subject.levels.forEach((level, li) => {
      level.walls.forEach((w, wi) => {
        const p = `subject.levels[${li}].walls[${wi}]`;
        check(w.material, p, `wall "${w.id}"`);
        w.openings.forEach((o, oi) =>
          check(o.material, `${p}.openings[${oi}]`, `opening "${o.id}"`),
        );
      });
      level.slabs.forEach((s, si) =>
        check(s.material, `subject.levels[${li}].slabs[${si}]`, `slab "${s.id}"`),
      );
    });
    doc.subject.roofs.forEach((r, i) => check(r.material, `subject.roofs[${i}]`, `roof "${r.id}"`));
    doc.subject.runs.forEach((r, i) => {
      check(r.material, `subject.runs[${i}]`, `${r.kind} "${r.id}"`);
      if (r.climber !== undefined) {
        check(r.climber, `subject.runs[${i}].climber`, `climber on ${r.kind} "${r.id}"`);
      }
    });
    doc.context.masses.forEach((m, i) =>
      check(m.material, `context.masses[${i}]`, `mass "${m.id}"`),
    );
    doc.context.roads.forEach((r, i) => check(r.material, `context.roads[${i}]`, `road "${r.id}"`));
    doc.context.scatter.forEach((f, i) => {
      if (f.material !== undefined) check(f.material, `context.scatter[${i}]`, `scatter "${f.id}"`);
    });

    return out;
  },
};

/**
 * Unused materials are a warning, not an error — they are usually a leftover
 * from an edit, and they cost nothing but noise.
 */
export const materialsAreUsed: Rule = {
  name: "materials-are-used",
  run(doc) {
    const used = new Set<string>([doc.site.terrain.material]);
    for (const level of doc.subject.levels) {
      for (const w of level.walls) {
        used.add(w.material);
        for (const o of w.openings) if (o.material !== undefined) used.add(o.material);
      }
      for (const s of level.slabs) used.add(s.material);
    }
    for (const r of doc.subject.roofs) used.add(r.material);
    for (const r of doc.subject.runs) {
      used.add(r.material);
      if (r.climber !== undefined) used.add(r.climber);
    }
    for (const m of doc.context.masses) used.add(m.material);
    for (const r of doc.context.roads) used.add(r.material);
    for (const f of doc.context.scatter) if (f.material !== undefined) used.add(f.material);

    return Object.keys(doc.materials)
      .filter((id) => !used.has(id))
      .map((id) => ({
        rule: "materials-are-used",
        severity: "warning" as const,
        path: `materials.${id}`,
        message: `material "${id}" is defined but never referenced`,
      }));
  },
};

/**
 * Asset references are checked only when a manifest is supplied. During early
 * authoring there is no manifest, and a rule that always fires is a rule people
 * learn to ignore.
 */
export const assetResolves: Rule = {
  name: "asset-resolves",
  run(doc, opts) {
    const known = opts.knownAssets;
    if (known === undefined) return [];
    const out: RawFinding[] = [];

    const check = (asset: string, path: string, owner: string): void => {
      if (known.has(asset)) return;
      out.push({
        rule: "asset-resolves",
        severity: "error",
        path,
        message: `${owner} references asset "${asset}", which is not in the manifest`,
      });
    };

    doc.subject.placements.forEach((p, i) =>
      check(p.asset, `subject.placements[${i}]`, `placement "${p.id}"`),
    );
    doc.context.scatter.forEach((s, i) =>
      s.assets.forEach((a, ai) =>
        check(a, `context.scatter[${i}].assets[${ai}]`, `scatter field "${s.id}"`),
      ),
    );

    return out;
  },
};
