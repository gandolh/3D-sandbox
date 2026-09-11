/**
 * Unit conventions for Solstice scene documents.
 *
 * Documents are hand-authored, so they use the units an author would write:
 * **metres for every length** and **degrees for every angle**. Millimetre
 * thicknesses ("a 240 mm wall") are a presentation concern — the document
 * stores `0.24`. Radians never appear on disk; conversion happens past the
 * schema boundary.
 *
 * Axes are three.js-native: Y-up, right-handed. The ground plane is XZ, which
 * is why plan-space coordinates are `[x, z]` and not `[x, y]`.
 */

/** Metres. */
export type M = number;
/** Degrees. */
export type Deg = number;

export const degToRad = (d: Deg): number => (d * Math.PI) / 180;
export const radToDeg = (r: number): Deg => (r * 180) / Math.PI;

/** Millimetres, for display only — never stored in a document. */
export const mToMm = (m: M): number => m * 1000;
export const mmToM = (mm: number): M => mm / 1000;
