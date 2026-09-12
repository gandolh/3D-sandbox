import type { M } from "../units.js";

/**
 * Half the width of a post in a colonnade, pergola or fence.
 *
 * The generator draws posts this size and the linter warns when a run is
 * narrower than two of them — which is only a real check while both numbers are
 * the same number. They were not: `run-is-well-formed` carried the literal
 * `2 * 0.08`, so changing the generator's post would have left the rule
 * quietly checking the old one.
 */
export const POST_HALF_WIDTH: M = 0.08;
