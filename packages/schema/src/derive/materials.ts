import type { SceneDocument } from "../document.js";

/** One place a material id appears in a document. */
export interface MaterialReference {
  id: string;
  /** JSON path, for a finding. */
  path: string;
  /** How to name the owner in a message: `wall "W-01"`. */
  owner: string;
}

/**
 * Every material id a document references, once.
 *
 * Two rules needed this list and each walked the document itself:
 * `material-resolves` to check ids exist, `materials-are-used` to check the
 * table has no leftovers. Two hand-written enumerations of the same tiers, and
 * adding a tier meant editing both — which is precisely what happened when
 * `context.paving` arrived. One rule was updated and the other silently
 * reported every paving material as unused, so the *new* feature looked like
 * the bug.
 *
 * A generator rather than an array because the two callers want different
 * things from it: one needs the path to report a finding, the other only needs
 * the id. Both get the same traversal.
 *
 * **Adding a tier means adding it here, once.** That is the whole point; if you
 * find yourself writing `doc.context.something.forEach` inside a rule again,
 * it belongs in this function instead.
 */
export function* materialReferences(doc: SceneDocument): Generator<MaterialReference> {
  yield { id: doc.site.terrain.material, path: "site.terrain", owner: "terrain" };

  for (const [li, level] of doc.subject.levels.entries()) {
    for (const [wi, wall] of level.walls.entries()) {
      const path = `subject.levels[${li}].walls[${wi}]`;
      yield { id: wall.material, path, owner: `wall "${wall.id}"` };
      for (const [oi, opening] of wall.openings.entries()) {
        if (opening.material !== undefined) {
          yield {
            id: opening.material,
            path: `${path}.openings[${oi}]`,
            owner: `opening "${opening.id}"`,
          };
        }
      }
    }
    for (const [si, slab] of level.slabs.entries()) {
      yield {
        id: slab.material,
        path: `subject.levels[${li}].slabs[${si}]`,
        owner: `slab "${slab.id}"`,
      };
    }
  }

  for (const [i, roof] of doc.subject.roofs.entries()) {
    yield { id: roof.material, path: `subject.roofs[${i}]`, owner: `roof "${roof.id}"` };
  }
  for (const [i, run] of doc.subject.runs.entries()) {
    yield { id: run.material, path: `subject.runs[${i}]`, owner: `${run.kind} "${run.id}"` };
    if (run.climber !== undefined) {
      yield {
        id: run.climber,
        path: `subject.runs[${i}].climber`,
        owner: `climber on ${run.kind} "${run.id}"`,
      };
    }
  }

  for (const [i, mass] of doc.context.masses.entries()) {
    yield { id: mass.material, path: `context.masses[${i}]`, owner: `mass "${mass.id}"` };
  }
  for (const [i, road] of doc.context.roads.entries()) {
    yield { id: road.material, path: `context.roads[${i}]`, owner: `road "${road.id}"` };
  }
  for (const [i, paving] of doc.context.paving.entries()) {
    yield { id: paving.material, path: `context.paving[${i}]`, owner: `paving "${paving.id}"` };
  }
  for (const [i, field] of doc.context.scatter.entries()) {
    if (field.material !== undefined) {
      yield { id: field.material, path: `context.scatter[${i}]`, owner: `scatter "${field.id}"` };
    }
  }
}
