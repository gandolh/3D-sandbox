import { ResponseSerializationError } from "@fastify/type-provider-zod";
import { SceneValidationError } from "@solstice/schema";
import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { ApiError, ERROR_STATUS, type ErrorCode } from "../lib/api-error.js";

/** The code for a 4xx that Fastify or a plugin raised. */
function clientErrorCode(status: number): ErrorCode {
  if (status === 404) return "not_found";
  if (status === 413) return "too_large";
  return "bad_request";
}

/** The status a thrown value carries, if it carries one (Fastify's own errors and its plugins' do). */
function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return undefined;
  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

/**
 * The one error handler, and the 404 handler. Wrapped in fastify-plugin, so they are set on the root and every
 * route inherits them. Every body is `{ error, message, ... }`, which the web client and the CLI parse.
 *
 * - A document that does not load answers 422 with its findings.
 * - An `ApiError` answers its code's status with its message and details.
 * - A scene file on disk that is not JSON answers 400.
 * - A 4xx that Fastify raised (an empty or malformed JSON body, a body over the limit) keeps its status and
 *   its message, which Fastify writes for clients.
 * - Anything else is a 500 with a fixed message, logged with the request. Its own message is as likely to be a
 *   filesystem path or a stack detail as anything a caller can act on, so it never reaches the client. A reply
 *   its response schema refuses is such a 500, logged with the schema's issues.
 */
const errorHandling: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof SceneValidationError) {
      return reply.code(ERROR_STATUS.invalid_document).send({ error: "invalid_document", findings: error.findings });
    }
    if (error instanceof ApiError) {
      return reply.code(ERROR_STATUS[error.code]).send({ error: error.code, message: error.message, ...error.details });
    }
    // A request body that is not JSON never gets here: Fastify raises its own 400 for that, handled below.
    if (error instanceof SyntaxError) {
      return reply.code(ERROR_STATUS.invalid_json).send({ error: "invalid_json", message: error.message });
    }
    const status = statusOf(error);
    if (status !== undefined && status >= 400 && status < 500) {
      const message = error instanceof Error ? error.message : "The request is not valid.";
      return reply.code(status).send({ error: clientErrorCode(status), message });
    }
    if (error instanceof ResponseSerializationError) {
      // A handler sent what its response schema doesn't allow: a bug to fix, never the client's fault.
      request.log.error(
        { err: error, issues: error.cause.issues },
        `${error.method} ${error.url}: the reply doesn't match its schema`,
      );
    } else {
      request.log.error({ err: error }, "unhandled error");
    }
    return reply.code(ERROR_STATUS.internal).send({ error: "internal", message: "The API failed; its log says why." });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({ error: "not_found", message: `There is no route ${request.method} ${request.url}.` }),
  );
};

export const errors = fp(errorHandling, { name: "errors" });
