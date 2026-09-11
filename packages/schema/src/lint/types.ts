import type { SceneDocument } from "../document.js";

export type Severity = "error" | "warning";

export interface LintFinding {
  /** Stable rule identifier, e.g. `opening-fits-wall`. */
  rule: string;
  severity: Severity;
  /** Where in the document, in dotted path form. */
  path: string;
  message: string;
}

export interface LintOptions {
  /**
   * Asset ids present in the generated manifest. When omitted, asset
   * references are not checked — the manifest does not exist during early
   * authoring and a rule that always fails is a rule people learn to ignore.
   */
  knownAssets?: ReadonlySet<string>;
  /**
   * Minimum distance from an opening's edge to the end of its host wall.
   * Below this there is not enough material left to carry the load.
   */
  minOpeningEdgeMargin?: number;
  /**
   * Instance count above which a scatter field is flagged. Exists because
   * path-tracer BVH build cost scales with triangles, and an unbounded forest
   * is the documented way this project breaks its own render button.
   */
  maxScatterInstances?: number;
}

export interface ResolvedOptions {
  knownAssets: ReadonlySet<string> | undefined;
  minOpeningEdgeMargin: number;
  maxScatterInstances: number;
}

export interface Rule {
  name: string;
  run(doc: SceneDocument, opts: ResolvedOptions): LintFinding[];
}

export const DEFAULTS = {
  minOpeningEdgeMargin: 0.25,
  maxScatterInstances: 4000,
} as const;
