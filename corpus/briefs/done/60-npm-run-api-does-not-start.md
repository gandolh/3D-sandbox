# Task 60 — `npm run api` does not start

## Context

Found on 2026-09-13 while verifying brief 54, and filed separately because it
is a different defect.

The README lists it as a supported command:

```
npm run api          # the persistence API, on :5174 — optional
```

It does not work. `apps/api/package.json` has
`"dev": "node --watch src/server.ts"`, and running it gives:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  /home/.../apps/api/src/app.js
  imported from /home/.../apps/api/src/server.ts
```

`server.ts` imports `./app.js` — correct for `NodeNext`, which is what the
package compiles to — but Node's type-stripping does **not** remap a `.js`
specifier onto a neighbouring `.ts` file. It looks for `app.js` in `src/`,
where only `app.ts` exists, and gives up.

`--watch` keeps the process alive after the failure, so it *looks* like a
server that started. It never listens: `curl http://127.0.0.1:5174/api/health`
gets nothing.

`"start": "node dist/server.js"` is fine — that runs compiled output. It is
only the dev script that is broken, which is the one a person actually uses.

## Files you OWN

- `apps/api/package.json` — the `dev` script
- `README.md` — if the command's description needs to change
- `apps/api/src/server.ts` — only if the fix is on the import side

## Files you must NOT touch

- The `.js` import specifiers across the rest of the repo. They are correct for
  `NodeNext` and every compiled package depends on them.
- The decision that files are truth and the API validates on write.

## What to do

1. **Pick a dev command that actually runs**, and say why in a comment. The
   candidates, none of which is obviously right:
   - build then watch the output (`tsc --build --watch` alongside
     `node --watch dist/server.js`) — no new dependency, two processes;
   - a single watcher that rebuilds and restarts;
   - stop using `.js` specifiers in this package only, which would need
     `allowImportingTsExtensions` and changes what `tsc` emits.
2. **Prove it serves.** The acceptance is not "it starts" — `--watch` already
   appears to. It is that `/api/health` answers.
3. **Check `npm run dev` for the web app the same way** while you are here. The
   README pairs them, and nothing has verified either since brief 33.
4. **If the README's description is now wrong, fix it.** That file was
   verified against a clean clone in brief 33 and should stay true.

## Acceptance

- `npm run api` serves `/api/health` within a few seconds of starting.
- Editing a source file restarts it.
- `npm run check` exits 0.

---

## Outcome — 2026-09-13

**`dev` builds and watches the output instead of running the source.**

```
tsc --build --watch --preserveWatchOutput & node --watch --enable-source-maps dist/server.js
```

**Why not the other two candidates.** Dropping the `.js` specifiers in this
package would need `allowImportingTsExtensions`, which changes what `tsc`
emits and would break `start`, the script that actually runs in production —
paying for a dev convenience with the deployment path. And a single watcher
that rebuilds and restarts means a new dependency for something two flags
already do.

This costs two processes and no dependency. `--preserveWatchOutput` stops
`tsc` clearing the terminal on every rebuild, which would otherwise wipe the
server's own log; `--enable-source-maps` puts stack traces back on the `.ts`
line numbers, which is the one thing running compiled output would otherwise
cost.

**Verified by running it, and the acceptance was deliberately not "it
starts".** `--watch` kept the broken version alive and looking healthy while it
never listened, which is exactly how this survived. So:

| check | result |
|---|---|
| `curl /api/health` | `{"ok":true,"scenesConfigured":true,"scenes":3}` |
| edit `app.ts`, wait, curl again | the edit is live — `"restarted":true` |
| revert, curl again | back to the original response |

**`npm run dev` for the web app was checked at the same time**, since the
README pairs them and nothing had verified either since brief 33: it serves
HTTP 200 on :5173. No change needed.

The README's description was already accurate about *what* the command is for,
so it needed no edit — only the command had to start working.
