import { z } from "zod";

/**
 * Ids are author-written and appear in error messages, so they are readable
 * rather than generated: `W-03`, `w-11`, `roof-main`.
 */
export const Id = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_-]*$/, "must start with a letter, then letters/digits/-/_")
  .min(1)
  .max(64);

export type Id = z.infer<typeof Id>;

/** A key into the document's own `materials` table. */
export const MaterialId = Id;
/** A key into the generated asset manifest (a glTF model). */
export const AssetId = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9_./-]*$/, "manifest path segment")
  .max(128);
