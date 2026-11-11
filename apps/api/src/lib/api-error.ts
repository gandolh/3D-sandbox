/**
 * Every error code the API sends, and the status it answers with. A client switches on the code; a new code is
 * one line here.
 */
export const ERROR_STATUS = {
  /** A scene id that can't be a file name. */
  invalid_id: 400,
  /** An `x-scene-mtime` that is not a number. */
  invalid_precondition: 400,
  /** A scene file on disk that is not JSON. */
  invalid_json: 400,
  /** A 4xx that Fastify raised itself: an empty or malformed JSON body. */
  bad_request: 400,
  not_found: 404,
  /** A write built on a read the file has changed since. */
  stale: 409,
  /** A create over a scene file already on disk. */
  exists: 409,
  /** A body over Fastify's limit (1 MiB). */
  too_large: 413,
  /** A document that does not load: the body lists the findings. */
  invalid_document: 422,
  internal: 500,
} as const satisfies Record<string, number>;

export type ErrorCode = keyof typeof ERROR_STATUS;

/**
 * The API's one error class. Throw it, or a subclass, to answer `ERROR_STATUS[code]` with
 * `{ error: code, message, ...details }`; the error plugin writes the body.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  /** Fields the body carries beside `error` and `message`, such as a stale write's `mtime`. */
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: ErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}
