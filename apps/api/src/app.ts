import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Config } from "./config.js";
import { healthRoutes } from "./features/health/index.js";
import { SceneIndex, sceneRoutes } from "./features/scenes/index.js";
import { corsPolicy } from "./plugins/cors.js";
import { errors } from "./plugins/errors.js";

/** The app, and the index it serves, which tests read to check what a route changed. */
export interface BuiltApp {
  app: FastifyInstance;
  index: SceneIndex;
}

export interface BuildAppOptions {
  /** Fastify's options that belong to the process: server.ts sets the logger, and a test leaves it out. */
  server?: Pick<FastifyServerOptions, "logger">;
}

/**
 * The app, ready and not listening. Seven routes: the service reads and writes JSON files and keeps a
 * rebuildable cache beside them; it stores nothing authoritative and re-implements none of the validation that
 * already lives in `@solstice/schema`.
 *
 * It registers in a fixed order: the zod compilers, the app's own plugins (CORS, errors), then each feature, handed the config
 * and the index as its options. Closing it closes the index.
 */
export async function buildApp(config: Config, options: BuildAppOptions = {}): Promise<BuiltApp> {
  const index = new SceneIndex(config.databasePath);
  await index.reindex(config.scenesDir);

  const app = Fastify(options.server);
  // Zod checks each request and encodes each reply, in every plugin registered below.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // The app's own plugins, fastify-plugin wrapped so they reach every feature.
  await app.register(corsPolicy, { allowedOrigins: config.allowedOrigins });
  await app.register(errors);

  // The features, each encapsulated.
  const context = { config, index };
  await app.register(healthRoutes, context);
  await app.register(sceneRoutes, context);

  app.addHook("onClose", async () => index.close());
  return { app, index };
}
