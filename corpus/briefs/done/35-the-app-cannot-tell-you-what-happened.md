# Task 35 — The app reports what it did in text nobody can read

## Context

From the 2026-09-12 audit, round 2. Four defects that share one consequence: the
application's own feedback does not reach the person using it.

**1 — The status line fails contrast, in both themes.** `--color-subtle` is
`#5f666e` (dark) and `#8b8f95` (light). Computed against `--color-chrome`:

| theme | contrast | WCAG AA for body text |
|---|---|---|
| dark (`#111316`) | **3.20 : 1** | 4.5 : 1 |
| light (`#edebe7`) | **2.73 : 1** | 4.5 : 1 |

`text-subtle` is used for the app's own status line (`App.tsx:98`), the
Inspector's empty state (`Inspector.tsx:28`), opening-kind labels, badges and
axis labels — 15 call sites. The single place the app tells you what happened is
below the legibility floor, and the light theme is worse than the dark one.

**2 — Nothing is announced.** There is **no `aria-live` or `role="status"`
anywhere** in `apps/web/src/ui`, `App.tsx` or `store.ts` — confirmed by grep. The
status string changes asynchronously for saves, drops, scene loads, parse
failures and every step of a render queue; `RenderOverlay` counts "Shot 2 / 4"
and "Rendered 3 of 4". A screen-reader user is told none of it.

**3 — Lint severity is colour only.** `Inspector.tsx:51` distinguishes an error
from a warning purely by `text-danger` vs `text-warn`. The rule name and message
are text; the severity — the part that says whether the document is *broken* or
merely *suspect* — is not. The footer counts do use text; the per-finding list a
user actually acts on does not.

**4 — A failed scene looks exactly like an empty selection.** When a scene fails
to parse, `App.tsx:26` sets a status and leaves `doc` null. `Inspector.tsx:27`
then renders "Select something in the viewport or the tree." — the ordinary
empty-state message. The user is invited to select something in a scene that
never loaded, and the only contradicting signal is the status line from defect 1.

## Files you OWN

- `apps/web/src/styles.css`
- `apps/web/src/App.tsx`
- `apps/web/src/ui/Inspector.tsx`
- `apps/web/src/ui/RenderOverlay.tsx`

## Files you must NOT touch

- The **Darkroom** visual direction is a locked decision — near-black chrome,
  hairline separation, sun-amber accent. This brief fixes the execution, not the
  direction. Do not lighten the ground or change the accent hue.

## What to do

1. **Raise `--color-subtle` in both themes until it clears 4.5:1** against
   `--color-chrome` and `--color-panel`, and state the measured ratios in a
   comment beside the tokens so the next change can be checked. If a genuinely
   de-emphasised tone is wanted for non-text ornament, keep it as a separate
   token and stop using it for text.
2. **Give the status line and the render overlay a live region.** Status is
   polite; a render failure should be assertive.
3. **Put the severity in text** — a short label or an icon with a text
   alternative, not only a colour.
4. **Distinguish "nothing selected" from "no document".** They are different
   states and the second one needs to say what went wrong and what to do.
5. **Check the result at 200% zoom and in both themes** before calling it done.

## Acceptance

- Every `text-subtle` use on real text clears 4.5:1 in both themes, with the
  ratios recorded.
- A save, a drop, a render step and a parse failure are each announced.
- An error and a warning are distinguishable without colour.
- `npm run check` exits 0.

---

## Outcome — 2026-09-12

**1 — Contrast, measured before and after.** `--color-subtle` is the app's own
status line, the Inspector's empty state, every opening-kind label, badge and
axis label — and it was the least legible text in the interface.

| theme | ground | before | after |
|---|---|---|---|
| dark | `--color-chrome` | **3.20** | **4.99** |
| dark | `--color-panel` | **3.06** | **4.76** |
| light | `--color-chrome` | **2.73** | **4.71** |
| light | `--color-panel` | **2.99** | **5.15** |

`#5f666e` → `#7e858d` (dark), `#8b8f95` → `#64686e` (light). Chosen with
headroom rather than landing on 4.50 exactly, and still quieter than
`--color-muted` in both themes, so the palette's hierarchy survives the fix.

**The brief's conditional turned out to be necessary**: a tone quiet enough to
read as ornament cannot also be legible body text. So `--color-faint` carries
the old values for non-text use — currently the scrollbar thumb, the one of the
seventeen call sites that was not text — and `--color-subtle` is now a text
tone. Both are asserted.

**Guarded by a test, not by the comment.** `apps/web/test/contrast.test.ts`
parses `styles.css`, computes the WCAG ratios, and asserts every text token
clears 4.5:1 on both grounds in both themes. It also asserts `faint` is
*below* the floor — so the split stays deliberate rather than drifting back
into one token — and that no `.tsx` uses `text-faint`. This project has found a
comment disagreeing with the thing it describes four times now; the measured
ratios are in the stylesheet beside the tokens, and the test is what keeps them
true.

**2 — Two live regions, two politenesses.** The store gained an `alert` channel
beside `status`, because they map onto exactly that distinction: `status` is
`role="status"` / `aria-live="polite"` and waits its turn, which is right for
"12 model(s) loaded" and wrong for "Render failed" after forty minutes of GPU.
`setAlert` is used for a failed render, a failed write and an abandoned queue;
`setStatus` clears any standing alert.

Both render in the **same footer slot**, so the sighted reading and the
announced one are one sentence rather than a screen-reader-only channel saying
something the screen does not.

The render overlay announces **milestones, not samples**: its numbers change
many times a second, and a live region carrying them would read the sample
counter aloud continuously and be switched off. The announcement is built from
the phase and the queue position — "Shot 2 of 4, path tracing" — so it is a
handful of strings over an hour.

**3 — Severity in words.** `Error · opening-fits-wall` / `Warning · …` on every
finding, replacing a rule name whose severity was carried only by
`text-danger` against `text-warn`. The footer counts always used text; the
per-finding list a user actually acts on did not. Verified in the browser:
`ERROR · OPENING-FITS-WALL | opening "w-f1" ends at 2.150 m but wall "W-01" is
only 0.050 m long`.

**4 — A failed scene no longer looks like an empty selection.** `loadError` in
the store, set by `App`'s two failure paths, clearing on any successful load.
The Inspector renders a `role="alert"` block naming what went wrong **and what
to do** — pick another scene, or fix the file and reload — instead of inviting
the user to select something in a scene that never loaded. `document === null`
alone could not distinguish them: it is also true for a moment on every load,
which is why there is now a separate "Loading the scene…" state.

**5 — Checked at 200 % zoom in both themes**, as the brief requires. The status
line and the timeline's axis labels — the two worst cases — are legible in both;
in the light theme, which was the worse of the two at 2.73:1, they now read
clearly. No layout broke at that zoom that was not already the case.

`npm run check` clean, **381 tests** (was 361).
