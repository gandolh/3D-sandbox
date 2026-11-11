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

/**
 * `:id`. A plain string: whether it is a safe id is the file store's question, answered with a 400
 * `invalid_id` before any path is built.
 */
export const sceneParamsSchema = z.object({ id: z.string() });

/**
 * A create or a replace takes any JSON: the document is validated by `loadScene` in the file store, which
 * answers 422 `invalid_document` with its findings, the reply the web client reads. A stricter body
 * schema would turn that into a 400 of another shape.
 */
export const sceneBodySchema = z.unknown();

/**
 * An error a handler sends itself (`exists`, `invalid_precondition`). Declared on a status, it also encodes
 * every other error the error plugin sends on that status and route, so it names only the two fields they all
 * carry, and no literal code.
 */
export const errorReplySchema = z.object({ error: z.string(), message: z.string() });

/**
 * `PUT`'s precondition: the `mtimeMs` the client read, echoed back. A string, as every header is; the handler
 * answers 400 `invalid_precondition` when it is not a number. A loose object, because Fastify replaces
 * `request.headers` with what the schema returns, and a plain object would strip every other header.
 */
export const preconditionHeadersSchema = z.looseObject({ "x-scene-mtime": z.string().optional() });

/** `PUT`: the scene saved, its size on disk, and how many warnings it lints with. */
export const savedSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
  bytes: z.number().int(),
  warnings: z.number().int(),
});

/** `DELETE`: the scene removed. */
export const deletedSchema = z.object({ ok: z.literal(true), id: z.string() });

/** `POST /api/reindex`: the scenes the rescan indexed, and the files it dropped because they do not load. */
export const reindexedSchema = z.object({
  ok: z.literal(true),
  indexed: z.array(z.string()),
  failed: z.array(z.string()),
});
