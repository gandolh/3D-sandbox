import type { SceneDocument } from "../document.js";

const SEGMENT = /([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]/g;

/**
 * Resolve a finding's dotted path to the ids of every entity enclosing it,
 * outermost first: `subject.levels[0].walls[2].openings[1]` becomes
 * `["ground-floor", "W-03", "w-12"]`.
 *
 * Doing this centrally means a rule only has to report *where* it found a
 * problem, and a UI can filter on structure instead of grepping the prose of
 * the message — which is how that kind of filter silently breaks the first time
 * someone rewords an error.
 */
export function resolveEntities(doc: SceneDocument, path: string): string[] {
  const ids: string[] = [];
  let node: unknown = doc;

  for (const match of path.matchAll(SEGMENT)) {
    const key = match[1] ?? match[2];
    if (key === undefined || node === null || typeof node !== "object") return ids;

    node = (node as Record<string, unknown>)[key];
    if (node === null || typeof node !== "object") return ids;

    const id = (node as { id?: unknown }).id;
    if (typeof id === "string" && !ids.includes(id)) ids.push(id);
  }

  return ids;
}
