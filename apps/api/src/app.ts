import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { SceneValidationError, serializeScene } from "@solstice/schema";
import { loadConfig, type Config } from "./config.js";
import { SceneIndex, summarize } from "./store/index-db.js";
import {
  SceneNotFoundError,
  UnsafeIdError,
  deleteSceneFile,
  readSceneFile,
  writeSceneFile,
} from "./store/files.js";

export interface BuiltApp {
  app: FastifyInstance;
  config: Config;
  index: SceneIndex;
}

/**
 * Seven routes. The service reads and writes JSON files and keeps a rebuildable
 * cache beside them; it stores nothing authoritative and re-implements none of
 * the validation that already lives in `@solstice/schema`.
 */
export async function buildApp(overrides: Partial<Config> = {}): Promise<BuiltApp> {
  const config = loadConfig(overrides);
  const index = new SceneIndex(config.databasePath);
  await index.reindex(config.scenesDir);

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof SceneValidationError) {
      return reply.code(422).send({ error: "invalid_document", findings: error.findings });
    }
    if (error instanceof UnsafeIdError) {
      return reply.code(400).send({ error: "invalid_id", message: error.message });
    }
    if (error instanceof SceneNotFoundError) {
      return reply.code(404).send({ error: "not_found", message: error.message });
    }
    if (error instanceof SyntaxError) {
      return reply.code(400).send({ error: "invalid_json", message: error.message });
    }
    app.log.error(error);
    const message = error instanceof Error ? error.message : String(error);
    return reply.code(500).send({ error: "internal", message });
  });

  app.get("/api/health", async () => ({
    ok: true,
    scenesDir: config.scenesDir,
    scenes: index.list().length,
  }));

  app.get("/api/scenes", async () => ({ scenes: index.list() }));

  app.get<{ Params: { id: string } }>("/api/scenes/:id", async (request) => {
    const document = await readSceneFile(config.scenesDir, request.params.id);
    return document;
  });

  app.post<{ Body: unknown }>("/api/scenes", async (request, reply) => {
    const body = request.body as { id?: unknown };
    const id = typeof body?.id === "string" ? body.id : "";
    if (index.get(id) !== null) {
      return reply.code(409).send({ error: "exists", message: `Scene "${id}" already exists` });
    }
    const { document, bytes } = await writeSceneFile(config.scenesDir, id, request.body);
    index.upsert(await summarize(config.scenesDir, id, document, bytes));
    return reply.code(201).send(document);
  });

  app.put<{ Params: { id: string }; Body: unknown }>("/api/scenes/:id", async (request) => {
    const { id } = request.params;
    const { document, bytes } = await writeSceneFile(config.scenesDir, id, request.body);
    index.upsert(await summarize(config.scenesDir, id, document, bytes));
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

  app.addHook("onClose", async () => index.close());
  return { app, config, index };
}

export { serializeScene };
