import { ApiError } from "../../lib/api-error.js";

// The scene store's errors. Each is an ApiError, so the error plugin answers it without knowing scenes exist,
// and the store and the tests can still tell them apart with instanceof.

export class UnsafeIdError extends ApiError {
  constructor(id: string) {
    super("invalid_id", `"${id}" is not a valid scene id — letters, digits, hyphen and underscore only`);
    this.name = "UnsafeIdError";
  }
}

export class StalePreconditionError extends ApiError {
  readonly id: string;
  /** The file's `mtimeMs` now, sent back as `mtime` so the client can say which version won. */
  readonly current: number;

  constructor(id: string, current: number) {
    super("stale", `Scene "${id}" has changed on disk since you read it`, { mtime: current });
    this.name = "StalePreconditionError";
    this.id = id;
    this.current = current;
  }
}

export class SceneNotFoundError extends ApiError {
  constructor(id: string) {
    super("not_found", `No scene "${id}"`);
    this.name = "SceneNotFoundError";
  }
}
