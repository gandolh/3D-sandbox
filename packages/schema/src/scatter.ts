import { area } from "./geometry.js";
import type { ScatterField } from "./document.js";

export interface ScatterEstimate {
  /** Field area less its exclusions, in m². */
  net: number;
  /** How many instances the field will place. */
  instances: number;
}

/**
 * How many instances a scatter field yields.
 *
 * Shared by the lint rule that guards the triangle budget and by the API's scene
 * summary — two places that must agree, because one tells the user the render
 * will work and the other tells them how big the scene is.
 */
export function estimateScatterInstances(field: ScatterField): ScatterEstimate {
  const gross = area(field.area);
  const excluded = field.exclude.reduce((sum, poly) => sum + area(poly), 0);
  const net = Math.max(0, gross - excluded);
  return { net, instances: Math.round((net / 100) * field.density) };
}
