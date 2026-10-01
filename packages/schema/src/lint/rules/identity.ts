import type { RawFinding, Rule } from "../types.js";

/**
 * Every id in a document must be unique, across every tier and entity kind.
 * Ids appear in linter messages and in the editor's selection state, so a
 * collision is not cosmetic — it makes one of the two entities unreachable.
 *
 * **Found by walking the document, not by listing entity kinds.** This rule
 * used to enumerate them by hand, and the list went stale twice: first without
 * `subject.runs` and `animation.tracks` (two same-id pergolas grew identical
 * foliage, since `runs.ts` seeds each canopy from `run.id`), then without
 * `level.rooms` and `context.paving`, which arrived after the list was written.
 * Two rooms sharing a wall's id then had their findings attached to the wall,
 * and were unreachable from the tree themselves.
 *
 * A hand-maintained enumeration fails silently — the same hazard as brief 24's
 * hand-listed cache key — so there is no list. Every object below the root with
 * a string `id` is an entity and is claimed at its own path, and a new entity
 * kind participates the day it is added to the schema. The root's own `id` is
 * the scene's name, not an entity, and is the one exclusion.
 *
 * The cost is that anything added later with a field called `id` is treated as
 * an entity id. That is the right default: a reference to another entity is
 * named for what it points at (`level`, `target`, `material`), never `id`.
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

    const walk = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${path}[${i}]`));
        return;
      }
      if (value === null || typeof value !== "object") return;
      const entity = value as Record<string, unknown>;
      // A parent is claimed before its children, so a level's id is "first
      // used" at the level rather than at whichever wall repeats it.
      if (path !== "" && typeof entity.id === "string") claim(entity.id, path);
      for (const [key, child] of Object.entries(entity)) walk(child, path === "" ? key : `${path}.${key}`);
    };
    walk(doc, "");

    return out;
  },
};
