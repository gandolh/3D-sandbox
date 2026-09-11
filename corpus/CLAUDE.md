# Corpus conventions — Solstice

This `corpus/` is an LLM-maintained wiki. **Read `index.md` first**, then at most
**2–3 wiki pages**. Needing more is a signal a page must split, not a licence to
read more.

## Layout

- `wiki/` — the synthesis. The LLM owns this and rewrites it freely.
- `briefs/{todo,done,superseded}/` — **immutable** work specs, `NN-slug.md`.
  Numbers are stable for the life of the file; never renumber on a move.
- `todos/` — captured prose, pre-spec.
- `log.md` — chronological, newest last. Absolute dates only.
- `index.md` — generated catalog. Regenerate with `bash corpus/lint.sh --index`.

## Source-of-truth ordering

1. The **actual code** beats any wiki claim.
2. A brief in **`done/`** beats `wiki/` if the wiki hasn't caught up.
3. **`decisions.md`** beats `status.md` for choices not formally revisited.

Verify any path, symbol or command a page names before acting on it — pages drift.

## Project invariants (do not "fix" these — they are deliberate)

- **WebGL2 only.** No `three/webgpu`, no TSL. Forced by `three-gpu-pathtracer`.
- **No React Three Fiber.** React renders chrome only; the scene graph is imperative.
- **Exact version pins.** No `^` or `~` anywhere. `.npmrc` sets `save-exact=true`.
- **No `@anthropic-ai/sdk` in the app.** Authoring is a repo-time activity.
- **Scene JSON files are truth**; SQLite is a derived, rebuildable index.
- **Degrees in documents, radians internally.** Metres, Y-up, right-handed.
- **ESM everywhere**, `"type": "module"`, `.js` extensions in relative imports
  (NodeNext resolution).
- **Zod: `.prefault()`, not `.default()`, for object defaults.** `.default({})`
  returns the literal without re-parsing, so nested defaults silently never apply.

## Workflow

Capture → `todos/`. Promote → `briefs/todo/NN-slug.md`. Build → move verbatim to
`briefs/done/`, append a `log.md` entry, fold durable findings into `wiki/`.
Never commit corpus changes unless asked.
