# Task 26 — The production build ships 11.2 MB of source maps

## Context

From the 2026-09-12 audit.

`apps/web/vite.config.ts:112` sets `build: { target: "es2023", sourcemap: true }`.
The result, measured on a clean build:

```
index-*.js              4,256,854 B
index-*.js.map          9,263,564 B
generateMeshBVH.worker-*.js       162,680 B
generateMeshBVH.worker-*.js.map 2,009,758 B
```

**11.2 MB of maps against a 4.3 MB bundle.** The deploy rsyncs `apps/web/dist`
wholesale, so every release pushes and publicly serves them.

Two costs. The obvious one is transfer and disk on a shared VPS. The subtler one
is that the maps expose the full unminified source of every workspace package,
which may be entirely fine for this project — it is a portfolio piece and the
repo is public — but it should be a **decision**, not a default nobody chose.

`tsconfig.base.json` separately sets `sourceMap: true` and `declarationMap: true`
for the packages. Those serve `tsc --build` and local debugging and are a
different question; this brief is about what reaches `dist`.

## Files you OWN

- `apps/web/vite.config.ts`

## Files you must NOT touch

- `tsconfig.base.json` — package-level source maps serve local debugging.
- Anything in the `vps-deploy` estate. The deploy is operated outside this repo.

## What to do

1. **Decide, and write the decision down.** Either maps stay (and the reason goes
   in a comment beside the flag — "the source is public anyway and a stack trace
   from the deployed build is worth more than the bytes"), or they go. Do not
   leave it as an unexamined `true`.
2. If they go, prefer `sourcemap: false` for the production build while keeping
   dev maps, which Vite gives you for free.
3. **Record the resulting `dist` size** in the outcome note.

## Acceptance

- The flag carries a comment saying which way it was decided and why.
- `npm run check` exits 0 and `npm run build:web` still produces a working client.

---

## Outcome — 2026-09-12

They go. `sourcemap: false` for the production build, with the reasoning beside
the flag rather than left as an unexamined literal.

**Not a secrecy argument** — the repo is the user's own and the source is not a
secret. A bytes argument: 11.2 MB of maps against a 4.3 MB bundle, nearly three
times the app, for a deployment that is a static folder on a VPS with no error
reporting to consume them. Nobody would ever read one.

The comment names the condition that would change the answer: if error
reporting ever lands, the right setting is `"hidden"` — maps generated and
uploaded to the reporter, not served beside the bundle — rather than back to
`true`. Dev keeps its maps; Vite serves those regardless of the flag.

**Measured:** `apps/web/dist` 15.5 MB → **4.3 MB**. The JS bundle is unchanged at
4,260 kB (1,487 kB gzipped) — brief 25 is the one that moves that number.
