# Task 28 — Any website you visit can delete your scenes

## Context

From the 2026-09-12 audit, round 2. **This is not the locked "the API is
unauthenticated on purpose" decision** — read that distinction carefully before
dismissing it.

`apps/api/src/app.ts:31`:

```ts
await app.register(cors, { origin: true });
```

`origin: true` **reflects whatever Origin the caller sends**. Without any CORS
registration at all, the browser's own same-origin policy would block this:
a cross-origin `DELETE` is not a simple request, so it fails at preflight, and a
cross-origin `POST` cannot set `content-type: application/json` either. Adding
`origin: true` is what removes that protection.

So while the API is running on localhost, any page in any tab can:

1. `GET /api/scenes` — enumerate every scene you have.
2. `DELETE /api/scenes/<id>` for each — `deleteSceneFile` does `rm(path)` with no
   backup, on files the project declares to be **the source of truth**.
3. Or, worse because it survives a glance, `PUT` schema-valid but corrupted
   geometry over every one of them.

Two smaller leaks make that precise rather than a guess, and belong with it:

- `apps/api/src/app.ts:47` — the catch-all handler returns `error.message` to the
  client, so an `ENOENT` hands back an absolute path like
  `/home/<user>/projects/3D-sandbox/scenes/x.scene.json`.
- `/api/health` returns the absolute `config.scenesDir` with no error needed.

Both are readable cross-origin *because* of the CORS setting above.

## Files you OWN

- `apps/api/src/app.ts`
- `apps/api/test/` — coverage for the new behaviour

## Files you must NOT touch

- Do **not** add authentication. That is a locked decision and it is not the
  problem here — the problem is that the browser's default protection was
  switched off. A local-only tool does not need auth; it needs to not accept
  instructions from `evil.example`.
- `packages/schema` — nothing here is a document concern.

## What to do

1. **Restrict `origin` to the dev client.** The Vite dev server's origin is the
   only legitimate caller. Reflecting one known origin is a one-line change and
   keeps the editor working.
2. **Stop returning raw `error.message` on a 500.** Log it server-side, return a
   generic body. Keep the specific, useful errors that are already
   deliberate — `SceneValidationError` findings, `UnsafeIdError`,
   `SceneNotFoundError` — those are the API doing its job.
3. **Drop `scenesDir` from `/api/health`,** or reduce it to a boolean "configured".
4. **Test it**: a request carrying a foreign `Origin` must not receive
   `access-control-allow-origin` for it.

## Acceptance

- A cross-origin `DELETE` is refused by the browser's preflight again.
- The dev client still saves through the API.
- A 500 carries no filesystem path.
- `npm run check` exits 0.
