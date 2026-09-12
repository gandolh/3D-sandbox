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

---

## Outcome — 2026-09-12

**1 — `.part`, then `mv`.** Both generated scripts route every download through
one shared `fetch_one` helper. An interrupted transfer now leaves a `.part`
that the existence check ignores, so the next run retries instead of skipping
forever.

Worth stating why `curl -f` was never enough: it guards against an HTTP error
*response*, not against a connection dropping mid-body. The two failures look
nothing alike and only one of them was handled.

**2 — Verified against the source's own size.** Poly Haven reports one and
ambientCG does too. A file that arrives the wrong length is **deleted** rather
than kept, so the next run retries rather than inheriting the corruption; a
file already on disk at the wrong length is refetched rather than skipped.

**3 — ambientCG sizes were there all along.** The API returns `size` on every
zip entry — 3 657 575 for `Concrete034` at 1K — and `resolveAmbientCg` never
read it, hardcoding `bytes: 0`. `totalBytes` was therefore 0, which is always
`<= HEAVY_BYTES`, so **the heavy-asset split was not running for one entire
source**. Now read:

| asset | before | after |
|---|---|---|
| `ambientcg/Asphalt026A` | — | **32.2 MB** |
| `ambientcg/Concrete034` | — | **10.1 MB** |
| `ambientcg/Gravel023` | — | **29.9 MB** |

None of the three crosses the 50 MB threshold, so nothing about the shipped set
moves between the two scripts. The mechanism is running, which is what was
broken.

**And "—" is gone.** An unknown size now prints **"size unknown"** in bold. A
dash reads as *small*; that is precisely how a whole source sat outside the
split unnoticed. If that string ever appears, a resolver has stopped reporting
sizes and the split has stopped protecting that source — which is now a
sentence rather than a silence.

**4 — `npm run assets` sweeps what is already on disk.** Nothing else looks:
`download.sh` skips a file that exists and `assets/manifest.ts` checks a file is
*present*, never that it is valid. Two suspicions — a length that disagrees with
the source, and anything under 512 bytes (the shape of a saved error page, which
this project has shipped once). Reported only; deleting someone's assets is not
this script's call.

Demonstrated by truncating a real 1 621 557-byte texture to 300 bytes:

```
! polyhaven/clay_plaster/clay_plaster_diff_2k.jpg — 300 bytes on disk,
  source says 1621557 — delete it and re-run download.sh
  1 file(s) on disk look wrong. A file that exists is never re-fetched, and
  nothing downstream checks it is valid.
```

The file was restored afterwards and verified at its original size.

**Tested as shell, because that is what it is.** `assets/test/download-script.test.ts`
lifts the real `fetch_one` text out of the *generated* `download.sh` and runs it
against `file://` URLs — so the test exercises the shipped helper rather than a
copy of it. Eight tests: fresh download, complete file left alone, **truncated
file refetched** (the brief's acceptance criterion, run rather than argued),
implausibly-small file refetched, a mismatched download refused with **nothing
left behind**, a stale `.part` ignored, plus two that read the generated
artefacts — no `curl -o "$target"` may reappear in either script, and no row in
`DOWNLOADS.md` may carry a dash or an unknown size.

That last pair matters more than it looks: a single direct `curl` slipping back
in for one asset would restore the bug quietly, for that asset only.

**Nothing in `assets-src/` was changed** beyond the deliberate truncate-and-
restore above, and the heavy/light policy is untouched — this brief made the
mechanism work, it did not change what the mechanism decides.

`npm run check` clean, **389 tests** (was 381).
