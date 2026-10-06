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
      s.assets.forEach((a, ai) => check(a, `context.scatter[${i}].assets[${ai}]`, `scatter field "${s.id}"`)),
    );

    return out;
  },
};

/**
 * A textured material's `<source>/<slug>` must be a known material, checked only
 * when a list is supplied, like `asset-resolves`.
 *
 * A separate rule because the failure is quieter than an invented model. An
 * unknown slug downloads nothing, and the material renders as its `baseColor`
 * stand-in with no error anywhere. `procedural` has no slug, and a material
 * without one has nothing to look up, so both are skipped.
 */
export const materialSlugResolves: Rule = {
  name: "material-slug-resolves",
  run(doc, opts) {
    const known = opts.knownMaterials;
    if (known === undefined) return [];
    const out: RawFinding[] = [];
    for (const [id, material] of Object.entries(doc.materials)) {
      if (material.source === "procedural" || material.slug === undefined) continue;
      const ref = `${material.source}/${material.slug}`;
      if (known.has(ref)) continue;
      out.push({
        rule: "material-slug-resolves",
        severity: "error",
        path: `materials.${id}`,
        message: `material "${id}" names "${ref}", which is not a known material`,
      });
    }
    return out;
  },
};
