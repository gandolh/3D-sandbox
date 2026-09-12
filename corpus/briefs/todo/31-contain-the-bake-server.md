# Task 31 — The bake server writes anywhere on disk

## Context

From the 2026-09-12 audit, round 2.

`assets/bake/serve.ts:77`:

```ts
const asset = String(form.get("asset"));
const outDir = join(assetsRoot, dirname(asset), "impostor");
await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "atlas.png"), ...);
await writeFile(join(outDir, "impostor.json"), `${meta}\n`);
```

`asset` comes straight from the request with **no containment check**. With
`asset = "../../../../../../home/<user>/.config/autostart/x.gltf"`, `join`
resolves outside the asset root, `mkdir -p` creates the path, and both files are
written — `impostor.json` with fully attacker-controlled content.

It only matters while the bake server is running (`node assets/bake/serve.ts`,
port 5199, no auth), which is a deliberate manual step. But a multipart POST
needs no CORS preflight, so any page open in any tab can reach it, and the
procedure in `corpus/wiki/assets.md` has you leave it running while a bake
completes.

**The fix already exists twelve files away.** `apps/web/vite.config.ts:70` does
exactly the right thing for the same class of input:

```ts
const rel = normalize(decodeURIComponent(...));
const file = join(root, rel);
// Never serve outside the asset root, whatever the request says.
if (!file.startsWith(root)) { res.statusCode = 403; res.end(); return; }
```

The bake server is the one place that both writes *and* skips this.

While in here, the same file's static handler (`serve.ts:42`) tests
`startsWith(assetsRoot)` without a trailing separator, so a sibling directory
named `assets-src-evil` would satisfy it. Not reachable by URL today, but it is
the same check done loosely and should be tightened in the same pass.

## Files you OWN

- `assets/bake/serve.ts`

## Files you must NOT touch

- `apps/web/vite.config.ts` — it is already correct and is the model to copy.

## What to do

1. **Contain the write path.** Resolve, then verify the result is inside
   `assetsRoot` **with a trailing separator**, and refuse with 400 otherwise.
2. **Validate `asset` positively rather than only rejecting traversal** — it
   should look like a manifest id (`<source>/<slug>`), so match it against that
   shape and reject anything else. A positive rule survives an encoding trick
   that a negative one misses.
3. **Tighten the static handler's prefix test** in the same pass.
4. **Bind to `127.0.0.1` explicitly** if it is not already, so the bake server is
   never reachable off the machine.
5. **Test the traversal**: a POST with `../` in `asset` must write nothing and
   return 400.

## Acceptance

- A traversing `asset` writes no file anywhere and is refused.
- A normal bake still works end to end.
- `npm run check` exits 0.
