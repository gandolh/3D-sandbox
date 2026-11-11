import { z } from "zod";

// The scene routes' schemas. Only the server uses them, so they live with the feature (the web client reads the
// replies by hand); the document itself is `SceneDocument`, from @solstice/schema. A response schema holds no
// transform, and lists its keys in the order the handler builds them, so a reply's bytes do not change.

/** One scene as `GET /api/scenes` lists it: the index's columns, in table order, then `hasBuilder`. */
const sceneListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  bytes: z.number().int(),
  /** The file's `mtimeMs`: a float. */
  mtime: z.number(),
  walls: z.number().int(),
  openings: z.number().int(),
  shots: z.number().int(),
  scatterInstances: z.number().int(),
  warnings: z.number().int(),
  /** Whether `scenes/src/<id>.ts` exists, so `npm run scenes` would overwrite the scene. */
  hasBuilder: z.boolean(),
});

/** `GET /api/scenes`. */
export const sceneListSchema = z.object({ scenes: z.array(sceneListItemSchema) });
