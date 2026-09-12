import { resolve, sep } from "node:path";

/**
 * Where the bake server is allowed to write, and what it will accept as a name.
 *
 * Separated from `serve.ts` so it can be tested: the server itself is a script
 * that binds a port, and a path-traversal guard that has never been run against
 * `../` is a guard on paper.
 */

/**
 * A manifest id, and only a manifest id: `<source>/<slug>`.
 *
 * `asset` arrives from a browser form and becomes a directory to write into, so
 * it is this server's whole security boundary. Matched **positively** against
 * the shape a real id has rather than by rejecting `..`, because a negative
 * rule has to anticipate every encoding and a positive one does not — `..%2f`,
 * a backslash, a leading slash and an absolute path all simply fail to be two
 * slug segments.
 */
export const ASSET_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/**
 * True when `path` is `root` or lies beneath it.
 *
 * `path.startsWith(root)` is **not** containment: `/home/u/assets-src-evil`
 * starts with `/home/u/assets-src` and is a different directory. The trailing
 * separator is what makes the test mean what it looks like it means.
 */
export function insideRoot(root: string, path: string): boolean {
  const full = resolve(path);
  const base = resolve(root);
  return full === base || full.startsWith(base + sep);
}
