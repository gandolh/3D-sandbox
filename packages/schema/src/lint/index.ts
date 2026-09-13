import type { SceneDocument } from "../document.js";
import { resolveEntities } from "./entities.js";
import { polygonsHaveArea, scatterDensityIsSane, shotCameraIsValid } from "./rules/context.js";
import { uniqueIds } from "./rules/identity.js";
import { assetResolves, materialResolves, materialsAreUsed } from "./rules/references.js";
import { roomsAreHabitable } from "./rules/rooms.js";
import { roofCoversWalls } from "./rules/roofs.js";
import { runIsWellFormed } from "./rules/runs.js";
import {
  openingFitsHeight,
  openingFitsWall,
  openingsDoNotOverlap,
  wallNotDegenerate,
} from "./rules/walls.js";
import { DEFAULTS, type LintFinding, type LintOptions, type Rule } from "./types.js";

export * from "./types.js";
export * from "./entities.js";

/** Every rule, in the order findings are reported. */
export const RULES: readonly Rule[] = [
  uniqueIds,
  wallNotDegenerate,
  openingFitsWall,
  openingFitsHeight,
  openingsDoNotOverlap,
  roofCoversWalls,
  roomsAreHabitable,
  runIsWellFormed,
  polygonsHaveArea,
  materialResolves,
  assetResolves,
  scatterDensityIsSane,
  shotCameraIsValid,
  materialsAreUsed,
];

/**
 * The semantic pass that runs after Zod parsing.
 *
 * Zod checks shape; this checks meaning. The distinction matters because these
 * documents are written by a language model, and the failures that actually
 * occur are referential and geometric — an opening on a wall too short to hold
 * it, a roof that covers nothing — none of which a shape schema can see.
 */
export function lintScene(doc: SceneDocument, options: LintOptions = {}): LintFinding[] {
  const opts = {
    knownAssets: options.knownAssets,
    minOpeningEdgeMargin: options.minOpeningEdgeMargin ?? DEFAULTS.minOpeningEdgeMargin,
    maxScatterInstances: options.maxScatterInstances ?? DEFAULTS.maxScatterInstances,
    scatterErrorMultiple: options.scatterErrorMultiple ?? DEFAULTS.scatterErrorMultiple,
  };

  const findings: LintFinding[] = RULES.flatMap((rule) =>
    rule.run(doc, opts).map((finding) => ({
      ...finding,
      entities: resolveEntities(doc, finding.path),
    })),
  );
  // Errors first; otherwise keep rule order, which is roughly structural order.
  return findings.sort((a, b) => Number(b.severity === "error") - Number(a.severity === "error"));
}

export const errorsOf = (findings: readonly LintFinding[]): LintFinding[] =>
  findings.filter((f) => f.severity === "error");

export const hasErrors = (findings: readonly LintFinding[]): boolean =>
  findings.some((f) => f.severity === "error");

/** Human-readable one-liner, used by the CLI and by thrown errors. */
export const formatFinding = (f: LintFinding): string =>
  `${f.severity === "error" ? "✗" : "!"} ${f.path} [${f.rule}] ${f.message}`;
