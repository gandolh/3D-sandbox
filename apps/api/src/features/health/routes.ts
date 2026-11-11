import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { Config } from "../../config.js";

/** What the health check takes from the app. */
export interface HealthOptions {
  config: Pick<Config, "scenesDir">;
  /** The scene index: the check reports how many scenes it lists. */
  index: { list(): readonly unknown[] };
}

/** `GET /api/health`: whether the service is up, whether it has a scenes directory, and how many scenes it lists. */
const healthSchema = z.object({ ok: z.literal(true), scenesConfigured: z.boolean(), scenes: z.number().int() });

export const healthRoutes: FastifyPluginAsyncZod<HealthOptions> = async (app, { config, index }) => {
  // No `scenesDir`: a health check that publishes an absolute filesystem path
  // is telling an unauthenticated caller the layout of the host. Whether one is
  // configured is all the information the check was ever used for.
  app.get("/api/health", { schema: { response: { 200: healthSchema } } }, async () => ({
    ok: true as const,
    scenesConfigured: config.scenesDir.length > 0,
    scenes: index.list().length,
  }));
};
