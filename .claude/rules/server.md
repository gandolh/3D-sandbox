---
paths:
  - "apps/api/src/**"
  - "packages/**"
---

# The API and the packages (`apps/api/src`, `packages/*`)

- Read the `code-structure` skill before you add or move a route, a plugin or a
  module. `apps/api/src` follows it: `server.ts` is the only file that listens;
  `app.ts` exports `buildApp(config, options)` and registers the plugins, then
  the features, by name; `plugins/` holds CORS and the error handlers, wrapped
  in `fastify-plugin`; `features/<name>/` holds a domain's routes, schemas and
  store, used through its `index.ts`, and never imports `app.ts`; `lib/` holds
  `ApiError` and never imports Fastify.
- Every route declares its schemas through `@fastify/type-provider-zod`, and a
  `response` schema for each status its handler sends itself, and no other: a
  declared status also encodes the error plugin's replies on it. Response
  schemas list keys in the order the handler builds them and hold no
  `.transform()`; a header schema is a `z.looseObject`.
- Throw `ApiError` (or a subclass) for an error the client should read; its
  code sets the status, from the table in `lib/api-error.ts`. Bodies are
  `{ error, message, ... }`, which `apps/web/src/lib/api.ts` reads.
- The scene JSON files in `scenes/` are the truth. The SQLite index in
  `apps/api/.data/` is derived and rebuildable; never read it as a source.
- Validation lives in `@solstice/schema`. Zod objects use `.prefault()`, not
  `.default()`: `.default({})` returns the literal without re-parsing, so
  nested defaults silently never apply.
- `apps/api/src/config.ts` is the only reader of the environment. Add no
  other `process.env` read; `n/no-process-env` is an error here.
- Relative imports carry the `.js` extension (NodeNext resolution), and
  every package is `"type": "module"`.
- Documents hold degrees; code holds radians. Metres, Y-up, right-handed: +X is
  east and -Z is north.
- Reach into an array with `itemAt` from `@solstice/schema`, not with a `!`:
  the compiler runs `noUncheckedIndexedAccess`, and `!` is an error in source.
- `npm run scenes` must leave `scenes/*.scene.json` byte-identical, and
  `planSvg` output must not change
  (`packages/drawing/test/plan-unchanged.test.ts`).
- `npm run check:conventions` runs `check-structure` strict over `apps/api/src`
  and `packages/schema/src`. A new route's reply must stay byte-identical to the
  one before its schema: `apps/api/test/replies.test.ts` holds that compare.
- Tests live in `apps/api/test/` and build the app with
  `buildApp(loadConfig(overrides, {}))`: an empty environment, no logger.
