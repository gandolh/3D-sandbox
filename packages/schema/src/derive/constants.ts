import type { M } from "../units.js";

/**
 * The full section of a post in a colonnade, pergola or fence — an 80 mm
 * square.
 *
 * The generator draws posts this size, centred on rows at ±`width / 2`, so the
 * two rows' faces meet when `width` equals one post and overlap below it. The
 * linter warns at exactly that point. Both read this one number, which is only
 * a real check while it means the same thing to both: it was once a literal
 * `2 * 0.08` in the rule, and then a constant named `POST_HALF_WIDTH` that the
 * generator used as the whole section — so the rule doubled a number that was
 * never a half, and warned on every colonnade between 80 and 160 mm wide.
 */
export const POST_WIDTH: M = 0.08;
