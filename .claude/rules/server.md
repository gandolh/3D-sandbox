---
paths:
  - "apps/api/src/**"
  - "packages/**"
---

# The API and the packages (`apps/api/src`, `packages/*`)

- Read the `code-structure` skill before you add or move a route, a plugin or a
  module.
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
- `npm run check:conventions` runs `check-structure` over `apps/api/src` and
  `packages/schema/src`, as a warning until the server is restructured.
