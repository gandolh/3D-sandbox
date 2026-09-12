import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { SceneValidationError, serializeScene } from "@solstice/schema";
import { loadConfig, type Config } from "./config.js";
import { SceneIndex, summarize } from "./store/index-db.js";
import {
  SceneNotFoundError,
  StalePreconditionError,
  UnsafeIdError,
  sceneMtime,
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

  /**
   * One named origin, not `true`.
   *
   * `origin: true` **reflects whatever origin asked**, which is not a relaxed
   * setting — it is the removal of the browser's own same-origin protection.
   * Any page in any tab could then read every scene on this machine and
   * `DELETE` them, because the browser would attach the reflected header and
   * hand the response over.
   *
   * That is a separate question from the locked decision that the API is
   * unauthenticated: unauthenticated is fine for something bound to
   * `127.0.0.1` and reachable only by its own client. Reflecting origins makes
   * it reachable by every website the user visits, which is not the same thing
   * at all.
   */
  await app.register(cors, { origin: config.allowedOrigins });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof SceneValidationError) {
      return reply.code(422).send({ error: "invalid_document", findings: error.findings });
    }
    if (error instanceof UnsafeIdError) {
      return reply.code(400).send({ error: "invalid_id", message: error.message });
    }
    if (error instanceof StalePreconditionError) {
      return reply
        .code(409)
        .send({ error: "stale", message: error.message, mtime: error.current });
    }
    if (error instanceof SceneNotFoundError) {
      return reply.code(404).send({ error: "not_found", message: error.message });
    }
    if (error instanceof SyntaxError) {
      return reply.code(400).send({ error: "invalid_json", message: error.message });
    }
    // Everything above this line is the API deliberately explaining itself —
    // lint findings, a bad id, a missing scene. Below it is a failure nobody
    // anticipated, whose message is as likely to be a filesystem path or a
    // stack detail as anything a caller can act on. Logged in full, reported as
    // a fact.
    app.log.error(error);
    return reply.code(500).send({ error: "internal" });
  });

  // No `scenesDir`: a health check that publishes an absolute filesystem path
  // is telling an unauthenticated caller the layout of the host. Whether one is
  // configured is all the information the check was ever used for.
  app.get("/api/health", async () => ({
    ok: true,
    scenesConfigured: config.scenesDir.length > 0,
    scenes: index.list().length,
  }));

  app.get("/api/scenes", async () => ({ scenes: index.list() }));

  /**
   * The document, and the version of it the caller is now holding.
   *
   * `mtime` goes out in a header rather than in the body because the body is a
   * `SceneDocument` and has to stay exactly that — it is parsed by the schema
   * on the way back in, and a stray field would be a lint finding.
   */
  app.get<{ Params: { id: string } }>("/api/scenes/:id", async (request, reply) => {
    const { id } = request.params;
    const document = await readSceneFile(config.scenesDir, id);
    reply.header("x-scene-mtime", String(await sceneMtime(config.scenesDir, id)));
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

  /**
   * Replace a scene that exists. It does not create one.
   *
   * It used to: a `PUT` to an unknown id wrote a new file. That reading of
   * `PUT` is defensible in the abstract and wrong here, because the id comes
   * from a URL a person typed and the cost of a typo was a **second scene**
   * silently appearing beside the one they meant to edit, with the index
   * dutifully listing it. `POST /api/scenes` is how a scene is created, it
   * already refuses to clobber, and having exactly one door in is worth more
   * than the convenience.
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
      return reply
        .code(400)
        .send({ error: "invalid_precondition", message: "x-scene-mtime must be a number" });
    }

    // Existence is checked here rather than inferred from a failed write, and
    // against the disk rather than the index — the index is a derived cache and
    // a scene dropped in by hand is a real scene before any rescan notices it.
    await readSceneFile(config.scenesDir, id);

    const { document, bytes } = await writeSceneFile(config.scenesDir, id, request.body, expected);
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
