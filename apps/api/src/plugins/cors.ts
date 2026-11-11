import cors from "@fastify/cors";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

export interface CorsPolicyOptions {
  /** The origins a browser may call this API from: `Config.allowedOrigins`. */
  allowedOrigins: string[];
}

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
const corsOrigins: FastifyPluginAsync<CorsPolicyOptions> = async (app, { allowedOrigins }) => {
  await app.register(cors, { origin: allowedOrigins });
};

/** Wrapped in fastify-plugin, so the policy is set on the root and covers every route. */
export const corsPolicy = fp(corsOrigins, { name: "cors-policy" });
