# Task 07: The server in the house code structure

**Depends on:**

- In 3D-sandbox: brief 05, for the gate, `n/no-process-env` and `.claude/rules/server.md`. It does not depend on brief 06 and may run before it, but never at the same time.
- In the owner's skills library:
  - brief 03, *A code-structure skill for the Fastify + React apps*: rules 1-11, the `server-skeleton.md` and `zod-type-provider.md` references, `check-structure.mjs`, and the dependency-cruiser and knip presets;
  - brief 16, *The Fastify servers adopt the code structure*: the method and the order of steps;
  - brief 15, *Enforce the base-ui and code-structure skills in every repo*: `check-structure` runs `--warn-only` until this brief is done.
- The owner's grilling of 2026-11-10: Q1 (how services start: every service runs from a container's `CMD`; **it does not apply here**, see below) and Q4 (no pull requests).

**Before you start:** run `brief-board guide` ([corpus/CLAUDE.md](../../CLAUDE.md)).

## Context

The skills library's structure is `server.ts` (listen), `app.ts` (build), `config.ts` (the one env reader), `plugins/`, `features/<name>/` and `lib/`. `apps/api` is close: it is one small Fastify 5.12.7 service of **seven routes** over scene files, and it is **not deployed**. The estate's deploy repo ships Solstice's client only, because "published, it would be an unauthenticated writer" (that repo's decision of 2026-10-01). Exposing the API means putting the estate's auth service in front of it, which is a separate brief. So:

- **There is no Dockerfile** (`find . -name 'Dockerfile*' -not -path './node_modules/*'` finds none) and no container `CMD` to update.
- **Production hardening is not needed while it is undeployed:** `trustProxy`, `close-with-grace`, explicit timeouts and a rate-limited 404. The service binds `127.0.0.1` by default and is unauthenticated by decision. Each is recorded as "when it is exposed" in step 6, not built.

What is left is the layout, the error plugin (with one real bug), route schemas, and the config.

### What `apps/api` is today (read 2026-11-10)

| File | Lines | Role |
|---|---|---|
| `apps/api/src/app.ts` | 209 | `buildApp(overrides)` (line 28): config, the index, `Fastify({ logger: false })` (33), `@fastify/cors` (50), `setErrorHandler` (52-77), and **all seven routes inline**: `GET /api/health` (80), `GET /api/scenes` (90), `GET /api/scenes/:id` (105), `POST /api/scenes` (137), `PUT /api/scenes/:id` (166), `DELETE /api/scenes/:id` (189), `POST /api/reindex` (200); `onClose` (205) |
| `apps/api/src/server.ts` | 13 | the entry: `buildApp`, `listen`, three `console.log` lines (7-9) |
| `apps/api/src/index.ts` | 4 | a barrel: `export *` from `app`, `config` and both stores |
| `apps/api/src/config.ts` | 42 | `loadConfig(overrides)`: five `process.env` reads (lines 24, 26, 27, 28, 30) |
| `apps/api/src/store/files.ts` | 213 | the file store, and the four error classes (`UnsafeIdError` 8, `StalePreconditionError` 15, `SceneNotFoundError` 30) |
| `apps/api/src/store/index-db.ts` | 149 | `SceneIndex` on `node:sqlite`, and `summarize` (126) |
| `apps/api/test/api.test.ts`, `builder-names.test.ts` | 398, 28 | 42 tests through `app.inject()` |

**Three entry files become two.**

- `apps/api/package.json` points `exports["."]` at `./dist/index.js`, but nothing imports `@solstice/api`. Command: `grep -rn "@solstice/api" --include=*.ts --include=*.tsx --include=*.json . | grep -v node_modules | grep -v package-lock` finds only `package.json:22` (`npm run dev --workspace @solstice/api`) and the package's own name.
- `start` already runs `dist/server.js`, and so does `dev`. So `index.ts` is dead: step 1 deletes it and drops `exports`. `app.ts` builds the app and `server.ts` starts it, which is what the skills library asks.
- The tests import `../src/app.js` directly (`apps/api/test/api.test.ts:7`), so they are unaffected.

### The facts the Round 8 page lists, checked here (2026-11-10)

- **Fastify's own 4xx answer 500. Confirmed.** On a scratch copy of the built app, with `app.inject()`: an empty body with `content-type: application/json`, malformed JSON (`{{{`), and a 1.1 MB body each answered **`500 {"error":"internal"}`**. The error handler (`apps/api/src/app.ts:52-77`) has no `statusCode` branch, and its `SyntaxError` branch (66-68) never fires for a parser failure, because Fastify wraps those as `FastifyError` with a `statusCode` of 400 or 413. The fix is the one branch in the error plugin (step 2). An unknown route answers `404 {"message","error","statusCode"}`, which is Fastify's own shape, not this API's `{ error, message }`.
- **500s are not logged.** `Fastify({ logger: false })` makes `app.log.error(error)` (line 75) a no-op, so the comment "Logged in full" is not true in the running server. Step 2 gives `server.ts` a logger and keeps tests silent.
- **The zod type provider and `.transform()`.** `grep -rnE "\.transform\(|preprocess|\.refine\(|superRefine|\.pipe\(|codec" packages/schema/src` finds **0**, so `SceneDocument` (`packages/schema/src/document.ts:441`) can be a response schema. **Spike, 2026-11-10:** with `@fastify/type-provider-zod` 1.0.3 and `serializerCompiler`, the three scenes serialised through `response: { 200: SceneDocument }` came out **byte-identical** to `JSON.stringify` of the loaded document (greenhollow 17,306 bytes, 20 ms cold; elmsgate 8,108; villa-carpathia 4,640).
- **zod resolves once**, 4.6.2 (`package-lock.json:3329`; `packages/schema/package.json:20`), and the provider needs `>=4.2.0`. No zod move. `apps/api/package.json` does not list `zod` itself, only `@solstice/schema` does; the new schema file imports it, so add it, pinned to 4.6.2.
- **The provider's peers.** It requires `@fastify/swagger >=9.5.1` and `openapi-types ^12.1.3` (`npm view @fastify/type-provider-zod@1.0.3 peerDependencies`). Pin both; the install added 5 packages in the spike.
- **A declared status becomes a 500** if the handler does not send it itself. Here, `POST` sends 409 `exists` itself (`app.ts:141`) and `PUT` sends 400 `invalid_precondition` itself (172). The other 4xx replies come from thrown errors through the error handler. Declare only 200, 201 and those two.
- **A schema stricter than the handler breaks the client.** `POST` and `PUT` bodies stay `z.unknown()`: validation is `loadScene` in the file store, and it answers `422 { error: "invalid_document", findings }`, which `apps/web/src/lib/api.ts:92-95` and the CLI read. A strict body schema would turn that into a 400 with a different shape. The `:id` param is `z.string()`: `UnsafeIdError` (a 400 `invalid_id`) stays in the store.
- **Env loaders fail quietly.** `config.ts:26-27` falls back silently, and `PORT=abc` becomes `NaN`. `SOLSTICE_ALLOWED_ORIGINS=""` splits to `[""]`, filters to `[]`, and `??` does not fall back to the defaults (`config.ts:30-37`), so every browser call fails CORS with no message. The config step validates and fails loudly.
- **`.parse(request.` and hand parsing:** 0 sites. The handlers cast (`request.body as { id?: unknown }`, `app.ts:138`). Command: `grep -rn "\.parse(\|safeParse(" apps/api/src`.
- **`npm test` on a fresh clone:** fixed by brief 05's `pretest`.
- **Import-time config:** not present. `loadConfig` is a function (`config.ts:20`).
- **Layered modules breaking the feature rule:** one feature only, so there is nothing to cross.
- **Workspace names differ.** The server is `apps/api`, and the shared contract is `packages/schema`, not `server/` and `shared/`. The rules and the checker take these as roots.
- **`connectionTimeout`, long polls, uploads:** none here. Bodies are scene documents, at most 49 KB on disk (`ls -l scenes/*.scene.json`), under Fastify's 1 MiB default.

## Owner decisions

Q23-Q25, Q43, Q54-Q56 were decided on 2026-11-10 (the owner confirmed the controller's technical calls). The checkers read this repo's roots from `scripts/conventions.json`. Only decision 8 is still a default.

1. **Feature folder** (Q23, decided 2026-11-10). Default: `apps/api/src/features/scenes/` for the seven scene routes and the stores, and `features/health/` for the health route.
2. **Plugin options and explicit registration** (Q24, decided).  `app.ts` imports each feature and registers it by name with the config and the index as typed options.
3. **Response schemas everywhere** (Q25, decided), through `@fastify/type-provider-zod` 1.0.3. Default: yes, with the exceptions in "The facts" (bodies stay `z.unknown()`).
4. **The store** (Q54, decided: keep it whole). `files.ts` and `index-db.ts` move into the feature unchanged, and neither is split.
5. **One `ApiError` class** (Q56, decided 2026-11-10). `ApiError(code, status, message)` is the base; the four named classes become subclasses, so `instanceof` in tests and the store still works. The error plugin maps `ApiError` generally. The body shape stays `{ error, message, ... }`, which the web client and the CLI parse (Q43: one handler, the repo's body shape, Fastify's own 4xx passed through, no thrown message echoed).
6. **Where the schemas live** (Q55, decided: in the feature unless the client imports them). `apps/api/src/features/scenes/schemas.ts`. `SceneDocument` stays in `packages/schema`.
7. **Tests stay in `apps/api/test/`**, the repo's convention in every package. The test runner stays Vitest (Q27).
8. **Logging.** Default: `server.ts` builds the app with pino at `warn`; tests build it silent. *New question: or leave the dev server silent, as today.*

## Files you OWN

- Everything under `apps/api/src/`, and `apps/api/package.json` (dependencies, `exports`), `apps/api/tsconfig.json`.
- `apps/api/test/` (imports only, and the new tests).
- `package-lock.json`.
- `.claude/rules/server.md` (the structure lines), `scripts/conventions.json`.
- [wiki/architecture.md](../../wiki/architecture.md) (the `apps/api` layout), [wiki/decisions.md](../../wiki/decisions.md), [wiki/status.md](../../wiki/status.md), [log.md](../../log.md).

## Files you must NOT touch

- `packages/schema` and every other package. The document schema and `loadScene` stay as they are.
- `apps/web/src/lib/api.ts` and `apps/cli`. Their reading of the API does not change: every status, `error` code and field they read today is the same afterwards.
- The scene files and the `x-scene-mtime` header protocol.

## What to do

One commit per step. After each: `npm run typecheck`, `npx vitest run apps/api` and `npm run lint` stay green, and `npm run check` is green at the end.

1. **Entries and config.**
   - Delete `apps/api/src/index.ts` and the `exports` field from `apps/api/package.json`. `grep -rn "src/index\|dist/index" apps/api` must find nothing left.
   - `config.ts`: `loadConfig(overrides, env = process.env)`, parsed with zod. `PORT` an integer from 1 to 65535, `HOST` a non-empty string, `SOLSTICE_ALLOWED_ORIGINS` split and checked non-empty when set (an empty value is an error naming the variable). Failures throw with the variable name. Defaults stay as today.
   - `server.ts`: `buildApp`, `listen`, one startup line each through `console.log` (allowed, it is a CLI). Nothing else.
   - Tests: a bad `PORT`, an empty origins value, and the defaults.
2. **The error plugin.** Move the handler to `apps/api/src/plugins/errors.ts`, wrapped in `fastify-plugin`. Add `ApiError` in `apps/api/src/lib/api-error.ts` (no Fastify import) and move the four error classes, now subclasses of it, to `apps/api/src/features/scenes/errors.ts`. Keep every mapping at `app.ts:53-66` and its body. Add a branch that honours `error.statusCode` for a 4xx `FastifyError`, answering `{ error: <code>, message }`, so an empty body, malformed JSON and an oversize body answer 400, 400 and 413 instead of 500. Add a not-found handler that answers `404 { error: "not_found", message }`. Add a logger option to `buildApp` (decision 8) so the `app.log.error` at the 500 branch logs. Tests: the three Fastify 4xx cases above, the unknown route, and the existing "keeps a 500's detail out of the response" (`api.test.ts:247`).
3. **Move the routes into the feature.** `apps/api/src/features/scenes/routes.ts` holds the six scene routes and the `onDisk` helper; `features/health/routes.ts` holds the health route; `store/files.ts` and `store/index-db.ts` move to `features/scenes/files.ts` and `index-db.ts` with `git mv`. `app.ts` keeps `buildApp`: config, index, `Fastify`, the plugins (CORS, errors), the features, `onClose`. No handler's body changes in this commit. The CORS plugin and its long comment (`app.ts:36-50`) move to `plugins/cors.ts`, wrapped in `fastify-plugin`. Tests must pass unchanged but for import paths.
4. **Route schemas, one route per commit**, in the order health, list, `GET :id`, `POST`, `PUT`, `DELETE`, reindex. Add the three dependencies, pinned (`@fastify/type-provider-zod` 1.0.3, `fastify-plugin` 6.0.1, `zod` 4.6.2, and the two peers), and set `setValidatorCompiler` and `setSerializerCompiler` once in `app.ts`. Each route declares `params` (`z.object({ id: z.string() })`), the `x-scene-mtime` header where it reads one, and `response` for 200 or 201 (plus the two statuses a handler sends itself). `GET :id` and `POST` use `SceneDocument`. Before each conversion, compare the old and new JSON for that route on all three scenes: **the bytes must be identical**, and a difference means the schema is wrong, not the test.
5. **Dependencies and checks.** Add dependency-cruiser and knip presets from the skills library (or the local copies), with these roots: server `apps/api/src`, contract `packages/schema`. `check-structure` runs with the roots mapped and, once clean, without `--warn-only`.
6. **Corpus.** Record in [wiki/decisions.md](../../wiki/decisions.md) ("The API in the house structure") what moved, what was **not** adopted and why: `close-with-grace`, `trustProxy`, explicit timeouts and a rate-limited 404 wait for the day the API is exposed behind the estate's auth service. Update [wiki/architecture.md](../../wiki/architecture.md), [wiki/status.md](../../wiki/status.md) and [log.md](../../log.md), and add the structure lines to `.claude/rules/server.md`. Run `bash corpus/lint.sh` until it is clean.

## Acceptance

- [ ] `ls apps/api/src` lists `app.ts`, `server.ts`, `config.ts`, `plugins/` and `features/`, and no `index.ts` or `store/`.
- [ ] `grep -rn "process.env" apps/api/src` finds only `config.ts`, and `grep -rn "listen(" apps/api/src` finds only `server.ts`.
- [ ] `npx vitest run apps/api` passes, with new tests for the config failures, the three Fastify 4xx answers (400, 400, 413), and the 404 body.
- [ ] Every route in `apps/api/src/features/*/routes.ts` has a `schema`: `grep -c "schema:" apps/api/src/features/*/routes.ts` shows one per route.
- [ ] A test builds the app, reads each of the three scenes through `GET /api/scenes/:id`, and compares the body to `JSON.stringify` of the loaded document, byte for byte.
- [ ] `npm run check` passes, with `check-structure` run without `--warn-only`, and `npm run scenes && git diff --exit-code -- scenes` prints nothing.
- [ ] `node apps/api/dist/server.js` starts after `npm run build`, answers `GET /api/health` with `{"ok":true,...}`, and `npm run api` still works.
- [ ] `bash corpus/lint.sh` ends clean.

## Interplay

- Brief 05's `no-process-env` is already an error on `apps/api/src`; this brief leaves it clean.
- Brief 06 does not touch `apps/api`. `apps/web/src/lib/api.ts` is the API's one browser client and depends on the codes this brief keeps.
- If the API is ever exposed, a new brief owns the container, the auth service in front, and the hardening this one defers.

## Owner questions this brief raises

- Does the dev server get a logger (decision 8), or stay silent?
- Should the unknown-route body change from Fastify's own shape to `{ error, message }`? It changes what a mistyped URL returns, and nothing in the repo reads it.
