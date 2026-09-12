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
