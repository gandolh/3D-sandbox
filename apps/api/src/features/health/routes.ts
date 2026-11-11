import type { FastifyPluginAsync } from "fastify";
import type { Config } from "../../config.js";

/** What the health check takes from the app. */
export interface HealthOptions {
  config: Pick<Config, "scenesDir">;
  /** The scene index: the check reports how many scenes it lists. */
  index: { list(): readonly unknown[] };
}

export const healthRoutes: FastifyPluginAsync<HealthOptions> = async (app, { config, index }) => {
  // No `scenesDir`: a health check that publishes an absolute filesystem path
  // is telling an unauthenticated caller the layout of the host. Whether one is
  // configured is all the information the check was ever used for.
  app.get("/api/health", async () => ({
    ok: true,
    scenesConfigured: config.scenesDir.length > 0,
    scenes: index.list().length,
  }));
};
