# Task 70 — `ScatterInstance` is declared twice

## Context

From the 2026-09-20 audit. Small, and worth doing because of how it fails rather
than how often.

`packages/schema/src/derive/scatter.ts` declares the same interface twice, 150
lines apart, byte-identical — once at line 6 and again at line 156:

```ts
export interface ScatterInstance {
  asset: string;
  position: [number, number, number];
  rotationY: number;
  scale: number;
}
```

TypeScript's declaration merging makes this compile silently, which is why
`npm run check` is green and why nothing has noticed.

**The failure is a future one and it is confusing when it lands.** A reader
working in the second half of the file — after the `scatterSeed` / `MAX_INSTANCES`
section — has no reason to suspect a definition already exists above. Adding a
field to "the" interface adds it to only one declaration, and merging then
requires the **union** of both. Every consumer of `ScatterInstance` — the
geometry scatter mesh builder, the API's scene summary — is suddenly required to
supply a field the editor never meant to make universal, and the error surfaces
far from the edit. The worse variant is an *optional* field, which merges
silently and simply never gets filled at one of the two construction sites.

This file is in `derive/`, which is the shared-primitives home — the one place in
the repo where a type quietly meaning two things costs the most.

## Files you OWN

- `packages/schema/src/derive/scatter.ts`

## Files you must NOT touch

- The shape of `ScatterInstance` itself. This is a de-duplication, not a redesign
   — no consumer should need to change.
- `MAX_INSTANCES` / `MAX_ATTEMPTS` and the matching lint rule (brief 30).

## What to do

1. Delete the second declaration. Keep the one at the top of the file, where a
   reader looks for it.
2. Check whether the two halves of the file are really one module. If the second
   declaration existed because the lower half reads as a separate concern, say so
   in the outcome — a split may be the better answer, but do not do it in this
   brief without recording the reason.
3. Confirm no other type in `derive/` is declared twice. This is a cheap grep and
   the whole point is that the compiler will not tell you.

## Acceptance

- `ScatterInstance` is declared exactly once; no consumer changed.
- No other duplicated type declaration exists in `packages/schema/src/derive/`.
- `npm run check` exits 0 and the test count is unchanged.

## Outcome — 2026-10-01

Second declaration deleted; the one at the top of the file stays. No consumer
changed. The gate passes, and the test count changed only by the other briefs'
additions.

**Where it came from:** commit `1167643` (2026-09-13) moved the placement half
of `geometry/context/scatter.ts` into `derive/`, and the moved block brought its
own copy of the interface. **The halves are one module:** the estimate walks the
same lattice the generator samples, which was the whole point of that move, so
I did not split them.

Sweep: no other type, interface, class or enum is declared twice in
`packages/schema/src/derive/`.
