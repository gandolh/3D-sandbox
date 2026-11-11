import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { SceneDocument } from "@solstice/schema";
import type { Config } from "../../config.js";
import { SceneNotFoundError, UnsafeIdError } from "./errors.js";
import { deleteSceneFile, hasBuilder, readSceneFile, sceneMtime, writeSceneFile } from "./files.js";
import { type SceneIndex, summarize } from "./index-db.js";
import { errorReplySchema, sceneBodySchema, sceneListSchema, sceneParamsSchema } from "./schemas.js";

/** What the scene routes take from the app: where the scene files are, and the index over them. */
export interface ScenesOptions {
  config: Pick<Config, "scenesDir">;
  index: SceneIndex;
}

/**
 * Six routes over the scene files: list, read, create, replace, delete and rescan. They read and write JSON
 * files and keep the index beside them current; validation is `loadScene`'s, in the file store.
 */
export const sceneRoutes: FastifyPluginAsyncZod<ScenesOptions> = async (app, { config, index }) => {
  /**
   * The index, plus `hasBuilder` per scene: whether `npm run scenes` would
   * overwrite it. The browser warns before drawing in one that it would.
   */
  app.get("/api/scenes", { schema: { response: { 200: sceneListSchema } } }, async () => ({
    scenes: await Promise.all(
      index.list().map(async (scene) => ({ ...scene, hasBuilder: await hasBuilder(config.scenesDir, scene.id) })),
    ),
  }));

  /**
   * The document, and the version of it the caller is now holding.
   *
   * `mtime` goes out in a header rather than in the body because the body is a
   * `SceneDocument` and has to stay exactly that — it is parsed by the schema
   * on the way back in, and a stray field would be a lint finding.
   */
  app.get(
    "/api/scenes/:id",
    { schema: { params: sceneParamsSchema, response: { 200: SceneDocument } } },
    async (request, reply) => {
      const { id } = request.params;
      const document = await readSceneFile(config.scenesDir, id);
      reply.header("x-scene-mtime", String(await sceneMtime(config.scenesDir, id)));
      return document;
    },
  );

  /**
   * Whether a scene file is on disk — asked of the disk, the way `PUT` asks,
   * because the index is a derived cache and a scene dropped in by hand is a
   * real scene before any rescan notices it. Asking the index here let a `POST`
   * replace a hand-written file it had never heard of.
   *
   * A file that is present but does not load still counts as present: it is
   * somebody's work, and refusing to overwrite it is the whole point.
   */
  const onDisk = async (id: string): Promise<boolean> => {
    try {
      await readSceneFile(config.scenesDir, id);
      return true;
    } catch (error) {
      if (error instanceof SceneNotFoundError) return false;
      if (error instanceof UnsafeIdError) throw error;
      return true;
    }
  };

  /**
   * Create. No `x-scene-mtime` precondition, unlike `PUT`: a create has no
   * earlier read to be stale against, and the existence check above it is the
   * only guard it needs.
   */
  app.post(
    "/api/scenes",
    { schema: { body: sceneBodySchema, response: { 201: SceneDocument, 409: errorReplySchema } } },
    async (request, reply) => {
      const body = request.body as { id?: unknown };
      const id = typeof body?.id === "string" ? body.id : "";
      if (await onDisk(id)) {
        return reply.code(409).send({ error: "exists", message: `Scene "${id}" already exists` });
      }
      const { document, bytes } = await writeSceneFile(config.scenesDir, id, request.body);
      index.upsert(await summarize(config.scenesDir, id, document, bytes));
      // The version the creator now holds, as a read would hand it out, so its
      // first save can be conditional like every later one.
      reply.header("x-scene-mtime", String(await sceneMtime(config.scenesDir, id)));
      return reply.code(201).send(document);
    },
  );

  /**
   * Replace a scene that exists. It does not create one.
   *
   * It used to: a `PUT` to an unknown id wrote a new file. That reading of
   * `PUT` is defensible in the abstract and wrong here, because the id comes
   * from a URL a person typed and the cost of a typo was a **second scene**
   * silently appearing beside the one they meant to edit, with the index
   * dutifully listing it. `POST /api/scenes` is how a scene is created, it
   * refuses to clobber any file on disk — indexed or not — and having exactly
   * one door in is worth more than the convenience.
   *
   * `x-scene-mtime`, echoed from the read, makes the write conditional. Absent,
   * the write proceeds — a caller that never read the file has nothing to be
   * stale about, and scripts that generate scenes wholesale are legitimate.
   */
  app.put<{ Params: { id: string }; Body: unknown }>("/api/scenes/:id", async (request, reply) => {
    const { id } = request.params;
    const header = request.headers["x-scene-mtime"];
    const expected = typeof header === "string" && header !== "" ? Number(header) : undefined;
    if (expected !== undefined && !Number.isFinite(expected)) {
      return reply.code(400).send({ error: "invalid_precondition", message: "x-scene-mtime must be a number" });
    }

    // Existence is checked here rather than inferred from a failed write, and
    // against the disk rather than the index — see `onDisk`. A file that is
    // present but does not load fails here too, which is right for a replace.
    await readSceneFile(config.scenesDir, id);

    const { document, bytes } = await writeSceneFile(config.scenesDir, id, request.body, expected);
    index.upsert(await summarize(config.scenesDir, id, document, bytes));
    // The new version. Without it a client holding the mtime it read would
    // find its own second save refused as stale.
    reply.header("x-scene-mtime", String(await sceneMtime(config.scenesDir, id)));
    return { ok: true, id, bytes, warnings: index.get(id)?.warnings ?? 0 };
  });

  app.delete<{ Params: { id: string } }>("/api/scenes/:id", async (request) => {
    const { id } = request.params;
    await deleteSceneFile(config.scenesDir, id);
    index.remove(id);
    return { ok: true, id };
  });

  /**
   * Rescan. The reason this route exists at all: scene files are edited outside
   * the app routinely, and the index has to be able to catch up.
   */
  app.post("/api/reindex", async () => {
    const result = await index.reindex(config.scenesDir);
    return { ok: true, ...result };
  });
};
