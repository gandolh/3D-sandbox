import { materialReferences } from "../../derive/materials.js";
import type { RawFinding, Rule } from "../types.js";

/**
 * Every material id must resolve against the document's own `materials` table.
 * The table is in-document rather than global so a scene file stays
 * self-contained and hand-readable.
 */
export const materialResolves: Rule = {
  name: "material-resolves",
  run(doc) {
    const known = new Set(Object.keys(doc.materials));
    const out: RawFinding[] = [];
    for (const { id, path, owner } of materialReferences(doc)) {
      if (known.has(id)) continue;
      out.push({
        rule: "material-resolves",
        severity: "error",
        path,
        message: `${owner} references material "${id}", which is not in the document's materials table`,
      });
    }
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
    const used = new Set<string>();
    for (const { id } of materialReferences(doc)) used.add(id);

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
