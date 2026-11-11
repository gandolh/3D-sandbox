---
summary: Locked calls about apps/api's code (2026-11-11) — the house code structure it follows, what it did not adopt while it stays undeployed and why, the error body and ApiError, config parsing, and the response-schema exceptions. Read before changing a route, the error plugin or config.ts.
updated: 2026-11-11
---

# API decisions

The counterpart to [decisions.md](decisions.md) for `apps/api`. Its storage calls (scene files as truth, a
derived `node:sqlite` index) stay there. The layout is in [architecture.md](architecture.md).

## The API in the house structure

_2026-11-11_ — `apps/api` follows the estate's code-structure skill: `server.ts` listens, `app.ts` builds
(`buildApp(config, options)`), `config.ts` is the one reader of the environment, `plugins/` holds CORS and the
error handlers, `features/scenes/` and `features/health/` hold the routes, and `lib/` holds `ApiError`. Every route
declares its schemas through `@fastify/type-provider-zod`, and `check-structure` runs strict.

**What moved.** `index.ts` (a barrel nothing imported) and the package's `exports` went. The seven routes left
`app.ts` for the two features; the file store and the index moved into `features/scenes/` whole (the owner's
Q54); the CORS registration and its note moved to `plugins/cors.ts`.

**Not adopted, while the API is undeployed.** The estate's deploy ships the client only, because a published API
would be an unauthenticated writer (that repo's decision of 2026-10-01). The skill's production pieces wait for the
day the API is exposed behind the estate's auth service, in a brief of its own with the container:

- `close-with-grace`: there is no container stopping it; Ctrl-C ends a dev server.
- `trustProxy`: there is no proxy in front of it.
- explicit `connectionTimeout`, `requestTimeout` and `keepAliveTimeout`: no long poll, no upload; bodies are scene
  documents, at most 49 KB, under Fastify's 1 MiB limit.
- a rate-limited 404: there is no `@fastify/rate-limit`, and the API binds `127.0.0.1` by default.

**Errors.** One body, `{ error, message, ... }`, which `apps/web/src/lib/api.ts` parses (the CLI works on files
and never calls the API). The codes and their statuses are listed once, in `lib/api-error.ts`. The store's three errors are subclasses of `ApiError`, so
`instanceof` still works; a stale write's `mtime` rides in the class's `details`. `SceneValidationError` lives in
`@solstice/schema` and keeps its own branch: 422 `invalid_document` with `findings`, no `message`. Fastify's own
4xx keep their status (an empty or malformed JSON body 400 `bad_request`, a body over the limit 413 `too_large`;
each used to answer 500). A 500 sends a fixed message and logs the error, so a filesystem path never reaches the
client. An unknown route answers 404 `{ error: "not_found", message }` rather than Fastify's own shape.

**Logging.** `server.ts` builds the app with pino at `warn`, so the 500s it logs reach the terminal; tests build it
silent. Under the old `logger: false`, the "logged in full" 500 branch logged nothing.

**Config.** `loadConfig(overrides, env)` parses `PORT`, `HOST`, `SOLSTICE_SCENES_DIR`, `SOLSTICE_INDEX_DB` and
`SOLSTICE_ALLOWED_ORIGINS` with zod and throws a `ConfigError` naming every bad variable. An empty value counts as
unset (the skill's rule), so `SOLSTICE_ALLOWED_ORIGINS=` gives the dev origins, and a list that splits to nothing
(`" , "`) is an error: it used to turn every browser call into a silent CORS failure. The API has never read a
`.env`, so `config.ts` loads none.

**Schemas.** They live in `features/scenes/schemas.ts`, because the web client reads the replies by hand and
imports none of them (Q55). Each route declares only the statuses its handler sends itself: 200 or 201, plus
`POST`'s 409 `exists` and `PUT`'s 400 `invalid_precondition`. Those two are `{ error: string, message: string }`
with no literal code, because a declared status encodes every reply on it, the store's `invalid_id` and Fastify's
`bad_request` included. The exceptions to the skill's rules, each safe here:

- `GET :id` and `POST` reply through `SceneDocument`, a strict object (rule 6 says a response schema should not
  be). Every reply is a document `loadScene` has just parsed with that schema, so no extra key can reach it.
- `POST` and `PUT` bodies are `z.unknown()`: `loadScene` validates, and its 422 is the reply the web client reads.
  Fastify hands a body schema `null` for a missing body, so a `PUT` with no body now reads "received null" in its
  finding rather than "received undefined".
- `PUT`'s `x-scene-mtime` header schema is a loose object, because Fastify replaces `request.headers` with what
  the validator returns.

**Tests** stay in `apps/api/test/`, the repo's convention, on Vitest. `replies.test.ts` holds the byte compare: each
scene read and created through the API is `JSON.stringify` of the loaded document.
