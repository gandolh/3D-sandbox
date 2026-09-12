# Task 34 — A half-downloaded asset is permanent and silent

## Context

From the 2026-09-12 audit, round 2. This project has already shipped a corrupt
asset once — a 404 page saved as a model file — and the mechanism that allowed it
is still in place.

`assets/download-list.ts:241` generates:

```sh
[ -f "${target}" ] || curl -fsSL -o "${target}" "${url}"
```

**Existence is the only check, and `-o` writes in place.** `curl -f` guards
against an HTTP error *response*; it does nothing about a transfer cut off
mid-stream. So a dropped connection leaves a truncated `.gltf` or `.bin` on disk,
and because the file now exists, **every future run of `download.sh` skips it
forever**. The scene then loads broken geometry with no error surfaced anywhere —
`assets/manifest.ts` checks that a file is present, never that it is valid.

Zip-based ambientCG assets are incidentally protected, because `unzip -oq` fails
loudly on a truncated archive. Direct `.gltf` / `.bin` / `.jpg` downloads — most
of the set — have no such check.

**Second defect, same file.** `assets/download-list.ts:155` hardcodes
`bytes: 0` for every ambientCG download, because `resolveAmbientCg` never reads a
size from the API response. `totalBytes` therefore returns 0 for those assets,
which is always `<= HEAVY_BYTES` (50 MB), so **the heavy-asset split silently does
not apply to ambientCG at all**. That split is the mechanism keeping the 900 MB
pine tree out of the default download; for one entire source it is not running.
`DOWNLOADS.md` prints "—" for those rows rather than flagging it.

## Files you OWN

- `assets/download-list.ts`
- the generated `assets-src/download.sh` / `download-heavy.sh` (regenerated, not
  hand-edited)

## Files you must NOT touch

- `assets-src/` contents — downloaded binaries are gitignored and not ours.
- The heavy/light split policy itself. It is a locked decision that heavy assets
  are not fetched by default; this brief makes the **mechanism** work, it does not
  change the policy.

## What to do

1. **Download to a temporary name and rename on success**:
   `curl -fsSL -o "$target.part" "$url" && mv "$target.part" "$target"`. An
   interrupted transfer then leaves a `.part` that the existence check ignores,
   so the next run retries instead of skipping forever.
2. **Verify what arrived, if the source lets you.** Poly Haven's API reports a
   size; compare it after download and fail loudly on a mismatch. A checksum is
   better where one is available.
3. **Read real sizes for ambientCG** so the heavy filter applies to every source.
   If the API genuinely does not expose a size, then say so **in the generated
   `DOWNLOADS.md` as a warning**, not as a dash — an unknown size must not read
   as "small".
4. **Make `npm run assets` report anything suspicious** — a target that exists but
   is implausibly small for its type is worth a line of output.

## Acceptance

- Interrupting a download and re-running `download.sh` re-fetches that file.
- Every row in `DOWNLOADS.md` has a real size or an explicit warning.
- `npm run check` exits 0.
