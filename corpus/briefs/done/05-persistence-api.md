# Task 05 — Fastify persistence API

## Context

"A small fastify api for saving the progress." Small is the operative word:
[decisions.md](../../wiki/decisions.md) settled that **scene files are truth and
SQLite is a derived index**, so this service reads and writes JSON files and keeps
a rebuildable cache beside them. It stores nothing authoritative.

The property that matters: scene files are hand-edited outside the app as a matter
of routine. The index must therefore be reconstructible by rescanning, and the API
must notice a file that changed underneath it.

## Files you OWN

- `apps/api/**`
- root `package.json` (workspace + scripts)

## Files you must NOT touch

- `packages/schema/**` — validation lives there and is already correct. This app
  calls `loadScene`; it does not re-implement any of it.

## What to do

1. New workspace `@solstice/api`, pinned `fastify@5.12.3`, `@fastify/cors@11.3.0`.
2. Routes — seven, no more:
   `GET /api/health`, `GET /api/scenes`, `GET /api/scenes/:id`,
   `POST /api/scenes`, `PUT /api/scenes/:id`, `DELETE /api/scenes/:id`,
   `POST /api/reindex`.
3. **Never write an invalid document.** Every write goes through `loadScene`
   (parse → lint → throw). A document with errors returns 422 and the findings,
   and the file on disk is untouched.
4. The index is derived. Rebuild it by scanning the scenes directory; a scene file
   changed out of band must be picked up.
5. Reject any id that is not a plain slug. The id becomes a filename, so path
   traversal is a live concern, not a theoretical one.

## Acceptance

- `npm run check` passes with the new workspace.
- Route tests via `fastify.inject()` — no network, no port binding.
- A test proves an invalid `PUT` leaves the file byte-identical.
- A test proves `POST /api/reindex` picks up a file written behind the API's back.
- A test proves `../` in an id is rejected.

---

## Outcome — 2026-09-11

Shipped. Seven routes, 28 new tests via `fastify.inject()` (121 across the repo),
verified live as well as in tests.

**`node:sqlite` instead of `better-sqlite3`.** The index is derived and disposable
by design, so an experimental built-in on a rebuildable cache is a fair trade for
zero native dependencies — nothing to compile on a VPS, nothing to keep pinned.
It prints an `ExperimentalWarning`; that is the whole cost.

**One error type reaches the routes.** `loadScene` previously let Zod's own error
escape on a malformed payload, so "not a scene at all" returned 500 instead of
422. It now converts shape failures into findings and throws
`SceneValidationError` like everything else — a route handler should not have to
know Zod exists.

**`estimateScatterInstances` is now shared.** The lint rule that guards the
triangle budget and the API's scene summary were computing instance counts
separately, and the API's version was wrong — it rounded density rather than
estimating instances, reporting 2 trees instead of 284. One function, one answer,
tested against the reference scene's 284.

Verified live: a valid `PUT` writes 9 523 bytes; a `PUT` that breaks the 250 mm
opening margin returns 422 with the finding **and leaves the file byte-identical**;
`../` in an id returns 400; and `POST /api/reindex` picks up a scene written
behind the API's back, which is the property the whole files-are-truth design
rests on.

`Save` in the web app now writes through the API and falls back to downloading the
canonical file when the API is not running — the common case while working on the
viewport alone.

Deferred: no auth (settled); no websocket push, so two browsers editing one scene
will overwrite each other; `@fastify/static` is not wired because the client is
served by Vite in dev and will be served by Caddy in production.
