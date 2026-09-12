# Task 30 — A document can ask for more geometry than any machine has

## Context

From the 2026-09-12 audit, round 2.

**These documents are AI-authored.** A misplaced exponent is not an exotic
adversarial case here; it is the expected failure. And there is currently nothing
between a bad number and the GPU.

**1 — The only volume guard cannot refuse a document.**
`packages/schema/src/lint/rules/context.ts:55` — `scatter-density-is-sane` fires
at `severity: "warning"`. `loadScene` only refuses on **errors**, so:

```json
{ "id": "bed", "assets": ["oak"], "density": 1e9,
  "area": [[0,0],[0,100],[100,100],[100,0]] }
```

parses, lints with a warning, and `PUT /api/scenes/:id` persists it as a
legitimate authored scene. `ScatterField.density` is
`z.number().finite().positive()` — no maximum.

When that scene is opened, `packages/geometry/src/context/scatter.ts:36` computes
`maxAttempts = target * 40 + 1000`. **The bound scales with the number it is
meant to limit** — roughly 4e11 attempts — and the tab dies.

**2 — Coordinates are unbounded, and at large magnitudes the row lattice stops
advancing.** `PlanSchema` is `z.tuple([z.number(), z.number()])`. Zod rejects
NaN/Infinity but accepts `1e15`. A row-arranged scatter field around
`[1e15, 1e15]` with `rowSpacing: [0.001, 0.001]` reaches
`for (let z = b.minZ + across / 2; z <= b.maxZ; z += across)` where
`1e15 + 0.001 === 1e15` in float64 — **the loop variable never advances and the
loop never terminates**. Not slow: infinite, with no allocation and no error.

## Files you OWN

- `packages/schema/src/document.ts` — bounds on the fields that need them
- `packages/schema/src/lint/rules/context.ts` — the severity
- `packages/geometry/src/context/scatter.ts` — the sampling bounds
- The corresponding tests

## Files you must NOT touch

- `scenes/` — the three bundled scenes are all well within any sane ceiling. If a
  new bound rejects one of them, the bound is wrong; say so rather than editing
  the scene.

## What to do

1. **Decide what "too big" means, once, and write it down.** There is already a
   `maxScatterInstances` budget option — the question is whether exceeding it is
   a warning or an error. Given that the linter's stated job is that an invalid
   document is never written, and that this is the only guard on geometry volume,
   it should be an **error** above some hard multiple of the budget while staying
   a warning in the band between "more than budgeted" and "absurd". Record the
   reasoning in `decisions-scene.md`; this is a real trade-off, not an obvious call.
2. **Bound the schema where a bound is meaningful** — a maximum `density`, and a
   plan-coordinate magnitude limit. A site is a place, not the solar system;
   ±100 km is already generous and rules out the float64 failure entirely.
3. **Make the sampler's own bound absolute, not relative.** `target * 40 + 1000`
   must not be the only thing standing between a bad document and a dead tab.
4. **Make the row loop advance by construction** — iterate an integer count
   computed up front rather than accumulating a float. That removes the
   non-termination regardless of what the schema allows.
5. **Test the infinite loop specifically**, with a timeout, so it can never come
   back.

## Acceptance

- A document with an absurd density is an **error** and cannot be saved.
- The row lattice terminates for any coordinate the schema admits.
- The three bundled scenes are unaffected.
- `npm run check` exits 0.
